<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LTag,
  LSkeleton,
  LEmpty,
  LButton,
  LTabs,
  LTabPane,
  LJsonView,
  LDialog,
  LInput,
} from "@lumina/ui";
import { ArrowLeft, Box, Link as LinkIcon, X as XIcon } from "lucide-vue-next";
import { RegistryService } from "@/services/registry.service";
import { useRuns } from "@/modules/run/composables/useRuns";
import { useDateFormat } from "@/composables/useDateFormat";
import { useToast } from "@/composables/useToast";

// The registry route doesn't carry the model ID, only :name and :version. We
// look up the model by name client-side, then find the matching version.
const route = useRoute();
const name = computed(() => route.params.name as string);
const version = computed(() => route.params.version as string);
const { formatDate } = useDateFormat();
const queryClient = useQueryClient();
const toast = useToast();

const { data: models } = useQuery({
  queryKey: ["registry-models", "by-name"],
  queryFn: () => RegistryService.list({ limit: 200 }),
});

const model = computed(() =>
  (models.value?.items ?? []).find((m) => m.name === name.value) ?? null,
);

const { data: versions, isLoading } = useQuery({
  queryKey: computed(() => ["registry-model-versions", model.value?.id]),
  queryFn: async () => {
    if (!model.value) return [];
    return RegistryService.listVersions(model.value.id);
  },
  enabled: computed(() => !!model.value),
});

const matchedVersion = computed(() =>
  (versions.value ?? []).find((v) => v.version === version.value) ?? null,
);

const aliasTags = computed(() => matchedVersion.value?.aliases ?? []);

// ── Link to run (Roadmap §M3-4) ──────────────────────────────────────
// The server doesn't model an explicit run → registry version FK, so we
// store the link under `metadata.linkedRunId` (and `linkedDatasetVersionId`
// if the user picks one). The lineage tab reads back from metadata so the
// graph survives across reloads. Future work: surface these as first-class
// columns on RegistryModelVersion.
const linkedRunId = computed(
  () =>
    (matchedVersion.value?.metadata as Record<string, unknown> | undefined)
      ?.linkedRunId as string | undefined,
);
const linkedRunName = computed(
  () =>
    (matchedVersion.value?.metadata as Record<string, unknown> | undefined)
      ?.linkedRunName as string | undefined,
);

const runsParams = computed(() =>
  model.value?.projectId
    ? { project: model.value.projectId, limit: 50, offset: 0 }
    : { limit: 0, offset: 0 },
);
const { data: runsResp } = useRuns(runsParams);
const projectRuns = computed(() => runsResp.value?.items ?? []);

const linkDialogOpen = ref(false);
const linkRunInput = ref("");

function openLinkDialog() {
  linkRunInput.value = linkedRunId.value ?? "";
  linkDialogOpen.value = true;
}

const linkMutation = useMutation({
  mutationFn: async (runId: string) => {
    if (!matchedVersion.value) throw new Error("No version");
    // Resolve the run name so the lineage tab can show "training-run-42"
    // instead of just the uuid. We accept the cost of a second fetch
    // because this dialog is rare and the resolved name is the entire UX.
    const matched = projectRuns.value.find((r) => r.runId === runId);
    const next = {
      ...(matchedVersion.value.metadata ?? {}),
      linkedRunId: runId,
      linkedRunName: matched?.name ?? null,
    };
    return RegistryService.patchVersion(matchedVersion.value.id, {
      metadata: next,
    });
  },
  onSuccess: () => {
    toast.success("Run linked to model version.");
    linkDialogOpen.value = false;
    queryClient.invalidateQueries({
      queryKey: computed(() => ["registry-model-versions", model.value?.id]).value,
    });
  },
  onError: (e) => toast.error(`Link failed: ${(e as Error).message}`),
});

