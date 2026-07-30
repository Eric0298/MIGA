using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Miga.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DeferredDemoConfirmation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "PrivacyPolicyVersion",
                schema: "auth",
                table: "users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32);

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "PrivacyPolicyAcceptedAtUtc",
                schema: "auth",
                table: "users",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PendingDemoExpiresAtUtc",
                schema: "auth",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PendingDemoSessionId",
                schema: "auth",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PendingDemoWorkspaceId",
                schema: "auth",
                table: "users",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_pending_demo_workspace",
                schema: "auth",
                table: "users",
                column: "PendingDemoWorkspaceId",
                unique: true,
                filter: "\"PendingDemoWorkspaceId\" IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_users_confirmed_privacy",
                schema: "auth",
                table: "users",
                sql: "NOT \"EmailConfirmed\" OR (\"PrivacyPolicyVersion\" IS NOT NULL AND \"PrivacyPolicyAcceptedAtUtc\" IS NOT NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_users_pending_demo_link",
                schema: "auth",
                table: "users",
                sql: "(\"PendingDemoWorkspaceId\" IS NULL AND \"PendingDemoSessionId\" IS NULL AND \"PendingDemoExpiresAtUtc\" IS NULL) OR (NOT \"EmailConfirmed\" AND \"PendingDemoWorkspaceId\" IS NOT NULL AND \"PendingDemoSessionId\" IS NOT NULL AND \"PendingDemoExpiresAtUtc\" IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM auth.users
                        WHERE "PrivacyPolicyVersion" IS NULL
                           OR "PrivacyPolicyAcceptedAtUtc" IS NULL
                    ) THEN
                        RAISE EXCEPTION
                            'DeferredDemoConfirmation cannot be rolled back safely while users with pending privacy acceptance exist. Confirm or remove those accounts explicitly before retrying the downgrade.';
                    END IF;
                END $$;
                """);

            migrationBuilder.DropIndex(
                name: "IX_users_pending_demo_workspace",
                schema: "auth",
                table: "users");

            migrationBuilder.DropCheckConstraint(
                name: "CK_users_confirmed_privacy",
                schema: "auth",
                table: "users");

            migrationBuilder.DropCheckConstraint(
                name: "CK_users_pending_demo_link",
                schema: "auth",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PendingDemoExpiresAtUtc",
                schema: "auth",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PendingDemoSessionId",
                schema: "auth",
                table: "users");

            migrationBuilder.DropColumn(
                name: "PendingDemoWorkspaceId",
                schema: "auth",
                table: "users");

            migrationBuilder.AlterColumn<string>(
                name: "PrivacyPolicyVersion",
                schema: "auth",
                table: "users",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(32)",
                oldMaxLength: 32,
                oldNullable: true);

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "PrivacyPolicyAcceptedAtUtc",
                schema: "auth",
                table: "users",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)),
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);
        }
    }
}
