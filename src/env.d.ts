/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly API_BASE_URL?: string;
  readonly PUBLIC_API_BASE_URL?: string;
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
