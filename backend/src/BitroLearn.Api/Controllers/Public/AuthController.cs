using BitroLearn.Api.DTOs.Auth;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Controllers.Public;

[Route("public/auth")]
public sealed class AuthController(IAntiforgery antiforgery) : PublicAreaController
{
    #region Public Endpoints
    [HttpGet("csrf")]
    [AllowAnonymous]
    [ProducesResponseType<CsrfResponse>(StatusCodes.Status200OK)]
    public ActionResult<CsrfResponse> Csrf([FromQuery] string area = "app")
    {
        if (area is not ("app" or "admin")) return ValidationProblem("ناحیهٔ درخواست باید app یا admin باشد.");
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        Response.Headers.CacheControl = "no-store";
        return new CsrfResponse(tokens.RequestToken!, "X-CSRF-TOKEN");
    }
    #endregion
}
