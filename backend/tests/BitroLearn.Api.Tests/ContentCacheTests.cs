using System.Reflection;
using BitroLearn.Api.Infrastructure.Caching;
using BitroLearn.Api.Infrastructure.Configuration;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.AspNetCore.Hosting;
using StackExchange.Redis;

namespace BitroLearn.Api.Tests;

public sealed class ContentCacheTests(PostgresFixture fixture):IClassFixture<PostgresFixture>
{
    #region Failure policy and single-flight behavior
    [Fact]
    public async Task Cache_failure_is_a_miss_and_write_failure_does_not_fail_business_operations()
    {
        var store=DispatchProxy.Create<IRedisStore,UnavailableStore>();
        var cache=new ContentDistributedCache(store,NullLogger<ContentDistributedCache>.Instance);
        Assert.Null(await cache.GetAsync("missing"));
        await cache.SetAsync("missing",[1,2],new() {AbsoluteExpirationRelativeToNow=TimeSpan.FromSeconds(10)});
        await cache.RemoveAsync("missing");
        using var cancelled=new CancellationTokenSource();cancelled.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(()=>cache.GetAsync("missing",cancelled.Token));
    }
    public class UnavailableStore:DispatchProxy
    {
        protected override object? Invoke(MethodInfo? targetMethod,object?[]? args)=>targetMethod!.Name switch
        {
            "GetStringAsync"=>Task.FromException<string?>(new RedisStoreException("Offline",new TimeoutException())),
            _=>Task.FromException<bool>(new RedisStoreException("Offline",new TimeoutException()))
        };
    }
    [RedisFact]
    public async Task Public_HTTP_reads_continue_with_a_failed_cache_backend()
    {
        using var original=new BackendTestFactory(fixture.ConnectionString);
        using var host=original.WithWebHostBuilder(builder=>builder.ConfigureServices(services=>
        {
            services.RemoveAll<IDistributedCache>();
            services.AddSingleton<IDistributedCache>(new ContentDistributedCache(DispatchProxy.Create<IRedisStore,UnavailableStore>(),NullLogger<ContentDistributedCache>.Instance));
        }));
        using var client=host.CreateClient();
        var response=await client.GetAsync("/public/courses");response.EnsureSuccessStatusCode();
        var courses=System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());Assert.True(courses.RootElement.GetArrayLength()>0);
        (await client.GetAsync("/public/auth/csrf?area=app")).EnsureSuccessStatusCode();
    }
    [Fact]
    public async Task Concurrent_reads_share_one_factory_and_invalidation_fetches_again()
    {
        await using var provider=new ServiceCollection().AddLogging().AddHybridCache().Services.BuildServiceProvider();
        var cache=provider.GetRequiredService<HybridCache>();var calls=0;
        var gate=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        async ValueTask<string> Read()=>await cache.GetOrCreateAsync("single",async ct=>{Interlocked.Increment(ref calls);await gate.Task.WaitAsync(ct);return "value";},tags:["content"]);
        var reads=Enumerable.Range(0,20).Select(_=>Read().AsTask()).ToArray();gate.SetResult();
        await Task.WhenAll(reads);Assert.Equal(1,calls);
        await cache.RemoveByTagAsync("content");await Read();Assert.Equal(2,calls);
    }
    #endregion
    #region Real shared content Redis, separate from OTP
    [RedisFact]
    public async Task Two_instances_share_L2_and_peer_L1_expires_after_invalidation()
    {
        var connectionString=AppConfigurationStatic.GetCacheRedisConnectionString();Assert.False(string.IsNullOrWhiteSpace(connectionString));
        using var connection=await ConnectionMultiplexer.ConnectAsync(connectionString!);
        var store=new RedisStore(connection);
        ServiceProvider Provider()
        {
            var services=new ServiceCollection().AddLogging();services.AddKeyedSingleton<IRedisStore>("content",store);
            services.AddSingleton<IDistributedCache,ContentDistributedCache>();
            services.AddHybridCache(o=>o.DefaultEntryOptions=new() {Expiration=TimeSpan.FromSeconds(20),LocalCacheExpiration=TimeSpan.FromSeconds(1)});
            return services.BuildServiceProvider();
        }
        await using var first=Provider();await using var second=Provider();
        var a=first.GetRequiredService<HybridCache>();var b=second.GetRequiredService<HybridCache>();var key="test:"+Guid.NewGuid().ToString("N");var calls=0;
        Task<string> Get(HybridCache cache)=>cache.GetOrCreateAsync(key,_=>{Interlocked.Increment(ref calls);return ValueTask.FromResult("value-"+calls);}).AsTask();
        try
        {
            var initial=await Get(a);Assert.Equal("value-1",initial);
            // GetOrCreate can release callers before its asynchronous L2 write ends.
            // SetAsync provides an explicit completion barrier for the peer-read assertion.
            await a.SetAsync(key,initial);
            Assert.Equal("value-1",await Get(b));Assert.Equal(1,calls);
            await a.RemoveAsync(key);await Task.Delay(1200);Assert.Equal("value-2",await Get(b));Assert.Equal(2,calls);
        }
        finally{await a.RemoveAsync(key);await b.RemoveAsync(key);}
    }
    #endregion
}
