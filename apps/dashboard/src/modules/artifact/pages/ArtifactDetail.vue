<script setup lang="ts">
import { computed, ref } from "vue";
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
  LIconButton,
} from "@lumina/ui";
import { ArrowLeft, Download, FileText, Folder, FolderOpen } from "lucide-vue-next";
import { ArtifactService } from "@/services/artifact.service";
import { useDateFormat } from "@/composables/useDateFormat";

const route = useRoute();
const projectId = computed(() => route.params.projectId as string);
const artifactId = computed(() => route.params.artifactId as string);
const { formatDate } = useDateFormat();

const { data: artifact, isLoading } = useQuery({
  queryKey: computed(() => ["artifact", artifactId.value]),
  queryFn: () => ArtifactService.get(artifactId.value),
  enabled: computed(() => !!artifactId.value),
});

// Versions aren't exposed via a dedicated endpoint yet — show the latest
// version metadata if present in the artifact payload, otherwise show empty.
const versions = computed(() => {
  const a = artifact.value as unknown as {
    versions?: Array<{
      id: string;
      version: string;
      aliases: string[];
      createdAt: string;
      metadata?: Record<string, unknown>;
    }>;
  } | null;
  return a?.versions ?? [];
});

const expandedFolders = ref<Set<string>>(new Set());

function toggleFolder(path: string) {
  const next = new Set(expandedFolders.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  expandedFolders.value = next;
}

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
}
const fileTree = computed<FileEntry[]>(() => {
  // Derive a tiny preview tree from the latest version's metadata.files if
  // present. Otherwise fall back to a single placeholder so the tab isn't empty.
  const meta = (versions.value[0]?.metadata ?? {}) as { files?: string[] };
  const files = meta.files ?? [];
  if (files.length === 0) return [];
  return files.map((p) => ({
    name: p.split("/").pop() ?? p,
    path: p,
    type: "file" as const,
  }));
});
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="`/projects/${projectId}/artifacts`"
      class="inline-flex items-center gap-1 text-sm text-fg-tertiary hover:text-fg-primary"
    >
      <ArrowLeft class="h-4 w-4" />
      Back to artifacts
    </RouterLink>

    <LSkeleton v-if="isLoading" text :repeat="3" />

    <template v-else-if="artifact">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-2xl font-semibold tracking-tight">
            {{ artifact.name }}
          </h1>
          <p v-if="artifact.description" class="mt-1 text-sm text-fg-tertiary">
            {{ artifact.description }}
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-fg-tertiary">
            <LTag size="small" type="info">{{ artifact.type }}</LTag>
            <span>{{ versions.length }} versions</span>
            <span>Updated {{ formatDate(artifact.updatedAt) }}</span>
          </div>
        </div>
        <div class="flex gap-2">
          <LButton size="sm">
            <Download class="mr-1 h-3 w-3" />
            Download
          </LButton>
        </div>
      </div>

      <LTabs type="line" animated>
        <LTabPane name="versions" tab="Versions">
          <LCard v-if="versions.length > 0" class="p-0">
            <ul class="divide-y divide-border">
              <li
                v-for="v in versions"
                :key="v.id"
                class="flex items-center justify-between px-4 py-3 text-sm hover:bg-canvas"
              >
                <div class="flex items-center gap-3">
                  <span class="font-mono">{{ v.version }}</span>
                  <div class="flex flex-wrap gap-1">
                    <LTag
                      v-for="a in v.aliases"
                      :key="a"
                      size="small"
                      type="primary"
                    >
                      @{{ a }}
                    </LTag>
                  </div>
                </div>
                <span class="font-mono text-xs text-fg-tertiary">
                  {{ formatDate(v.createdAt) }}
                </span>
              </li>
            </ul>
          </LCard>
          <LCard v-else class="p-8">
            <LEmpty
              title="No versions yet"
              description="Log artifacts from your runs to see versions here."
            />
          </LCard>
        </LTabPane>

        <LTabPane name="files" tab="Files">
          <LCard v-if="fileTree.length > 0" class="p-3">
            <ul class="space-y-1 font-mono text-sm">
              <li
                v-for="entry in fileTree"
                :key="entry.path"
                class="flex items-center gap-2 rounded px-2 py-1 hover:bg-canvas"
              >
                <LIconButton
                  aria-label="Toggle folder"
                  size="small"
                  @click="toggleFolder(entry.path)"
                >
                  <FolderOpen v-if="expandedFolders.has(entry.path)" class="h-3.5 w-3.5" />
                  <Folder v-else class="h-3.5 w-3.5" />
                </LIconButton>
                <FileText class="h-3.5 w-3.5 text-fg-tertiary" />
                <span class="truncate">{{ entry.path }}</span>
              </li>
            </ul>
          </LCard>
          <LCard v-else class="p-8">
            <LEmpty
              title="No file listing available"
              description="The artifact backend doesn't expose a file manifest yet."
            />
          </LCard>
        </LTabPane>

        <LTabPane name="metadata" tab="Metadata">
          <LCard class="p-4">
            <LJsonView
              :data="(versions[0]?.metadata ?? {}) as Record<string, unknown>"
              :deep="3"
            />
          </LCard>
        </LTabPane>

        <LTabPane name="lineage" tab="Lineage">
          <LCard class="p-8">
            <LEmpty
              title="No lineage captured"
              description="This artifact's producer run and parent artifacts will appear here."
            />
          </LCard>
        </LTabPane>
      </LTabs>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Artifact not found.
    </LCard>
  </div>
</template>