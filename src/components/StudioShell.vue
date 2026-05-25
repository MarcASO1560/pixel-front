<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import {
  ChevronRight,
  Folder,
  Grid3X3,
  List,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from "@lucide/vue";

import {
  createProject,
  createProjectFolder,
  createSession,
  getCurrentUser,
  getProjectTree,
  listProjects,
  type Project,
  type ProjectFolder,
  type ProjectTree,
  type User,
} from "../lib/api";

type ExplorerItem =
  | {
      kind: "project";
      id: string;
      name: string;
      description?: string | null;
      updated_at: string;
      color?: string | null;
      raw: Project;
    }
  | {
      kind: "folder";
      id: string;
      name: string;
      description?: string | null;
      updated_at: string;
      color?: string | null;
      raw: ProjectFolder;
    };

const ACCESS_TOKEN_KEY = "pixel-studio-access-token";
const FRONTEND_AUTH_TOKEN = import.meta.env.PUBLIC_FRONTEND_AUTH_TOKEN ?? "";
const GOOGLE_CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const DEFAULT_IS_ADMIN = import.meta.env.PUBLIC_DEFAULT_IS_ADMIN === "true";

const folderColors = ["#f1c84b", "#67d9c8", "#82aaff", "#c792ea", "#f78c6c", "#9ccc65"];

const projectForm = reactive({
  name: "",
  description: "",
});

const folderForm = reactive({
  name: "",
  color: folderColors[0],
});

const accessToken = ref<string | null>(null);
const currentUser = ref<User | null>(null);
const projects = ref<Project[]>([]);
const selectedProject = ref<Project | null>(null);
const projectTree = ref<ProjectTree | null>(null);
const currentFolderId = ref<string | null>(null);
const isLoading = ref(false);
const isLoadingTree = ref(false);
const isCreatingItem = ref(false);
const isCreateDialogOpen = ref(false);
const errorMessage = ref("");
const googleButtonRef = ref<HTMLElement | null>(null);
const searchQuery = ref("");
const viewMode = ref<"grid" | "list">("grid");
const density = ref<"comfortable" | "compact">("comfortable");

const isAuthenticated = computed(() => Boolean(accessToken.value && currentUser.value));
const isInsideProject = computed(() => Boolean(selectedProject.value));
const currentFolder = computed(() =>
  projectTree.value?.folders.find((folder) => folder.id === currentFolderId.value) ?? null,
);
const breadcrumbFolders = computed(() => {
  if (!projectTree.value || !currentFolder.value) {
    return [];
  }

  const foldersById = new Map(projectTree.value.folders.map((folder) => [folder.id, folder]));
  const path: ProjectFolder[] = [];
  let cursor: ProjectFolder | undefined = currentFolder.value;

  while (cursor) {
    path.unshift(cursor);
    cursor = cursor.parent_id ? foldersById.get(cursor.parent_id) : undefined;
  }

  return path;
});
const currentTitle = computed(() => currentFolder.value?.name ?? selectedProject.value?.name ?? "Proyectos");
const searchPlaceholder = computed(() =>
  selectedProject.value ? "Buscar en esta carpeta" : "Buscar proyectos",
);
const createButtonLabel = computed(() => (selectedProject.value ? "Nueva carpeta" : "Nuevo proyecto"));
const dialogTitle = computed(() => createButtonLabel.value);
const visibleItems = computed<ExplorerItem[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const items = selectedProject.value ? folderItems.value : projectItems.value;

  if (!query) {
    return items;
  }

  return items.filter((item) => {
    const name = item.name.toLowerCase();
    const description = item.description?.toLowerCase() ?? "";
    return name.includes(query) || description.includes(query);
  });
});
const projectItems = computed<ExplorerItem[]>(() =>
  projects.value.map((project) => ({
    kind: "project",
    id: project.id,
    name: project.name,
    description: project.description,
    updated_at: project.updated_at,
    color: null,
    raw: project,
  })),
);
const folderItems = computed<ExplorerItem[]>(() =>
  (projectTree.value?.folders ?? [])
    .filter((folder) => (folder.parent_id ?? null) === currentFolderId.value)
    .map((folder) => ({
      kind: "folder",
      id: folder.id,
      name: folder.name,
      description: null,
      updated_at: folder.updated_at,
      color: folder.color,
      raw: folder,
    })),
);
const emptyMessage = computed(() => {
  if (searchQuery.value.trim()) {
    return "Sin resultados";
  }

  return selectedProject.value ? "Esta carpeta esta vacia" : "No hay proyectos";
});

