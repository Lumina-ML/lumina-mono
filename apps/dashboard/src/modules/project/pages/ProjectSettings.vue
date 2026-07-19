<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { LCard, LEmpty, LButton, LInput, LAlert, LDialog } from "@lumina/ui";
import { Settings as SettingsIcon, Trash2, ShieldAlert } from "lucide-vue-next";
import { useProject } from "@/modules/project/composables/useProjects";
import { ProjectService } from "@/services/project.service";
import { useToast } from "@/composables/useToast";

/**
 * Project settings. Today this is mostly the danger zone — server-side
 * `DELETE /projects/:id` ships but had no UI entry point. Closes the
 * remaining piece of §12 from `docs/User-Lifecycle-Flow-Audit.md`.
 *
 * Project metadata editing is a planned follow-up once the workspace
 * guard gets refactored (see `apps/server/src/core/authz/assert-workspace.ts`
 * — inline asserts need to become a service before adding more handlers).
 */
const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const toast = useToast();

const projectId = computed(() => route.params.projectId as string);
const { data: project } = useProject(projectId);

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
          Project metadata edits, retention policies, and integration
          settings are coming in a follow-up release.
        </p>
      </div>

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