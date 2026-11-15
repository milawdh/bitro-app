using System.ComponentModel.DataAnnotations;

namespace BitroLearn.Api.DTOs.Auth;

#region Request Contracts
public sealed class OtpRequest
{
    [Required, StringLength(40)]
    public string PhoneNumber { get; init; } = "";
}
public sealed class OtpVerifyRequest
{
    [Required, RegularExpression("^[a-f0-9]{32}$")]
    public string ChallengeId { get; init; } = "";
    [Required, RegularExpression("^[0-9]{6}$")]
    public string Code { get; init; } = "";
}
public sealed class AdminLoginRequest
{
    [Required, EmailAddress, StringLength(254)]
    public string Username { get; init; } = "";
    [Required, StringLength(256), DataType(DataType.Password)]
    public string Password { get; init; } = "";
}
#endregion
#region Response Contracts
public sealed record OtpRequestResponse(string ChallengeId, int ExpiresIn, int ResendAfter);
public sealed record CurrentAdminUserResponse(string Id, string FullName, string? Email, IReadOnlyList<string> Roles);
public sealed record CurrentAppUserResponse(string Id, string FullName, string PhoneNumber);
public sealed record CsrfResponse(string RequestToken, string HeaderName);
#endregion
