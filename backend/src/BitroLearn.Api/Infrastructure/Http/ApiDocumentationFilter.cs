using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Authorization;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace BitroLearn.Api.Infrastructure.Http;

public sealed class ApiDocumentationFilter : IOperationFilter
{
    #region OpenAPI Operation Metadata
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        foreach (var response in operation.Responses.Where(pair => pair.Key.StartsWith('2')).Select(pair => pair.Value))
            if (response.Content.TryGetValue("application/json", out var json))
                response.Content = new Dictionary<string, OpenApiMediaType> { ["application/json"] = json };
        if (!context.ApiDescription.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any())
        {
            var admin = context.ApiDescription.RelativePath?.StartsWith("admin/", StringComparison.Ordinal) == true;
            operation.Security = [new OpenApiSecurityRequirement
            {
                [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = admin ? "AdminCookie" : "AppCookie" } }] = []
            }];
        }
        if (context.ApiDescription.HttpMethod is "POST" or "PUT" or "PATCH" or "DELETE")
        {
            operation.Parameters.Add(new OpenApiParameter
            {
                Name = "X-CSRF-TOKEN", In = ParameterLocation.Header, Required = true,
                Description = "First GET /public/auth/csrf?area=app or area=admin. Refresh the token after login/logout. Browser cookies are sent automatically.",
                Schema = new OpenApiSchema { Type = "string" }
            });
        }
        foreach (var status in new[] { "400", "401", "403", "409", "429", "503" })
            operation.Responses.TryAdd(status, new OpenApiResponse { Description = "ProblemDetails error; includes requestId." });
    }
    #endregion
}
