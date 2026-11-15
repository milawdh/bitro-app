using BitroLearn.Api.DTOs.Auth;
using BitroLearn.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Controllers.Admin;

[Route("admin/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthController(AdminAuthService auth) : AdminAreaController
{
    #region Public Endpoints
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType<CurrentAdminUserResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CurrentAdminUserResponse>> Login(AdminLoginRequest request, CancellationToken cancellationToken)
        => await auth.LoginAsync(request, cancellationToken);

    [HttpGet("me")]
    [ProducesResponseType<CurrentAdminUserResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CurrentAdminUserResponse>> Me(CancellationToken cancellationToken)
        => await auth.GetCurrentUserAsync(User, cancellationToken);

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await auth.LogoutAsync(HttpContext, cancellationToken);
        return NoContent();
    }
    #endregion
}
