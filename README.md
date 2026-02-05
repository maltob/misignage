# miSignage

miSignage is a Digital Signage management system designed for self-hosting. It allows organizations to manage displays, playlists, and schedules through a centralized web interface.

## Features

- **Device Management**: Link and monitor digital signage players.
- **Content Library**: Upload images and videos. Support for external webpages.
- **Playlists**: Create sequential playlists of content.
- **Scheduling**: Schedule playlists to run on specific displays at specific times.
- **Webpage Rendering**: Server-side rendering of webpages for displays that cannot handle complex web content directly.
- **OIDC Authentication**: Secure Single Sign-On (SSO) support.
- **API Access**: Generate API keys for external automation.
- **User Roles**: Roles for Admins, Managers, and Viewers.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- (Optional) Node.js and Go for local development

### Running with Docker
1. Edit the docker-compose.yml file to set the desired environment variables such as BASE_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, etc.
2.  Build and start the services:

    ```bash
    docker-compose up -d --build
    ```

3.  Access the application at `http://localhost:8080` (or the configured port).

### Local Development
# The frontend is built into the executable so it should be built first

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run build-local
    ```

4.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
5.  Install dependencies:
    ```bash
    go mod download
    ```
6.  Run the server:
    ```bash
    go run main.go
    ```

#### Frontend


## Configuration

Configuration is managed via environment variables. See [ENV.md](ENV.md) for a complete list of available options.

### Key Variables

- `PORT`: Port for the backend server (default: 8080).
- `JWT_SECRET`: Secret key for session signing.
- `OIDC_PROVIDER`: OIDC provider URL (e.g., Google, generic).
- `OIDC_CLIENT_ID`: Client ID for OIDC.
- `OIDC_CLIENT_SECRET`: Client Secret for OIDC.
- `BOOTSTRAP_USER_EMAIL`: Initial admin email address.
- `BOOTSTRAP_USER_PASSWORD`: Initial admin password.
- `SESSION_SECRET`: Session secret key.
- `BASE_URL`: Base URL of the application.

## License

MIT