onMounted(async () => {
  const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (storedToken) {
    accessToken.value = storedToken;
    await loadWorkspace();
  }

  if (!isAuthenticated.value) {
    await initializeGoogleSignIn();
  }
});

async function signInWithGoogleCredential(credential: string) {
  const profile = decodeGoogleCredential(credential);
  if (!profile.email) {
    throw new Error("Google no devolvio un email valido");
  }

  await signIn({
    email: profile.email,
    display_name: profile.name || profile.email,
    avatar_url: profile.picture || null,
    is_admin: DEFAULT_IS_ADMIN,
  });
}

async function signIn(user: {
  email: string;
  display_name: string;
  avatar_url?: string | null;
  is_admin: boolean;
}) {
  errorMessage.value = "";
  isLoading.value = true;

  try {
    const session = await createSession({
      auth_token: FRONTEND_AUTH_TOKEN,
      email: user.email,
      display_name: user.display_name || null,
      avatar_url: user.avatar_url ?? null,
      is_admin: user.is_admin,
    });

    accessToken.value = session.access_token;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
    await loadWorkspace();
  } catch (error) {
    handleError(error);
  } finally {
    isLoading.value = false;
  }
}

async function initializeGoogleSignIn() {
  if (!GOOGLE_CLIENT_ID || !FRONTEND_AUTH_TOKEN) {
    errorMessage.value = "El acceso no esta configurado todavia";
    return;
  }

  try {
    await loadGoogleScript();
    await nextTick();

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          await signInWithGoogleCredential(response.credential);
        } catch (error) {
          handleError(error);
        }
      },
    });

    if (googleButtonRef.value) {
      window.google.accounts.id.renderButton(googleButtonRef.value, {
        theme: "filled_black",
        size: "large",
        width: 320,
        text: "signin_with",
        shape: "rectangular",
      });
    }
  } catch (error) {
    handleError(error);
  }
}

function loadGoogleScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_SCRIPT_SRC}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("No se pudo cargar Google")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google"));
    document.head.appendChild(script);
  });
}

function decodeGoogleCredential(credential: string): { email?: string; name?: string; picture?: string } {
  const [, payload] = credential.split(".");
  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(normalizedPayload)
      .split("")
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );

  return JSON.parse(json) as { email?: string; name?: string; picture?: string };
}

async function loadWorkspace() {
  if (!accessToken.value) {
    return;
  }

  errorMessage.value = "";
  isLoading.value = true;

  try {
    const [user, projectList] = await Promise.all([
      getCurrentUser(accessToken.value),
      listProjects(accessToken.value),
    ]);
    currentUser.value = user;
    projects.value = projectList;
  } catch (error) {
    signOut(false);
    handleError(error);
  } finally {
    isLoading.value = false;
  }
}

async function loadSelectedProjectTree() {
  if (!accessToken.value || !selectedProject.value) {
    return;
  }

  errorMessage.value = "";
  isLoadingTree.value = true;

  try {
    projectTree.value = await getProjectTree(accessToken.value, selectedProject.value.id);
  } catch (error) {
    handleError(error);
  } finally {
    isLoadingTree.value = false;
  }
}

async function addItem() {
  if (selectedProject.value) {
    await addFolder();
  } else {
    await addProject();
  }
}

async function addProject() {
  if (!accessToken.value || !projectForm.name.trim()) {
    return;
  }

  errorMessage.value = "";
  isCreatingItem.value = true;

  try {
    const project = await createProject(accessToken.value, {
      name: projectForm.name.trim(),
      description: projectForm.description.trim() || null,
    });

    projects.value = [project, ...projects.value];
    projectForm.name = "";
    projectForm.description = "";
    closeCreateDialog();
  } catch (error) {
    handleError(error);
  } finally {
    isCreatingItem.value = false;
  }
}

