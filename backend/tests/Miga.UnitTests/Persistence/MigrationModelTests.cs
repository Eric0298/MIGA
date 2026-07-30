using Microsoft.EntityFrameworkCore;
using Miga.Infrastructure.Persistence;
using Shouldly;

namespace Miga.UnitTests.Persistence;

public sealed class MigrationModelTests
{
    [Fact]
    public void InitialMigration_ShouldMatchTheRuntimePostgreSqlModel()
    {
        var options = new DbContextOptionsBuilder<MigaDbContext>()
            .UseNpgsql(
                "Host=localhost;Database=miga_model_check;Username=model_check;" +
                "SSL Mode=Disable")
            .Options;
        using var dbContext = new MigaDbContext(options);

        dbContext.Database.HasPendingModelChanges().ShouldBeFalse();
    }
}
