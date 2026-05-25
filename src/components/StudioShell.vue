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
  createSession,
  getCurrentUser,
  listProjects,
  type Project,
  type User,
} from "../lib/api";

const ACCESS_TOKEN_KEY = "pixel-studio-access-token";
const FRONTEND_AUTH_TOKEN = import.meta.env.PUBLIC_FRONTEND_AUTH_TOKEN ?? "";
const GOOGLE_CLIENT_ID = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const DEFAULT_IS_ADMIN = import.meta.env.PUBLIC_DEFAULT_IS_ADMIN === "true";

const projectForm = reactive({
  name: "",
  description: "",
});

const accessToken = ref<string | null>(null);
const currentUser = ref<User | null>(null);
const projects = ref<Project[]>([]);
const isLoading = ref(false);
const isCreatingProject = ref(false);
const isCreateDialogOpen = ref(false);
const errorMessage = ref("");
const googleButtonRef = ref<HTMLElement | null>(null);
const searchQuery = ref("");
const viewMode = ref<"grid" | "list">("grid");

const isAuthenticated = computed(() => Boolean(accessToken.value && currentUser.value));
const visibleProjects = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  if (!query) {
    return projects.value;
  }

  return projects.value.filter((project) => {
    const name = project.name.toLowerCase();
    const description = project.description?.toLowerCase() ?? "";
    return name.includes(query) || description.includes(query);
  });
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
    is_admin: DEFAULT_IS_ADMIN,
  });
}

async function signIn(user: { email: string; display_name: string; is_admin: boolean }) {
  errorMessage.value = "";
  isLoading.value = true;

  try {
    const session = await createSession({
      auth_token: FRONTEND_AUTH_TOKEN,
      email: user.email,
      display_name: user.display_name || null,
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

function decodeGoogleCredential(credential: string): { email?: string; name?: string } {
  const [, payload] = credential.split(".");
  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(normalizedPayload)
      .split("")
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );

  return JSON.parse(json) as { email?: string; name?: string };
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

async function addProject() {
  if (!accessToken.value || !projectForm.name.trim()) {
    return;
  }

  errorMessage.value = "";
  isCreatingProject.value = true;

  try {
    const project = await createProject(accessToken.value, {
      name: projectForm.name.trim(),
      description: projectForm.description.trim() || null,
    });

    projects.value = [project, ...projects.value];
    projectForm.name = "";
    projectForm.description = "";
    isCreateDialogOpen.value = false;
  } catch (error) {
    handleError(error);
  } finally {
    isCreatingProject.value = false;
  }
}

function signOut(clearMessage = true) {
  accessToken.value = null;
  currentUser.value = null;
  projects.value = [];
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
          <button class="nav-item active" type="button">
            <Folder :size="18" aria-hidden="true" />
            <span>Proyectos</span>
          </button>
        </nav>

        <div class="sidebar-account">
          <div class="account-avatar">
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
            <span>Nuevo</span>
          </button>

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
        </header>

        <div class="explorer-pathbar">
          <div class="breadcrumb" aria-label="Ruta">
            <span>Inicio</span>
            <ChevronRight :size="16" aria-hidden="true" />
            <strong>Proyectos</strong>
          </div>

          <label class="search-box">
            <Search :size="17" aria-hidden="true" />
            <input v-model="searchQuery" type="search" placeholder="Buscar proyectos" />
          </label>
        </div>

        <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>

        <section class="content-header">
          <h1>Proyectos</h1>
          <span>{{ visibleProjects.length }} elementos</span>
        </section>

        <section class="file-area" aria-live="polite">
          <div v-if="isLoading" class="empty-state">Cargando...</div>

          <div v-else-if="visibleProjects.length === 0" class="empty-state">
            <Folder :size="34" aria-hidden="true" />
            <span>{{ projects.length === 0 ? "Esta carpeta esta vacia" : "Sin resultados" }}</span>
          </div>

          <div v-else :class="['file-collection', viewMode]">
            <article v-for="project in visibleProjects" :key="project.id" class="project-item">
              <div class="project-icon">
                <Folder :size="44" aria-hidden="true" />
              </div>
              <div class="project-copy">
                <h2>{{ project.name }}</h2>
                <p>{{ project.description || "Sin descripcion" }}</p>
                <time :datetime="project.updated_at">{{ formatDate(project.updated_at) }}</time>
              </div>
            </article>
          </div>
        </section>
      </section>

      <div
        v-if="isCreateDialogOpen"
        class="dialog-backdrop"
        role="presentation"
        @click.self="isCreateDialogOpen = false"
      >
        <section class="project-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
          <header>
            <h2 id="new-project-title">Nuevo proyecto</h2>
            <button class="text-button" type="button" @click="isCreateDialogOpen = false">Cancelar</button>
          </header>

          <form @submit.prevent="addProject">
            <label>
              <span>Nombre</span>
              <input v-model="projectForm.name" type="text" required autofocus />
            </label>

            <label>
              <span>Descripcion</span>
              <textarea v-model="projectForm.description" rows="4"></textarea>
            </label>

            <button type="submit" class="primary-action" :disabled="isCreatingProject">
              <Plus :size="18" aria-hidden="true" />
              <span>{{ isCreatingProject ? "Creando..." : "Crear proyecto" }}</span>
            </button>
          </form>
        </section>
      </div>
    </section>
  </main>
</template>
