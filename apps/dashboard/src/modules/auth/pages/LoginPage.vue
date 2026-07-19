<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter, useRoute, RouterLink } from "vue-router";
import {
  LCard,
  LInput,
  LButton,
  LAlert,
} from "@lumina/ui";
import {
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRight,
  Github,
  Sparkles,
} from "lucide-vue-next";
import { useAuth } from "@/modules/auth/composables/useAuth";
import {
  DEFAULT_WORKSPACE_ID,
  WorkspaceService,
  type WorkspaceRole,
} from "@/services/workspace.service";
import { useToast } from "@/composables/useToast";
import BrandMark from "@/components/BrandMark.vue";

type Mode = "loading" | "first-run" | "sign-in" | "new-user";

const router = useRouter();
const route = useRoute();
const auth = useAuth();
const toast = useToast();

const mode = ref<Mode>("loading");

// ── Sign-in state ────────────────────────────────────────────────────
const apiKey = ref("");
const showKey = ref(false);
const signInError = ref<string | null>(null);
const signingIn = ref(false);

// ── First-run (bootstrap) state ──────────────────────────────────────
const bootstrapName = ref("");
const bootstrapEmail = ref("");
const bootstrapError = ref<string | null>(null);
const bootstrapping = ref(false);

// ── "I'm new" create-account state (when server already has users) ──
const newName = ref("");
const newEmail = ref("");
const newUserError = ref<string | null>(null);
const creatingUser = ref(false);

/**
 * After signing in (any flow), jump to the redirect target if the
 * router handed us a `?redirect=` hint, otherwise land on the
 * workspace overview. `router.replace` so the login entry doesn't
 * pollute browser history.
 */
function redirectAfterAuth() {
  const target =
    typeof route.query.redirect === "string" && route.query.redirect.length > 0
      ? route.query.redirect
      : "/";
  router.replace(target);
}

/**
 * Attach a freshly-created user to the default workspace. The server
 * used to do this inside `POST /users`, but that coupled the user
 * module to workspace seeding. The onboarding flow is the right place
 * to decide "this user is the first admin → owner" vs "this user is
 * joining an existing server → member".
 *
 * Best-effort: if the membership write fails (e.g. the seeded
 * workspace is missing for some reason) we warn and still let the
 * user through. They can be granted access from settings later.
 */
async function attachToDefaultWorkspace(userId: string, role: WorkspaceRole) {
  try {
    await WorkspaceService.createMembership({
      workspaceId: DEFAULT_WORKSPACE_ID,
      userId,
      role,
    });
  } catch (err) {
    console.warn("[auth] could not attach user to default workspace:", err);
    toast.warning(
      "Account created, but we couldn't add you to the default workspace automatically. Ask an admin to grant access from Settings → Members.",
    );
  }
}

async function onSignIn() {
  signInError.value = null;
  if (!apiKey.value.trim()) {
    signInError.value = "Please paste an API key.";
    return;
  }
  signingIn.value = true;
  try {
    const user = await auth.login(apiKey.value);
    if (user) {
      redirectAfterAuth();
    }
  } catch (err) {
    signInError.value = err instanceof Error ? err.message : "Sign-in failed.";
  } finally {
    signingIn.value = false;
  }
}

async function onBootstrap() {
  bootstrapError.value = null;
  if (!bootstrapEmail.value.trim() || !bootstrapName.value.trim()) {
    bootstrapError.value = "Name and email are both required.";
    return;
  }
  bootstrapping.value = true;
  try {
    const result = await WorkspaceService.createUser({
      name: bootstrapName.value.trim(),
      email: bootstrapEmail.value.trim(),
    });

    // Sign the new admin in with the freshly-issued key BEFORE the
    // workspace write, so the membership endpoint sees a valid bearer.
    const user = await auth.login(result.apiKey);
    if (!user) {
      throw new Error("Could not validate the new API key.");
    }

    // First user on the server → owner of the default workspace.
    await attachToDefaultWorkspace(user.id, "owner");

    toast.success(
      "Workspace ready. Your API key is saved — copy it from the user menu (top right) any time.",
    );
    redirectAfterAuth();
  } catch (err) {
    bootstrapError.value = err instanceof Error ? err.message : "Bootstrap failed.";
  } finally {
    bootstrapping.value = false;
  }
}

