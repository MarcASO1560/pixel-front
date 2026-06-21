import { defineMiddleware } from "astro:middleware";

import { fetchApi, healthUrl, type UserPublic } from "./lib/api";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  createLoginRedirectUrl,
  isApiPath,
  isAuthPath,
  isFrameworkAssetPath,
  isProtectedPath,
} from "./lib/session";

const checkApiHealth = async () => {
  try {
    const response = await fetch(healthUrl(), { headers: { Accept: "application/json" } });
    return response.ok;
  } catch {
    return false;
  }
};

const readCurrentUser = async (accessToken: string) =>
  fetchApi<UserPublic>("/users/me", { accessToken, direct: true });

const createExpiredSessionCookie = (requestUrl: URL) =>
  [
    `${ACCESS_TOKEN_COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    "HttpOnly",
    requestUrl.protocol === "https:" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

const redirectToLoginWithExpiredSession = (requestUrl: URL) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: createLoginRedirectUrl(requestUrl).toString(),
      "Set-Cookie": createExpiredSessionCookie(requestUrl),
    },
  });

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (isFrameworkAssetPath(pathname)) {
    return next();
  }

  if (isApiPath(pathname)) {
    return next();
  }

  if (pathname === "/workspace" || pathname.startsWith("/workspace/")) {
    const studioUrl = new URL(context.url);
    studioUrl.pathname = pathname.replace(/^\/workspace/, "/studio");
    return Response.redirect(studioUrl.toString(), 302);
  }

  context.locals.apiAvailable = await checkApiHealth();

  const accessToken = context.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const user = accessToken ? await readCurrentUser(accessToken) : null;
  if (user) {
    context.locals.user = user;
  }

  if (isProtectedPath(pathname)) {
    if (!context.locals.apiAvailable) {
      return new Response("API unavailable", { status: 503 });
    }

    if (!accessToken || !user) {
      return redirectToLoginWithExpiredSession(context.url);
    }
  }

  if (isAuthPath(pathname) && user) {
    return Response.redirect(new URL("/studio", context.url).toString(), 302);
  }

  return next();
});
