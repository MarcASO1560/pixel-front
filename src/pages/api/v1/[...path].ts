import type { APIRoute } from "astro";

import { BACKEND_API_V1_URL } from "../../../lib/api";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
} from "../../../lib/session";

export const prerender = false;

const AUTH_SESSION_PATHS = new Set([
  "auth/register",
  "auth/login",
  "auth/google",
  "auth/password-reset/confirm",
]);

const createCookieOptions = (request: Request) => ({
  httpOnly: true,
  maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure:
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https",
});

const createExpiredCookieOptions = (request: Request) => ({
  ...createCookieOptions(request),
  maxAge: 0,
});

const copyRequestHeaders = (request: Request) => {
  const headers = new Headers(request.headers);
  headers.delete("accept-encoding");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("cookie");
  headers.delete("expect");
  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  return headers;
};

const copyResponseHeaders = (response: Response) => {
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("set-cookie");
  headers.delete("transfer-encoding");
  return headers;
};

const canHaveBody = (method: string) => method !== "GET" && method !== "HEAD";

const proxyRequest: APIRoute = async ({ cookies, params, request }) => {
  const path = params.path || "";

  if (path === "auth/logout") {
    cookies.set(ACCESS_TOKEN_COOKIE_NAME, "", createExpiredCookieOptions(request));
    return Response.json({ status: "ok" });
  }

  const backendUrl = new URL(`${BACKEND_API_V1_URL}/${path}`);
  backendUrl.search = new URL(request.url).search;

  const headers = copyRequestHeaders(request);
  const accessToken = cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set(
      "Cookie",
      `${ACCESS_TOKEN_COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
    );
  }

  const backendResponse = await fetch(backendUrl, {
    method: request.method,
    headers,
    body: canHaveBody(request.method) ? await request.arrayBuffer() : undefined,
  });

  if (backendResponse.ok && AUTH_SESSION_PATHS.has(path)) {
    const payload = (await backendResponse.json()) as {
      access_token?: string;
      token_type?: string;
    };

    if (payload.access_token) {
      cookies.set(
        ACCESS_TOKEN_COOKIE_NAME,
        payload.access_token,
        createCookieOptions(request),
      );
    }

    return Response.json({
      status: "ok",
      token_type: payload.token_type || "bearer",
    });
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: copyResponseHeaders(backendResponse),
  });
};

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
