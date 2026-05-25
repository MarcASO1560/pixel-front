<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { FolderKanban, LogOut, Plus, RefreshCw, ShieldCheck } from "@lucide/vue";

import {
  createProject,
  createSession,
  getCurrentUser,
  listProjects,
  type Project,
  type User,
} from "../lib/api";

const ACCESS_TOKEN_KEY = "pixel-studio-access-token";
const FRONTEND_AUTH_TOKEN = import.meta.env.VITE_FRONTEND_AUTH_TOKEN ?? "";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const DEFAULT_IS_ADMIN = import.meta.env.VITE_DEFAULT_IS_ADMIN === "true";

const projectForm = reactive({
  name: "",
  description: "",
});

const accessToken = ref<string | null>(null);
const currentUser = ref<User | null>(null);
const projects = ref<Project[]>([]);
const isLoading = ref(false);
const isCreatingProject = ref(false);
const errorMessage = ref("");
const statusMessage = ref("");
const googleButtonRef = ref<HTMLElement | null>(null);

const isAuthenticated = computed(() => Boolean(accessToken.value && currentUser.value));

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
  statusMessage.value = "";
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
    statusMessage.value = "Sesion iniciada";
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
  statusMessage.value = "";
  isCreatingProject.value = true;

  try {
    const project = await createProject(accessToken.value, {
      name: projectForm.name.trim(),
      description: projectForm.description.trim() || null,
    });

    projects.value = [project, ...projects.value];
    projectForm.name = "";
    projectForm.description = "";
    statusMessage.value = "Proyecto creado";
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
    statusMessage.value = "";
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

    <section v-else class="workspace-view" aria-label="Proyectos">
      <header class="topbar">
        <div>
          <p class="eyebrow">Pixel Studio</p>
          <h1>Proyectos</h1>
        </div>

        <div class="topbar-actions">
          <span class="user-pill">{{ currentUser?.display_name || currentUser?.email }}</span>
          <button class="icon-button" type="button" title="Recargar" @click="loadWorkspace">
            <RefreshCw :size="18" aria-hidden="true" />
          </button>
          <button class="icon-button" type="button" title="Salir" @click="signOut()">
            <LogOut :size="18" aria-hidden="true" />
          </button>
        </div>
      </header>

      <section class="workspace-grid">
        <aside class="create-panel" aria-labelledby="new-project-title">
          <h2 id="new-project-title">Nuevo proyecto</h2>

          <form @submit.prevent="addProject">
            <label>
              <span>Nombre</span>
              <input v-model="projectForm.name" type="text" required />
            </label>

            <label>
              <span>Descripcion</span>
              <textarea v-model="projectForm.description" rows="4"></textarea>
            </label>

            <button type="submit" class="primary-action" :disabled="isCreatingProject">
              <Plus :size="18" aria-hidden="true" />
              <span>{{ isCreatingProject ? "Creando..." : "Crear" }}</span>
            </button>
          </form>

          <p v-if="statusMessage" class="notice success">{{ statusMessage }}</p>
          <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
        </aside>

        <section class="project-list" aria-live="polite">
          <div class="list-header">
            <h2>Biblioteca</h2>
            <span>{{ projects.length }} proyectos</span>
          </div>

          <div v-if="isLoading" class="empty-state">Cargando...</div>

          <div v-else-if="projects.length === 0" class="empty-state">
            <FolderKanban :size="28" aria-hidden="true" />
            <span>Sin proyectos</span>
          </div>

          <article v-for="project in projects" v-else :key="project.id" class="project-row">
            <div>
              <h3>{{ project.name }}</h3>
              <p>{{ project.description || "Sin descripcion" }}</p>
            </div>
            <time :datetime="project.updated_at">{{ formatDate(project.updated_at) }}</time>
          </article>
        </section>
      </section>
    </section>
  </main>
</template>
