const runtimeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;

export const BACKEND_API_ORIGIN = (
  runtimeEnv?.API_BASE_URL ||
  import.meta.env.PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8001"
)
  .replace(/\/$/, "")
  .replace(/\/api\/v1$/, "");

export const API_ORIGIN = "";
export const API_V1_URL = "/api/v1";
export const BACKEND_API_V1_URL = `${BACKEND_API_ORIGIN}/api/v1`;

export type UserPublic = {
  id: string;
  username?: string | null;
  email: string;
  avatar_url?: string | null;
  avatar_pixel_art?: PixelAvatarData | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type PixelAvatarData = {
  version: 1;
  size: number;
  palette: string[];
  pixels: Array<string | null>;
};

export type ProjectAccessRole = "owner" | "editor" | "viewer";

export type ProjectPublic = {
  id: string;
  owner_id: string;
  access_role?: ProjectAccessRole;
  access_count?: number;
  name: string;
  description?: string | null;
  settings: Record<string, unknown>;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at?: string | null;
};

export type ProjectFolderPublic = {
  id: string;
  project_id: string;
  parent_id?: string | null;
  name: string;
  color?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ProjectResourcePublic = {
  id: string;
  project_id: string;
  folder_id?: string | null;
  name: string;
  type: string;
  resource_metadata: Record<string, unknown>;
  thumbnail_url?: string | null;
  color?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ProjectResourceDetail = ProjectResourcePublic & {
  data: Record<string, unknown>;
};

export type ProjectTree = {
  folders: ProjectFolderPublic[];
  resources: ProjectResourcePublic[];
};

export type ProjectShareLinkPublic = {
  project_id: string;
  token: string;
  url: string;
  role: ProjectAccessRole;
  created_at: string;
  updated_at: string;
};

export type ProjectAccessUserPublic = {
  id: string;
  username?: string | null;
  email: string;
  avatar_url?: string | null;
  avatar_pixel_art?: PixelAvatarData | null;
  role: ProjectAccessRole;
  is_owner: boolean;
  joined_at?: string | null;
};

export type WorkspaceBootstrap = {
  user: UserPublic;
  projects: ProjectPublic[];
};

export const apiUrl = (path: string, options: { direct?: boolean } = {}) => {
  const apiBase = options.direct ? BACKEND_API_V1_URL : API_V1_URL;
  const origin = options.direct ? BACKEND_API_ORIGIN : API_ORIGIN;

  return path.startsWith("/api/")
    ? `${origin}${path}`
    : `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
};

export const healthUrl = () => `${BACKEND_API_ORIGIN}/health`;

export const fetchApi = async <ResponseBody>(
  path: string,
  init: RequestInit & { accessToken?: string; direct?: boolean } = {},
) => {
  const { accessToken, direct = false, headers, ...requestInit } = init;
  const response = await fetch(apiUrl(path, { direct }), {
    ...requestInit,
    credentials: requestInit.credentials ?? (direct ? "omit" : "same-origin"),
    headers: {
      Accept: "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    return null;
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as ResponseBody;
};
