using BitroLearn.Api.Infrastructure.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BitroLearn.Api.Data;

public sealed class AppDbContextDesignFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    #region Design-Time Context Creation

    public AppDbContext CreateDbContext(string[] args)
    {
        // Scaffolding a migration needs provider metadata, not a live database.
        var connection = AppConfigurationStatic.DbConnectionStringKey.ReadEnv()
                         ?? "Host=localhost;Database=bitro_design;Username=design";
        return new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(connection).Options);
    }

    #endregion
}
