<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { LCard, LEmpty, LButton, LInput, LTextarea, LAlert, LDialog } from "@lumina/ui";
import { Settings as SettingsIcon, Trash2, ShieldAlert, Save } from "lucide-vue-next";
import { useProject } from "@/modules/project/composables/useProjects";
import { ProjectService } from "@/services/project.service";
import { useToast } from "@/composables/useToast";

/**
 * Project settings. Renders two surfaces:
 *   1. Metadata editing — displayName and description (Roadmap §M0-4).
 *      Backed by `PATCH /projects/:id` (server route already guarded by
 *      workspace authz; see `apps/server/src/modules/project/routes.ts`).
 *   2. Danger zone — irreversible project deletion, behind a typed-name
 *      confirmation dialog. Closes §12 of
 *      `docs/User-Lifecycle-Flow-Audit.md`.
 *
 * The `name` field is intentionally NOT editable: it's the URL slug and
 * the SDK's `lumina.init(project=...)` argument, so changing it would
 * break external scripts and links.
 */
const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const toast = useToast();

const projectId = computed(() => route.params.projectId as string);
const { data: project } = useProject(projectId);

// ── Metadata edit form ──────────────────────────────────────────────
// Local editable copies so the user can type freely without the query
// refetch clobbering in-progress edits. We resync whenever the project
// is loaded (or the route changes to a different project).
const editDisplayName = ref("");
const editDescription = ref("");
let lastSyncedProjectId: string | null = null;

watch(
  project,
  (p) => {
    if (!p) return;
    if (lastSyncedProjectId === p.id) return;
    editDisplayName.value = p.displayName ?? "";
    editDescription.value = p.description ?? "";
    lastSyncedProjectId = p.id;
  },
  { immediate: true },
);

const dirty = computed(() => {
  if (!project.value) return false;
  const dn = editDisplayName.value.trim();
  const desc = editDescription.value.trim();
  const origDn = project.value.displayName ?? "";
  const origDesc = project.value.description ?? "";
  return dn !== origDn || desc !== origDesc;
});

const updateMutation = useMutation({
  mutationFn: () =>
    ProjectService.update(projectId.value, {
      displayName: editDisplayName.value.trim() || undefined,
      description: editDescription.value.trim() || undefined,
    }),
  onSuccess: (updated) => {
    toast.success(`Project "${updated.name}" updated.`);
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project", updated.id] });
    // Re-sync local form with the canonical server-side values (may
    // differ from what the user typed if the server normalized them).
    editDisplayName.value = updated.displayName ?? "";
    editDescription.value = updated.description ?? "";
    lastSyncedProjectId = updated.id;
  },
  onError: (e) => toast.error(`Update failed: ${(e as Error).message}`),
});

function saveMetadata() {
  if (!dirty.value || updateMutation.isPending.value) return;
  updateMutation.mutate();
}

function resetMetadata() {
  if (!project.value) return;
  editDisplayName.value = project.value.displayName ?? "";
  editDescription.value = project.value.description ?? "";
}

// ── Delete ──────────────────────────────────────────────────────────
const deleteOpen = ref(false);
const deleteConfirm = ref("");

const canDelete = computed(
  () => !!project.value && deleteConfirm.value.trim() === project.value.name,
);

const deleteMutation = useMutation({
  mutationFn: () => ProjectService.delete(projectId.value),
  onSuccess: () => {
    toast.success(`Project "${project.value?.name}" deleted.`);
    deleteOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["runs"] });
    router.replace("/projects");
  },
  onError: (e) =>
    toast.error(`Delete failed: ${(e as Error).message}`),
});

function openDelete() {
  deleteConfirm.value = "";
  deleteOpen.value = true;
}
</script>

