namespace BitroLearn.Api.Entities;

public sealed class CourseEnrollment : VersionedEntity
{
    #region Properties
    public string UserId { get; set; } = "";
    public string CourseId { get; set; } = "";
    #endregion
}

public sealed class CoursePaidAccess : VersionedEntity
{
    #region Properties
    public string UserId { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string Source { get; set; } = "";
    #endregion
}

public sealed class Invoice : VersionedEntity
{
    #region Properties
    public string UserId { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string IdempotencyKey { get; set; } = "";
    public long AmountRial { get; set; }
    public string CourseTitle { get; set; } = "";
    public string? TrackId { get; set; }
    public string PaymentStatus { get; set; } = "creating";
    public string FulfillmentStatus { get; set; } = "pending";
    public DateTimeOffset? LeaseUntil { get; set; }
    public string? LeaseToken { get; set; }
    #endregion
}

public sealed class SpotPlayerLicense : VersionedEntity
{
    #region Properties
    public string UserId { get; set; } = "";
    public string CourseId { get; set; } = "";
    public string Status { get; set; } = "pending";
    public string Source { get; set; } = "api";
    public string? EncryptedKey { get; set; }
    public string? ProviderId { get; set; }
    public string? Error { get; set; }
    #endregion
}

public sealed class ProviderAudit
{
    #region Properties
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string CorrelationId { get; set; } = "";
    public string Operation { get; set; } = "";
    public string RequestJson { get; set; } = "{}";
    public string? ResponseJson { get; set; }
    public int? HttpStatus { get; set; }
    public string Status { get; set; } = "started";
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FinishedAt { get; set; }
    #endregion
}

public sealed class VideoAsset : VersionedEntity
{
    #region Properties
    public string ObjectKey { get; set; } = "";
    public string FileName { get; set; } = "";
    public string UploadId { get; set; } = "";
    public long TotalBytes { get; set; }
    public long PartBytes { get; set; }
    public string Status { get; set; } = "uploading";
    public string? Error { get; set; }
    #endregion
}