async function addFolder() {
  if (!accessToken.value || !selectedProject.value || !folderForm.name.trim()) {
    return;
  }

  errorMessage.value = "";
  isCreatingItem.value = true;

  try {
    const folder = await createProjectFolder(accessToken.value, selectedProject.value.id, {
      name: folderForm.name.trim(),
      color: folderForm.color,
      parent_id: currentFolderId.value,
    });

    projectTree.value = {
      folders: [...(projectTree.value?.folders ?? []), folder],
      resources: projectTree.value?.resources ?? [],
    };
    folderForm.name = "";
    folderForm.color = folderColors[0];
    closeCreateDialog();
  } catch (error) {
    handleError(error);
  } finally {
    isCreatingItem.value = false;
  }
}

async function openItem(item: ExplorerItem) {
  if (item.kind === "project") {
    selectedProject.value = item.raw;
    projectTree.value = null;
    currentFolderId.value = null;
    searchQuery.value = "";
    await loadSelectedProjectTree();
    return;
  }

  currentFolderId.value = item.raw.id;
  searchQuery.value = "";
}

function goToProjectRoot() {
  currentFolderId.value = null;
  searchQuery.value = "";
}

function goToFolder(folderId: string) {
  currentFolderId.value = folderId;
  searchQuery.value = "";
}

function goToProjects() {
  selectedProject.value = null;
  projectTree.value = null;
  currentFolderId.value = null;
  searchQuery.value = "";
}

function closeCreateDialog() {
  isCreateDialogOpen.value = false;
}

function signOut(clearMessage = true) {
  accessToken.value = null;
  currentUser.value = null;
  projects.value = [];
  selectedProject.value = null;
  projectTree.value = null;
  currentFolderId.value = null;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  if (clearMessage) {
    errorMessage.value = "";
  }
}

