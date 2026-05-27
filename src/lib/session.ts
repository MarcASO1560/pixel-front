export const ACCESS_TOKEN_COOKIE_NAME = "sefkira_access_token";
export const ACCESS_TOKEN_STORAGE_KEY = "sefkira_access_token";
export const LEGACY_ACCESS_TOKEN_STORAGE_KEY = "pixel_access_token";
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const AUTH_PATHS = new Set(["/", "/login"]);
const PROTECTED_PATH_PREFIXES = ["/workspace", "/app", "/projects"];

export const isAuthPath = (pathname: string) => AUTH_PATHS.has(pathname);

export const isProtectedPath = (pathname: string) =>
  PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export const isFrameworkAssetPath = (pathname: string) =>
  pathname.startsWith("/_astro") ||
  pathname.startsWith("/favicon") ||
  pathname.includes(".");

export const createLoginRedirectUrl = (requestUrl: URL) => {
  const loginUrl = new URL("/login", requestUrl);
  loginUrl.searchParams.set("next", `${requestUrl.pathname}${requestUrl.search}`);
  return loginUrl;
};

export const createSafeRedirectPath = (rawPath: string | null) => {
  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return "/workspace";
  }

  return rawPath;
};
