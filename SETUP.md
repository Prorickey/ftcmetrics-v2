# Deployment Setup

## How It Works

On every push to `main`, GitHub Actions builds Docker images for the **web** and **api** packages and pushes them to the GitHub Container Registry (`ghcr.io`).

Images:
- `ghcr.io/ftc8569/ftcmetrics-web:latest`
- `ghcr.io/ftc8569/ftcmetrics-api:latest`

Each push also tags images with the commit SHA for rollbacks.

## Server Setup

### 1. Authenticate Docker with GHCR

On the server, create a GitHub Personal Access Token (classic) with `read:packages` scope, then log in:

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
# Enter the PAT as the password
```

### 2. Copy the compose file

```bash
mkdir -p /opt/deployments/ftcmetrics
cp docker-compose.prod.yml /opt/deployments/ftcmetrics/docker-compose.yml
```

### 3. Create the environment file

Create `/opt/deployments/ftcmetrics/.env`:

```env
# Database
POSTGRES_USER=ftcmetrics
POSTGRES_PASSWORD=CHANGE_ME

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=GENERATE_WITH_openssl_rand_base64_32

# OAuth (configure the providers you use)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# FTC Events API
FTC_API_USERNAME=
FTC_API_TOKEN=

# API CORS
CORS_ORIGIN=https://your-domain.com

# Soketi (optional, change for production)
SOKETI_APP_ID=ftcmetrics
SOKETI_APP_KEY=ftcmetrics-key
SOKETI_APP_SECRET=ftcmetrics-secret
```

### 4. Deploy

```bash
cd /opt/deployments/ftcmetrics
docker compose pull
docker compose up -d --remove-orphans
```

### 5. Update

After a new push to `main`, pull and restart:

```bash
cd /opt/deployments/ftcmetrics
docker compose pull
docker compose up -d --remove-orphans
```

### 6. Verify

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f api
```

## GitHub Repository Settings

The workflow uses `GITHUB_TOKEN` which is automatically provided -- no additional secrets are needed. If the repository is private, make sure the package visibility is set to match (Settings > Packages).
