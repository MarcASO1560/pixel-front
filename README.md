# Pixel Studio Front

Frontend de `pixel.studio`, construido con Astro, Vue y TypeScript.

## Iniciar el servicio

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Las variables que usa el navegador deben empezar por `PUBLIC_`, porque Astro solo expone al cliente las variables con ese prefijo.

Para usar el backend publicado desde local, deja:

```text
PUBLIC_API_BASE_URL="https://pixel-back.vercel.app/api/v1"
```

`PUBLIC_FRONTEND_AUTH_TOKEN` debe tener el mismo valor que `FRONTEND_AUTH_TOKEN` en Vercel.

Aplicacion local:

```text
http://localhost:4321
```
