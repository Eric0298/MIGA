using Microsoft.EntityFrameworkCore;

namespace Miga.Infrastructure.Persistence;

public sealed class MigaDbContext : DbContext
{
    public MigaDbContext(DbContextOptions<MigaDbContext> options)
        : base(options)
    {
    }
}