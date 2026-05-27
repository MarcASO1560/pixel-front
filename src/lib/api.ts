export const API_ORIGIN = (
  import.meta.env.PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
)
  .replace(/\/$/, "")
  .replace(/\/api\/v1$/, "");

export const API_V1_URL = `${API_ORIGIN}/api/v1`;

export type UserPublic = {
  id: string;
  username?: string | null;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type ProjectPublic = {
  id: string;
  owner_id: string;
  name: string;
  description?: string | null;
  settings: Record<string, unknown>;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at?: string | null;
};

export type WorkspaceBootstrap = {
  user: UserPublic;
  projects: ProjectPublic[];
};

export const apiUrl = (path: string) =>
  path.startsWith("/api/")
    ? `${API_ORIGIN}${path}`
    : `${API_V1_URL}${path.startsWith("/") ? path : `/${path}`}`;

export const healthUrl = () => `${API_ORIGIN}/health`;

export const fetchApi = async <ResponseBody>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
) => {
  const { accessToken, headers, ...requestInit } = init;
  const response = await fetch(apiUrl(path), {
    ...requestInit,
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as ResponseBody;
};
