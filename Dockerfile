# Multi-stage build for Grapes IDE (Headless API mode)
#
# NOTE: Docker can't run the full desktop UI without a display server.
# This image runs the embedded Axum API server in headless mode.

# Stage 1: Build frontend assets (for embedding into the Tauri binary)
FROM node:18-bookworm-slim as frontend-builder
WORKDIR /app/desktop

COPY desktop/package.json desktop/package-lock.json ./
COPY desktop/index.html desktop/vite.config.ts desktop/postcss.config.js desktop/tailwind.config.js ./
COPY desktop/tsconfig.json desktop/tsconfig.node.json ./
COPY desktop/src/frontend ./src/frontend

RUN npm ci
RUN npm run build:frontend

# Stage 2: Build the Rust/Tauri binary
FROM rust:1.75-slim-bookworm as desktop-builder
WORKDIR /app/desktop

RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev \
    libgtk-3-dev libwebkit2gtk-4.1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY desktop/Cargo.toml desktop/Cargo.lock desktop/build.rs desktop/tauri.conf.json ./
COPY desktop/capabilities ./capabilities
COPY desktop/icons ./icons
COPY desktop/src ./src

# `tauri_build::build()` expects the `frontendDist` from `tauri.conf.json`
COPY --from=frontend-builder /app/desktop/dist ./dist

RUN cargo build --release

# Stage 3: Runtime
FROM debian:bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    sqlite3 \
    libssl3 \
    libgtk-3-0 \
    libwebkit2gtk-4.1-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=desktop-builder /app/desktop/target/release/grapes-ide /app/grapes-ide

ENV GRAPES_HEADLESS=1
ENV RUST_LOG=info
ENV PORT=3001

EXPOSE 3001

CMD ["/app/grapes-ide"]
