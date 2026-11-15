using System.Security.Claims;
using BitroLearn.Api.Data;
using BitroLearn.Api.DTOs.Auth;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BitroLearn.Api.Services;

public sealed class AppAuthService(AppDbContext database, OtpService otp)
{
    #region Public Methods
    public Task<OtpRequestResponse> RequestOtpAsync(string phoneNumber, string clientIp, CancellationToken cancellationToken)
        => otp.RequestAsync(phoneNumber, clientIp, cancellationToken);

    public async Task<CurrentAppUserResponse> VerifyOtpAsync(OtpVerifyRequest request, HttpContext context, CancellationToken cancellationToken)
    {
        var phone = await otp.VerifyAndConsumeAsync(request.ChallengeId, request.Code, cancellationToken);
        var user = await database.AppUsers.SingleOrDefaultAsync(candidate => candidate.PhoneNumber == phone, cancellationToken);
        if (user is null)
        {
            user = new AppUser
            {
                Id = Guid.NewGuid().ToString("N"), PhoneNumber = phone, PhoneNumberConfirmed = true,
                IsActive = true, FullName = "", SecurityStamp = Guid.NewGuid().ToString("N"), CreatedAt = DateTimeOffset.UtcNow
            };
            database.AppUsers.Add(user);
            try { await database.SaveChangesAsync(cancellationToken); }
            catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                database.ChangeTracker.Clear();
                user = await database.AppUsers.SingleOrDefaultAsync(candidate => candidate.PhoneNumber == phone, cancellationToken);
                if (user is null) throw new ApiException(503, "ساخت حساب تکمیل نشد.", "کد تازه درخواست کنید.");
            }
        }
        if (!user.IsActive || !user.PhoneNumberConfirmed) throw new ApiException(403, "ورود برای این حساب مجاز نیست.");
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id), new Claim(ClaimTypes.Name, user.PhoneNumber),
            new Claim(AuthSchemes.AppStampClaim, user.SecurityStamp), new Claim(AuthPolicies.MethodClaim, AuthPolicies.OtpMethod)
        };
        await context.SignInAsync(AuthSchemes.AppCookie, new ClaimsPrincipal(new ClaimsIdentity(claims, AuthSchemes.AppCookie)),
            new AuthenticationProperties { IsPersistent = false });
        return ToResponse(user);
    }

    public async Task<CurrentAppUserResponse> GetCurrentUserAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var id = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = id is null ? null : await database.AppUsers.AsNoTracking().SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (user is null || !user.IsActive) throw new ApiException(401, "ورود به حساب لازم است.");
        return ToResponse(user);
    }

    public async Task LogoutAsync(HttpContext context, CancellationToken cancellationToken)
    {
        var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = id is null ? null : await database.AppUsers.SingleOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);
        if (user is not null)
        {
            user.SecurityStamp = Guid.NewGuid().ToString("N");
            await database.SaveChangesAsync(cancellationToken);
        }
        await context.SignOutAsync(AuthSchemes.AppCookie);
    }
    #endregion

    #region Private Methods
    private static CurrentAppUserResponse ToResponse(AppUser user) => new(user.Id, user.FullName, user.PhoneNumber);
    #endregion
}
