using Npgsql;

namespace Miga.Infrastructure.Security;

public static class DatabaseConnectionSecurityValidator
{
    public static void ValidateProduction(string connectionString)
    {
        NpgsqlConnectionStringBuilder builder;

        try
        {
            builder = new NpgsqlConnectionStringBuilder(connectionString);
        }
        catch (ArgumentException exception)
        {
            throw new InvalidOperationException(
                "Connection string 'MigaDatabase' is not a valid PostgreSQL connection string.",
                exception);
        }

        var trustsServerCertificate =
            builder.TryGetValue("Trust Server Certificate", out var trustValue) &&
            trustValue is true;

        if (builder.SslMode != SslMode.VerifyFull ||
            trustsServerCertificate)
        {
            throw new InvalidOperationException(
                "Production PostgreSQL connections must use 'SSL Mode=VerifyFull' " +
                "and 'Trust Server Certificate=false'.");
        }
    }
}
