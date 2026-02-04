# Multi-stage build for Grapes IDE Desktop Application
# This builds the complete desktop application with embedded backend and frontend

# Stage 1: Build Frontend
FROM node:18-alpine as frontend-builder
WORKDIR /app/frontend
COPY desktop/src/frontend/package*.json ./
RUN npm install
COPY desktop/src/frontend/ .
RUN npm run build

# Stage 2: Build Desktop App (Tauri + Rust Backend)
FROM rust:1.75-slim-bookworm as desktop-builder
WORKDIR /app
RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev \
    libgtk-3-dev libwebkit2gtk-4.1-dev \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Copy the desktop application
COPY desktop/ .
COPY --from=frontend-builder /app/frontend/dist ./src/frontend/dist

# Build the Rust/Tauri application
RUN cargo build --release

# Stage 3: Final Runtime (Debian with built binaries)
FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    sqlite3 \
    libgtk-3-0 \
    libwebkit2gtk-4.1-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy the built desktop application
COPY --from=desktop-builder /app/target/release/grapes-ide /app/grapes-ide

# Create data directory
RUN mkdir -p /app/data

# Expose port (for backend API within the app)
EXPOSE 3001

# Environment variables
ENV RUST_LOG=info
ENV PORT=3001

# For running the application (headless mode would require additional setup)
# This is primarily for development. Production would use the actual binary differently
CMD ["/app/grapes-ide"]
