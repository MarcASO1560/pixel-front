<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import BulletListIcon from "pixelarticons/svg/bulletlist.svg?raw";
import ChevronRightIcon from "pixelarticons/svg/chevron-right.svg?raw";
import FilterIcon from "pixelarticons/svg/filter.svg?raw";
import FolderIcon from "pixelarticons/svg/folder.svg?raw";
import FolderPlusIcon from "pixelarticons/svg/folder-plus.svg?raw";
import GamepadIcon from "pixelarticons/svg/gamepad.svg?raw";
import GridIcon from "pixelarticons/svg/grid-3x3.svg?raw";
import LogoutIcon from "pixelarticons/svg/logout.svg?raw";
import PenSquareIcon from "pixelarticons/svg/pen-square.svg?raw";
import PlusBoxIcon from "pixelarticons/svg/plus-box.svg?raw";
import PlusIcon from "pixelarticons/svg/plus.svg?raw";
import ReloadIcon from "pixelarticons/svg/reload.svg?raw";
import SearchIcon from "pixelarticons/svg/search.svg?raw";
import ShieldIcon from "pixelarticons/svg/shield.svg?raw";
import UserIcon from "pixelarticons/svg/user.svg?raw";

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
  updateProject,
  updateProjectFolder,
} from "../lib/api";

type ExplorerItem =
  | {
      kind: "project";
      id: string;
      name: string;
      description?: string | null;
      created_at: string;
      updated_at: string;
      color?: string | null;
      raw: Project;
    }
  | {
      kind: "folder";
      id: string;
      name: string;
      description?: string | null;
      created_at: string;
      updated_at: string;
      color?: string | null;
      raw: ProjectFolder;
    };

type ViewMode = "grid" | "list";
type ItemSize = "small" | "medium" | "large";
type SortBy = "name" | "updated_at" | "created_at";
type SortDirection = "asc" | "desc";

type ExplorerState = {
  version?: number;
  preferences?: {
    viewMode?: ViewMode;
    itemSize?: ItemSize;
    sortBy?: SortBy;
    sortDirection?: SortDirection;
    showDescriptions?: boolean;
    showDates?: boolean;
    foldersFirst?: boolean;
  };
  location?: {
    projectId?: string | null;
    folderId?: string | null;
    searchByLocation?: Record<string, string>;
  };
};

const ACCESS_TOKEN_KEY = "pixel-studio-access-token";
const EXPLORER_STATE_KEY = "pixel-studio-explorer-state";
const FRONTEND_AUTH_TOKEN = import.meta.env.PUBLIC_FRONTEND_AUTH_TOKEN ?? "";
const GOOGLE_CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const DEFAULT_IS_ADMIN = import.meta.env.PUBLIC_DEFAULT_IS_ADMIN === "true";

const folderColors = [
  "#ff7a59",
  "#ff9f8a",
  "#ffb23f",
  "#e6b673",
  "#ffd84a",
  "#ffef99",
  "#d6f264",
  "#c4ff7a",
  "#a6e85f",
  "#65d98f",
  "#9cffd1",
  "#67f7d5",
  "#7de7ff",
  "#5cc8ff",
  "#78a8ff",
  "#9b7cff",
  "#b994ff",
  "#d66bff",
  "#ff5caf",
  "#f4a7b9",
  "#ffffff",
  "#cfd7e6",
  "#9aa7c0",
  "#6d7891",
];
const defaultProjectColor = "#78a8ff";
const icons = {
  bulletList: BulletListIcon,
  chevronRight: ChevronRightIcon,
  filter: FilterIcon,
  folder: FolderIcon,
  folderPlus: FolderPlusIcon,
  project: GamepadIcon,
  create: PlusBoxIcon,
  grid: GridIcon,
  logout: LogoutIcon,
  penSquare: PenSquareIcon,
  plus: PlusIcon,
  reload: ReloadIcon,
  search: SearchIcon,
  shield: ShieldIcon,
  user: UserIcon,
} as const;

const projectForm = reactive({
  name: "",
  description: "",
  color: defaultProjectColor,
});

