using System.Runtime.CompilerServices;
using System.Text.Json;
using StackExchange.Redis;

namespace BitroLearn.Api.Infrastructure.Caching;

public sealed class RedisStore(IConnectionMultiplexer connection) : IRedisStore
{
    #region Constants and Dependencies
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IDatabase database = connection.GetDatabase();
    #endregion

    #region Connection
    public Task<TimeSpan> PingAsync(CancellationToken cancellationToken = default)
        => ExecuteAsync(() => database.PingAsync(), cancellationToken);
    #endregion

    #region Strings and Json
    public async Task<string?> GetStringAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        var value = await ExecuteAsync(() => database.StringGetAsync(key), cancellationToken);
        return value.HasValue ? value.ToString() : null;
    }

    public Task<bool> SetStringAsync(string key, string value, TimeSpan? expiry = null, RedisSetMode mode = RedisSetMode.Always, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(value); ValidateExpiry(expiry);
        return ExecuteAsync(() => database.StringSetAsync(key, value, expiry, when: ToWhen(mode)), cancellationToken);
    }

    public async Task<T?> GetJsonAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var value = await GetStringAsync(key, cancellationToken);
        return value is null ? default : Deserialize<T>(value);
    }

    public Task<bool> SetJsonAsync<T>(string key, T value, TimeSpan? expiry = null, RedisSetMode mode = RedisSetMode.Always, CancellationToken cancellationToken = default)
        => SetStringAsync(key, JsonSerializer.Serialize(value, JsonOptions), expiry, mode, cancellationToken);

    public Task<long> IncrementAsync(string key, long value = 1, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        return ExecuteAsync(() => database.StringIncrementAsync(key, value), cancellationToken);
    }

    public Task<long> DecrementAsync(string key, long value = 1, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        return ExecuteAsync(() => database.StringDecrementAsync(key, value), cancellationToken);
    }
    #endregion

    #region Keys and Expiration
    public Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        return ExecuteAsync(() => database.KeyExistsAsync(key), cancellationToken);
    }

    public Task<bool> DeleteAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        return ExecuteAsync(() => database.KeyDeleteAsync(key), cancellationToken);
    }

    public Task<long> DeleteManyAsync(IReadOnlyList<string> keys, CancellationToken cancellationToken = default)
    {
        var redisKeys = ToKeys(keys);
        return redisKeys.Length == 0 ? Task.FromResult(0L) : ExecuteAsync(() => database.KeyDeleteAsync(redisKeys), cancellationToken);
    }

    public Task<bool> ExpireAsync(string key, TimeSpan? expiry, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ValidateExpiry(expiry);
        return ExecuteAsync(() => database.KeyExpireAsync(key, expiry), cancellationToken);
    }

    public Task<TimeSpan?> GetTimeToLiveAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        return ExecuteAsync(() => database.KeyTimeToLiveAsync(key), cancellationToken);
    }

    public async IAsyncEnumerable<string> ScanKeysAsync(string pattern, int pageSize = 100, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(pattern);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(pageSize);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var endpoint in connection.GetEndPoints())
        {
            var server = connection.GetServer(endpoint);
            if (!server.IsConnected || server.IsReplica) continue;
            await using var enumerator = server.KeysAsync(database.Database, pattern, pageSize: pageSize).GetAsyncEnumerator(cancellationToken);
            while (await ExecuteAsync(() => enumerator.MoveNextAsync().AsTask(), cancellationToken))
            {
                var key = enumerator.Current.ToString();
                if (seen.Add(key)) yield return key;
            }
        }
    }
    #endregion

    #region Bulk and Atomic Batches
    public async Task<IReadOnlyDictionary<string, string?>> GetManyAsync(IReadOnlyList<string> keys, CancellationToken cancellationToken = default)
    {
        var redisKeys = ToKeys(keys);
        if (redisKeys.Length == 0) return new Dictionary<string, string?>();
        var values = await ExecuteAsync(() => database.StringGetAsync(redisKeys), cancellationToken);
        var result = new Dictionary<string, string?>(keys.Count, StringComparer.Ordinal);
        for (var index = 0; index < keys.Count; index++) result[keys[index]] = values[index].HasValue ? values[index].ToString() : null;
        return result;
    }

    public async Task SetManyAsync(IReadOnlyDictionary<string, string> values, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(values);
        if (values.Count == 0) return;
        await CompareExchangeAsync([], values.Select(pair => new RedisWrite(pair.Key, pair.Value, expiry)).ToArray(), cancellationToken);
    }

    public async Task<IReadOnlyDictionary<string, T?>> GetManyJsonAsync<T>(IReadOnlyList<string> keys, CancellationToken cancellationToken = default)
    {
        var values = await GetManyAsync(keys, cancellationToken);
        return values.ToDictionary(pair => pair.Key, pair => pair.Value is null ? default : Deserialize<T>(pair.Value), StringComparer.Ordinal);
    }

    public Task SetManyJsonAsync<T>(IReadOnlyDictionary<string, T> values, TimeSpan? expiry = null, CancellationToken cancellationToken = default)
        => SetManyAsync(values.ToDictionary(pair => pair.Key, pair => JsonSerializer.Serialize(pair.Value, JsonOptions), StringComparer.Ordinal), expiry, cancellationToken);

    public async Task<bool> CompareExchangeAsync(IReadOnlyList<RedisCondition> conditions, IReadOnlyList<RedisWrite> writes, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(conditions); ArgumentNullException.ThrowIfNull(writes);
        foreach (var condition in conditions) ValidateKey(condition.Key);
        foreach (var write in writes) { ValidateKey(write.Key); ValidateExpiry(write.Expiry); }
        if (writes.Count == 0) throw new ArgumentException("An atomic batch must contain at least one write.", nameof(writes));
        return await ExecuteAsync(async () =>
        {
            var transaction = database.CreateTransaction();
            foreach (var condition in conditions)
                transaction.AddCondition(condition.ExpectedValue is null
                    ? Condition.KeyNotExists(condition.Key) : Condition.StringEqual(condition.Key, condition.ExpectedValue));
            var commands = new List<Task<bool>>(writes.Count);
            foreach (var write in writes)
                commands.Add(write.Value is null ? transaction.KeyDeleteAsync(write.Key) : transaction.StringSetAsync(write.Key, write.Value, write.Expiry));
            var committed = await transaction.ExecuteAsync();
            if (committed) await Task.WhenAll(commands);
            return committed;
        }, cancellationToken);
    }
    #endregion

    #region Hashes
    public async Task<string?> HashGetAsync(string key, string field, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(field);
        var value = await ExecuteAsync(() => database.HashGetAsync(key, field), cancellationToken);
        return value.HasValue ? value.ToString() : null;
    }

    public async Task<IReadOnlyDictionary<string, string>> HashGetAllAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        var entries = await ExecuteAsync(() => database.HashGetAllAsync(key), cancellationToken);
        return entries.ToDictionary(entry => entry.Name.ToString(), entry => entry.Value.ToString(), StringComparer.Ordinal);
    }

    public Task<bool> HashSetAsync(string key, string field, string value, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(field); ArgumentNullException.ThrowIfNull(value);
        return ExecuteAsync(() => database.HashSetAsync(key, field, value), cancellationToken);
    }

    public Task HashSetManyAsync(string key, IReadOnlyDictionary<string, string> values, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(values);
        return ExecuteAsync(async () => { await database.HashSetAsync(key, values.Select(pair => new HashEntry(pair.Key, pair.Value)).ToArray()); return true; }, cancellationToken);
    }

    public Task<bool> HashDeleteAsync(string key, string field, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(field);
        return ExecuteAsync(() => database.HashDeleteAsync(key, field), cancellationToken);
    }

    public Task<bool> HashExistsAsync(string key, string field, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(field);
        return ExecuteAsync(() => database.HashExistsAsync(key, field), cancellationToken);
    }

    public Task<long> HashIncrementAsync(string key, string field, long value = 1, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(field);
        return ExecuteAsync(() => database.HashIncrementAsync(key, field, value), cancellationToken);
    }
    #endregion

    #region Lists
    public Task<long> ListLeftPushAsync(string key, string value, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(value);
        return ExecuteAsync(() => database.ListLeftPushAsync(key, value), cancellationToken);
    }
    public Task<long> ListRightPushAsync(string key, string value, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(value);
        return ExecuteAsync(() => database.ListRightPushAsync(key, value), cancellationToken);
    }
    public async Task<string?> ListLeftPopAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        var value = await ExecuteAsync(() => database.ListLeftPopAsync(key), cancellationToken);
        return value.HasValue ? value.ToString() : null;
    }
    public async Task<string?> ListRightPopAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        var value = await ExecuteAsync(() => database.ListRightPopAsync(key), cancellationToken);
        return value.HasValue ? value.ToString() : null;
    }
    public async Task<IReadOnlyList<string>> ListRangeAsync(string key, long start = 0, long stop = -1, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        var values = await ExecuteAsync(() => database.ListRangeAsync(key, start, stop), cancellationToken);
        return values.Select(value => value.ToString()).ToArray();
    }
    public Task<long> ListLengthAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        return ExecuteAsync(() => database.ListLengthAsync(key), cancellationToken);
    }
    #endregion

    #region Sets
    public Task<bool> SetAddAsync(string key, string value, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(value);
        return ExecuteAsync(() => database.SetAddAsync(key, value), cancellationToken);
    }
    public Task<bool> SetRemoveAsync(string key, string value, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(value);
        return ExecuteAsync(() => database.SetRemoveAsync(key, value), cancellationToken);
    }
    public Task<bool> SetContainsAsync(string key, string value, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(value);
        return ExecuteAsync(() => database.SetContainsAsync(key, value), cancellationToken);
    }
    public async Task<IReadOnlyList<string>> SetMembersAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        var values = await ExecuteAsync(() => database.SetMembersAsync(key), cancellationToken);
        return values.Select(value => value.ToString()).ToArray();
    }
    public Task<long> SetLengthAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        return ExecuteAsync(() => database.SetLengthAsync(key), cancellationToken);
    }
    #endregion

    #region Sorted Sets
    public Task<bool> SortedSetAddAsync(string key, string value, double score, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(value);
        if (!double.IsFinite(score)) throw new ArgumentOutOfRangeException(nameof(score));
        return ExecuteAsync(() => database.SortedSetAddAsync(key, value, score), cancellationToken);
    }
    public Task<bool> SortedSetRemoveAsync(string key, string value, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(value);
        return ExecuteAsync(() => database.SortedSetRemoveAsync(key, value), cancellationToken);
    }
    public Task<double?> SortedSetScoreAsync(string key, string value, CancellationToken cancellationToken = default)
    {
        ValidateKey(key); ArgumentNullException.ThrowIfNull(value);
        return ExecuteAsync(() => database.SortedSetScoreAsync(key, value), cancellationToken);
    }
    public async Task<IReadOnlyList<RedisSortedValue>> SortedSetRangeAsync(string key, long start = 0, long stop = -1, bool descending = false, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        var values = await ExecuteAsync(() => database.SortedSetRangeByRankWithScoresAsync(key, start, stop, descending ? Order.Descending : Order.Ascending), cancellationToken);
        return values.Select(value => new RedisSortedValue(value.Element.ToString(), value.Score)).ToArray();
    }
    public Task<long> SortedSetLengthAsync(string key, CancellationToken cancellationToken = default)
    {
        ValidateKey(key);
        return ExecuteAsync(() => database.SortedSetLengthAsync(key), cancellationToken);
    }
    #endregion

    #region Private Helpers
    private static async Task<T> ExecuteAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try { return await operation().WaitAsync(cancellationToken); }
        catch (Exception exception) when (exception is RedisException or TimeoutException)
        {
            throw new RedisStoreException("Redis operation could not be completed.", exception);
        }
    }
    private static T? Deserialize<T>(string value)
    {
        try { return JsonSerializer.Deserialize<T>(value, JsonOptions); }
        catch (JsonException exception) { throw new RedisStoreException("Redis JSON value is invalid.", exception); }
    }
    private static void ValidateKey(string key) => ArgumentException.ThrowIfNullOrWhiteSpace(key);
    private static void ValidateExpiry(TimeSpan? expiry)
    {
        if (expiry is { } value && value <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(expiry));
    }
    private static RedisKey[] ToKeys(IReadOnlyList<string> keys)
    {
        ArgumentNullException.ThrowIfNull(keys);
        return keys.Select(key => { ValidateKey(key); return (RedisKey)key; }).ToArray();
    }
    private static When ToWhen(RedisSetMode mode) => mode switch
    {
        RedisSetMode.Always => When.Always,
        RedisSetMode.OnlyIfMissing => When.NotExists,
        RedisSetMode.OnlyIfExists => When.Exists,
        _ => throw new ArgumentOutOfRangeException(nameof(mode))
    };
    #endregion
}
