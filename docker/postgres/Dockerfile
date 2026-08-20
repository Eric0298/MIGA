FROM postgres:18.6-alpine3.23@sha256:697c180dbf244d3ce4a8f4cbc0156cde840af055c1bf8b76aebe422a4822086f

# The official entrypoint skips its privilege-drop helper when it already runs as postgres.
USER root
RUN test -x /usr/local/bin/gosu && rm /usr/local/bin/gosu

USER postgres
