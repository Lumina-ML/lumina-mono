<script setup lang="ts">
import { ref, h, computed } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LButton,
  LDataTable,
  LDialog,
  LInput,
  LTextarea,
  LEmpty,
  LSkeleton,
} from "@lumina/ui";
import type { ColumnDef } from "@tanstack/vue-table";
import { Plus, FolderOpen, Sparkles, X } from "lucide-vue-next";
import { useProjects } from "@/modules/project/composables/useProjects";
import { ProjectService } from "@/services/project.service";
import { useToast } from "@/composables/useToast";
import { useProjectStore } from "@/stores/project";
import { useDateFormat } from "@/composables/useDateFormat";
import type { Project } from "@/types/project";

const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const projectStore = useProjectStore();
const { formatDate } = useDateFormat();

const page = ref(1);
const pageSize = ref(20);

const params = ref({ limit: pageSize.value, offset: (page.value - 1) * pageSize.value });

const { data: projects, isLoading } = useProjects(params);

// ── "Try our demo project" banner (Roadmap §MVP-3 / M2-3) ────────────
// Highlights the pre-seeded __demo__ project on the project list so
// users who land here directly can find their way to the playground.
// Dismissible per-browser; the dismissal is sticky so the banner
// doesn't come back on every reload.
const DEMO_BANNER_DISMISS_KEY = "lumina:demo-banner-dismissed";
const bannerDismissed = ref(
  typeof window !== "undefined" &&
    window.localStorage.getItem(DEMO_BANNER_DISMISS_KEY) === "1",
);
const demoProject = computed(() =>
  projects.value?.items.find((p) => p.name === "__demo__") ?? null,
);
const showDemoBanner = computed(() => !!demoProject.value && !bannerDismissed.value);
function dismissDemoBanner() {
  bannerDismissed.value = true;
  try {
    window.localStorage.setItem(DEMO_BANNER_DISMISS_KEY, "1");
  } catch {
    /* ignore quota */
  }
}

// ── Create dialog ─────────────────────────────────────────────────────
const createOpen = ref(false);
const newName = ref("");
const newDisplayName = ref("");
const newDescription = ref("");
const createError = ref<string | null>(null);

const createMutation = useMutation({
  mutationFn: () =>
    ProjectService.create({
      name: newName.value.trim(),
      ...(newDisplayName.value.trim()
        ? { displayName: newDisplayName.value.trim() }
        : {}),
      ...(newDescription.value.trim()
        ? { description: newDescription.value.trim() }
        : {}),
    }),
  onSuccess: (created) => {
    toast.success(`Project "${created.name}" created`);
    projectStore.setCurrentId(created.id);
    createOpen.value = false;
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    router.push(`/projects/${created.id}`);
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    createError.value = msg;
    toast.error(`Failed to create project: ${msg}`);
  },
});

function resetForm() {
  newName.value = "";
  newDisplayName.value = "";
  newDescription.value = "";
  createError.value = null;
}

function openCreate() {
  resetForm();
  createOpen.value = true;
}

function submit() {
  createError.value = null;
  if (!newName.value.trim()) {
    createError.value = "Name is required";
    return;
  }
  createMutation.mutate();
}

const columns: ColumnDef<Project>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.id}`, class: "font-medium hover:underline" },
        () => row.original.name,
      ),
  },
  {
    accessorKey: "displayName",
    header: "Display Name",
    cell: ({ row }) => row.original.displayName || "—",
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => row.original.description || "—",
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      h(
        RouterLink,
        { to: `/projects/${row.original.id}` },
        () => h(LButton, { size: "sm" }, () => "View"),
      ),
  },
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Projects</h1>
        <p class="text-muted-foreground">Manage your ML projects.</p>
      </div>
      <LButton size="sm" @click="openCreate">
        <Plus class="mr-1 h-3 w-3" />
        New project
      </LButton>
    </div>

    <!-- "Try our demo project" banner. Roadmap §MVP-3. -->
    <div
      v-if="showDemoBanner"
      class="flex items-center justify-between gap-3 rounded-md border border-accent-primary/30 bg-accent-primary/5 px-4 py-3 text-sm"
    >
      <div class="flex items-center gap-2">
        <Sparkles class="h-4 w-4 text-accent-primary" />
        <span class="font-medium">Try our demo project.</span>
        <span class="text-fg-tertiary">
          The <code class="font-mono">__demo__</code> project ships
          pre-seeded so you can explore Lumina with realistic data.
        </span>
      </div>
      <div class="flex items-center gap-2">
        <RouterLink
          v-if="demoProject"
          :to="`/projects/${demoProject.id}/runs`"
          class="text-accent-primary hover:underline"
        >
          Open it →
        </RouterLink>
        <LButton
          size="xs"
          quaternary
          aria-label="Dismiss"
          @click="dismissDemoBanner"
        >
          <X class="h-3 w-3" />
        </LButton>
      </div>
    </div>

    <LCard class="p-0">
      <LSkeleton v-if="isLoading" class="p-8" :repeat="3" />
      <LDataTable
        v-else-if="(projects?.items.length ?? 0) > 0"
        :data="projects?.items ?? []"
        :columns="columns"
        :loading="isLoading"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="projects?.total ?? 0"
      />
      <LEmpty
        v-else
        class="p-12"
        title="No projects yet"
        description="Create your first project to start tracking runs, metrics, and artifacts."
      >
        <LButton class="mt-2" @click="openCreate">
          <Plus class="mr-1 h-3 w-3" />
          Create project
        </LButton>
      </LEmpty>
    </LCard>

    <LDialog
      v-model:show="createOpen"
      title="New project"
      width="480px"
      @close="resetForm"
    >
      <form class="space-y-3" @submit.prevent="submit">
        <div>
          <label for="project-name" class="mb-1 block text-xs font-medium text-fg-secondary">
            Name <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="project-name"
            v-model:value="newName"
            placeholder="e.g. image-classifier"
            autocomplete="off"
            autofocus
          />
          <p class="mt-1 text-[11px] text-fg-tertiary">
            Used in URLs and SDK calls (e.g. <code class="font-mono">lumina.init(project="{{ newName || 'name' }}")</code>).
            Letters, digits, dashes, underscores.
          </p>
        </div>
        <div>
          <label for="project-display" class="mb-1 block text-xs font-medium text-fg-secondary">
            Display name
          </label>
          <LInput
            id="project-display"
            v-model:value="newDisplayName"
            placeholder="e.g. Image Classifier"
          />
        </div>
        <div>
          <label for="project-desc" class="mb-1 block text-xs font-medium text-fg-secondary">
            Description
          </label>
          <LTextarea
            id="project-desc"
            v-model:value="newDescription"
            placeholder="Optional — what's this project for?"
            :rows="3"
          />
        </div>
        <div
          v-if="createError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ createError }}
        </div>
      </form>
      <template #footer>
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] text-fg-tertiary">
            <FolderOpen class="mr-1 inline h-3 w-3" />
            Project will be added to the default workspace.
          </span>
          <div class="flex gap-2">
            <LButton quaternary @click="createOpen = false">Cancel</LButton>
            <LButton
              :loading="createMutation.isPending.value"
              :disabled="!newName.trim()"
              @click="submit"
            >
              Create project
            </LButton>
          </div>
        </div>
      </template>
    </LDialog>
  </div>
</template>