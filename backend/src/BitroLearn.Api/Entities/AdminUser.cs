using Microsoft.AspNetCore.Identity;

namespace BitroLearn.Api.Entities;

public sealed class AdminUser : IdentityUser
{
    #region Properties

    public string FullName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    #endregion
}
