import { defineMiddleware } from "astro:middleware";

import { fetchApi, healthUrl, type UserPublic } from "./lib/api";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  createLoginRedirectUrl,
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
  fetchApi<UserPublic>("/users/me", { accessToken });

const expiredSessionCookie = `${ACCESS_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;

const redirectToLoginWithExpiredSession = (requestUrl: URL) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: createLoginRedirectUrl(requestUrl).toString(),
      "Set-Cookie": expiredSessionCookie,
    },
  });

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (isFrameworkAssetPath(pathname)) {
    return next();
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
    return Response.redirect(new URL("/workspace", context.url).toString(), 302);
  }

  return next();
});
