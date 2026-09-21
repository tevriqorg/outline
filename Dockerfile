ARG APP_PATH=/opt/outline
ARG BASE_IMAGE=outlinewiki/outline-base
FROM ${BASE_IMAGE} AS base

ARG APP_PATH
WORKDIR $APP_PATH

# ---
FROM node:26.3.0-slim AS runner

LABEL org.opencontainers.image.source="https://github.com/outline/outline"

ARG APP_PATH
# Optional Debian mirror for networks with slow access to deb.debian.org.
# Empty by default, so the upstream package endpoints are left untouched.
ARG DEBIAN_MIRROR
WORKDIR $APP_PATH
ENV NODE_ENV=production

# Limit glibc malloc arenas, which default to 8 per CPU. Each arena can hold
# onto 64MB of virtual memory and freed allocations, which inflates resident
# memory in multi-threaded Node.js processes for no performance benefit here.
ENV MALLOC_ARENA_MAX=2

# Create a non-root user compatible with Debian and BusyBox based images
RUN addgroup --gid 1001 nodejs && \
    adduser --uid 1001 --ingroup nodejs nodejs && \
    mkdir -p /var/lib/outline && \
    chown -R nodejs:nodejs /var/lib/outline && \
    chown -R nodejs:nodejs $APP_PATH

COPY --from=base --chown=nodejs:nodejs $APP_PATH/build ./build
COPY --from=base --chown=nodejs:nodejs $APP_PATH/server ./server
COPY --from=base --chown=nodejs:nodejs $APP_PATH/public ./public
COPY --from=base --chown=nodejs:nodejs $APP_PATH/.sequelizerc ./.sequelizerc
COPY --from=base --chown=nodejs:nodejs $APP_PATH/node_modules ./node_modules
COPY --from=base --chown=nodejs:nodejs $APP_PATH/package.json ./package.json
# This slim base image ships without CA certificates, and Debian mirrors may
# redirect plain HTTP to HTTPS. Without a usable trust store that redirect
# fails with "certificate verify failed" (error:0A000086). Reuse the trust
# store already installed by the build stage instead of fetching it again
# (local copies, no network access). All three paths are required: openssl's
# default CA location /usr/lib/ssl is entirely absent from the slim image, so
# copying /etc/ssl alone still leaves apt unable to verify TLS.
COPY --from=base /etc/ssl /etc/ssl
COPY --from=base /usr/lib/ssl /usr/lib/ssl
COPY --from=base /usr/share/ca-certificates /usr/share/ca-certificates
# a local copy and needs no network access.
COPY --from=base /etc/ssl/certs /etc/ssl/certs
COPY --from=base /usr/share/ca-certificates /usr/share/ca-certificates
# Install wget to healthcheck the server
RUN if [ -n "$DEBIAN_MIRROR" ]; then \
      for f in /etc/apt/sources.list /etc/apt/sources.list.d/debian.sources; do \
        if [ -f "$f" ]; then sed -i -E "s|https?://deb\.debian\.org|${DEBIAN_MIRROR}|g" "$f"; fi; \
      done; \
    fi && \
    apt-get update \
    && apt-get install -y wget \
    && rm -rf /var/lib/apt/lists/*

ENV FILE_STORAGE_LOCAL_ROOT_DIR=/var/lib/outline/data
RUN mkdir -p "$FILE_STORAGE_LOCAL_ROOT_DIR" && \
    chown -R nodejs:nodejs "$FILE_STORAGE_LOCAL_ROOT_DIR" && \
    chmod 1777 "$FILE_STORAGE_LOCAL_ROOT_DIR"

VOLUME /var/lib/outline/data

USER nodejs

HEALTHCHECK --interval=1m CMD wget -qO- "http://localhost:${PORT:-3000}/_health" | grep -q "OK" || exit 1

EXPOSE 3000
CMD ["node", "build/server/index.js"]
