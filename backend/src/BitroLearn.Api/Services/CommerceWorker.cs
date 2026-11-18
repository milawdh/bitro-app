using BitroLearn.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace BitroLearn.Api.Services;

public sealed class CommerceWorker(IServiceScopeFactory scopes,ILogger<CommerceWorker> logger) : BackgroundService
{
    #region Durable work polling
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var nextPayment = DateTimeOffset.MinValue;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var commerce = scope.ServiceProvider.GetRequiredService<CommerceService>();
                await db.ProviderAudits.Where(a => a.Status == "started" && a.StartedAt < DateTimeOffset.UtcNow.AddMinutes(-5)).ExecuteUpdateAsync(s => s.SetProperty(a => a.Status,"interrupted"),stoppingToken);
                if (DateTimeOffset.UtcNow >= nextPayment)
                {
                    nextPayment = DateTimeOffset.UtcNow.AddSeconds(120);
                    var ids = await db.Invoices.AsNoTracking().Where(i => i.TrackId != null && (i.PaymentStatus == "pending" || i.PaymentStatus == "paid" && i.FulfillmentStatus != "completed") && (i.LeaseUntil == null || i.LeaseUntil < DateTimeOffset.UtcNow)).OrderBy(i => i.UpdatedAt).Select(i => i.Id).Take(100).ToArrayAsync(stoppingToken);
                    foreach (var id in ids)
                    {
                        var token = Guid.NewGuid().ToString("N");
                        var claimed = await db.Invoices.Where(i => i.Id == id && (i.LeaseUntil == null || i.LeaseUntil < DateTimeOffset.UtcNow)).ExecuteUpdateAsync(s => s.SetProperty(i => i.LeaseToken,token).SetProperty(i => i.LeaseUntil,DateTimeOffset.UtcNow.AddMinutes(2)).SetProperty(i => i.UpdatedAt,DateTimeOffset.UtcNow),stoppingToken);
                        if (claimed == 0) continue;
                        try { await commerce.ProcessInvoice(id,token,stoppingToken); }
                        catch (Exception e) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning("Invoice {Id} deferred: {Type}",id,e.GetType().Name); }
                        finally { await db.Invoices.Where(i => i.Id == id && i.LeaseToken == token).ExecuteUpdateAsync(s => s.SetProperty(i => i.LeaseUntil,(DateTimeOffset?)null).SetProperty(i => i.LeaseToken,(string?)null),CancellationToken.None); }
                    }
                }

            }
            catch (Exception e) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning("Worker cycle deferred: {Type}",e.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(5),stoppingToken);
        }
    }
    #endregion
}

public sealed class MediaWorker(IServiceScopeFactory scopes,ILogger<MediaWorker> logger) : BackgroundService
{
    #region Media validation polling
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var media = scope.ServiceProvider.GetRequiredService<MediaService>();
                await db.VideoAssets.Where(v => v.Status == "processing" && v.UpdatedAt < DateTimeOffset.UtcNow.AddMinutes(-5)).ExecuteUpdateAsync(s => s.SetProperty(v => v.Status,"validating"),stoppingToken);
                foreach (var id in await db.VideoAssets.AsNoTracking().Where(v => v.Status == "validating").Select(v => v.Id).Take(10).ToArrayAsync(stoppingToken))
                {
                    if (await db.VideoAssets.Where(v => v.Id == id && v.Status == "validating").ExecuteUpdateAsync(s => s.SetProperty(v => v.Status,"processing").SetProperty(v => v.UpdatedAt,DateTimeOffset.UtcNow),stoppingToken) == 0) continue;
                    try { await media.Complete(id,stoppingToken); }
                    catch (Exception e) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning("Media {Id} deferred: {Type}",id,e.GetType().Name); }
                }
                foreach (var id in await db.VideoAssets.AsNoTracking().Where(v => v.Status == "uploading" && v.UpdatedAt < DateTimeOffset.UtcNow.AddHours(-24)).Select(v=>v.Id).Take(20).ToArrayAsync(stoppingToken))
                    await media.Abort(id,stoppingToken);
            }
            catch (Exception e) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning("Media cycle deferred: {Type}",e.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(5),stoppingToken);
        }
    }
    #endregion
}

public sealed class LicenseWorker(IServiceScopeFactory scopes,ILogger<LicenseWorker> logger) : BackgroundService
{
    #region Independent license provisioning
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var commerce = scope.ServiceProvider.GetRequiredService<CommerceService>();
                await db.SpotPlayerLicenses.Where(l => l.Status == "issuing" && l.UpdatedAt < DateTimeOffset.UtcNow.AddMinutes(-3)).ExecuteUpdateAsync(s => s.SetProperty(l => l.Status,"needsReconciliation"),stoppingToken);
                foreach (var id in await db.SpotPlayerLicenses.AsNoTracking().Where(l => l.Status == "pending").Select(l => l.Id).Take(100).ToArrayAsync(stoppingToken)) await commerce.IssueLicense(id,stoppingToken);
            }
            catch (Exception e) when (!stoppingToken.IsCancellationRequested) { logger.LogWarning("License cycle deferred: {Type}",e.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(5),stoppingToken);
        }
    }
    #endregion
}
