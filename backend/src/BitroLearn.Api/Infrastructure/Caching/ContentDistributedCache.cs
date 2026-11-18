using Microsoft.Extensions.Caching.Distributed;

namespace BitroLearn.Api.Infrastructure.Caching;

// HybridCache's optional L2 adapter. Authentication keeps its own store and failure policy.
public sealed class ContentDistributedCache([FromKeyedServices("content")] IRedisStore store,ILogger<ContentDistributedCache> logger):IDistributedCache
{
    #region Bounded cache failure handling
    private long retryAfter;
    private async Task<T?> Safe<T>(Func<Task<T>> operation,T? fallback,CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        if(DateTime.UtcNow.Ticks<Interlocked.Read(ref retryAfter))return fallback;
        try{return await operation();}
        catch(RedisStoreException)
        {
            var next=DateTime.UtcNow.AddSeconds(Configuration.AppConfigurationStatic.GetCacheFailureBackoffSeconds()).Ticks;
            if(Interlocked.Exchange(ref retryAfter,next)<DateTime.UtcNow.Ticks)logger.LogWarning("Content cache unavailable; using database-backed reads.");
            return fallback;
        }
    }
    private static string Key(string key)=>"bitro:content:v1:"+key;
    public async Task<byte[]?> GetAsync(string key,CancellationToken token=default)
    {
        var value=await Safe(()=>store.GetStringAsync(Key(key),token),(string?)null,token);
        if(value is null)return null;
        try{return Convert.FromBase64String(value);}catch(FormatException){return null;}
    }
    public async Task SetAsync(string key,byte[] value,DistributedCacheEntryOptions options,CancellationToken token=default)
    {
        var expiry=options.AbsoluteExpirationRelativeToNow??(options.AbsoluteExpiration is {} absolute?absolute-DateTimeOffset.UtcNow:TimeSpan.FromSeconds(Configuration.AppConfigurationStatic.GetCacheDistributedSeconds()));
        if(expiry<=TimeSpan.Zero)return;
        await Safe(()=>store.SetStringAsync(Key(key),Convert.ToBase64String(value),expiry,cancellationToken:token),false,token);
    }
    public async Task RemoveAsync(string key,CancellationToken token=default)=>await Safe(()=>store.DeleteAsync(Key(key),token),false,token);
    public Task RefreshAsync(string key,CancellationToken token=default){token.ThrowIfCancellationRequested();return Task.CompletedTask;}
    public byte[]? Get(string key)=>GetAsync(key).GetAwaiter().GetResult();
    public void Set(string key,byte[] value,DistributedCacheEntryOptions options)=>SetAsync(key,value,options).GetAwaiter().GetResult();
    public void Remove(string key)=>RemoveAsync(key).GetAwaiter().GetResult();
    public void Refresh(string key)=>RefreshAsync(key).GetAwaiter().GetResult();
    #endregion
}
