FROM postgres:18.4-alpine3.23@sha256:996d0920e4ff9df1fc19dacb904492f3c1ec0ec1cc338f0ad7123be7731c5f5e

# The official entrypoint skips its privilege-drop helper when it already runs as postgres.
USER root
RUN test -x /usr/local/bin/gosu && rm /usr/local/bin/gosu

USER postgres