async function onCreateUser() {
  newUserError.value = null;
  if (!newEmail.value.trim() || !newName.value.trim()) {
    newUserError.value = "Name and email are both required.";
    return;
  }
  creatingUser.value = true;
  try {
    const result = await WorkspaceService.createUser({
      name: newName.value.trim(),
      email: newEmail.value.trim(),
    });

    const user = await auth.login(result.apiKey);
    if (!user) {
      throw new Error("Could not validate the new API key.");
    }

    // Subsequent users on an already-bootstrapped server → regular
    // member of the default workspace. An admin can promote later.
    await attachToDefaultWorkspace(user.id, "member");

    toast.success(
      "Account created. Your API key is saved — copy it from the user menu (top right) any time.",
    );
    redirectAfterAuth();
  } catch (err) {
    newUserError.value = err instanceof Error ? err.message : "Failed to create account.";
  } finally {
    creatingUser.value = false;
  }
}

onMounted(async () => {
  // Honor a deep-link with a pre-filled key.
  if (typeof route.query.key === "string" && route.query.key.length > 0) {
    apiKey.value = route.query.key;
  }

  try {
    const { items } = await WorkspaceService.listUsers();
    mode.value = items.length === 0 ? "first-run" : "sign-in";
  } catch {
    // If we can't even list users, fall back to manual sign-in.
    mode.value = "sign-in";
  }
});

