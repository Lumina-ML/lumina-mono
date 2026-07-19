<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/vue-query";
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
  LDialog,
  LInput,
} from "@lumina/ui";
import {
  ArrowLeft,
  Download,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Pencil,
  Upload,
  PackageOpen,
} from "lucide-vue-next";
import { ArtifactService } from "@/services/artifact.service";
import { RegistryService } from "@/services/registry.service";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";
import { useRealtimeSubscription } from "@/composables/useRealtimeSubscription";
import { useWorkspaceChannel } from "@/composables/useWorkspaceChannel";
import { ApiError } from "@/services/api";
import type { ArtifactVersion } from "@/types/artifact";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const { formatDate } = useDateFormat();

const projectId = computed(() => route.params.projectId as string);
const artifactId = computed(() => route.params.artifactId as string);

// Workspace-wide realtime: refetch versions + lineage when another
// agent uploads a new file or finalizes a version. The artifact body
// itself rarely changes, but we invalidate it too for consistency with
// alias edits elsewhere.
useRealtimeSubscription(
  useWorkspaceChannel(),
  (event) => {
    if (event.type === "ArtifactUploaded") {
      queryClient.invalidateQueries({ queryKey: ["artifact", artifactId.value] });
      queryClient.invalidateQueries({ queryKey: ["artifact-versions", artifactId.value] });
      queryClient.invalidateQueries({ queryKey: ["artifact-lineage"] });
    }
  },
);

// ── Load artifact + versions ──────────────────────────────────────────
const {
  data: artifact,
  isLoading,
} = useQuery({
  queryKey: computed(() => ["artifact", artifactId.value]),
  queryFn: () => ArtifactService.get(artifactId.value),
  enabled: computed(() => !!artifactId.value),
});

const { data: versionsResp, isLoading: versionsLoading } = useQuery({
  queryKey: computed(() => ["artifact-versions", artifactId.value]),
  queryFn: () => ArtifactService.listVersions(artifactId.value),
  enabled: computed(() => !!artifactId.value),
});

const versions = computed<ArtifactVersion[]>(() => versionsResp.value ?? []);
const latestVersion = computed<ArtifactVersion | null>(
  () => versions.value[0] ?? null,
);

// ── File tree (manifest-based) ────────────────────────────────────────
interface FileEntry {
  name: string;
  path: string;
  size?: number;
}
const fileTree = computed<FileEntry[]>(() => {
  const v = latestVersion.value;
  if (!v) return [];
  if (v.manifest?.entries?.length) {
    return v.manifest.entries.map((e) => ({
      name: e.path.split("/").pop() ?? e.path,
      path: e.path,
      size: e.size ? Number(e.size) : undefined,
    }));
  }
  if (v.files?.length) {
    return v.files.map((f) => ({
      name: f.path.split("/").pop() ?? f.path,
      path: f.path,
      size: f.size,
    }));
  }
  return [];
});
const expandedFolders = ref<Set<string>>(new Set());
function toggleFolder(path: string) {
  const next = new Set(expandedFolders.value);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  expandedFolders.value = next;
}

function downloadEntry(entry: FileEntry) {
  const v = latestVersion.value;
  if (!v) return;
  const file = v.files?.find((f) => f.path === entry.path);
  const url = file?.downloadUrl ?? file?.referenceUri;
  if (url) {
    window.open(url, "_blank", "noopener");
    return;
  }
  toast.warning("No download URL on this artifact — backend didn't pre-sign.");
}

function downloadAll() {
  // S3-backed artifacts get a per-file pre-signed URL; for local storage,
  // the backend exposes /versions/:id/file?path=… that streams the file.
  // We surface the latest version's first file as a representative
  // download so the button is never dead. The full bundle would need a
  // zip endpoint which we don't ship yet.
  const first = fileTree.value[0];
  if (!first) {
    toast.info("No files to download yet");
    return;
  }
  downloadEntry(first);
}

// ── Lineage (server endpoint exists at /versions/:id/lineage) ────────
const lineageQuery = useQuery({
  queryKey: computed(() => ["artifact-lineage", latestVersion.value?.id]),
  queryFn: () => {
    if (!latestVersion.value) {
      return Promise.resolve({ parents: [], children: [] });
    }
    return ArtifactService.listLineage(latestVersion.value.id);
  },
  enabled: computed(() => !!latestVersion.value),
});
const lineage = computed(() => lineageQuery.data.value ?? { parents: [], children: [] });

