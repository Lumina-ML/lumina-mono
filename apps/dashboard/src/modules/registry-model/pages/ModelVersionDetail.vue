<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import {
  LCard,
  LTag,
  LSkeleton,
  LEmpty,
  LButton,
  LTabs,
  LTabPane,
  LJsonView,
} from "@lumina/ui";
import { ArrowLeft, Box } from "lucide-vue-next";
import { RegistryService } from "@/services/registry.service";
import { useDateFormat } from "@/composables/useDateFormat";

// The registry route doesn't carry the model ID, only :name and :version. We
// look up the model by name client-side, then find the matching version.
const route = useRoute();
const name = computed(() => route.params.name as string);
const version = computed(() => route.params.version as string);
const { formatDate } = useDateFormat();

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
          <LCard class="p-8">
            <LEmpty
              title="No lineage graph yet"
              description="Link this version to a training run and dataset to populate the lineage graph."
              :icon="Box"
            />
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
  </div>
</template>