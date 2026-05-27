/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_BASE_URL?: string;
  readonly PUBLIC_DEFAULT_IS_ADMIN?: string;
  readonly PUBLIC_FRONTEND_AUTH_TOKEN?: string;
  readonly PUBLIC_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    apiAvailable?: boolean;
    user?: import("./lib/api").UserPublic;
  }
}