<template>
  <LCard class="p-8">
    <LEmpty
      v-if="!project"
      title="Project settings"
      description="Configure project-level metadata, default run configs, retention, and integrations."
      :icon="SettingsIcon"
    />
    <div v-else class="space-y-6 text-left">
      <div>
        <h2 class="text-lg font-semibold">Settings for {{ project.name }}</h2>
        <p class="text-xs text-fg-tertiary">
          Edit how this project appears in the dashboard. The internal
          name (<code class="font-mono">{{ project.name }}</code>) is
          fixed because it's part of the URL and used by SDK scripts.
        </p>
      </div>

      <!-- Metadata edit -->
      <LCard>
        <template #header>
          <div class="flex items-center gap-2 px-4 py-3">
            <SettingsIcon class="h-4 w-4 text-fg-tertiary" />
            <h3 class="text-sm font-medium">Metadata</h3>
          </div>
        </template>

        <form class="space-y-4 px-4 pb-4" @submit.prevent="saveMetadata">
          <div class="space-y-1">
            <label
              for="project-display-name"
              class="text-xs font-medium text-fg-secondary"
            >
              Display name
            </label>
            <LInput
              id="project-display-name"
              v-model:value="editDisplayName"
              placeholder="Friendly name shown in lists"
              autocomplete="off"
              :disabled="updateMutation.isPending.value"
            />
          </div>
          <div class="space-y-1">
            <label
              for="project-description"
              class="text-xs font-medium text-fg-secondary"
            >
              Description
            </label>
            <LTextarea
              id="project-description"
              v-model:value="editDescription"
              placeholder="What is this project for?"
              :rows="3"
              :disabled="updateMutation.isPending.value"
            />
          </div>
          <div class="flex items-center justify-end gap-2">
            <LButton
              quaternary
              :disabled="!dirty || updateMutation.isPending.value"
              attr-type="button"
              @click="resetMetadata"
            >
              Reset
            </LButton>
            <LButton
              :disabled="!dirty"
              :loading="updateMutation.isPending.value"
              @click="saveMetadata"
            >
              <Save class="mr-1 h-3 w-3" />
              Save changes
            </LButton>
          </div>
        </form>
      </LCard>

      <!-- Danger zone -->
      <LCard>
        <template #header>
          <div class="flex items-center gap-2 px-4 py-3">
            <ShieldAlert class="h-4 w-4 text-accent-danger" />
            <h3 class="text-sm font-medium text-accent-danger">Danger zone</h3>
          </div>
        </template>

        <div class="space-y-3 px-4 pb-4 text-sm">
          <p class="text-fg-secondary">
            Deleting this project removes every run, artifact, sweep,
            report, evaluation, trace, and launch queue under it. Server
            cascades are irreversible.
          </p>
          <div>
            <LButton type="error" @click="openDelete">
              <Trash2 class="mr-1 h-3 w-3" />
              Delete project
            </LButton>
          </div>
        </div>
      </LCard>
    </div>
  </LCard>

  <LDialog
    v-model:show="deleteOpen"
    title="Delete this project?"
    width="480px"
    @close="deleteConfirm = ''"
  >
    <div class="space-y-3">
      <LAlert type="error" :show-icon="true">
        This permanently deletes the project, every run, artifact, sweep,
        report, evaluation, and trace that lives inside it. There is no
        undo.
      </LAlert>

      <div class="space-y-1">
        <label
          for="project-delete-confirm"
          class="text-xs font-medium text-fg-secondary"
        >
          Type the project name
          <code class="font-mono text-fg-primary">{{ project?.name }}</code>
          to confirm.
        </label>
        <LInput
          id="project-delete-confirm"
          v-model:value="deleteConfirm"
          :placeholder="project?.name"
          autocomplete="off"
          spellcheck="false"
          :disabled="deleteMutation.isPending.value"
          @keydown.enter="canDelete && deleteMutation.mutate()"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <LButton
          quaternary
          :disabled="deleteMutation.isPending.value"
          @click="deleteOpen = false"
        >
          Cancel
        </LButton>
        <LButton
          type="error"
          :disabled="!canDelete"
          :loading="deleteMutation.isPending.value"
          @click="deleteMutation.mutate()"
        >
          <Trash2 class="mr-1 h-3 w-3" />
          Delete permanently
        </LButton>
      </div>
    </template>
  </LDialog>
</template>