const unlinkMutation = useMutation({
  mutationFn: async () => {
    if (!matchedVersion.value) throw new Error("No version");
    const next = { ...(matchedVersion.value.metadata ?? {}) };
    delete next.linkedRunId;
    delete next.linkedRunName;
    return RegistryService.patchVersion(matchedVersion.value.id, {
      metadata: next,
    });
  },
  onSuccess: () => {
    toast.success("Run link removed.");
    queryClient.invalidateQueries({
      queryKey: computed(() => ["registry-model-versions", model.value?.id]).value,
    });
  },
});
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      to="/models"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to model registry
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="model && matchedVersion">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-semibold tracking-tight">
            {{ model.name }}
            <span class="font-mono text-fg-tertiary">v{{ matchedVersion.version }}</span>
          </h1>
          <p v-if="model.description" class="mt-1 text-sm text-fg-tertiary">
            {{ model.description }}
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <LTag
              v-for="alias in aliasTags"
              :key="alias"
              size="small"
              type="primary"
            >
              @{{ alias }}
            </LTag>
            <span class="text-xs text-fg-tertiary">
              Created {{ formatDate(matchedVersion.createdAt) }}
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <LButton size="sm">Deploy</LButton>
        </div>
      </div>

      <LTabs type="line" animated>
        <LTabPane name="overview" tab="Overview">
          <LCard class="p-4">
            <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
              Metadata
            </h3>
            <LJsonView
              :data="matchedVersion.metadata"
              :deep="3"
            />
          </LCard>
        </LTabPane>

        <LTabPane name="schema" tab="Schema">
          <LCard class="p-8">
            <LEmpty
              title="No schema recorded"
              description="Model schema (input/output shapes) will appear here once captured."
              :icon="Box"
            />
          </LCard>
        </LTabPane>

        <LTabPane name="lineage" tab="Lineage">
          <LCard class="p-4">
            <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary">
              <LinkIcon class="mr-1 inline h-3 w-3" />
              Linked run
            </h3>
            <div v-if="linkedRunId" class="flex items-center gap-2 text-sm">
              <LTag size="small" type="primary">Run</LTag>
              <RouterLink
                v-if="model?.projectId"
                :to="`/projects/${model.projectId}/runs/${linkedRunId}`"
                class="font-mono text-xs hover:underline"
              >
                {{ linkedRunName ?? linkedRunId }}
              </RouterLink>
              <span v-else class="font-mono text-xs">{{ linkedRunId }}</span>
              <LButton
                size="xs"
                quaternary
                :loading="unlinkMutation.isPending.value"
                @click="unlinkMutation.mutate()"
              >
                <XIcon class="h-3 w-3" />
                Unlink
              </LButton>
            </div>
            <div v-else class="flex items-center gap-2 text-sm">
              <span class="text-fg-tertiary">No run linked yet.</span>
              <LButton size="sm" :disabled="!model?.projectId" @click="openLinkDialog">
                <LinkIcon class="mr-1 h-3 w-3" />
                Link to run
              </LButton>
            </div>
            <p
              v-if="!model?.projectId"
              class="mt-2 text-[11px] text-fg-tertiary"
            >
              Linking requires the registry model to belong to a project
              (the dashboard couldn't read its <code>projectId</code> from
              the registry list).
            </p>
          </LCard>
        </LTabPane>

        <LTabPane name="evaluations" tab="Evaluations">
          <LCard class="p-8">
            <LEmpty
              title="No evaluations"
              description="Run an evaluation against this model version to see metrics here."
              :icon="Box"
            />
          </LCard>
        </LTabPane>

        <LTabPane name="deployments" tab="Deployments">
          <LCard class="p-8">
            <LEmpty
              title="Not deployed"
              description="Deployment history will appear here once this version is rolled out."
              :icon="Box"
            />
          </LCard>
        </LTabPane>

        <LTabPane name="logs" tab="Logs">
          <LCard class="p-8">
            <LEmpty
              title="No logs"
              description="Logs from inference calls will appear here."
              :icon="Box"
            />
          </LCard>
        </LTabPane>
      </LTabs>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Model version not found.
    </LCard>

    <!-- Link-to-run dialog (Roadmap §M3-4). -->
    <LDialog
      v-model:show="linkDialogOpen"
      title="Link this version to a run"
      width="520px"
    >
      <div class="space-y-3">
        <p class="text-xs text-fg-tertiary">
          Pick a run in this project. The link is stored as
          <code class="font-mono">metadata.linkedRunId</code> on the
          registry version (soft link — no FK), so existing data won't
          cascade.
        </p>
        <div>
          <label
            for="link-run-input"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Run ID
          </label>
          <LInput
            id="link-run-input"
            v-model:value="linkRunInput"
            placeholder="e.g. 019234ab-…"
          />
          <div
            v-if="projectRuns.length > 0"
            class="mt-2 max-h-40 overflow-auto rounded-md border border-border"
          >
            <button
              v-for="r in projectRuns"
              :key="r.runId"
              type="button"
              class="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-canvas"
              :class="linkRunInput === r.runId ? 'bg-accent-primary/10' : ''"
              @click="linkRunInput = r.runId"
            >
              <span class="truncate font-medium">{{ r.name }}</span>
              <span class="font-mono text-fg-tertiary">
                {{ r.runId.slice(0, 8) }}…
              </span>
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="linkDialogOpen = false">Cancel</LButton>
          <LButton
            :loading="linkMutation.isPending.value"
            :disabled="!linkRunInput.trim()"
            @click="linkMutation.mutate(linkRunInput.trim())"
          >
            Link
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>