# Environment Variables

This document lists all environment variables used by the MiSignage backend.

## Core Configuration

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `PORT` | The HTTP port the server listens on. | `8080` | `3000` |
| `BASE_URL` | The public URL of the backend, used for constructing callback URLs. | - | `http://localhost:8080` |

## Database

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `DB_TYPE` | database driver to use. Options: `postgres`, empty (sqlite). | `sqlite` | `postgres` |
| `DB_DSN` | Database connection string. For SQLite, it's the filename. | `misignage.db` | `host=localhost user=postgres password=secret dbname=misignage port=5432 sslmode=disable` |

## Authentication (JWT & Sessions)

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | Secret key used to sign JWT tokens. **Change this in production.** | `default_secret_change_me` | `complex_random_string` |
| `SESSION_SECRET` | Secret key used for session cookies. **Change this in production.** | `default_session` | `another_complex_string` |

## OIDC (Single Sign-On)

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `OIDC_DISCOVERY_URL` | The OIDC Discovery Endpoint (Issuer URL). | Microsoft Common v2.0 | `https://login.microsoftonline.com/{tenant_id}/v2.0` |
| `OIDC_CLIENT_ID` | Client ID from your OIDC provider. | - | `00000000-0000-0000-0000-000000000000` |
| `OIDC_CLIENT_SECRET` | Client Secret from your OIDC provider. | - | `client_secret_value` |

## Bootstrapping (First Run)

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `BOOTSTRAP_USER_EMAIL` | Email for the initial admin user. | `admin@misignage.local` | `admin@example.com` |
| `BOOTSTRAP_USER_PASSWORD` | Password for the initial admin user. If empty, one is generated and printed to logs. | (Generated) | `SecurePassword123` |
