using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Miga.Api.Middleware;
using Shouldly;

namespace Miga.IntegrationTests;

public sealed class ApiExceptionHandlerTests
{
    private const string ErrorIdShape = "^[0-9a-f]{32}$";

    [Fact]
    public async Task TryHandleAsync_ShouldNotEchoAttackerTraceIdentifier_InLogsOrResponse()
    {
        var logger = new CapturingLogger<ApiExceptionHandler>();
        var problemDetails = new CapturingProblemDetailsService();
        var handler = new ApiExceptionHandler(problemDetails, logger);

        var httpContext = new DefaultHttpContext
        {
            TraceIdentifier = "attacker\r\n[FAKE] admin=true"
        };
        httpContext.Request.Method = "POST";
        httpContext.Request.Path = "/api/x";

        var exception = new InvalidOperationException(
            "boom\r\n[FAKE] Elevation=granted with a secret token abc123");

        var handled = await handler.TryHandleAsync(httpContext, exception, CancellationToken.None);

        handled.ShouldBeTrue();

        // 3 + 5: response contains a server-generated errorId with fixed shape.
        var responseTraceId = problemDetails.LastContext!.ProblemDetails.Extensions["traceId"]
            .ShouldBeOfType<string>();
        responseTraceId.ShouldMatch(ErrorIdShape);
        responseTraceId.ShouldNotContain("attacker");
        responseTraceId.ShouldNotBe(httpContext.TraceIdentifier);

        var combined = string.Join("\n", logger.Entries);

        // 1 + 2: attacker-controlled bytes never survive into logs.
        combined.ShouldNotContain("attacker");
        combined.ShouldNotContain("[FAKE]");
        combined.ShouldNotContain('\r');

        // A single log entry per handled exception. Its own text ends with a
        // LF because ILogger emits one line per entry, so we assert LF only
        // inside individual entries.
        foreach (var entry in logger.Entries)
        {
            entry.ShouldNotContain('\r');
            entry.ShouldNotContain('\n');
        }

        // 4: the same errorId appears in the log.
        combined.ShouldContain(responseTraceId);

        // 7: exception Message content is not written to the log.
        combined.ShouldNotContain("Elevation=granted");
        combined.ShouldNotContain("secret token abc123");
    }

    [Fact]
    public async Task TryHandleAsync_ShouldGenerateDifferentErrorIds_ForDifferentInvocations()
    {
        var logger = new CapturingLogger<ApiExceptionHandler>();
        var problemDetails = new CapturingProblemDetailsService();
        var handler = new ApiExceptionHandler(problemDetails, logger);

        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < 5; i++)
        {
            var httpContext = new DefaultHttpContext { TraceIdentifier = "shared-client-id" };
            httpContext.Request.Method = "GET";
            httpContext.Request.Path = "/api/x";
            await handler.TryHandleAsync(httpContext, new Exception("boom"), CancellationToken.None);

            var errorId = problemDetails.LastContext!.ProblemDetails.Extensions["traceId"]
                .ShouldBeOfType<string>();
            errorId.ShouldMatch(ErrorIdShape);
            seen.Add(errorId).ShouldBeTrue($"errorId {errorId} was reused");
        }

        seen.Count.ShouldBe(5);
    }

    private sealed class CapturingProblemDetailsService : IProblemDetailsService
    {
        public ProblemDetailsContext? LastContext { get; private set; }

        public ValueTask WriteAsync(ProblemDetailsContext context)
        {
            LastContext = context;
            return ValueTask.CompletedTask;
        }

        public ValueTask<bool> TryWriteAsync(ProblemDetailsContext context)
        {
            LastContext = context;
            return ValueTask.FromResult(true);
        }
    }

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<string> Entries { get; } = new();

        public IDisposable BeginScope<TState>(TState state) where TState : notnull =>
            NullScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            Entries.Add(formatter(state, exception));
        }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose() { }
        }
    }
}
