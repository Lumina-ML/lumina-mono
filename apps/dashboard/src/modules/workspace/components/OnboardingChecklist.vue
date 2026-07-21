<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import {
  Check,
  ChevronRight,
  X,
} from "lucide-vue-next";
import { LButton } from "@lumina/ui";

/**
 * Onboarding checklist (Roadmap §MVP-3 / M2-1).
 *
 * Five linear steps that walk a brand-new user through the parts of
 * Lumina that aren't already obvious from the demo cards:
 *
 *   1. Create a project       → /projects
 *   2. Run a demo             → scroll to demo cards (anchor on the
 *                               workspace overview)
 *   3. Open a run             → /projects/__demo__/runs (after step 1)
 *   4. View a metric chart    → /projects/__demo__/runs (RunDetail
 *                               already shows charts)
 *   5. Invite a teammate      → /settings/members
 *
 * Completion state lives in localStorage so it survives reloads but is
 * scoped per-browser — there is no backend source of truth for "has
 * this user done X yet". When all five are checked off the checklist
 * auto-collapses; users can still reopen it from the "Show onboarding"
 * affordance.
 */

interface Step {
  id: string;
  title: string;
  description: string;
  to?: string; // router-link target
  anchor?: string; // scroll target when no route (used for the demo-cards anchor)
  /** Marker the parent sets when the step is considered done. */
  done: () => boolean;
}

const STORAGE_KEY = "lumina:onboarding:v1";

function loadState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveState(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

const router = useRouter();
const collapsed = ref(false);
const state = ref<Record<string, boolean>>(loadState());

// ── Step definitions ─────────────────────────────────────────────────
// "Done" semantics are intentionally side-effecty — each step is
// considered complete when the user has navigated to its destination at
// least once, or when the relevant data exists. The simplest signal
// that doesn't require a backend is: have they hit the page?
const completedCount = computed(
  () => Object.values(state.value).filter(Boolean).length,
);

const steps = computed<Step[]>(() => [
  {
    id: "create-project",
    title: "Create a project",
    description: "Projects scope runs, sweeps, and artifacts.",
    to: "/projects",
    done: () => state.value["create-project"] === true,
  },
  {
    id: "run-demo",
    title: "Run a demo scenario",
    description: "Click any of the demo cards below to populate the __demo__ project.",
    anchor: "demo-cards",
    done: () => state.value["run-demo"] === true,
  },
  {
    id: "open-run",
    title: "Open a run",
    description: "Drill into a run to see metrics, logs, and config.",
    to: "/projects",
    done: () => state.value["open-run"] === true,
  },
  {
    id: "view-chart",
    title: "View a metric chart",
    description: "Inside any run, click a metric key to chart it.",
    to: "/projects",
    done: () => state.value["view-chart"] === true,
  },
  {
    id: "invite",
    title: "Invite a teammate",
    description: "Share the workspace via the Members settings page.",
    to: "/settings/members",
    done: () => state.value["invite"] === true,
  },
]);

const progress = computed(() => completedCount.value / steps.value.length);
const allDone = computed(() => progress.value === 1);

// Mark a step as done when the user clicks its action.
function completeAndGo(step: Step) {
  state.value = { ...state.value, [step.id]: true };
  saveState(state.value);
  if (step.to) {
    router.push(step.to);
  } else if (step.anchor && typeof document !== "undefined") {
    document
      .getElementById(step.anchor)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function reset() {
  state.value = {};
  saveState(state.value);
}

function dismiss() {
  collapsed.value = true;
}
</script>

<template>
  <section
    v-if="!collapsed"
    class="rounded-lg border border-border bg-card p-4 shadow-sm"
    aria-label="Onboarding checklist"
  >
    <header class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold">
          Get started with Lumina
          <span class="ml-2 text-xs font-normal text-fg-tertiary">
            {{ completedCount }} / {{ steps.length }} complete
          </span>
        </h2>
        <p class="text-xs text-fg-tertiary">
          Five quick steps to see Lumina in action. Skim, click around,
          come back when you're ready.
        </p>
      </div>
      <div class="flex items-center gap-1">
        <LButton size="xs" quaternary aria-label="Reset progress" @click="reset">
          Reset
        </LButton>
        <LButton size="xs" quaternary aria-label="Dismiss" @click="dismiss">
          <X class="h-3 w-3" />
        </LButton>
      </div>
    </header>

    <!-- Progress bar -->
    <div class="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
      <div
        class="h-full bg-accent-primary transition-all"
        :style="{ width: `${progress * 100}%` }"
      />
    </div>

    <ol class="grid grid-cols-1 gap-2 md:grid-cols-5">
      <li
        v-for="(step, i) in steps"
        :key="step.id"
        class="flex items-start gap-2 rounded-md border border-border p-2 text-xs transition-colors"
        :class="step.done() ? 'bg-accent-primary/5 border-accent-primary/30' : 'bg-canvas'"
      >
        <div
          class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-medium"
          :class="
            step.done()
              ? 'border-accent-primary bg-accent-primary text-white'
              : 'border-border text-fg-tertiary'
          "
        >
          <Check v-if="step.done()" class="h-3 w-3" />
          <span v-else>{{ i + 1 }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-medium text-fg-primary">{{ step.title }}</div>
          <div class="mt-0.5 text-fg-tertiary">{{ step.description }}</div>
          <LButton
            v-if="!step.done()"
            quaternary
            size="xs"
            class="!mt-1 !text-accent-primary hover:!underline"
            @click="completeAndGo(step)"
          >
            Do it now
            <ChevronRight class="ml-1 h-3 w-3" />
          </LButton>
          <span
            v-else
            class="mt-1 inline-flex items-center gap-1 text-accent-success"
          >
            <Check class="h-3 w-3" />
            Done
          </span>
        </div>
      </li>
    </ol>

    <p v-if="allDone" class="mt-3 text-xs text-fg-tertiary">
      🎉 You've finished the quick start. The checklist will auto-collapse
      next time you visit this page.
    </p>
  </section>
</template>