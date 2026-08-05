# Asset Tracker — Web Version
# Multi-stage build: install deps, then run the server.

# ---------- Build stage ----------
FROM node:20-slim AS build
WORKDIR /app

# better-sqlite3 requires native compilation tooling on Debian/slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

# ---------- Runtime stage ----------
FROM node:20-slim
WORKDIR /app

# Only runtime packages + native modules are needed.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy installed node_modules (includes compiled better-sqlite3).
COPY --from=build /app/node_modules ./node_modules

# Copy app source.
COPY server.js app.js package.json ./
COPY controllers ./controllers
COPY routes ./routes
COPY services ./services
COPY db ./db
COPY middleware ./middleware
COPY utils ./utils
COPY client ./client

# Data volume (SQLite DB + backups) — mount a persistent volume here.
ENV APP_DATA_DIR=/app/data
ENV DB_PATH=/app/data/assets.db
ENV BACKUP_DIR=/app/data/backups
ENV PORT=8080
ENV HOST=0.0.0.0

RUN mkdir -p /app/data && chmod -R a+rw /app/data
VOLUME ["/app/data"]

EXPOSE 8080
CMD ["node", "server.js"]
