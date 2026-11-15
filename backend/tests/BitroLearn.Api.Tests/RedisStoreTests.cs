using BitroLearn.Api.Infrastructure.Caching;
using StackExchange.Redis;

namespace BitroLearn.Api.Tests;

public sealed class RedisOnlyFactAttribute : FactAttribute
{
    #region Integration prerequisites
    public RedisOnlyFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("BITRO_TEST_REDIS_CONNECTION_STRING")))
            Skip = "Set BITRO_TEST_REDIS_CONNECTION_STRING to run isolated Redis wrapper tests.";
    }
    #endregion
}

public sealed class RedisStoreTests
{
    #region Strings, documents, and bulk reads

    [RedisOnlyFact]
    public async Task Bulk_read_preserves_missing_values_and_reads_other_instances_writes()
    {
        await using var pair = await RedisPair.CreateAsync();
        var first = pair.Key("first"); var second = pair.Key("second"); var missing = pair.Key("missing");
        await pair.First.SetManyAsync(new Dictionary<string, string> { [first] = "one", [second] = "two" }, TimeSpan.FromMinutes(1));
        var found = await pair.Second.GetManyAsync([first, second, missing]);
        Assert.Equal("one", found[first]); Assert.Equal("two", found[second]); Assert.Null(found[missing]);
        Assert.Empty(await pair.Second.GetManyAsync([]));
    }

    [RedisOnlyFact]
    public async Task Json_documents_round_trip_through_bulk_and_single_reads()
    {
        await using var pair = await RedisPair.CreateAsync();
        var first = pair.Key("document-a"); var second = pair.Key("document-b");
        var item = new StoredTestDocument("بیترو", 17);
        await pair.First.SetJsonAsync(first, item, TimeSpan.FromMinutes(1));
        Assert.Equal(item, await pair.Second.GetJsonAsync<StoredTestDocument>(first));
        await pair.Second.SetManyJsonAsync(new Dictionary<string, StoredTestDocument> { [second] = new("shared", 19) }, TimeSpan.FromMinutes(1));
        var values = await pair.First.GetManyJsonAsync<StoredTestDocument>([first, second]);
        Assert.Equal(19, values[second]?.Count);
        Assert.Equal(item, values[first]);
    }

    [RedisOnlyFact]
    public async Task Conditional_string_write_does_not_replace_existing_data()
    {
        await using var pair = await RedisPair.CreateAsync();
        var key = pair.Key("conditional");
        Assert.True(await pair.First.SetStringAsync(key, "initial", TimeSpan.FromMinutes(1), RedisSetMode.OnlyIfMissing));
        Assert.False(await pair.Second.SetStringAsync(key, "replacement", TimeSpan.FromMinutes(1), RedisSetMode.OnlyIfMissing));
        Assert.Equal("initial", await pair.Second.GetStringAsync(key));
    }

    #endregion

    #region Expiration, counters, and bounded discovery

    [RedisOnlyFact]
    public async Task Expiry_and_persist_are_visible_to_other_instances()
    {
        await using var pair = await RedisPair.CreateAsync();
        var key = pair.Key("expiring");
        await pair.First.SetStringAsync(key, "value", TimeSpan.FromSeconds(10));
        var ttl = await pair.Second.GetTimeToLiveAsync(key);
        Assert.True(ttl is { TotalSeconds: > 0 and <= 10 });
        Assert.True(await pair.Second.ExpireAsync(key, null));
        Assert.Null(await pair.First.GetTimeToLiveAsync(key));
        Assert.True(await pair.Second.ExpireAsync(key, TimeSpan.FromMilliseconds(1)));
        await Task.Delay(30);
        Assert.False(await pair.First.ExistsAsync(key));
        Assert.Null(await pair.First.GetStringAsync(key));
    }

    [RedisOnlyFact]
    public async Task Concurrent_counter_updates_do_not_lose_increments()
    {
        await using var pair = await RedisPair.CreateAsync();
        var key = pair.Key("counter");
        await Task.WhenAll(Enumerable.Range(0, 100).Select(index => (index % 2 == 0 ? pair.First : pair.Second).IncrementAsync(key)));
        Assert.Equal("100", await pair.First.GetStringAsync(key));
        Assert.Equal(97L, await pair.Second.DecrementAsync(key, 3));
    }

    [RedisOnlyFact]
    public async Task Key_scan_is_restricted_to_the_requested_test_prefix()
    {
        await using var pair = await RedisPair.CreateAsync();
        var first = pair.Key("scan-a"); var second = pair.Key("scan-b");
        await pair.First.SetManyAsync(new Dictionary<string, string> { [first] = "a", [second] = "b" }, TimeSpan.FromMinutes(1));
        var found = new List<string>();
        await foreach (var key in pair.Second.ScanKeysAsync(pair.Prefix + "scan-*", pageSize: 10)) found.Add(key);
        Assert.Equal(new[] { first, second }.Order(), found.Order());
    }

    #endregion

    #region Redis collections

    [RedisOnlyFact]
    public async Task Hash_fields_and_counters_are_shared_between_instances()
    {
        await using var pair = await RedisPair.CreateAsync(); var key = pair.Key("hash");
        await pair.First.HashSetManyAsync(key, new Dictionary<string, string> { ["language"] = "fa", ["level"] = "beginner" });
        Assert.Equal("fa", await pair.Second.HashGetAsync(key, "language"));
        Assert.Equal(2, (await pair.Second.HashGetAllAsync(key)).Count);
        Assert.Equal(3L, await pair.Second.HashIncrementAsync(key, "attempts", 3));
        Assert.True(await pair.First.HashDeleteAsync(key, "level"));
        Assert.False(await pair.Second.HashExistsAsync(key, "level"));
    }

