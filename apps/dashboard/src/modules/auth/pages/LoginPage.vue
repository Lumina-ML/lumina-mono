<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
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
import { ApiError } from "@/services/api";
import { useToast } from "@/composables/useToast";
import BrandMark from "@/components/BrandMark.vue";

type Mode = "loading" | "first-run" | "sign-in" | "new-user" | "forgot-key";

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

// Probe failure is shown as a banner on top of the sign-in form so the
// user knows we couldn't reach the server (rather than silently landing
// on an empty form). Distinguishes network errors (server down / DNS /
// CORS) from HTTP 4xx (auth) and 5xx (server-side problem).
const probeError = ref<string | null>(null);

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

// ── "Forgot key" recovery state ──────────────────────────────────────
// Gated server-side by an email allowlist (LUMINA_ROTATE_KEY_EMAILS).
// Non-eligible emails come back as a generic 404, so the copy here never
// confirms whether an email is registered.
const forgotEmail = ref("");
const forgotError = ref<string | null>(null);
const forgotting = ref(false);
const recoveredKey = ref<string | null>(null);
const recoveredCopied = ref(false);

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
    signInError.value = describeFetchError(err);
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
    handleCreateUserError(err, {
      setError: (msg) => (bootstrapError.value = msg),
      // For bootstrap, a 409 means someone (another tab, a previous
      // session) already created the first user. The submitted email
      // exists but we can't recover their API key, so flip into
      // sign-in mode and ask them to use the key they were issued.
      onConflict: () => {
        apiKey.value = "";
        mode.value = "sign-in";
        toast.warning(
          "A user with this email already exists on this server. Sign in with your existing API key instead.",
        );
      },
    });
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
    handleCreateUserError(err, {
      setError: (msg) => (newUserError.value = msg),
      // For new-user, a 409 just means "pick a different email" — stay
      // on the form so they can correct the input.
      onConflict: () => {},
    });
  } finally {
    creatingUser.value = false;
  }
}

function enterForgotKey() {
  forgotEmail.value = "";
  forgotError.value = null;
  recoveredKey.value = null;
  recoveredCopied.value = false;
  mode.value = "forgot-key";
}

async function onForgotKey() {
  forgotError.value = null;
  const email = forgotEmail.value.trim();
  if (!email) {
    forgotError.value = "Enter the email tied to your account.";
    return;
  }
  forgotting.value = true;
  try {
    const { apiKey: newKey } = await WorkspaceService.rotateKeyByEmail(email);
    recoveredKey.value = newKey;
  } catch (err) {
    // 404 is the server's "not eligible / no such user" — never confirm which.
    if (err instanceof ApiError && err.status === 404) {
      forgotError.value =
        "That email isn't set up for self-service recovery on this server. Ask an admin to rotate your key, or create a new account.";
    } else if (err instanceof ApiError && err.status === 429) {
      forgotError.value = "Too many attempts. Please wait a few minutes and try again.";
    } else {
      forgotError.value = describeFetchError(err);
    }
  } finally {
    forgotting.value = false;
  }
}

async function copyRecoveredKey() {
  if (!recoveredKey.value) return;
  try {
    await navigator.clipboard.writeText(recoveredKey.value);
    recoveredCopied.value = true;
    setTimeout(() => (recoveredCopied.value = false), 1500);
  } catch {
    toast.error("Couldn't copy — select the key and copy it manually.");
  }
}

/** Prefill the recovered key into the sign-in form and switch to it. */
function useRecoveredKey() {
  if (recoveredKey.value) apiKey.value = recoveredKey.value;
  mode.value = "sign-in";
}

/**
 * Turn a thrown error from fetchApi into a copy line the user can act
 * on. Network failures bubble up as `TypeError` from `fetch()` rather
 * than as `ApiError`, so we treat anything that's not an `ApiError` as
 * "can't reach the server".
 */
function describeFetchError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Can't reach the Lumina server. Check that the API URL is correct and the server is running.";
  }
  if (err.status === 401 || err.status === 403) {
    return "That API key was rejected. Double-check it from your dashboard and try again.";
  }
  if (err.status >= 500) {
    return `The Lumina server is having trouble (HTTP ${err.status}). Please retry in a moment.`;
  }
  // 4xx with a message from the server — surface verbatim.
  const data = err.data as { message?: string } | undefined;
  if (data?.message) return data.message;
  return `Sign-in failed (HTTP ${err.status}).`;
}

/**
 * Shared error shape for both create-user flows. Branches on 409 (the
 * only "expected" client-side failure — every other error is a real
 * server/network problem and should surface verbatim).
 */
