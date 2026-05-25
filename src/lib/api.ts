const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1";

export type SessionRequest = {
  auth_token: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_admin: boolean;
};

export type SessionResponse = {
  access_token: string;
  token_type: string;
};

export type User = {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Project = {
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

export type ProjectCreate = {
  name: string;
  description?: string | null;
  settings?: Record<string, unknown>;
  thumbnail_url?: string | null;
};

export type ProjectUpdate = {
  name?: string;
  description?: string | null;
  settings?: Record<string, unknown>;
  thumbnail_url?: string | null;
};

export type ProjectFolder = {
  id: string;
  project_id: string;
  parent_id?: string | null;
  name: string;
  color?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type ProjectResource = {
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

export type ProjectTree = {
  folders: ProjectFolder[];
  resources: ProjectResource[];
};

export type ProjectFolderCreate = {
  name: string;
  color?: string | null;
  position?: number;
  parent_id?: string | null;
};

export type ProjectFolderUpdate = {
  name?: string;
  color?: string | null;
  position?: number;
};

async function request<T>(path: string, options: RequestInit = {}, accessToken?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // Fall back to status text.
  }

  return `${response.status} ${response.statusText}`;
}

export function createSession(payload: SessionRequest): Promise<SessionResponse> {
  return request<SessionResponse>("/auth/session", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser(accessToken: string): Promise<User> {
  return request<User>("/users/me", {}, accessToken);
}

export function listProjects(accessToken: string): Promise<Project[]> {
  return request<Project[]>("/projects/", {}, accessToken);
}

export function createProject(accessToken: string, payload: ProjectCreate): Promise<Project> {
  return request<Project>(
    "/projects/",
    {
      method: "POST",
      body: JSON.stringify({
        settings: {},
        thumbnail_url: null,
        ...payload,
      }),
    },
    accessToken,
  );
}

export function updateProject(
  accessToken: string,
  projectId: string,
  payload: ProjectUpdate,
): Promise<Project> {
  return request<Project>(
    `/projects/${projectId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}

export function getProjectTree(accessToken: string, projectId: string): Promise<ProjectTree> {
  return request<ProjectTree>(`/projects/${projectId}/tree`, {}, accessToken);
}

export function createProjectFolder(
  accessToken: string,
  projectId: string,
  payload: ProjectFolderCreate,
): Promise<ProjectFolder> {
  return request<ProjectFolder>(
    `/projects/${projectId}/folders`,
    {
      method: "POST",
      body: JSON.stringify({
        color: null,
        position: 0,
        parent_id: null,
        ...payload,
      }),
    },
    accessToken,
  );
}

export function updateProjectFolder(
  accessToken: string,
  projectId: string,
  folderId: string,
  payload: ProjectFolderUpdate,
): Promise<ProjectFolder> {
  return request<ProjectFolder>(
    `/projects/${projectId}/folders/${folderId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    accessToken,
  );
}
