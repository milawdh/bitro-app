namespace BitroLearn.Api.Entities;

public sealed class AppUser
{
    #region Properties

    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string PhoneNumber { get; set; } = string.Empty;
    public bool PhoneNumberConfirmed { get; set; }
    public string FullName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string SecurityStamp { get; set; } = Guid.NewGuid().ToString("N");
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    #endregion
}