// ── Aliases editor ───────────────────────────────────────────────────
const aliasesOpen = ref(false);
const aliasesDraft = ref("");
const aliasesError = ref<string | null>(null);
function openAliasesEditor() {
  aliasesDraft.value = (latestVersion.value?.aliases ?? []).join(", ");
  aliasesError.value = null;
  aliasesOpen.value = true;
}
const aliasesMutation = useMutation({
  mutationFn: () => {
    if (!latestVersion.value) throw new Error("No version");
    const aliases = aliasesDraft.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return ArtifactService.patchVersion(latestVersion.value.id, { aliases });
  },
  onSuccess: () => {
    toast.success("Aliases updated");
    aliasesOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["artifact-versions", artifactId.value] });
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    aliasesError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

// ── Add file (upload via backend's addFile + finalize) ───────────────
const addFileOpen = ref(false);
const filePath = ref("");
const fileSizeText = ref("");
const fileContentType = ref("application/octet-stream");
const fileError = ref<string | null>(null);
function openAddFile() {
  filePath.value = "";
  fileSizeText.value = "";
  fileContentType.value = "application/octet-stream";
  fileError.value = null;
  addFileOpen.value = true;
}
const addFileMutation = useMutation({
  mutationFn: async () => {
    if (!latestVersion.value) throw new Error("No version");
    if (!filePath.value.trim()) throw new Error("Path is required");
    const size = Number(fileSizeText.value.trim());
    if (!size || size <= 0 || Number.isNaN(size)) {
      throw new Error("Size must be a positive number");
    }
    return ArtifactService.addFile(latestVersion.value.id, {
      path: filePath.value.trim(),
      size,
      contentType: fileContentType.value.trim() || undefined,
    });
  },
  onSuccess: () => {
    toast.success("File registered (upload via the returned URL if S3)");
    addFileOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["artifact-versions", artifactId.value] });
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    fileError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

// ── Promote to registry ──────────────────────────────────────────────
const promoteOpen = ref(false);
const promoteModelName = ref("");
const promoteAliasText = ref("latest");
const promoteError = ref<string | null>(null);
function openPromote() {
  promoteModelName.value = artifact.value?.name ?? "";
  promoteAliasText.value = "latest";
  promoteError.value = null;
  promoteOpen.value = true;
}
const promoteMutation = useMutation({
  mutationFn: async () => {
    if (!artifact.value || !latestVersion.value) {
      throw new Error("Artifact or version missing");
    }
    if (!promoteModelName.value.trim()) {
      throw new Error("Model name is required");
    }
    // 1) Create (or fetch) the registry model under this project.
    //    The FE service has no "find by name" path, so we 404-handle.
    let modelId: string;
    try {
      const created = await RegistryService.create(projectId.value, {
        name: promoteModelName.value.trim(),
      });
      modelId = created.id;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Already exists — look it up in the project-scoped list.
        const list = await RegistryService.list({
          projectId: projectId.value,
          limit: 200,
        });
        const found = list.items.find(
          (m) => m.name === promoteModelName.value.trim(),
        );
        if (!found) {
          throw new Error("Registry model exists but couldn't be loaded");
        }
        modelId = found.id;
      } else {
        throw e;
      }
    }
    // 2) Attach this artifact version to the registry.
    const aliases = promoteAliasText.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return RegistryService.createVersion(
      modelId,
      latestVersion.value.id,
      aliases,
    );
  },
  onSuccess: (version) => {
    toast.success(
      `Promoted to registry as ${promoteModelName.value}@${version.version}`,
    );
    promoteOpen.value = false;
    router.push(`/models/${encodeURIComponent(promoteModelName.value)}/versions/${version.version}`);
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    promoteError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

// Pretty-printer for size
function formatSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
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
        <div class="flex flex-wrap gap-2">
          <LButton
            size="sm"
            quaternary
            :disabled="!latestVersion"
            @click="openPromote"
          >
            <PackageOpen class="mr-1 h-3 w-3" />
            Promote to registry
          </LButton>
          <LButton size="sm" quaternary :disabled="!latestVersion" @click="openAddFile">
            <Upload class="mr-1 h-3 w-3" />
            Add file
          </LButton>
          <LButton size="sm" :disabled="fileTree.length === 0" @click="downloadAll">
            <Download class="mr-1 h-3 w-3" />
            Download
          </LButton>
        </div>
      </div>

      <LTabs type="line" animated>
        <!-- ── Versions ────────────────────────────────────────────── -->
        <LTabPane name="versions" tab="Versions">
          <LSkeleton v-if="versionsLoading" class="p-8" :repeat="3" />
          <LCard v-else-if="versions.length > 0" class="p-0">
            <ul class="divide-y divide-border">
              <li
                v-for="v in versions"
                :key="v.id"
                class="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-canvas"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <span class="font-mono">{{ v.version }}</span>
                  <LTag size="small" :type="v.state === 'committed' ? 'success' : 'default'">
                    {{ v.state }}
                  </LTag>
                  <div v-if="v.aliases.length > 0" class="flex flex-wrap gap-1">
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
                <div class="flex items-center gap-2">
                  <span class="font-mono text-xs text-fg-tertiary">
                    {{ formatDate(v.createdAt) }}
                  </span>
                  <LIconButton
                    v-if="v === latestVersion"
                    aria-label="Edit aliases"
                    size="small"
                    @click="openAliasesEditor"
                  >
                    <Pencil class="h-3.5 w-3.5" />
                  </LIconButton>
                </div>
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

        <!-- ── Files ───────────────────────────────────────────────── -->
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
                  <FolderOpen
                    v-if="expandedFolders.has(entry.path)"
                    class="h-3.5 w-3.5"
                  />
                  <Folder v-else class="h-3.5 w-3.5" />
                </LIconButton>
                <FileText class="h-3.5 w-3.5 text-fg-tertiary" />
                <span class="truncate">{{ entry.path }}</span>
                <span class="ml-auto text-xs text-fg-tertiary">
                  {{ formatSize(entry.size) }}
                </span>
                <LIconButton
                  aria-label="Download file"
                  size="small"
                  @click="downloadEntry(entry)"
                >
                  <Download class="h-3.5 w-3.5" />
                </LIconButton>
              </li>
            </ul>
          </LCard>
          <LCard v-else class="p-8">
            <LEmpty
              title="No file listing available"
              description="Log files from your runs to populate this view."
            />
          </LCard>
        </LTabPane>

        <!-- ── Metadata ────────────────────────────────────────────── -->
        <LTabPane name="metadata" tab="Metadata">
          <LCard class="p-4">
            <LJsonView
              :data="(latestVersion?.metadata ?? {}) as Record<string, unknown>"
              :deep="3"
            />
          </LCard>
        </LTabPane>

        <!-- ── Lineage ─────────────────────────────────────────────── -->
        <LTabPane name="lineage" tab="Lineage">
          <LCard v-if="lineageQuery.isLoading.value" class="p-8">
            <LSkeleton text :repeat="2" />
          </LCard>
          <LCard
            v-else-if="
              lineage.parents.length === 0 && lineage.children.length === 0
            "
            class="p-8"
          >
            <LEmpty
              title="No lineage captured"
              description="Attach parent artifacts via the SDK (lumina.artifact_lineage) to see the producer/consumer graph."
            />
          </LCard>
          <div v-else class="space-y-4">
            <LCard v-if="lineage.parents.length > 0" class="p-4">
              <h3
                class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary"
              >
                <GitBranch class="mr-1 inline h-3 w-3" />
                Parents ({{ lineage.parents.length }})
              </h3>
              <ul class="space-y-1.5 text-sm">
                <li
                  v-for="edge in lineage.parents"
                  :key="edge.id"
                  class="flex items-center gap-2 rounded-md border border-border bg-canvas px-3 py-2"
                >
                  <span class="font-mono text-xs">{{ edge.type }}</span>
                  <RouterLink
                    :to="`/projects/${projectId}/artifacts`"
                    class="font-mono text-xs hover:underline"
                  >
                    {{ edge.parentVersionId.slice(0, 12) }}…
                  </RouterLink>
                </li>
              </ul>
            </LCard>
            <LCard v-if="lineage.children.length > 0" class="p-4">
              <h3
                class="mb-3 text-xs font-medium uppercase tracking-wider text-fg-tertiary"
              >
                <GitBranch class="mr-1 inline h-3 w-3" />
                Children ({{ lineage.children.length }})
              </h3>
              <ul class="space-y-1.5 text-sm">
                <li
                  v-for="edge in lineage.children"
                  :key="edge.id"
                  class="flex items-center gap-2 rounded-md border border-border bg-canvas px-3 py-2"
                >
                  <span class="font-mono text-xs">{{ edge.type }}</span>
                  <RouterLink
                    :to="`/projects/${projectId}/artifacts`"
                    class="font-mono text-xs hover:underline"
                  >
                    {{ edge.childVersionId.slice(0, 12) }}…
                  </RouterLink>
                </li>
              </ul>
            </LCard>
          </div>
        </LTabPane>
      </LTabs>

      <!-- ── Aliases dialog ─────────────────────────────────────────── -->
      <LDialog
        v-model:show="aliasesOpen"
        title="Edit aliases"
        width="460px"
        @close="aliasesError = null"
      >
        <div class="space-y-3">
          <p class="text-xs text-fg-tertiary">
            Comma-separated aliases (e.g. <code class="font-mono">latest, production</code>).
            These power <code class="font-mono">lumina.use_artifact("name:alias")</code>.
          </p>
          <LInput
            v-model:value="aliasesDraft"
            placeholder="latest, production"
            autofocus
          />
          <div
            v-if="aliasesError"
            class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
          >
            {{ aliasesError }}
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <LButton quaternary @click="aliasesOpen = false">Cancel</LButton>
            <LButton
              :loading="aliasesMutation.isPending.value"
              @click="aliasesMutation.mutate()"
            >
              Save
            </LButton>
          </div>
        </template>
      </LDialog>

      <!-- ── Add file dialog ────────────────────────────────────────── -->
      <LDialog
        v-model:show="addFileOpen"
        title="Register a file"
        width="500px"
        @close="fileError = null"
      >
        <div class="space-y-3">
          <p class="text-xs text-fg-tertiary">
            Registers the file with the artifact backend. For S3 storage the
            backend returns a pre-signed upload URL you must PUT to; for local
            storage the file is referenced by path.
          </p>
          <div>
            <label
              for="file-path"
              class="mb-1 block text-xs font-medium text-fg-secondary"
            >
              Path <span class="text-accent-danger">*</span>
            </label>
            <LInput
              id="file-path"
              v-model:value="filePath"
              placeholder="e.g. model.bin"
            />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                for="file-size"
                class="mb-1 block text-xs font-medium text-fg-secondary"
              >
                Size (bytes) <span class="text-accent-danger">*</span>
              </label>
              <LInput
                id="file-size"
                v-model:value="fileSizeText"
                placeholder="e.g. 1048576"
              />
            </div>
            <div>
              <label
                for="file-ct"
                class="mb-1 block text-xs font-medium text-fg-secondary"
              >
                Content type
              </label>
              <LInput
                id="file-ct"
                v-model:value="fileContentType"
                placeholder="application/octet-stream"
              />
            </div>
          </div>
          <div
            v-if="fileError"
            class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
          >
            {{ fileError }}
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <LButton quaternary @click="addFileOpen = false">Cancel</LButton>
            <LButton
              :loading="addFileMutation.isPending.value"
              @click="addFileMutation.mutate()"
            >
              Register file
            </LButton>
          </div>
        </template>
      </LDialog>

      <!-- ── Promote to registry dialog ─────────────────────────────── -->
      <LDialog
        v-model:show="promoteOpen"
        title="Promote to model registry"
        width="500px"
        @close="promoteError = null"
      >
        <div class="space-y-3">
          <p class="text-xs text-fg-tertiary">
            Creates a registry model under this project (or fetches an existing
            one by name) and points a new version at the latest artifact version.
          </p>
          <div>
            <label
              for="promote-name"
              class="mb-1 block text-xs font-medium text-fg-secondary"
            >
              Registry model name <span class="text-accent-danger">*</span>
            </label>
            <LInput
              id="promote-name"
              v-model:value="promoteModelName"
              placeholder="e.g. resnet50"
            />
          </div>
          <div>
            <label
              for="promote-aliases"
              class="mb-1 block text-xs font-medium text-fg-secondary"
            >
              Aliases (comma-separated)
            </label>
            <LInput
              id="promote-aliases"
              v-model:value="promoteAliasText"
              placeholder="latest, production"
            />
          </div>
          <div
            v-if="promoteError"
            class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
          >
            {{ promoteError }}
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <LButton quaternary @click="promoteOpen = false">Cancel</LButton>
            <LButton
              :loading="promoteMutation.isPending.value"
              :disabled="!promoteModelName.trim()"
              @click="promoteMutation.mutate()"
            >
              <PackageOpen class="mr-1 h-3 w-3" />
              Promote
            </LButton>
          </div>
        </template>
      </LDialog>
    </template>

    <LCard v-else class="p-8 text-center text-fg-tertiary">
      Artifact not found.
    </LCard>
  </div>
</template>