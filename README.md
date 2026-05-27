# Sefkira Studio Frontend

Astro, Vue, and TypeScript frontend for Sefkira Studio.

## Local Setup

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Local app:

```text
http://127.0.0.1:4321/login
```

## Environment

Astro only exposes browser variables prefixed with `PUBLIC_`.

```text
PUBLIC_API_BASE_URL="http://127.0.0.1:8001"
PUBLIC_FRONTEND_AUTH_TOKEN="change-this-frontend-auth-token"
PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
PUBLIC_DEFAULT_IS_ADMIN="false"
```

For production, set the same variables in Vercel. `PUBLIC_FRONTEND_AUTH_TOKEN`
must match `FRONTEND_AUTH_TOKEN` in the backend.

## Scripts

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run preview
```