const folderForm = reactive({
  name: "",
  color: folderColors[0],
});

const folderEditForm = reactive({
  name: "",
  description: "",
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
const isEditDialogOpen = ref(false);
const isUpdatingItem = ref(false);
const editingItem = ref<ExplorerItem | null>(null);
const selectedItemKey = ref<string | null>(null);
const errorMessage = ref("");
const googleButtonRef = ref<HTMLElement | null>(null);
const searchQuery = ref("");
const searchByLocation = ref<Record<string, string>>({});
const pendingLocation = ref<{ projectId: string | null; folderId: string | null } | null>(null);
const viewMode = ref<ViewMode>("grid");
const itemSize = ref<ItemSize>("medium");
const sortBy = ref<SortBy>("updated_at");
const sortDirection = ref<SortDirection>("desc");
const showDescriptions = ref(true);
const showDates = ref(true);
const foldersFirst = ref(true);
let isApplyingSearch = false;
let isRestoringState = false;

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
const createActionLabel = computed(() => "CREA");
const createActionDescription = computed(() =>
  selectedProject.value ? "Nueva carpeta en esta ubicacion" : "Nuevo proyecto creativo",
);
const createOptionLabel = computed(() => (selectedProject.value ? "Carpeta" : "Proyecto"));
const createOptionIcon = computed(() => (selectedProject.value ? icons.folderPlus : icons.project));
const createSubmitLabel = computed(() => (selectedProject.value ? "Crear carpeta" : "Crear proyecto"));
const dialogTitle = computed(() => "Crea");
const editDialogTitle = computed(() => (editingItem.value?.kind === "project" ? "Editar proyecto" : "Editar carpeta"));
const hasSearchQuery = computed(() => Boolean(searchQuery.value.trim()));
const currentLocationKey = computed(() => {
  if (!selectedProject.value) {
    return "root";
  }

  return `project:${selectedProject.value.id}:folder:${currentFolderId.value ?? "root"}`;
});
const visibleItems = computed<ExplorerItem[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let items = selectedProject.value ? folderItems.value : projectItems.value;

  if (query) {
    items = items.filter((item) => {
      const name = item.name.toLowerCase();
      const description = item.description?.toLowerCase() ?? "";
      return name.includes(query) || description.includes(query);
    });
  }

  return [...items].sort(compareExplorerItems);
});
const selectedExplorerItem = computed(() =>
  visibleItems.value.find((item) => getItemKey(item) === selectedItemKey.value) ?? null,
);
const projectItems = computed<ExplorerItem[]>(() =>
  projects.value.map((project) => ({
    kind: "project",
    id: project.id,
    name: project.name,
    description: project.description,
    created_at: project.created_at,
    updated_at: project.updated_at,
    color: getProjectColor(project),
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
      created_at: folder.created_at,
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
  restoreExplorerState();

  const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  if (storedToken) {
    accessToken.value = storedToken;
    await loadWorkspace();
    await restoreLastLocation();
  }

  if (!isAuthenticated.value) {
    await initializeGoogleSignIn();
  }
});

watch([viewMode, itemSize, sortBy, sortDirection, showDescriptions, showDates, foldersFirst], () => {
  saveExplorerState();
});

watch(searchQuery, (value) => {
  if (isApplyingSearch) {
    return;
  }

  searchByLocation.value = {
    ...searchByLocation.value,
    [currentLocationKey.value]: value,
  };
  saveExplorerState();
});

watch(visibleItems, (items) => {
  if (selectedItemKey.value && !items.some((item) => getItemKey(item) === selectedItemKey.value)) {
    selectedItemKey.value = null;
  }
});

function restoreExplorerState() {
  try {
    isRestoringState = true;
    const rawState = window.localStorage.getItem(EXPLORER_STATE_KEY);
    if (!rawState) {
      applySearchForCurrentLocation();
      return;
    }

    const state = JSON.parse(rawState) as ExplorerState;
    const isLegacyState = state.version !== 2;
    const preferences = state.preferences;

    if (isViewMode(preferences?.viewMode)) {
      viewMode.value = preferences.viewMode;
    }
    if (isItemSize(preferences?.itemSize)) {
      itemSize.value = preferences.itemSize;
    }
    if (isSortBy(preferences?.sortBy)) {
      sortBy.value = preferences.sortBy;
    }
    if (isSortDirection(preferences?.sortDirection)) {
      sortDirection.value = preferences.sortDirection;
    }
    if (isLegacyState && preferences?.sortBy === "name") {
      sortDirection.value = "asc";
    }
    if (typeof preferences?.showDescriptions === "boolean") {
      showDescriptions.value = preferences.showDescriptions;
    }
    if (typeof preferences?.showDates === "boolean") {
      showDates.value = preferences.showDates;
    }
    if (typeof preferences?.foldersFirst === "boolean") {
      foldersFirst.value = preferences.foldersFirst;
    }

    searchByLocation.value = state.location?.searchByLocation ?? {};
    pendingLocation.value = {
      projectId: state.location?.projectId ?? null,
      folderId: state.location?.folderId ?? null,
    };
    applySearchForCurrentLocation();
  } catch {
    resetExplorerPreferences(false);
  } finally {
    isRestoringState = false;
  }
}

function saveExplorerState() {
  const state: ExplorerState = {
    version: 2,
    preferences: {
      viewMode: viewMode.value,
      itemSize: itemSize.value,
      sortBy: sortBy.value,
      sortDirection: sortDirection.value,
      showDescriptions: showDescriptions.value,
      showDates: showDates.value,
      foldersFirst: foldersFirst.value,
    },
    location: {
      projectId: selectedProject.value?.id ?? null,
      folderId: currentFolderId.value,
      searchByLocation: searchByLocation.value,
    },
  };

  window.localStorage.setItem(EXPLORER_STATE_KEY, JSON.stringify(state));
}

async function restoreLastLocation() {
  const location = pendingLocation.value;
  if (!location?.projectId) {
    applySearchForCurrentLocation();
    saveExplorerState();
    return;
  }

  const project = projects.value.find((item) => item.id === location.projectId);
  if (!project) {
    pendingLocation.value = null;
    goToProjects();
    return;
  }

  selectedProject.value = project;
  currentFolderId.value = null;
  await loadSelectedProjectTree();

  const folderExists = projectTree.value?.folders.some((folder) => folder.id === location.folderId);
  currentFolderId.value = folderExists ? location.folderId : null;
  pendingLocation.value = null;
  applySearchForCurrentLocation();
  saveExplorerState();
}

function applySearchForCurrentLocation() {
  isApplyingSearch = true;
  searchQuery.value = searchByLocation.value[currentLocationKey.value] ?? "";
  void nextTick(() => {
    isApplyingSearch = false;
  });
}

function resetExplorerPreferences(clearSearch = true) {
  viewMode.value = "grid";
  itemSize.value = "medium";
  sortBy.value = "updated_at";
  sortDirection.value = "desc";
  showDescriptions.value = true;
  showDates.value = true;
  foldersFirst.value = true;

  if (clearSearch) {
    searchByLocation.value = {
      ...searchByLocation.value,
      [currentLocationKey.value]: "",
    };
    searchQuery.value = "";
  }

  saveExplorerState();
}

function compareExplorerItems(first: ExplorerItem, second: ExplorerItem) {
  if (foldersFirst.value && first.kind !== second.kind) {
    return first.kind === "folder" ? -1 : 1;
  }

  const direction = sortDirection.value === "asc" ? 1 : -1;
  let result = 0;

  if (sortBy.value === "name") {
    result = first.name.localeCompare(second.name, "es", {
      numeric: true,
      sensitivity: "base",
    });
  } else {
    result =
      new Date(first[sortBy.value]).getTime() - new Date(second[sortBy.value]).getTime();
  }

  return result * direction;
}

function getItemKey(item: ExplorerItem) {
  return `${item.kind}:${item.id}`;
}

function getProjectColor(project: Project) {
  const color = project.settings?.color;
  return typeof color === "string" && color ? color : defaultProjectColor;
}

function selectItem(item: ExplorerItem) {
  selectedItemKey.value = getItemKey(item);
}

function clearSelectedItem() {
  selectedItemKey.value = null;
}

function getItemKindLabel(item: ExplorerItem) {
  return item.kind === "project" ? "Proyecto" : "Carpeta";
}

function getItemDescription(item: ExplorerItem) {
  if (item.description?.trim()) {
    return item.description;
  }

  return item.kind === "folder" ? "Carpeta" : "Sin descripcion";
}

function updateSortBy(value: Event) {
  const target = value.target as HTMLSelectElement;
  if (!isSortBy(target.value)) {
    return;
  }

  sortBy.value = target.value;

  if (!isRestoringState) {
    sortDirection.value = sortBy.value === "name" ? "asc" : "desc";
  }
}

function isViewMode(value: unknown): value is ViewMode {
  return value === "grid" || value === "list";
}

function isItemSize(value: unknown): value is ItemSize {
  return value === "small" || value === "medium" || value === "large";
}

function isSortBy(value: unknown): value is SortBy {
  return value === "name" || value === "updated_at" || value === "created_at";
}

function isSortDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc";
}

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
    await restoreLastLocation();
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
      settings: {
        color: projectForm.color,
      },
    });

    projects.value = [project, ...projects.value];
    selectedItemKey.value = `project:${project.id}`;
    projectForm.name = "";
    projectForm.description = "";
    projectForm.color = defaultProjectColor;
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
    selectedItemKey.value = `folder:${folder.id}`;
    folderForm.name = "";
    folderForm.color = folderColors[0];
    closeCreateDialog();
  } catch (error) {
    handleError(error);
  } finally {
    isCreatingItem.value = false;
  }
}

