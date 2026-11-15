using Amazon.S3;
using Amazon.S3.Model;
using BitroLearn.Api.Data;
using BitroLearn.Api.Infrastructure.Caching;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BitroLearn.Api.Infrastructure.Health;

public sealed class PostgresHealthCheck(AppDbContext db) : IHealthCheck
{
    #region Health Check
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try { return await db.Database.CanConnectAsync(cancellationToken) ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy("Database unavailable."); }
        catch { return HealthCheckResult.Unhealthy("Database unavailable."); }
    }
    #endregion
}

public sealed class RedisHealthCheck(IRedisStore redis) : IHealthCheck
{
    #region Health Check
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try { await redis.PingAsync(cancellationToken); return HealthCheckResult.Healthy(); }
        catch { return HealthCheckResult.Unhealthy("Authentication cache unavailable."); }
    }
    #endregion
}

public sealed class ObjectStorageHealthCheck(IAmazonS3 s3) : IHealthCheck
{
    #region Health Check
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try { await s3.ListBucketsAsync(new ListBucketsRequest(), cancellationToken); return HealthCheckResult.Healthy(); }
        catch { return HealthCheckResult.Degraded("Object storage unavailable."); }
    }
    #endregion
}
