using System.Security.Claims;
using BitroLearn.Api.Data;
using BitroLearn.Api.Entities;
using BitroLearn.Api.Infrastructure.Configuration;
using BitroLearn.Api.Infrastructure.SMS;
using BitroLearn.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BitroLearn.Api.Infrastructure.Authentication;

public static class AuthenticationExtensions
{
    #region Registration
    public static IServiceCollection AddBitroAuthentication(this IServiceCollection services)
    {
        // Identity and its role tables belong ONLY to the independent administrator store.
        services.AddIdentityCore<AdminUser>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 12;
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireUppercase = true;
            options.Password.RequireNonAlphanumeric = true;
            options.Lockout.AllowedForNewUsers = true;
            options.Lockout.MaxFailedAccessAttempts = AppConfigurationStatic.GetAdminMaxAttempts();
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromSeconds(AppConfigurationStatic.GetAdminLockSeconds());
        }).AddRoles<IdentityRole>().AddEntityFrameworkStores<AppDbContext>().AddSignInManager().AddDefaultTokenProviders();

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = AuthSchemes.Selector;
            options.DefaultChallengeScheme = AuthSchemes.Selector;
        })
        .AddPolicyScheme(AuthSchemes.Selector, "Choose exactly one area session", options =>
        {
            options.ForwardDefaultSelector = context => context.Request.Path.StartsWithSegments("/admin") ||
                (context.Request.Path.StartsWithSegments("/public/auth/csrf") &&
                 string.Equals(context.Request.Query["area"].ToString(), "admin", StringComparison.Ordinal))
                    ? AuthSchemes.AdminCookie : AuthSchemes.AppCookie;
        })
        .AddCookie(AuthSchemes.AdminCookie, options =>
        {
            ConfigureCookie(options, "bitro.admin.auth");
            options.Events.OnValidatePrincipal = ValidateAdminPrincipalAsync;
        })
        .AddCookie(AuthSchemes.AppCookie, options =>
        {
            ConfigureCookie(options, "bitro.app.auth");
            options.Events.OnValidatePrincipal = ValidateAppPrincipalAsync;
        });

        services.AddAuthorization(options =>
        {
            options.FallbackPolicy = new AuthorizationPolicyBuilder(AuthSchemes.Selector).RequireAuthenticatedUser().Build();
            options.AddPolicy(AuthPolicies.AdminArea, policy => policy.AddAuthenticationSchemes(AuthSchemes.AdminCookie)
                .RequireAuthenticatedUser().RequireClaim(AuthPolicies.MethodClaim, AuthPolicies.PasswordMethod)
                .RequireRole(RoleConstants.Editor, RoleConstants.Admin, RoleConstants.SuperAdmin));
            // Application users do not have roles, permissions, passwords, or any admin-store identity.
            options.AddPolicy(AuthPolicies.AppArea, policy => policy.AddAuthenticationSchemes(AuthSchemes.AppCookie)
                .RequireAuthenticatedUser().RequireClaim(AuthPolicies.MethodClaim, AuthPolicies.OtpMethod));
        });
        services.AddScoped<AdminAuthService>();
        services.AddScoped<AppAuthService>();
        services.AddScoped<OtpService>();
        services.AddSingleton<ISMSProvider, ConsoleSMSProvider>();
        return services;
    }
    #endregion

    #region Cookie Configuration
    private static void ConfigureCookie(CookieAuthenticationOptions options, string name)
    {
        options.Cookie.Name = name;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = AppConfigurationStatic.GetCookieSecure() ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
        options.Cookie.Path = "/";
        options.ExpireTimeSpan = TimeSpan.FromHours(AppConfigurationStatic.GetCookieLifetimeHours());
        options.SlidingExpiration = false;
        options.Events.OnRedirectToLogin = context => WriteAuthenticationProblemAsync(context, 401, "ورود به حساب لازم است.");
        options.Events.OnRedirectToAccessDenied = context => WriteAuthenticationProblemAsync(context, 403, "دسترسی به این بخش مجاز نیست.");
    }
    #endregion

    #region Principal Validation
    private static async Task ValidateAdminPrincipalAsync(CookieValidatePrincipalContext context)
    {
        var users = context.HttpContext.RequestServices.GetRequiredService<UserManager<AdminUser>>();
        var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var stamp = context.Principal?.FindFirstValue(users.Options.ClaimsIdentity.SecurityStampClaimType);
        var user = userId is null ? null : await users.FindByIdAsync(userId);
        if (user is null || !user.IsActive || string.IsNullOrEmpty(stamp) ||
            !string.Equals(stamp, await users.GetSecurityStampAsync(user), StringComparison.Ordinal))
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(AuthSchemes.AdminCookie);
            return;
        }
        var roles = await users.GetRolesAsync(user);
        var roleClaimType = users.Options.ClaimsIdentity.RoleClaimType;
        var claims = context.Principal!.Claims.Where(claim => claim.Type != roleClaimType).ToList();
        claims.AddRange(roles.Select(role => new Claim(roleClaimType, role)));
        context.ReplacePrincipal(new ClaimsPrincipal(new ClaimsIdentity(claims, AuthSchemes.AdminCookie,
            users.Options.ClaimsIdentity.UserNameClaimType, roleClaimType)));
    }

    private static async Task ValidateAppPrincipalAsync(CookieValidatePrincipalContext context)
    {
        var database = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var id = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        var stamp = context.Principal?.FindFirstValue(AuthSchemes.AppStampClaim);
        var user = id is null ? null : await database.AppUsers.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.Id == id, context.HttpContext.RequestAborted);
        if (user is null || !user.IsActive || !user.PhoneNumberConfirmed || string.IsNullOrEmpty(stamp) ||
            !string.Equals(stamp, user.SecurityStamp, StringComparison.Ordinal))
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(AuthSchemes.AppCookie);
        }
    }
    #endregion

    #region Error Responses
    private static Task WriteAuthenticationProblemAsync(RedirectContext<CookieAuthenticationOptions> context, int statusCode, string title)
        => Results.Problem(statusCode: statusCode, title: title, extensions: new Dictionary<string, object?>
        {
            ["requestId"] = context.HttpContext.TraceIdentifier
        }).ExecuteAsync(context.HttpContext);
    #endregion
}
