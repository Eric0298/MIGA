using System.Net;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Miga.Api.Middleware;
using Miga.Api.Security;
using Miga.Infrastructure.Auth;
using Miga.Infrastructure.DependencyInjection;
using Miga.Infrastructure.Security;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
    options.Limits.MaxRequestBodySize = 6 * 1024 * 1024;
});

builder.Host.UseSerilog((context, configuration) =>
{
    configuration.ReadFrom.Configuration(context.Configuration);
});

builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions.TryAdd("traceId", context.HttpContext.TraceIdentifier);
    };
});
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.AddScoped<ApiAntiforgeryFilter>();
builder.Services
    .AddControllers(options => options.Filters.AddService<ApiAntiforgeryFilter>())
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
        options.JsonSerializerOptions.MaxDepth = 32;
    });
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var problem = new ValidationProblemDetails(context.ModelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Request validation failed."
        };
        problem.Extensions["code"] = "validation_failed";
        problem.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
        return new BadRequestObjectResult(problem);
    };
});

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.Name = builder.Environment.IsProduction()
        ? "__Host-Miga.Antiforgery"
        : "Miga.Antiforgery";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = builder.Environment.IsProduction()
        ? CookieSecurePolicy.Always
        : CookieSecurePolicy.SameAsRequest;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.Path = "/";
});

builder.Services
    .AddOptions<MigaCorsOptions>()
    .Bind(builder.Configuration.GetSection(MigaCorsOptions.SectionName))
    .Validate(options =>
    {
        if (options.AllowedOrigins.Length == 0)
        {
            return !builder.Environment.IsProduction();
        }

        return options.AllowedOrigins.All(origin =>
            Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttps ||
             (builder.Environment.IsDevelopment() &&
              uri.Scheme == Uri.UriSchemeHttp &&
              (uri.IsLoopback || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)))));
    }, "CORS origins must be explicit HTTPS origins in production.")
    .ValidateOnStart();

var allowedOrigins = builder.Configuration
    .GetSection($"{MigaCorsOptions.SectionName}:AllowedOrigins")
    .Get<string[]>() ?? [];
builder.Services.AddCors(options =>
{
    options.AddPolicy(ApiSecurityConstants.FrontendCorsPolicy, policy =>
    {
        if (allowedOrigins.Length == 0)
        {
            policy.SetIsOriginAllowed(_ => false);
            return;
        }

        policy
            .WithOrigins(allowedOrigins)
            .WithMethods("GET", "POST", "PUT", "DELETE")
            .WithHeaders("Content-Type", "Accept", "Accept-Language", "X-XSRF-TOKEN")
            .AllowCredentials()
            .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
    });
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetSlidingWindowLimiter(
            ClientKey(context),
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0
            }));

    AddFixedWindowPolicy(options, ApiSecurityConstants.LoginRatePolicy, 10, TimeSpan.FromMinutes(5));
    AddFixedWindowPolicy(options, ApiSecurityConstants.RegistrationRatePolicy, 5, TimeSpan.FromHours(1));
    AddFixedWindowPolicy(options, ApiSecurityConstants.DemoCreationRatePolicy, 5, TimeSpan.FromHours(1));
    AddFixedWindowPolicy(options, ApiSecurityConstants.RecoveryRatePolicy, 5, TimeSpan.FromHours(1));
    AddFixedWindowPolicy(
        options,
        ApiSecurityConstants.PasswordMutationRatePolicy,
        10,
        TimeSpan.FromHours(1),
        SessionOrIpKey);
    AddFixedWindowPolicy(
        options,
        ApiSecurityConstants.SnapshotWriteRatePolicy,
        30,
        TimeSpan.FromMinutes(1),
        SessionOrIpKey);
    AddFixedWindowPolicy(
        options,
        ApiSecurityConstants.YouTubeMetadataRatePolicy,
        10,
        TimeSpan.FromMinutes(1),
        SessionOrIpKey);
    AddFixedWindowPolicy(
        options,
        ApiSecurityConstants.AccountExportRatePolicy,
        5,
        TimeSpan.FromHours(1),
        SessionOrIpKey);

    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter =
                Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        }

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Too many requests."
        };
        problem.Extensions["code"] = "rate_limited";
        problem.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
        await context.HttpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
    };
});

builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

var registeredCookieName = builder.Environment.IsProduction()
    ? "__Host-Miga.Auth"
    : "Miga.Auth";
var demoCookieName = builder.Environment.IsProduction()
    ? "__Host-Miga.Demo"
    : "Miga.Demo";
builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = MigaAuthenticationConstants.DynamicScheme;
        options.DefaultChallengeScheme = MigaAuthenticationConstants.RegisteredScheme;
        options.DefaultSignInScheme = MigaAuthenticationConstants.RegisteredScheme;
    })
    .AddPolicyScheme(
        MigaAuthenticationConstants.DynamicScheme,
        MigaAuthenticationConstants.DynamicScheme,
        options =>
        {
            options.ForwardDefaultSelector = context =>
            {
                if (context.Request.Cookies.ContainsKey(registeredCookieName))
                {
                    return MigaAuthenticationConstants.RegisteredScheme;
                }

                return context.Request.Cookies.ContainsKey(demoCookieName)
                    ? MigaAuthenticationConstants.DemoScheme
                    : MigaAuthenticationConstants.RegisteredScheme;
            };
        })
    .AddCookie(MigaAuthenticationConstants.RegisteredScheme, options =>
    {
        options.Cookie.Name = registeredCookieName;
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = builder.Environment.IsProduction()
            ? CookieSecurePolicy.Always
            : CookieSecurePolicy.SameAsRequest;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.Path = "/";
        options.ExpireTimeSpan = TimeSpan.FromHours(24);
        options.SlidingExpiration = false;
        options.EventsType = typeof(RegisteredCookieEvents);
    })
    .AddCookie(MigaAuthenticationConstants.DemoScheme, options =>
    {
        options.Cookie.Name = demoCookieName;
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = builder.Environment.IsProduction()
            ? CookieSecurePolicy.Always
            : CookieSecurePolicy.SameAsRequest;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.Path = "/";
        options.ExpireTimeSpan = TimeSpan.FromHours(2);
        options.SlidingExpiration = false;
        options.EventsType = typeof(DemoCookieEvents);
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(
        MigaAuthenticationConstants.RegisteredPolicy,
        policy =>
        {
            policy.AddAuthenticationSchemes(MigaAuthenticationConstants.RegisteredScheme);
            policy.RequireAuthenticatedUser();
            policy.RequireClaim(
                MigaAuthenticationConstants.ActorTypeClaim,
                MigaAuthenticationConstants.RegisteredActor);
        });
    options.AddPolicy(
        MigaAuthenticationConstants.DemoPolicy,
        policy =>
        {
            policy.AddAuthenticationSchemes(MigaAuthenticationConstants.DemoScheme);
            policy.RequireAuthenticatedUser();
            policy.RequireClaim(
                MigaAuthenticationConstants.ActorTypeClaim,
                MigaAuthenticationConstants.DemoActor);
        });
    options.AddPolicy(
        MigaAuthenticationConstants.WorkspacePolicy,
        policy =>
        {
            policy.AddAuthenticationSchemes(
                MigaAuthenticationConstants.RegisteredScheme,
                MigaAuthenticationConstants.DemoScheme);
            policy.RequireAuthenticatedUser();
            policy.RequireAssertion(context =>
                context.User.HasClaim(
                    MigaAuthenticationConstants.ActorTypeClaim,
                    MigaAuthenticationConstants.RegisteredActor) ||
                context.User.HasClaim(
                    MigaAuthenticationConstants.ActorTypeClaim,
                    MigaAuthenticationConstants.DemoActor));
        });
});

