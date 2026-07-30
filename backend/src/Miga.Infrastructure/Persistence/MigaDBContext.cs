using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Miga.Domain.Entities;
using Miga.Domain.Enums;
using Miga.Infrastructure.Auth;

namespace Miga.Infrastructure.Persistence;

public sealed class MigaDbContext
    : IdentityDbContext<MigaUser, IdentityRole<Guid>, Guid>, IDataProtectionKeyContext
{
    public MigaDbContext(DbContextOptions<MigaDbContext> options)
        : base(options)
    {
    }

    public DbSet<Workspace> Workspaces => Set<Workspace>();

    public DbSet<WorkspaceSnapshot> WorkspaceSnapshots => Set<WorkspaceSnapshot>();

    public DbSet<UserSession> UserSessions => Set<UserSession>();

    public DbSet<DemoSession> DemoSessions => Set<DemoSession>();

    public DbSet<SecurityAuditEvent> SecurityAuditEvents => Set<SecurityAuditEvent>();

    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        ConfigureIdentity(builder);
        ConfigureWorkspaces(builder);
        ConfigureSessions(builder);
        ConfigureAudit(builder);

        builder.Entity<DataProtectionKey>(entity =>
        {
            entity.ToTable("data_protection_keys", "auth");
        });
    }

    private static void ConfigureIdentity(ModelBuilder builder)
    {
        builder.Entity<MigaUser>(entity =>
        {
            entity.ToTable(
                "users",
                "auth",
                table =>
                {
                    table.HasCheckConstraint(
                        "CK_users_confirmed_privacy",
                        "NOT \"EmailConfirmed\" OR " +
                        "(\"PrivacyPolicyVersion\" IS NOT NULL AND " +
                        "\"PrivacyPolicyAcceptedAtUtc\" IS NOT NULL)");
                    table.HasCheckConstraint(
                        "CK_users_pending_demo_link",
                        "(\"PendingDemoWorkspaceId\" IS NULL AND " +
                        "\"PendingDemoSessionId\" IS NULL AND " +
                        "\"PendingDemoExpiresAtUtc\" IS NULL) OR " +
                        "(NOT \"EmailConfirmed\" AND " +
                        "\"PendingDemoWorkspaceId\" IS NOT NULL AND " +
                        "\"PendingDemoSessionId\" IS NOT NULL AND " +
                        "\"PendingDemoExpiresAtUtc\" IS NOT NULL)");
                });
            entity.Property(x => x.Email).HasMaxLength(254).IsRequired();
            entity.Property(x => x.NormalizedEmail).HasMaxLength(254).IsRequired();
            entity.Property(x => x.UserName).HasMaxLength(254).IsRequired();
            entity.Property(x => x.NormalizedUserName).HasMaxLength(254).IsRequired();
            entity.Property(x => x.PrivacyPolicyVersion).HasMaxLength(32);
            entity.HasIndex(x => x.NormalizedEmail)
                .HasDatabaseName("IX_users_normalized_email")
                .IsUnique();
            entity.HasIndex(x => x.PendingDemoWorkspaceId)
                .HasDatabaseName("IX_users_pending_demo_workspace")
                .IsUnique()
                .HasFilter("\"PendingDemoWorkspaceId\" IS NOT NULL");
        });

        builder.Entity<IdentityRole<Guid>>().ToTable("roles", "auth");
        builder.Entity<IdentityUserRole<Guid>>().ToTable("user_roles", "auth");
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims", "auth");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins", "auth");
        builder.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claims", "auth");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens", "auth");
    }

    private void ConfigureWorkspaces(ModelBuilder builder)
    {
        builder.Entity<Workspace>(entity =>
        {
            entity.ToTable(
                "workspaces",
                "app",
                table => table.HasCheckConstraint(
                    "CK_workspaces_kind_expiry",
                    "(\"Kind\" = 'Demo' AND \"ExpiresAtUtc\" IS NOT NULL AND \"OwnerUserId\" IS NULL) OR " +
                    "(\"Kind\" = 'Registered' AND \"ExpiresAtUtc\" IS NULL AND \"OwnerUserId\" IS NOT NULL)"));
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Kind)
                .HasConversion<string>()
                .HasMaxLength(16);
            entity.HasIndex(x => x.OwnerUserId)
                .IsUnique()
                .HasFilter("\"OwnerUserId\" IS NOT NULL");
            entity.HasIndex(x => new { x.Kind, x.ExpiresAtUtc });
            entity.HasOne<MigaUser>()
                .WithOne()
                .HasForeignKey<Workspace>(x => x.OwnerUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<WorkspaceSnapshot>(entity =>
        {
            entity.ToTable("workspace_snapshots", "app");
            entity.HasKey(x => x.WorkspaceId);
            entity.Property(x => x.DataJson).IsRequired();
            if (Database.IsNpgsql())
            {
                entity.Property(x => x.DataJson).HasColumnType("jsonb");
            }

            entity.HasOne(x => x.Workspace)
                .WithOne(x => x.Snapshot)
                .HasForeignKey<WorkspaceSnapshot>(x => x.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureSessions(ModelBuilder builder)
    {
        builder.Entity<UserSession>(entity =>
        {
            entity.ToTable("user_sessions", "auth");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.SecurityStampAtIssue).HasMaxLength(256).IsRequired();
            entity.HasIndex(x => new { x.UserId, x.RevokedAtUtc });
            entity.HasIndex(x => x.AbsoluteExpiresAtUtc);
            entity.HasOne<MigaUser>()
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<DemoSession>(entity =>
        {
            entity.ToTable("demo_sessions", "app");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.WorkspaceId).IsUnique();
            entity.HasIndex(x => new { x.RevokedAtUtc, x.AbsoluteExpiresAtUtc });
            entity.HasOne(x => x.Workspace)
                .WithOne(x => x.DemoSession)
                .HasForeignKey<DemoSession>(x => x.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureAudit(ModelBuilder builder)
    {
        builder.Entity<SecurityAuditEvent>(entity =>
        {
            entity.ToTable("security_events", "audit");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.EventType).HasMaxLength(96).IsRequired();
            entity.Property(x => x.Outcome).HasMaxLength(32).IsRequired();
            entity.Property(x => x.ActorType).HasMaxLength(24);
            entity.Property(x => x.CorrelationId).HasMaxLength(128).IsRequired();
            entity.HasIndex(x => x.OccurredAtUtc);
            entity.HasIndex(x => new { x.ActorType, x.ActorId });
        });
    }
}