function handleCreateUserError(
  err: unknown,
  opts: {
    setError: (msg: string) => void;
    onConflict: () => void;
  },
) {
  if (err instanceof ApiError && err.status === 409) {
    // Server already shaped the body as { error, message, field }.
    const data = err.data as { message?: string; field?: string } | undefined;
    const message =
      data?.message ?? "An account with this email already exists.";
    opts.setError(message);
    opts.onConflict();
    return;
  }
  opts.setError(err instanceof Error ? err.message : "Action failed.");
}

onMounted(async () => {
  // Honor a deep-link with a pre-filled key.
  if (typeof route.query.key === "string" && route.query.key.length > 0) {
    apiKey.value = route.query.key;
  }

  try {
    const { items } = await WorkspaceService.listUsers();
    mode.value = items.length === 0 ? "first-run" : "sign-in";
  } catch (err) {
    // We couldn't reach the server (or the server rejected the probe).
    // Either way, fall back to the manual sign-in form so the user has
    // something to interact with, and surface the reason as a banner so
    // they know why the auto-bootstrap prompt didn't appear.
    probeError.value = describeFetchError(err);
    mode.value = "sign-in";
  }
});

const apiBase = import.meta.env.VITE_LUMINA_API_URL || "(default — same origin)";
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background">
    <header class="flex items-center justify-between border-b border-border px-6 py-3">
      <div class="flex items-center gap-2">
        <BrandMark :size="24" :show-wordmark="true" />
      </div>
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

          <LAlert
            v-if="probeError"
            type="warning"
            :show-icon="true"
            title="Couldn't reach the server"
          >
            {{ probeError }}
            <template v-if="apiBase">
              <div class="mt-1 text-[11px] text-fg-tertiary">
                Tried: <code class="font-mono">{{ apiBase }}</code>
              </div>
            </template>
          </LAlert>

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

              <div class="text-center">
                <LButton
                  size="sm"
                  text
                  class="!px-0 text-xs"
                  @click="enterForgotKey"
                >
                  Forgot your key?
                </LButton>
              </div>
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

        <!-- ── Forgot key: self-service recovery ────────────────────── -->
        <template v-else-if="mode === 'forgot-key'">
          <div class="text-center">
            <div class="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/15 text-accent-primary">
              <KeyRound class="h-6 w-6" />
            </div>
            <h1 class="text-2xl font-semibold tracking-tight">Recover your API key</h1>
            <p class="mt-1 text-sm text-fg-tertiary">
              If your email is enabled for recovery, we'll issue a fresh key.
            </p>
          </div>

          <!-- Result: a fresh key was minted. Show once so it can be copied. -->
          <LCard v-if="recoveredKey" class="p-6">
            <div class="space-y-3">
              <LAlert type="warning" :show-icon="true" title="Copy this key now">
                Your old key stopped working the moment this one was issued.
                Store it somewhere safe — you won't see it again.
              </LAlert>
              <div class="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 font-mono text-xs">
                <span class="min-w-0 flex-1 truncate">{{ recoveredKey }}</span>
                <LButton size="sm" @click="copyRecoveredKey">
                  {{ recoveredCopied ? "Copied" : "Copy" }}
                </LButton>
              </div>
              <LButton
                type="primary"
                size="lg"
                class="!w-full"
                @click="useRecoveredKey"
              >
                Continue to sign in
                <ArrowRight class="ml-1 h-4 w-4" />
              </LButton>
            </div>
          </LCard>

          <!-- Request form -->
          <LCard v-else class="p-6">
            <form class="space-y-4" @submit.prevent="onForgotKey">
              <div>
                <label
                  for="femail"
                  class="mb-1 block text-xs font-medium text-fg-secondary"
                >
                  Email
                </label>
                <LInput
                  id="femail"
                  v-model:value="forgotEmail"
                  placeholder="you@example.com"
                  size="large"
                  autocomplete="email"
                  :disabled="forgotting"
                  @keydown.enter.prevent="onForgotKey"
                />
                <p class="mt-1 text-[11px] text-fg-tertiary">
                  Recovery must be enabled for your email by an admin
                  (<code class="font-mono">LUMINA_ROTATE_KEY_EMAILS</code>).
                </p>
              </div>

              <LAlert
                v-if="forgotError"
                type="error"
                :show-icon="true"
              >
                {{ forgotError }}
              </LAlert>

              <div class="flex gap-2">
                <LButton
                  size="lg"
                  quaternary
                  class="!flex-1"
                  :disabled="forgotting"
                  @click="mode = 'sign-in'"
                >
                  Back
                </LButton>
                <LButton
                  type="primary"
                  size="lg"
                  class="!flex-1"
                  :loading="forgotting"
                  :disabled="!forgotEmail.trim()"
                  @click="onForgotKey"
                >
                  Issue a new key
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