builder.Services.AddOpenApi();

var trustedProxyAddresses = builder.Configuration
    .GetSection($"{TrustedProxyOptions.SectionName}:Addresses")
    .Get<string[]>() ?? [];
var useForwardedHeaders = trustedProxyAddresses.Length > 0;
if (useForwardedHeaders)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders =
            ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = Math.Clamp(
            builder.Configuration.GetValue<int?>(
                $"{TrustedProxyOptions.SectionName}:ForwardLimit") ?? 1,
            1,
            3);
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
        foreach (var address in trustedProxyAddresses)
        {
            if (!IPAddress.TryParse(address, out var parsedAddress))
            {
                throw new InvalidOperationException("TrustedProxies contains an invalid IP address.");
            }

            options.KnownProxies.Add(parsedAddress);
        }
    });
}

var app = builder.Build();

if (useForwardedHeaders)
{
    app.UseForwardedHeaders();
}

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseSerilogRequestLogging();
app.UseCors(ApiSecurityConstants.FrontendCorsPolicy);
app.UseAuthentication();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.Use(async (context, next) =>
{
    var contentLength = context.Request.ContentLength;
    var isSensitiveApi =
        context.Request.Path.StartsWithSegments("/api/auth") ||
        context.Request.Path.StartsWithSegments("/api/account");
    var requestTooLarge =
        contentLength > ApiSecurityConstants.SensitiveRequestBodyLimit;
    if (isSensitiveApi &&
        contentLength is null &&
        (HttpMethods.IsPost(context.Request.Method) ||
         HttpMethods.IsPut(context.Request.Method) ||
         HttpMethods.IsDelete(context.Request.Method) ||
         HttpMethods.IsPatch(context.Request.Method)))
    {
        var readLimit = ApiSecurityConstants.SensitiveRequestBodyLimit + 1;
        context.Request.EnableBuffering(
            bufferThreshold: readLimit,
            bufferLimit: readLimit);
        var buffer = new byte[readLimit];
        var totalRead = 0;
        try
        {
            while (totalRead < readLimit)
            {
                var read = await context.Request.Body.ReadAsync(
                    buffer.AsMemory(totalRead, readLimit - totalRead),
                    context.RequestAborted);
                if (read == 0)
                {
                    break;
                }

                totalRead += read;
            }

            requestTooLarge = totalRead > ApiSecurityConstants.SensitiveRequestBodyLimit;
        }
        catch (IOException)
        {
            requestTooLarge = true;
        }
        finally
        {
            if (context.Request.Body.CanSeek)
            {
                context.Request.Body.Position = 0;
            }
        }
    }

    if (isSensitiveApi && requestTooLarge)
    {
        context.Response.StatusCode = StatusCodes.Status413PayloadTooLarge;
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status413PayloadTooLarge,
            Title = "Request body too large."
        };
        problem.Extensions["code"] = "request_too_large";
        problem.Extensions["traceId"] = context.TraceIdentifier;
        await context.Response.WriteAsJsonAsync(problem, context.RequestAborted);
        return;
    }

    await next(context);
});
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();

app.Run();

static string ClientKey(HttpContext context) =>
    context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

static string SessionOrIpKey(HttpContext context)
{
    var sessionId = context.User.FindFirst(MigaAuthenticationConstants.SessionIdClaim)?.Value;
    return string.IsNullOrWhiteSpace(sessionId)
        ? $"ip:{ClientKey(context)}"
        : $"session:{sessionId}";
}

static void AddFixedWindowPolicy(
    RateLimiterOptions options,
    string policyName,
    int permitLimit,
    TimeSpan window,
    Func<HttpContext, string>? partitionKey = null)
{
    options.AddPolicy(policyName, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            (partitionKey ?? ClientKey)(context),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = window,
                QueueLimit = 0,
                AutoReplenishment = true
            }));
}

public partial class Program;
