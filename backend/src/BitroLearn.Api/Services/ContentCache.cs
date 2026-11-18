using BitroLearn.Api.Data;
using Microsoft.Extensions.Caching.Hybrid;

namespace BitroLearn.Api.Services;

public sealed class ContentCache(HybridCache cache,IServiceScopeFactory scopes,ILogger<ContentCache> logger)
{
    #region Shared published projections only
    public async Task<T> Get<T>(string key,Func<AppDbContext,CancellationToken,Task<T>> read,CancellationToken ct)
        =>await cache.GetOrCreateAsync("content:v1:"+key,async token=>
        {
            await using var scope=scopes.CreateAsyncScope();
            return await read(scope.ServiceProvider.GetRequiredService<AppDbContext>(),token);
        },tags:["content"],cancellationToken:ct);
    public async Task Invalidate(CancellationToken ct)
    {
        try{await cache.RemoveByTagAsync("content",ct);}
        catch(Exception e) when(e is not OperationCanceledException){logger.LogWarning("Content cache invalidation deferred to expiration: {Type}",e.GetType().Name);}
    }
    #endregion
}
