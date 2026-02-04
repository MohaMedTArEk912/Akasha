# Stage 1: Build Frontend
FROM node:18-alpine as frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Build Backend
FROM rust:1.75-slim-bookworm as backend-builder
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
COPY backend/Cargo.toml .
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
COPY backend/ .
RUN touch src/main.rs && cargo build --release

# Stage 3: Final Runtime
FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libssl3 ca-certificates sqlite3 && rm -rf /var/lib/apt/lists/*

# Copy backend binary
COPY --from=backend-builder /usr/src/app/target/release/grapes-backend /app/grapes-backend

# Copy frontend dist folder (backend expects it at ../frontend/dist)
# But in docker we can place it anywhere and adjust main.rs or just match the path.
# Let's match the path: /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose port
EXPOSE 3001

# Environment variables
ENV PORT=3001
ENV RUST_LOG=info

# Run
CMD ["./grapes-backend"]