function openEditItem(item: ExplorerItem) {
  selectItem(item);
  editingItem.value = item;
  folderEditForm.name = item.name;
  folderEditForm.description = item.kind === "project" ? item.description ?? "" : "";
  folderEditForm.color = item.color || folderColors[0];
  isEditDialogOpen.value = true;
}

function closeEditDialog() {
  isEditDialogOpen.value = false;
  editingItem.value = null;
}

async function updateItemDetails() {
  if (!accessToken.value || !editingItem.value || !folderEditForm.name.trim()) {
    return;
  }

  errorMessage.value = "";
  isUpdatingItem.value = true;

  try {
    if (editingItem.value.kind === "project") {
      const projectSettings = editingItem.value.raw.settings ?? {};
      const updatedProject = await updateProject(accessToken.value, editingItem.value.id, {
        name: folderEditForm.name.trim(),
        description: folderEditForm.description.trim() || null,
        settings: {
          ...projectSettings,
          color: folderEditForm.color,
        },
      });

      projects.value = projects.value.map((project) =>
        project.id === updatedProject.id ? updatedProject : project,
      );
      if (selectedProject.value?.id === updatedProject.id) {
        selectedProject.value = updatedProject;
      }
    } else {
      if (!selectedProject.value) {
        return;
      }

      const updatedFolder = await updateProjectFolder(
        accessToken.value,
        selectedProject.value.id,
        editingItem.value.id,
        {
          name: folderEditForm.name.trim(),
          color: folderEditForm.color,
        },
      );

      projectTree.value = {
        folders: (projectTree.value?.folders ?? []).map((folder) =>
          folder.id === updatedFolder.id ? updatedFolder : folder,
        ),
        resources: projectTree.value?.resources ?? [],
      };
    }

    closeEditDialog();
  } catch (error) {
    handleError(error);
  } finally {
    isUpdatingItem.value = false;
  }
}

