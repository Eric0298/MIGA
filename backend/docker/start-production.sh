#!/bin/sh
# Production startup for the Miga API container.
# Ordered: validate secret presence, apply EF migrations, exec the API as PID 1.
# Never prints the connection string, host, user, password, or environment dump.

set -eu

echo "startup: validating database configuration"

if [ -z "${ConnectionStrings__MigaDatabase:-}" ]; then
    echo "startup: database connection variable is unavailable" >&2
    exit 1
fi

echo "startup: applying database migrations"

if ! /app/migrate --connection "$ConnectionStrings__MigaDatabase"; then
    echo "startup: database migration failed" >&2
    exit 1
fi

echo "startup: database migrations complete"
echo "startup: launching API"

exec dotnet Miga.Api.dll
