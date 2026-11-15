using Xunit;

// Configuration deliberately uses OS environment variables; tests restore their changes.
#region Process-wide test isolation
[assembly: CollectionBehavior(DisableTestParallelization = true)]
#endregion
