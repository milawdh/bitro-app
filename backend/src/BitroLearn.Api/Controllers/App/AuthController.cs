using BitroLearn.Api.DTOs.Auth;
using BitroLearn.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BitroLearn.Api.Controllers.App;

[Route("app/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthController(AppAuthService auth) : AppAreaController
{
    #region Public Endpoints
    [HttpPost("otp/request")]
    [AllowAnonymous]
    [ProducesResponseType<OtpRequestResponse>(StatusCodes.Status202Accepted)]
    public async Task<ActionResult<OtpRequestResponse>> RequestOtp(OtpRequest request, CancellationToken cancellationToken)
    {
        var address = HttpContext.Connection.RemoteIpAddress;
        if (address?.IsIPv4MappedToIPv6 == true) address = address.MapToIPv4();
        return Accepted(await auth.RequestOtpAsync(request.PhoneNumber, address?.ToString() ?? "unknown", cancellationToken));
    }

    [HttpPost("otp/verify")]
    [AllowAnonymous]
    [ProducesResponseType<CurrentAppUserResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CurrentAppUserResponse>> VerifyOtp(OtpVerifyRequest request, CancellationToken cancellationToken)
        => await auth.VerifyOtpAsync(request, HttpContext, cancellationToken);

    [HttpGet("me")]
    [ProducesResponseType<CurrentAppUserResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CurrentAppUserResponse>> Me(CancellationToken cancellationToken)
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
