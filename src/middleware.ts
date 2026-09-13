import { defineMiddleware } from "astro:middleware";

import {
  fetchApi,
  healthUrl,
  type ProjectWorkspaceBootstrap,
  type UserPublic,
  type WorkspaceBootstrap,
} from "./lib/api";
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

const readWorkspace = async (accessToken: string) =>
  fetchApi<WorkspaceBootstrap>("/workspace/", { accessToken, direct: true });

const readProjectWorkspace = async (accessToken: string, projectId: string) =>
  fetchApi<ProjectWorkspaceBootstrap>(`/workspace/projects/${encodeURIComponent(projectId)}`, {
    accessToken,
    direct: true,
  });

type AuthenticatedSession = {
  user: UserPublic;
  workspace?: WorkspaceBootstrap;
  projectWorkspace?: ProjectWorkspaceBootstrap;
};

const readAuthenticatedSession = async (
  accessToken: string,
  options: { includeWorkspace: boolean; projectId?: string },
): Promise<AuthenticatedSession | null> => {
  if (options.projectId) {
    try {
      const projectWorkspace = await readProjectWorkspace(accessToken, options.projectId);
      if (projectWorkspace) {
        return { user: projectWorkspace.user, projectWorkspace };
      }
    } catch {
      // Fall through to the user endpoint so an unavailable project does not
      // invalidate the authenticated session.
    }
  }

  if (options.includeWorkspace) {
    try {
      const workspace = await readWorkspace(accessToken);
      if (workspace) {
        return { user: workspace.user, workspace };
      }
    } catch {
      // Fall back to the lightweight user endpoint below so a temporary
      // workspace failure does not discard an otherwise valid session.
    }
  }

  try {
    const user = await readCurrentUser(accessToken);
    return user ? { user } : null;
  } catch {
    return null;
  }
};

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

  const accessToken = context.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  const shouldBootstrapWorkspace = pathname === "/studio" || pathname === "/studio/";
  const projectRouteMatch = pathname.match(/^\/studio\/([^/]+)\/?$/);
  const authenticatedSession = accessToken
    ? await readAuthenticatedSession(accessToken, {
        includeWorkspace: shouldBootstrapWorkspace,
        projectId: projectRouteMatch?.[1],
      })
    : null;

  if (authenticatedSession) {
    context.locals.apiAvailable = true;
    context.locals.user = authenticatedSession.user;
    if (authenticatedSession.workspace) {
      context.locals.workspace = authenticatedSession.workspace;
    }
    if (authenticatedSession.projectWorkspace) {
      context.locals.projectWorkspace = authenticatedSession.projectWorkspace;
    }
  } else {
    context.locals.apiAvailable = await checkApiHealth();
  }

  if (isProtectedPath(pathname)) {
    if (!context.locals.apiAvailable) {
      return new Response("API unavailable", { status: 503 });
    }

    if (!accessToken || !authenticatedSession) {
      return redirectToLoginWithExpiredSession(context.url);
    }
  }

  if (isAuthPath(pathname) && authenticatedSession) {
    return Response.redirect(new URL("/studio", context.url).toString(), 302);
  }

  return next();
});
