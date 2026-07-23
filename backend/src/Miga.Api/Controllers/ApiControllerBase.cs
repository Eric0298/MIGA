using Microsoft.AspNetCore.Mvc;

namespace Miga.Api.Controllers;

public abstract class ApiControllerBase : ControllerBase
{
    protected ObjectResult ApiProblem(
        int statusCode,
        string code,
        string title,
        IReadOnlyDictionary<string, object?>? extensions = null)
    {
        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = title
        };
        problem.Extensions["code"] = code;
        problem.Extensions["traceId"] = HttpContext.TraceIdentifier;

        if (extensions is not null)
        {
            foreach (var (key, value) in extensions)
            {
                problem.Extensions[key] = value;
            }
        }

        return new ObjectResult(problem) { StatusCode = statusCode };
    }
}
