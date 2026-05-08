# --- Stage 1: Build Frontend ---
FROM node:26-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend ---
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS backend-builder
WORKDIR /app/backend

# Install build dependencies
RUN apk add --no-cache gcc musl-dev

# Download dependencies
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy source
COPY backend/ ./
# Copy frontend assets for embedding
COPY --from=frontend-builder /app/frontend/dist ./dist

# Cross-compile for target platform (defined by docker buildx)
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags "-s -w" -o misignage ./main.go

# --- Stage 3: Final Image ---
FROM alpine:latest
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata ffmpeg chromium nss freetype harfbuzz ttf-freefont

# Create a non-root user and group with static UID/GID
RUN addgroup -g 1000 -S misignage && \
    adduser -u 1000 -S misignage -G misignage

# Copy binary from builder
COPY --from=backend-builder /app/backend/misignage ./

# Create necessary directories and set ownership
RUN mkdir -p uploads data && \
    chown -R misignage:misignage /app

# Switch to non-root user
USER misignage

# Environment variables
ENV PORT=8080
ENV DB_TYPE=sqlite
ENV DB_DSN=/app/data/misignage.db

# Expose port
EXPOSE 8080

# Run the application
CMD ["./misignage"]