const apiBase = import.meta.env.VITE_LUMINA_API_URL || "(default — same origin)";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background">
    <header class="flex items-center justify-between border-b border-border px-6 py-3">
      <RouterLink to="/login" class="flex items-center gap-2">
        <BrandMark :size="24" :show-wordmark="true" />
      </RouterLink>
      <a
        href="https://github.com/Lumina-ML/lumina"
        target="_blank"
        rel="noreferrer noopener"
        class="inline-flex items-center gap-1 text-xs text-fg-tertiary hover:text-fg-primary"
      >
        <Github class="h-3.5 w-3.5" />
        Source
      </a>
    </header>

    <div class="flex flex-1 items-center justify-center p-6">
      <div class="w-full max-w-md space-y-6">
        <!-- ── Loading ──────────────────────────────────────────────── -->
        <template v-if="mode === 'loading'">
          <div class="flex flex-col items-center gap-3 py-12 text-fg-tertiary">
            <BrandMark :size="48" :show-wordmark="false" />
            <p class="text-sm">Checking server state…</p>
          </div>
        </template>

        <!-- ── First-run: bootstrap ─────────────────────────────────── -->
        <template v-else-if="mode === 'first-run'">
          <div class="text-center">
            <div class="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/15 text-accent-primary">
              <Sparkles class="h-6 w-6" />
            </div>
            <h1 class="text-2xl font-semibold tracking-tight">Welcome to Lumina</h1>
            <p class="mt-1 text-sm text-fg-tertiary">
              First run — let's set up your admin account.
            </p>
          </div>

          <LCard class="p-6">
            <form class="space-y-4" @submit.prevent="onBootstrap">
              <div>
                <label
                  for="bname"
                  class="mb-1 block text-xs font-medium text-fg-secondary"
                >
                  Your name
                </label>
                <LInput
                  id="bname"
                  v-model:value="bootstrapName"
                  placeholder="Ada Lovelace"
                  size="large"
                  autocomplete="name"
                  :disabled="bootstrapping"
                />
              </div>
              <div>
                <label
                  for="bemail"
                  class="mb-1 block text-xs font-medium text-fg-secondary"
                >
                  Email
                </label>
                <LInput
                  id="bemail"
                  v-model:value="bootstrapEmail"
                  type="text"
                  placeholder="you@example.com"
                  size="large"
                  autocomplete="email"
                  :disabled="bootstrapping"
                />
                <p class="mt-1 text-[11px] text-fg-tertiary">
                  This becomes your sign-in identity. API base: <code class="font-mono">{{ apiBase }}</code>
                </p>
              </div>

              <LAlert
                v-if="bootstrapError"
                type="error"
                :show-icon="true"
              >
                {{ bootstrapError }}
              </LAlert>

              <LButton
                type="primary"
                size="lg"
                :loading="bootstrapping"
                :disabled="!bootstrapName.trim() || !bootstrapEmail.trim()"
                class="!w-full"
                @click="onBootstrap"
              >
                <template v-if="!bootstrapping" #default>
                  Set up Lumina
                  <ArrowRight class="ml-1 h-4 w-4" />
                </template>
              </LButton>
            </form>
          </LCard>
        </template>

        <!-- ── Sign-in with key ─────────────────────────────────────── -->
        <template v-else-if="mode === 'sign-in'">
          <div class="text-center">
            <BrandMark :size="48" :show-wordmark="false" class="mx-auto mb-3" />
            <h1 class="text-2xl font-semibold tracking-tight">Sign in to Lumina</h1>
            <p class="mt-1 text-sm text-fg-tertiary">
              Paste your API key, or create a new account below.
            </p>
          </div>

          <LCard class="p-6">
            <form class="space-y-4" @submit.prevent="onSignIn">
              <div>
                <label
                  for="apiKey"
                  class="mb-1 block text-xs font-medium text-fg-secondary"
                >
                  API key
                </label>
                <LInput
                  id="apiKey"
                  v-model:value="apiKey"
                  :type="showKey ? 'text' : 'password'"
                  placeholder="lm-..."
                  size="large"
                  autocomplete="off"
                  spellcheck="false"
                  :disabled="signingIn"
                  @keydown.enter.prevent="onSignIn"
                >
                  <template #prefix>
                    <KeyRound class="h-4 w-4 text-fg-tertiary" />
                  </template>
                  <template #suffix>
                    <button
                      type="button"
                      class="flex h-7 w-7 items-center justify-center rounded text-fg-tertiary hover:bg-canvas"
                      :aria-label="showKey ? 'Hide API key' : 'Show API key'"
                      @click="showKey = !showKey"
                    >
                      <EyeOff v-if="showKey" class="h-4 w-4" />
                      <Eye v-else class="h-4 w-4" />
                    </button>
                  </template>
                </LInput>
                <p class="mt-1 text-[11px] text-fg-tertiary">
                  API base: <code class="font-mono">{{ apiBase }}</code>
                </p>
              </div>

              <LAlert
                v-if="signInError || auth.error.value"
                type="error"
                :show-icon="true"
              >
                {{ signInError || auth.error.value }}
              </LAlert>

              <LButton
                type="primary"
                size="lg"
                :loading="signingIn"
                :disabled="!apiKey.trim()"
                class="!w-full"
                @click="onSignIn"
              >
                Sign in
                <ArrowRight class="ml-1 h-4 w-4" />
              </LButton>
            </form>
          </LCard>

          <LCard class="p-4">
            <div class="flex items-start gap-3">
              <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-primary/15 text-accent-primary">
                <UserPlus class="h-4 w-4" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium">First time here?</div>
                <p class="mt-0.5 text-xs text-fg-tertiary">
                  Create an account — we'll issue a fresh API key and sign you in.
                </p>
                <LButton
                  size="sm"
                  text
                  class="mt-1 !px-0"
                  @click="mode = 'new-user'"
                >
                  Create an account →
                </LButton>
              </div>
            </div>
          </LCard>
        </template>

        <!-- ── Create-account (existing server, new user) ───────────── -->
        <template v-else-if="mode === 'new-user'">
          <div class="text-center">
            <div class="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/15 text-accent-primary">
              <UserPlus class="h-6 w-6" />
            </div>
            <h1 class="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p class="mt-1 text-sm text-fg-tertiary">
              We'll create a user, issue an API key, and sign you in.
            </p>
          </div>

          <LCard class="p-6">
            <form class="space-y-4" @submit.prevent="onCreateUser">
              <div>
                <label
                  for="nname"
                  class="mb-1 block text-xs font-medium text-fg-secondary"
                >
                  Your name
                </label>
                <LInput
                  id="nname"
                  v-model:value="newName"
                  placeholder="Ada Lovelace"
                  size="large"
                  autocomplete="name"
                  :disabled="creatingUser"
                />
              </div>
              <div>
                <label
                  for="nemail"
                  class="mb-1 block text-xs font-medium text-fg-secondary"
                >
                  Email
                </label>
                <LInput
                  id="nemail"
                  v-model:value="newEmail"

                  placeholder="you@example.com"
                  size="large"
                  autocomplete="email"
                  :disabled="creatingUser"
                />
              </div>

              <LAlert
                v-if="newUserError"
                type="error"
                :show-icon="true"
              >
                {{ newUserError }}
              </LAlert>

              <div class="flex gap-2">
                <LButton
                  size="lg"
                  quaternary
                  class="!flex-1"
                  :disabled="creatingUser"
                  @click="mode = 'sign-in'"
                >
                  Back
                </LButton>
                <LButton
                  type="primary"
                  size="lg"
                  class="!flex-1"
                  :loading="creatingUser"
                  :disabled="!newName.trim() || !newEmail.trim()"
                  @click="onCreateUser"
                >
                  Create &amp; sign in
                  <ArrowRight class="ml-1 h-4 w-4" />
                </LButton>
              </div>
            </form>
          </LCard>
        </template>
      </div>
    </div>
  </div>
</template>