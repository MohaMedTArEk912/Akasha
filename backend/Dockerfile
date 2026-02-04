# Build stage
FROM rust:1.75-slim-bookworm as builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apt-get update && \
    apt-get install -y pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Create a dummy project to cache dependencies
COPY Cargo.toml .
# We don't have Cargo.lock yet but if we did we'd copy it
# COPY Cargo.lock .

RUN mkdir src && \
    echo "fn main() {println!(\"if you see this, the build broke\")}" > src/main.rs

RUN cargo build --release

# Copy source code
COPY . .

# Touch main.rs to force rebuild
RUN touch src/main.rs

# Build the actual application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y libssl3 ca-certificates sqlite3 && \
    rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /usr/src/app/target/release/grapes-backend /app/grapes-backend

# Expose port
EXPOSE 3001

# Run
CMD ["./grapes-backend"]
