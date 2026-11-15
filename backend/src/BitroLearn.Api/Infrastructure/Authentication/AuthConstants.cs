namespace BitroLearn.Api.Infrastructure.Authentication;

public static class RoleConstants
{
    #region Constants
    public const string Editor = "editor";
    public const string Admin = "admin";
    public const string SuperAdmin = "superadmin";
    public static readonly string[] All = [Editor, Admin, SuperAdmin];
    #endregion
    #region Public Methods
    public static bool IsStaff(IEnumerable<string> roles) => roles.Any(role => role is Editor or Admin or SuperAdmin);
    #endregion
}

public static class AuthSchemes
{
    #region Constants
    public const string Selector = "Bitro.Area";
    public const string AdminCookie = "Bitro.Admin";
    public const string AppCookie = "Bitro.App";
    public const string AppStampClaim = "bitro.app.security_stamp";
    #endregion
}

public static class AuthPolicies
{
    #region Constants
    public const string AdminArea = "AdminArea";
    public const string AppArea = "AppArea";
    public const string MethodClaim = "amr";
    public const string OtpMethod = "otp";
    public const string PasswordMethod = "password";
    #endregion
}
