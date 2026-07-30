using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Miga.Application.Common.Security;

namespace Miga.Api.Middleware;

public sealed class ApiExceptionHandler : IExceptionHandler
{
    private readonly IProblemDetailsService _problemDetailsService;
    private readonly ILogger<ApiExceptionHandler> _logger;

    public ApiExceptionHandler(
        IProblemDetailsService problemDetailsService,
        ILogger<ApiExceptionHandler> logger)
    {
        _problemDetailsService = problemDetailsService;
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        // HttpContext.TraceIdentifier is derived from client-controlled inputs
        // (e.g. the W3C traceparent header) and must not reach a log sink or a
        // response body verbatim. We mint an error id fully controlled by the
        // server so support can correlate the ProblemDetails payload with the
        // structured log entry without giving the caller any influence over
        // either value.
        var errorId = Guid.NewGuid().ToString("N");

        // Never log the raw request path or method — both can contain attacker
        // controlled bytes (CR/LF, PII, secrets in query strings). We keep the
        // method as a whitelisted token, the path as a non-reversible fingerprint
        // for correlation, and the exception type as safe technical context.
        // The exception object itself is not attached to the log entry because
        // its Message may echo user-supplied bytes from parsers.
        _logger.LogError(
            "Unhandled API exception. Method={RequestMethod} PathFingerprint={RequestPathFingerprint} ExceptionType={ExceptionType} ErrorId={ErrorId}",
            LogSanitizer.SanitizeHttpMethod(httpContext.Request.Method),
            LogSanitizer.Fingerprint(httpContext.Request.Path.Value),
            exception.GetType().FullName ?? exception.GetType().Name,
            errorId);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred.",
                Extensions =
                {
                    ["code"] = "unexpected_error",
                    // Public field name kept for API compatibility, but the value
                    // is the server-generated errorId, not HttpContext.TraceIdentifier.
                    ["traceId"] = errorId
                }
            }
        });
    }
}