function handleError(error: unknown) {
  errorMessage.value = error instanceof Error ? error.message : "Error inesperado";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<template>
  <main class="app-shell">
    <section v-if="!isAuthenticated" class="auth-view" aria-labelledby="auth-title">
      <section class="auth-panel">
        <div class="brand-row">
          <div class="brand-mark">
            <ShieldCheck :size="24" aria-hidden="true" />
          </div>
          <div>
            <h1 id="auth-title">Pixel Studio</h1>
            <p>Accede con Google</p>
          </div>
        </div>

        <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>

        <div ref="googleButtonRef" class="google-button"></div>

        <div v-if="isLoading" class="loading-row">
          <ShieldCheck :size="18" aria-hidden="true" />
          <span>Entrando...</span>
        </div>
      </section>
    </section>

    <section v-else class="workspace-view" aria-label="Explorador de proyectos">
      <aside class="explorer-sidebar">
        <nav class="sidebar-nav" aria-label="Navegacion">
          <button class="nav-item active" type="button" @click="goToProjects">
            <Folder :size="18" aria-hidden="true" />
            <span>Proyectos</span>
          </button>
        </nav>

        <div class="sidebar-account">
          <img
            v-if="currentUser?.avatar_url"
            class="account-photo"
            :src="currentUser.avatar_url"
            alt=""
            referrerpolicy="no-referrer"
          />
          <div v-else class="account-avatar">
            <UserRound :size="18" aria-hidden="true" />
          </div>
          <div class="account-copy">
            <strong>{{ currentUser?.display_name || currentUser?.email }}</strong>
            <span>{{ currentUser?.email }}</span>
          </div>
          <button class="icon-button" type="button" title="Salir" @click="signOut()">
            <LogOut :size="18" aria-hidden="true" />
          </button>
        </div>
      </aside>

      <section class="explorer-main">
        <header class="explorer-commandbar">
          <button class="command-button primary" type="button" @click="isCreateDialogOpen = true">
            <Plus :size="18" aria-hidden="true" />
            <span>{{ createButtonLabel }}</span>
          </button>

          <div class="toolbar-group">
            <div class="density-switcher" aria-label="Tamano de lista">
              <button
                type="button"
                :class="{ active: density === 'comfortable' }"
                @click="density = 'comfortable'"
              >
                Normal
              </button>
              <button type="button" :class="{ active: density === 'compact' }" @click="density = 'compact'">
                Compacta
              </button>
            </div>

            <div class="view-switcher" aria-label="Vista">
              <button
                class="icon-button"
                :class="{ active: viewMode === 'grid' }"
                type="button"
                title="Cuadricula"
                @click="viewMode = 'grid'"
              >
                <Grid3X3 :size="18" aria-hidden="true" />
              </button>
              <button
                class="icon-button"
                :class="{ active: viewMode === 'list' }"
                type="button"
                title="Lista"
                @click="viewMode = 'list'"
              >
                <List :size="18" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <div class="explorer-pathbar">
          <div class="breadcrumb" aria-label="Ruta">
            <button type="button" @click="goToProjects">Proyectos</button>
            <template v-if="selectedProject">
              <ChevronRight :size="16" aria-hidden="true" />
              <button type="button" @click="goToProjectRoot">{{ selectedProject.name }}</button>
            </template>
            <template v-for="folder in breadcrumbFolders" :key="folder.id">
              <ChevronRight :size="16" aria-hidden="true" />
              <button type="button" @click="goToFolder(folder.id)">{{ folder.name }}</button>
            </template>
          </div>

          <label class="search-box">
            <Search :size="17" aria-hidden="true" />
            <input v-model="searchQuery" type="search" :placeholder="searchPlaceholder" />
          </label>
        </div>

        <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>

        <section class="content-header">
          <h1>{{ currentTitle }}</h1>
          <span>{{ visibleItems.length }} elementos</span>
        </section>

        <section class="file-area" aria-live="polite">
          <div v-if="isLoading || isLoadingTree" class="empty-state">Cargando...</div>

          <div v-else-if="visibleItems.length === 0" class="empty-state">
            <Folder :size="34" aria-hidden="true" />
            <span>{{ emptyMessage }}</span>
          </div>

          <div v-else :class="['file-collection', viewMode, density]">
            <button
              v-for="item in visibleItems"
              :key="`${item.kind}-${item.id}`"
              class="project-item"
              type="button"
              @click="openItem(item)"
            >
              <div class="project-icon" :style="{ color: item.color || undefined }">
                <Folder :size="44" aria-hidden="true" />
              </div>
              <div class="project-copy">
                <h2>{{ item.name }}</h2>
                <p>{{ item.description || (item.kind === 'folder' ? 'Carpeta' : 'Sin descripcion') }}</p>
                <time :datetime="item.updated_at">{{ formatDate(item.updated_at) }}</time>
              </div>
            </button>
          </div>
        </section>
      </section>

      <div
        v-if="isCreateDialogOpen"
        class="dialog-backdrop"
        role="presentation"
        @click.self="closeCreateDialog"
      >
        <section class="project-dialog" role="dialog" aria-modal="true" aria-labelledby="create-item-title">
          <header>
            <h2 id="create-item-title">{{ dialogTitle }}</h2>
            <button class="text-button" type="button" @click="closeCreateDialog">Cancelar</button>
          </header>

          <form @submit.prevent="addItem">
            <template v-if="!isInsideProject">
              <label>
                <span>Nombre</span>
                <input v-model="projectForm.name" type="text" required autofocus />
              </label>

              <label>
                <span>Descripcion</span>
                <textarea v-model="projectForm.description" rows="4"></textarea>
              </label>
            </template>

            <template v-else>
              <label>
                <span>Nombre</span>
                <input v-model="folderForm.name" type="text" required autofocus />
              </label>

              <fieldset class="color-field">
                <legend>Color</legend>
                <button
                  v-for="color in folderColors"
                  :key="color"
                  class="color-swatch"
                  :class="{ active: folderForm.color === color }"
                  type="button"
                  :style="{ backgroundColor: color }"
                  :title="color"
                  @click="folderForm.color = color"
                ></button>
              </fieldset>
            </template>

            <button type="submit" class="primary-action" :disabled="isCreatingItem">
              <Plus :size="18" aria-hidden="true" />
              <span>{{ isCreatingItem ? "Creando..." : dialogTitle }}</span>
            </button>
          </form>
        </section>
      </div>
    </section>
  </main>
</template>
