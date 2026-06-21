import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = (process.env.SESSION_PROXY_BASE_URL || "http://127.0.0.1:4321").replace(
  /\/$/,
  "",
);
const password = "secret-pass";
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const email = `session-proxy-${suffix}@example.com`;
const username = `proxy_${suffix}`;

const requestJson = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;
  return { body, bodyText, response };
};

const readSetCookieHeaders = (response) => {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }

  const setCookie = response.headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
};

const getSessionSetCookie = (response) => {
  const cookies = readSetCookieHeaders(response);
  return cookies.find((cookie) => cookie.startsWith("sefkira_access_token=")) || "";
};

const toCookieHeader = (setCookie) => setCookie.split(";")[0];

const register = await requestJson("/api/v1/auth/register", {
  method: "POST",
  body: JSON.stringify({
    username,
    email,
    password,
    password_confirmation: password,
  }),
});

assert.equal(register.response.status, 200);
assert.equal(register.body.status, "ok");
assert.equal(register.body.token_type, "bearer");
assert.equal("access_token" in register.body, false);

const sessionSetCookie = getSessionSetCookie(register.response);
assert.ok(sessionSetCookie, "register response must set the session cookie");
assert.match(sessionSetCookie, /;\s*HttpOnly/i);
assert.match(sessionSetCookie, /;\s*SameSite=Lax/i);

if (baseUrl.startsWith("https://")) {
  assert.match(sessionSetCookie, /;\s*Secure/i);
}

const sessionCookie = toCookieHeader(sessionSetCookie);
const me = await requestJson("/api/v1/users/me", {
  headers: {
    Cookie: sessionCookie,
  },
});

assert.equal(me.response.status, 200);
assert.equal(me.body.email, email);
assert.equal(me.body.is_admin, false);

const logout = await requestJson("/api/v1/auth/logout", {
  method: "POST",
  headers: {
    Cookie: sessionCookie,
  },
  body: "{}",
});

assert.equal(logout.response.status, 200);
assert.equal(logout.body.status, "ok");
assert.match(getSessionSetCookie(logout.response), /Max-Age=0/i);

const afterLogout = await requestJson("/api/v1/users/me", {
  headers: {
    Cookie: toCookieHeader(getSessionSetCookie(logout.response)),
  },
});

assert.equal(afterLogout.response.status, 401);

console.log(`Session proxy verified against ${baseUrl}`);
