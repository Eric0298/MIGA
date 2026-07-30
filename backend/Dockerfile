# syntax=docker/dockerfile:1.7

# --- Build stage --------------------------------------------------------------
# Uses the same SDK pinned in ../global.json (10.0.301).
FROM mcr.microsoft.com/dotnet/sdk:10.0.301-noble AS build
WORKDIR /src

# Root-level files that participate in restore/build reproducibility.
COPY global.json ./
COPY Directory.Build.props ./
COPY .config/ ./.config/
COPY backend/ backend/

# Tool restore for dotnet-ef (used by the migrations bundle step below).
RUN dotnet tool restore

# Locked-mode restore against the committed packages.lock.json files.
RUN dotnet restore backend/src/Miga.Api/Miga.Api.csproj --locked-mode
RUN dotnet restore backend/src/Miga.Infrastructure/Miga.Infrastructure.csproj --locked-mode

# Framework-dependent publish. The runtime image already ships ASP.NET Core 10.
RUN dotnet publish backend/src/Miga.Api/Miga.Api.csproj \
        --configuration Release \
        --no-restore \
        --no-self-contained \
        --output /app/publish \
        /p:UseAppHost=false

# Self-contained migrations bundle: single native executable that applies the
# EF Core migrations against the target database without needing the SDK.
RUN dotnet tool run dotnet-ef -- migrations bundle \
        --project backend/src/Miga.Infrastructure/Miga.Infrastructure.csproj \
        --startup-project backend/src/Miga.Api/Miga.Api.csproj \
        --context MigaDbContext \
        --configuration Release \
        --self-contained \
        --target-runtime linux-x64 \
        --output /app/publish/migrate \
        --force

# --- Runtime stage ------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS runtime

ARG APP_UID=10001
ARG APP_GID=10001

ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_gcServer=1 \
    DOTNET_EnableDiagnostics=0 \
    ASPNETCORE_URLS=http://0.0.0.0:8080 \
    TZ=UTC

# ca-certificates + tzdata are required for TLS to PostgreSQL / SMTP.
# libgssapi-krb5-2 silences a runtime warning from Npgsql when GSSAPI is probed.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        tzdata \
        libgssapi-krb5-2; \
    rm -rf /var/lib/apt/lists/*; \
    groupadd --system --gid ${APP_GID} miga; \
    useradd  --system --uid ${APP_UID} --gid ${APP_GID} --home-dir /app --shell /usr/sbin/nologin miga

WORKDIR /app

COPY --from=build --chown=miga:miga /app/publish/ ./

# Migration bundle is a self-contained native binary; make it executable.
RUN chmod 0555 /app/migrate && chown miga:miga /app/migrate

USER miga

EXPOSE 8080

ENTRYPOINT ["dotnet", "Miga.Api.dll"]
