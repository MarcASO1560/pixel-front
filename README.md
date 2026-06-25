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

The browser talks to the Astro app through same-origin `/api/v1/*` routes.
Those routes proxy requests to the backend and keep the JWT in an `HttpOnly`
cookie, so the backend URL should be configured server-side.

```text
API_BASE_URL="http://127.0.0.1:8001"
PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

For production, set `API_BASE_URL` and `PUBLIC_GOOGLE_CLIENT_ID` in Vercel.
`PUBLIC_GOOGLE_CLIENT_ID` is intentionally exposed to the browser; `API_BASE_URL`
is used by server-side middleware and proxy routes. Google sign-in is verified
server-side by the backend against `GOOGLE_CLIENT_ID`.

## Scripts

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:session-proxy
npm.cmd run preview
```

`test:session-proxy` expects the frontend and backend to be running. Override
the target with `SESSION_PROXY_BASE_URL`, for example:


## Hola

```powershell
$env:SESSION_PROXY_BASE_URL="https://www.sefkirastudio.com"
npm.cmd run test:session-proxy
```
