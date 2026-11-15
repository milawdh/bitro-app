using BitroLearn.Api.Infrastructure.Authentication;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Infrastructure.Http;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger, IProblemDetailsService problems) : IExceptionHandler
{
    #region Exception Handling
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var known = exception as ApiException;
        var status = known?.StatusCode ?? StatusCodes.Status500InternalServerError;
        if (known is null) logger.LogError(exception, "Unhandled API error. RequestId: {RequestId}", context.TraceIdentifier);
        else logger.LogWarning("API request rejected. Status: {Status}; RequestId: {RequestId}", status, context.TraceIdentifier);
        context.Response.StatusCode = status;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = known?.Title ?? "An unexpected error occurred.",
                Detail = known?.Detail,
                Instance = context.Request.Path
            },
            Exception = exception
        });
    }
    #endregion
}
