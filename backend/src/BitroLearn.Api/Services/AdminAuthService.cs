using System.Security.Claims;
using BitroLearn.Api.DTOs.Auth;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;

namespace BitroLearn.Api.Services;

public sealed class AdminAuthService(UserManager<AdminUser> users, SignInManager<AdminUser> signIn)
{
    #region Public Methods
    public async Task<CurrentAdminUserResponse> LoginAsync(AdminLoginRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await users.FindByNameAsync(request.Username.Trim());
        if (user is null || !user.IsActive) throw InvalidCredentials();
        var roles = await users.GetRolesAsync(user);
        if (!RoleConstants.IsStaff(roles)) throw InvalidCredentials();
        var result = await signIn.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded) throw InvalidCredentials();
        signIn.AuthenticationScheme = AuthSchemes.AdminCookie;
        await signIn.SignInWithClaimsAsync(user, isPersistent: false, [new Claim(AuthPolicies.MethodClaim, AuthPolicies.PasswordMethod)]);
        return ToResponse(user, roles);
    }

    public async Task<CurrentAdminUserResponse> GetCurrentUserAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await users.GetUserAsync(principal);
        if (user is null || !user.IsActive) throw new ApiException(401, "ورود به حساب لازم است.");
        return ToResponse(user, await users.GetRolesAsync(user));
    }

    public async Task LogoutAsync(HttpContext context, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var user = await users.GetUserAsync(context.User);
        if (user is not null)
        {
            var result = await users.UpdateSecurityStampAsync(user);
            if (!result.Succeeded) throw new ApiException(409, "خروج از حساب تکمیل نشد.", "دوباره تلاش کنید.");
        }
        await context.SignOutAsync(AuthSchemes.AdminCookie);
    }
    #endregion

    #region Private Methods
    private static CurrentAdminUserResponse ToResponse(AdminUser user, IEnumerable<string> roles)
        => new(user.Id, user.FullName, user.Email, roles.Order(StringComparer.Ordinal).ToArray());
    private static ApiException InvalidCredentials() => new(401, "نام کاربری یا رمز عبور نامعتبر است.");
    #endregion
}