async function openItem(item: ExplorerItem) {
  clearSelectedItem();
  if (item.kind === "project") {
    selectedProject.value = item.raw;
    projectTree.value = null;
    currentFolderId.value = null;
    await loadSelectedProjectTree();
    applySearchForCurrentLocation();
    saveExplorerState();
    return;
  }

  currentFolderId.value = item.raw.id;
  applySearchForCurrentLocation();
  saveExplorerState();
}

function goToProjectRoot() {
  clearSelectedItem();
  currentFolderId.value = null;
  applySearchForCurrentLocation();
  saveExplorerState();
}

function goToFolder(folderId: string) {
  clearSelectedItem();
  currentFolderId.value = folderId;
  applySearchForCurrentLocation();
  saveExplorerState();
}

function goToProjects() {
  clearSelectedItem();
  selectedProject.value = null;
  projectTree.value = null;
  currentFolderId.value = null;
  applySearchForCurrentLocation();
  saveExplorerState();
}

function closeCreateDialog() {
  isCreateDialogOpen.value = false;
}

function signOut(clearMessage = true) {
  accessToken.value = null;
  currentUser.value = null;
  projects.value = [];
  clearSelectedItem();
  selectedProject.value = null;
  projectTree.value = null;
  currentFolderId.value = null;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  saveExplorerState();
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
            <span class="pixelart-icon" aria-hidden="true" v-html="icons.shield"></span>
          </div>
          <div>
            <h1 id="auth-title">Pixel Studio</h1>
            <p>Accede con Google</p>
          </div>
        </div>

        <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>

        <div ref="googleButtonRef" class="google-button"></div>

        <div v-if="isLoading" class="loading-row">
          <span class="pixelart-icon" aria-hidden="true" v-html="icons.shield"></span>
          <span>Entrando...</span>
        </div>
      </section>
    </section>

    <section v-else class="workspace-view" aria-label="Explorador de proyectos">
      <section class="explorer-main">
        <header class="explorer-commandbar">
          <div class="commandbar-actions">
            <div class="view-switcher" aria-label="Vista">
              <button
                class="icon-button"
                :class="{ active: viewMode === 'grid' }"
                type="button"
                title="Cuadricula"
                @click="viewMode = 'grid'"
              >
                <span class="pixelart-icon" aria-hidden="true" v-html="icons.grid"></span>
              </button>
              <button
                class="icon-button"
                :class="{ active: viewMode === 'list' }"
                type="button"
                title="Lista"
                @click="viewMode = 'list'"
              >
                <span class="pixelart-icon" aria-hidden="true" v-html="icons.bulletList"></span>
              </button>
            </div>

            <div class="desktop-filter-strip">
              <div class="filter-group">
                <label class="filter-control compact">
                  <span>Tamano</span>
                  <select v-model="itemSize">
                    <option value="small">Pequeno</option>
                    <option value="medium">Mediano</option>
                    <option value="large">Grande</option>
                  </select>
                </label>

                <label class="filter-control compact">
                  <span>Orden</span>
                  <select :value="sortBy" @change="updateSortBy">
                    <option value="updated_at">Modificado</option>
                    <option value="created_at">Creado</option>
                    <option value="name">Nombre</option>
                  </select>
                </label>

                <label class="filter-control compact wide">
                  <span>{{ sortBy === "name" ? "Alfabetico" : "Tiempo" }}</span>
                  <select v-model="sortDirection">
                    <template v-if="sortBy === 'name'">
                      <option value="asc">A-Z</option>
                      <option value="desc">Z-A</option>
                    </template>
                    <template v-else>
                      <option value="desc">Recientes primero</option>
                      <option value="asc">Antiguos primero</option>
                    </template>
                  </select>
                </label>
              </div>

              <div class="filter-group">
                <label class="filter-toggle" title="Mostrar descripcion">
                  <input v-model="showDescriptions" type="checkbox" />
                  <span>Descripcion</span>
                </label>

                <label class="filter-toggle" title="Mostrar fechas">
                  <input v-model="showDates" type="checkbox" />
                  <span>Fechas</span>
                </label>

                <label class="filter-toggle" title="Mostrar carpetas primero">
                  <input v-model="foldersFirst" type="checkbox" />
                  <span>Carpetas primero</span>
                </label>

                <button class="filter-reset" type="button" title="Restablecer filtros" @click="resetExplorerPreferences()">
                  <span class="pixelart-icon" aria-hidden="true" v-html="icons.reload"></span>
                </button>
              </div>
            </div>

            <div class="topbar-account" :title="currentUser?.email || undefined">
              <img
                v-if="currentUser?.avatar_url"
                class="account-photo"
                :src="currentUser.avatar_url"
                alt=""
                referrerpolicy="no-referrer"
              />
              <div v-else class="account-avatar">
                <span class="pixelart-icon" aria-hidden="true" v-html="icons.user"></span>
              </div>
              <strong>{{ currentUser?.display_name || currentUser?.email }}</strong>
            </div>

            <button class="icon-button logout-button" type="button" title="Salir" @click="signOut()">
              <span class="pixelart-icon" aria-hidden="true" v-html="icons.logout"></span>
            </button>
          </div>

          <details class="mobile-filter-drawer">
            <summary>
              <span class="pixelart-icon" aria-hidden="true" v-html="icons.filter"></span>
              <span>Vista y filtros</span>
            </summary>

            <div class="mobile-filter-grid">
              <label class="filter-control compact">
                <span>Tamano</span>
                <select v-model="itemSize">
                  <option value="small">Pequeno</option>
                  <option value="medium">Mediano</option>
                  <option value="large">Grande</option>
                </select>
              </label>

              <label class="filter-control compact">
                <span>Orden</span>
                <select :value="sortBy" @change="updateSortBy">
                  <option value="updated_at">Modificado</option>
                  <option value="created_at">Creado</option>
                  <option value="name">Nombre</option>
                </select>
              </label>

              <label class="filter-control compact wide">
                <span>{{ sortBy === "name" ? "Alfabetico" : "Tiempo" }}</span>
                <select v-model="sortDirection">
                  <template v-if="sortBy === 'name'">
                    <option value="asc">A-Z</option>
                    <option value="desc">Z-A</option>
                  </template>
                  <template v-else>
                    <option value="desc">Recientes primero</option>
                    <option value="asc">Antiguos primero</option>
                  </template>
                </select>
              </label>

              <label class="filter-toggle" title="Mostrar descripcion">
                <input v-model="showDescriptions" type="checkbox" />
                <span>Descripcion</span>
              </label>

              <label class="filter-toggle" title="Mostrar fechas">
                <input v-model="showDates" type="checkbox" />
                <span>Fechas</span>
              </label>

              <label class="filter-toggle" title="Mostrar carpetas primero">
                <input v-model="foldersFirst" type="checkbox" />
                <span>Carpetas primero</span>
              </label>

              <button class="filter-reset" type="button" title="Restablecer filtros" @click="resetExplorerPreferences()">
                <span class="pixelart-icon" aria-hidden="true" v-html="icons.reload"></span>
                <span>Restablecer</span>
              </button>
            </div>
          </details>
        </header>

        <div class="explorer-pathbar">
          <div class="breadcrumb" aria-label="Ruta">
            <button type="button" @click="goToProjects">Proyectos</button>
            <template v-if="selectedProject">
              <span class="pixelart-icon breadcrumb-chevron" aria-hidden="true" v-html="icons.chevronRight"></span>
              <button type="button" @click="goToProjectRoot">{{ selectedProject.name }}</button>
            </template>
            <template v-for="folder in breadcrumbFolders" :key="folder.id">
              <span class="pixelart-icon breadcrumb-chevron" aria-hidden="true" v-html="icons.chevronRight"></span>
              <button type="button" @click="goToFolder(folder.id)">{{ folder.name }}</button>
            </template>
          </div>

          <label class="search-box">
            <span class="pixelart-icon" aria-hidden="true" v-html="icons.search"></span>
            <input v-model="searchQuery" type="search" :placeholder="searchPlaceholder" />
          </label>
        </div>

        <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>

        <section class="content-header">
          <h1>{{ currentTitle }}</h1>
          <span>{{ visibleItems.length }} elementos</span>
        </section>

        <div class="explorer-split" :class="{ 'with-preview': selectedExplorerItem }">
          <section class="file-area" aria-live="polite">
            <div v-if="isLoading || isLoadingTree" class="empty-state">Cargando...</div>

            <div v-else-if="visibleItems.length === 0 && hasSearchQuery" class="empty-state">
              <span class="pixelart-icon empty-folder-icon" aria-hidden="true" v-html="icons.folder"></span>
              <span>{{ emptyMessage }}</span>
            </div>

            <div
              v-else
              :class="[
                'file-collection',
                viewMode,
                itemSize,
                { 'hide-descriptions': !showDescriptions, 'hide-dates': !showDates },
              ]"
            >
              <article
                v-for="item in visibleItems"
                :key="`${item.kind}-${item.id}`"
                class="project-item"
                :class="{ selected: selectedItemKey === getItemKey(item) }"
              >
                <button
                  class="project-open"
                  type="button"
                  @click="selectItem(item)"
                  @dblclick="openItem(item)"
                  @keydown.enter.prevent="openItem(item)"
                >
                  <div class="project-icon" :style="{ '--folder-color': item.color || undefined }">
                    <span
                      class="pixelart-icon item-glyph"
                      :class="{ 'project-glyph': item.kind === 'project', 'folder-glyph': item.kind === 'folder' }"
                      aria-hidden="true"
                      v-html="item.kind === 'project' ? icons.project : icons.folder"
                    ></span>
                  </div>
                  <div class="project-copy">
                    <h2>{{ item.name }}</h2>
                    <p v-if="showDescriptions">
                      {{ getItemDescription(item) }}
                    </p>
                    <time v-if="showDates" :datetime="item.updated_at">{{ formatDate(item.updated_at) }}</time>
                  </div>
                </button>

                <button
                  class="item-action"
                  type="button"
                  :title="item.kind === 'project' ? 'Editar proyecto' : 'Editar carpeta'"
                  @click="openEditItem(item)"
                >
                  <span class="pixelart-icon" aria-hidden="true" v-html="icons.penSquare"></span>
                </button>
              </article>

              <article v-if="!hasSearchQuery" class="project-item create-blueprint">
                <button class="project-open create-open" type="button" @click="isCreateDialogOpen = true">
                  <div class="project-icon create-icon">
                    <span class="pixelart-icon item-glyph create-glyph" aria-hidden="true" v-html="icons.create"></span>
                  </div>
                  <div class="project-copy">
                    <h2>{{ createActionLabel }}</h2>
                    <p v-if="showDescriptions" class="create-description">{{ createActionDescription }}</p>
                  </div>
                </button>
              </article>
            </div>
          </section>

          <aside v-if="selectedExplorerItem" class="preview-panel" aria-label="Detalle seleccionado">
            <header class="preview-header">
              <div class="preview-icon" :style="{ '--folder-color': selectedExplorerItem.color || undefined }">
                <span
                  class="pixelart-icon preview-glyph"
                  :class="{ 'project-glyph': selectedExplorerItem.kind === 'project' }"
                  aria-hidden="true"
                  v-html="selectedExplorerItem.kind === 'project' ? icons.project : icons.folder"
                ></span>
              </div>
              <div class="preview-title">
                <span>{{ getItemKindLabel(selectedExplorerItem) }}</span>
                <h2>{{ selectedExplorerItem.name }}</h2>
              </div>
              <button
                class="icon-button"
                type="button"
                :title="selectedExplorerItem.kind === 'project' ? 'Editar proyecto' : 'Editar carpeta'"
                @click="openEditItem(selectedExplorerItem)"
              >
                <span class="pixelart-icon" aria-hidden="true" v-html="icons.penSquare"></span>
              </button>
            </header>

            <section class="preview-block">
              <h3>Descripcion</h3>
              <p class="preview-description">{{ getItemDescription(selectedExplorerItem) }}</p>
            </section>

            <dl class="preview-facts">
              <div>
                <dt>Tipo</dt>
                <dd>{{ getItemKindLabel(selectedExplorerItem) }}</dd>
              </div>
              <div>
                <dt>Modificado</dt>
                <dd>{{ formatDate(selectedExplorerItem.updated_at) }}</dd>
              </div>
              <div>
                <dt>Creado</dt>
                <dd>{{ formatDate(selectedExplorerItem.created_at) }}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>
                  <span
                    class="preview-color"
                    :style="{ backgroundColor: selectedExplorerItem.color || defaultProjectColor }"
                  ></span>
                  {{ selectedExplorerItem.color || defaultProjectColor }}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
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
            <div class="create-option-card" aria-label="Tipo de creacion">
              <span class="pixelart-icon create-option-icon" aria-hidden="true" v-html="createOptionIcon"></span>
              <div>
                <strong>{{ createOptionLabel }}</strong>
                <span>{{ createActionDescription }}</span>
              </div>
            </div>

            <template v-if="!isInsideProject">
              <label>
                <span>Nombre</span>
                <input v-model="projectForm.name" type="text" required autofocus />
              </label>

              <label>
                <span>Descripcion</span>
                <textarea v-model="projectForm.description" rows="4"></textarea>
              </label>

              <fieldset class="color-field">
                <legend>Color</legend>
                <div class="color-grid">
                  <button
                    v-for="color in folderColors"
                    :key="color"
                    class="color-swatch"
                    :class="{ active: projectForm.color === color }"
                    type="button"
                    :style="{ backgroundColor: color }"
                    :title="color"
                    @click="projectForm.color = color"
                  ></button>
                  <label class="custom-color" title="Color personalizado">
                    <input v-model="projectForm.color" type="color" aria-label="Color personalizado" />
                    <span :style="{ backgroundColor: projectForm.color }"></span>
                  </label>
                </div>
              </fieldset>
            </template>

            <template v-else>
              <label>
                <span>Nombre</span>
                <input v-model="folderForm.name" type="text" required autofocus />
              </label>

              <fieldset class="color-field">
                <legend>Color</legend>
                <div class="color-grid">
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
                  <label class="custom-color" title="Color personalizado">
                    <input v-model="folderForm.color" type="color" aria-label="Color personalizado" />
                    <span :style="{ backgroundColor: folderForm.color }"></span>
                  </label>
                </div>
              </fieldset>
            </template>

            <button type="submit" class="primary-action" :disabled="isCreatingItem">
              <span class="pixelart-icon" aria-hidden="true" v-html="icons.plus"></span>
              <span>{{ isCreatingItem ? "Creando..." : createSubmitLabel }}</span>
            </button>
          </form>
        </section>
      </div>

      <div
        v-if="isEditDialogOpen"
        class="dialog-backdrop"
        role="presentation"
        @click.self="closeEditDialog"
      >
        <section class="project-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-item-title">
          <header>
            <h2 id="edit-item-title">{{ editDialogTitle }}</h2>
            <button class="text-button" type="button" @click="closeEditDialog">Cancelar</button>
          </header>

          <form @submit.prevent="updateItemDetails">
            <label>
              <span>Nombre</span>
              <input v-model="folderEditForm.name" type="text" required autofocus />
            </label>

            <label v-if="editingItem?.kind === 'project'">
              <span>Descripcion</span>
              <textarea v-model="folderEditForm.description" rows="4"></textarea>
            </label>

            <fieldset v-if="editingItem" class="color-field">
              <legend>Color</legend>
              <div class="color-grid">
                <button
                  v-for="color in folderColors"
                  :key="color"
                  class="color-swatch"
                  :class="{ active: folderEditForm.color === color }"
                  type="button"
                  :style="{ backgroundColor: color }"
                  :title="color"
                  @click="folderEditForm.color = color"
                ></button>
                <label class="custom-color" title="Color personalizado">
                  <input v-model="folderEditForm.color" type="color" aria-label="Color personalizado" />
                  <span :style="{ backgroundColor: folderEditForm.color }"></span>
                </label>
              </div>
            </fieldset>

            <button type="submit" class="primary-action" :disabled="isUpdatingItem">
              <span class="pixelart-icon" aria-hidden="true" v-html="icons.penSquare"></span>
              <span>{{ isUpdatingItem ? "Guardando..." : "Guardar cambios" }}</span>
            </button>
          </form>
        </section>
      </div>
    </section>
  </main>
</template>
