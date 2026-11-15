using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BitroLearn.Api.Infrastructure.Http;

public sealed class CsrfValidationFilter(IAntiforgery antiforgery) : IAsyncAuthorizationFilter, IOrderedFilter
{
    #region Filter Ordering
    public int Order => 1000;
    #endregion

    #region Request Validation
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var method = context.HttpContext.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method)) return;
        try { await antiforgery.ValidateRequestAsync(context.HttpContext); }
        catch (AntiforgeryValidationException)
        {
            var problem = new ProblemDetails
            {
                Status = 400, Title = "CSRF validation failed.", Instance = context.HttpContext.Request.Path,
                Detail = "Request a fresh token from /public/auth/csrf for the matching area."
            };
            problem.Extensions["requestId"] = context.HttpContext.TraceIdentifier;
            context.Result = new BadRequestObjectResult(problem) { ContentTypes = { "application/problem+json" } };
        }
    }
    #endregion
}
