# Pixel Studio Front

Frontend de `pixel.studio`, construido con Astro, Vue y TypeScript.

## Iniciar el servicio

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Las variables que usa el navegador deben empezar por `PUBLIC_`, porque Astro solo expone al cliente las variables con ese prefijo.

Aplicacion local:

```text
http://localhost:4321
```