    [RedisOnlyFact]
    public async Task Lists_keep_order_across_push_pop_and_range_operations()
    {
        await using var pair = await RedisPair.CreateAsync(); var key = pair.Key("list");
        await pair.First.ListLeftPushAsync(key, "first"); await pair.Second.ListRightPushAsync(key, "second"); await pair.First.ListRightPushAsync(key, "third");
        Assert.Equal(new[] { "first", "second", "third" }, await pair.Second.ListRangeAsync(key));
        Assert.Equal("first", await pair.Second.ListLeftPopAsync(key));
        Assert.Equal("third", await pair.First.ListRightPopAsync(key));
        Assert.Equal(1L, await pair.Second.ListLengthAsync(key));
    }

    [RedisOnlyFact]
    public async Task Sets_enforce_membership_uniqueness()
    {
        await using var pair = await RedisPair.CreateAsync(); var key = pair.Key("set");
        Assert.True(await pair.First.SetAddAsync(key, "a")); Assert.False(await pair.Second.SetAddAsync(key, "a"));
        await pair.Second.SetAddAsync(key, "b");
        Assert.Equal(new[] { "a", "b" }, (await pair.First.SetMembersAsync(key)).Order());
        Assert.True(await pair.Second.SetRemoveAsync(key, "a")); Assert.False(await pair.First.SetContainsAsync(key, "a"));
        Assert.Equal(1L, await pair.First.SetLengthAsync(key));
    }

    [RedisOnlyFact]
    public async Task Sorted_sets_return_ordered_scores_in_both_directions()
    {
        await using var pair = await RedisPair.CreateAsync(); var key = pair.Key("sorted");
        await pair.First.SortedSetAddAsync(key, "early", 2); await pair.Second.SortedSetAddAsync(key, "late", 9);
        Assert.Equal(new[] { "early", "late" }, (await pair.Second.SortedSetRangeAsync(key)).Select(item => item.Value));
        Assert.Equal(new[] { "late", "early" }, (await pair.First.SortedSetRangeAsync(key, descending: true)).Select(item => item.Value));
        Assert.Equal(9d, await pair.First.SortedSetScoreAsync(key, "late"));
        Assert.True(await pair.Second.SortedSetRemoveAsync(key, "late")); Assert.Equal(1L, await pair.First.SortedSetLengthAsync(key));
    }

    #endregion

    #region Conditional atomic batches

    [RedisOnlyFact]
    public async Task Competing_atomic_batches_have_exactly_one_winner()
    {
        await using var pair = await RedisPair.CreateAsync(); var guard = pair.Key("guard"); var payload = pair.Key("payload");
        var attempts = await Task.WhenAll(
            pair.First.CompareExchangeAsync([new RedisCondition(guard, null)], [new RedisWrite(guard, "first"), new RedisWrite(payload, "first-payload")]),
            pair.Second.CompareExchangeAsync([new RedisCondition(guard, null)], [new RedisWrite(guard, "second"), new RedisWrite(payload, "second-payload")]));
        Assert.Single(attempts, committed => committed);
        var state = await pair.First.GetManyAsync([guard, payload]);
        Assert.Equal(state[guard] + "-payload", state[payload]);
    }

    [RedisOnlyFact]
    public async Task Failed_condition_leaves_every_batch_write_untouched()
    {
        await using var pair = await RedisPair.CreateAsync(); var guard = pair.Key("guard"); var payload = pair.Key("payload");
        await pair.First.SetManyAsync(new Dictionary<string, string> { [guard] = "original", [payload] = "untouched" }, TimeSpan.FromMinutes(1));
        Assert.False(await pair.Second.CompareExchangeAsync([new RedisCondition(guard, "stale")], [new RedisWrite(guard, "wrong"), new RedisWrite(payload, null)]));
        Assert.Equal("original", await pair.First.GetStringAsync(guard)); Assert.Equal("untouched", await pair.First.GetStringAsync(payload));
    }

    #endregion

    #region Test documents
    private sealed record StoredTestDocument(string Name, int Count);
    #endregion
}

internal sealed class RedisPair : IAsyncDisposable
{
    #region Connections and key ownership
    private readonly IConnectionMultiplexer firstConnection;
    private readonly IConnectionMultiplexer secondConnection;
    private readonly HashSet<string> keys = new(StringComparer.Ordinal);
    public string Prefix { get; } = "bitro:test:{" + Guid.NewGuid().ToString("N") + "}:";
    public IRedisStore First { get; }
    public IRedisStore Second { get; }
    private RedisPair(IConnectionMultiplexer first, IConnectionMultiplexer second)
    {
        firstConnection = first; secondConnection = second;
        First = new RedisStore(first); Second = new RedisStore(second);
    }
    public static async Task<RedisPair> CreateAsync()
    {
        var connection = Environment.GetEnvironmentVariable("BITRO_TEST_REDIS_CONNECTION_STRING")!;
        return new RedisPair(await ConnectionMultiplexer.ConnectAsync(connection), await ConnectionMultiplexer.ConnectAsync(connection));
    }
    public string Key(string name) { var key = Prefix + name; keys.Add(key); return key; }
    #endregion

    #region Bounded cleanup
    public async ValueTask DisposeAsync()
    {
        try { await First.DeleteManyAsync(keys.ToArray()); }
        finally { firstConnection.Dispose(); secondConnection.Dispose(); }
    }
    #endregion
}
