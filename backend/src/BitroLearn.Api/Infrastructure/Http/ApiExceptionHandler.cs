using BitroLearn.Api.Infrastructure.Authentication;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Infrastructure.Http;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger, IProblemDetailsService problems) : IExceptionHandler
{
    #region Exception Handling
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var known = exception as ApiException ?? (exception is System.Text.Json.JsonException or ArgumentException ? new ApiException(400,"Invalid request data.") : exception is Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException ? new ApiException(409,"Concurrent modification.") : null);
        known ??= exception is Microsoft.EntityFrameworkCore.DbUpdateException { InnerException: Npgsql.PostgresException { SqlState: "23505" } } ? new ApiException(409,"Duplicate record.") : exception is Microsoft.EntityFrameworkCore.DbUpdateException { InnerException: Npgsql.PostgresException { SqlState: "23503" or "23514" } } ? new ApiException(400,"Database constraint rejected the request.") : exception is HttpRequestException ? new ApiException(503,"Provider temporarily unavailable.") : null;
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
