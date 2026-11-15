namespace BitroLearn.Api.Infrastructure.Caching;

public interface IRedisStore
{
    #region Connection
    Task<TimeSpan> PingAsync(CancellationToken cancellationToken = default);
    #endregion

    #region Strings and Json
    Task<string?> GetStringAsync(string key, CancellationToken cancellationToken = default);
    Task<bool> SetStringAsync(string key, string value, TimeSpan? expiry = null, RedisSetMode mode = RedisSetMode.Always, CancellationToken cancellationToken = default);
    Task<T?> GetJsonAsync<T>(string key, CancellationToken cancellationToken = default);
    Task<bool> SetJsonAsync<T>(string key, T value, TimeSpan? expiry = null, RedisSetMode mode = RedisSetMode.Always, CancellationToken cancellationToken = default);
    Task<long> IncrementAsync(string key, long value = 1, CancellationToken cancellationToken = default);
    Task<long> DecrementAsync(string key, long value = 1, CancellationToken cancellationToken = default);
    #endregion

    #region Keys and Expiration
    Task<bool> ExistsAsync(string key, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string key, CancellationToken cancellationToken = default);
    Task<long> DeleteManyAsync(IReadOnlyList<string> keys, CancellationToken cancellationToken = default);
    Task<bool> ExpireAsync(string key, TimeSpan? expiry, CancellationToken cancellationToken = default);
    Task<TimeSpan?> GetTimeToLiveAsync(string key, CancellationToken cancellationToken = default);
    IAsyncEnumerable<string> ScanKeysAsync(string pattern, int pageSize = 100, CancellationToken cancellationToken = default);
    #endregion

    #region Bulk and Atomic Batches
    Task<IReadOnlyDictionary<string, string?>> GetManyAsync(IReadOnlyList<string> keys, CancellationToken cancellationToken = default);
    Task SetManyAsync(IReadOnlyDictionary<string, string> values, TimeSpan? expiry = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<string, T?>> GetManyJsonAsync<T>(IReadOnlyList<string> keys, CancellationToken cancellationToken = default);
    Task SetManyJsonAsync<T>(IReadOnlyDictionary<string, T> values, TimeSpan? expiry = null, CancellationToken cancellationToken = default);
    Task<bool> CompareExchangeAsync(IReadOnlyList<RedisCondition> conditions, IReadOnlyList<RedisWrite> writes, CancellationToken cancellationToken = default);
    #endregion

    #region Hashes
    Task<string?> HashGetAsync(string key, string field, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<string, string>> HashGetAllAsync(string key, CancellationToken cancellationToken = default);
    Task<bool> HashSetAsync(string key, string field, string value, CancellationToken cancellationToken = default);
    Task HashSetManyAsync(string key, IReadOnlyDictionary<string, string> values, CancellationToken cancellationToken = default);
    Task<bool> HashDeleteAsync(string key, string field, CancellationToken cancellationToken = default);
    Task<bool> HashExistsAsync(string key, string field, CancellationToken cancellationToken = default);
    Task<long> HashIncrementAsync(string key, string field, long value = 1, CancellationToken cancellationToken = default);
    #endregion

    #region Lists
    Task<long> ListLeftPushAsync(string key, string value, CancellationToken cancellationToken = default);
    Task<long> ListRightPushAsync(string key, string value, CancellationToken cancellationToken = default);
    Task<string?> ListLeftPopAsync(string key, CancellationToken cancellationToken = default);
    Task<string?> ListRightPopAsync(string key, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<string>> ListRangeAsync(string key, long start = 0, long stop = -1, CancellationToken cancellationToken = default);
    Task<long> ListLengthAsync(string key, CancellationToken cancellationToken = default);
    #endregion

    #region Sets
    Task<bool> SetAddAsync(string key, string value, CancellationToken cancellationToken = default);
    Task<bool> SetRemoveAsync(string key, string value, CancellationToken cancellationToken = default);
    Task<bool> SetContainsAsync(string key, string value, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<string>> SetMembersAsync(string key, CancellationToken cancellationToken = default);
    Task<long> SetLengthAsync(string key, CancellationToken cancellationToken = default);
    #endregion

    #region Sorted Sets
    Task<bool> SortedSetAddAsync(string key, string value, double score, CancellationToken cancellationToken = default);
    Task<bool> SortedSetRemoveAsync(string key, string value, CancellationToken cancellationToken = default);
    Task<double?> SortedSetScoreAsync(string key, string value, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RedisSortedValue>> SortedSetRangeAsync(string key, long start = 0, long stop = -1, bool descending = false, CancellationToken cancellationToken = default);
    Task<long> SortedSetLengthAsync(string key, CancellationToken cancellationToken = default);
    #endregion
}

#region Public Data Contracts
public enum RedisSetMode { Always, OnlyIfMissing, OnlyIfExists }

// A null expected value means the key must not exist. Conditions are all checked atomically.
public sealed record RedisCondition(string Key, string? ExpectedValue = null);

// A null value means delete; otherwise set the string and its optional expiration.
public sealed record RedisWrite(string Key, string? Value = null, TimeSpan? Expiry = null);
public sealed record RedisSortedValue(string Value, double Score);

public sealed class RedisStoreException(string message, Exception innerException) : Exception(message, innerException) { }
#endregion
