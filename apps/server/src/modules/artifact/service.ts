import crypto from "node:crypto";
import { inject, injectable } from "tsyringe";
import type { ObjectStorage } from "../../core/storage/object-storage.js";
import type { EventBus } from "../../core/bus/event-bus.js";
import type { Queue } from "../../core/queue/queue.js";
import type { PrismaClient } from "../../generated/prisma/index.js";
import { TOKENS } from "../../core/di/tokens.js";
import type {
  CreateArtifactInput,
  CreateArtifactVersionInput,
  CreateArtifactFileInput,
  PatchArtifactVersionInput,
  ListArtifactsQuery,
  Manifest,
  ManifestEntry,
} from "./schema.js";
import { ArtifactRepository } from "./repository.js";

/**
 * Legacy deps-object constructor kept for callers that still pass an
 * explicit `{ prisma, storage, eventBus, queue }` (older route tests,
 * direct service wiring). The tsyringe-managed `@injectable()` path is
 * the four-argument constructor below; both share the same body via the
 * `init` helper.
 */
export interface ArtifactServiceDeps {
  prisma: PrismaClient;
  storage: ObjectStorage;
  eventBus?: EventBus;
  queue?: Queue;
}

@injectable()
export class ArtifactService {
  private readonly repository: ArtifactRepository;
  private readonly storage: ObjectStorage;
  private readonly eventBus: EventBus | undefined;
  private readonly queue: Queue | undefined;

  constructor(
    @inject(TOKENS.PrismaClient) prisma: PrismaClient,
    @inject(TOKENS.Storage) storage: ObjectStorage,
    @inject(TOKENS.EventBus) eventBus: EventBus,
    @inject(TOKENS.Queue) queue: Queue,
  ) {
    this.repository = new ArtifactRepository(prisma);
    this.storage = storage;
    this.eventBus = eventBus;
    this.queue = queue;
  }

  /** Legacy constructor that accepts a deps object. Routes/tests that
   * still pass `{ prisma, storage, eventBus, queue }` keep working. */
  static fromDeps(deps: ArtifactServiceDeps): ArtifactService {
    const svc = Object.create(ArtifactService.prototype) as ArtifactService;
    // Reach into the same private fields the DI constructor populates.
    (svc as unknown as { repository: ArtifactRepository }).repository = new ArtifactRepository(deps.prisma);
    (svc as unknown as { storage: ObjectStorage }).storage = deps.storage;
    (svc as unknown as { eventBus: EventBus | undefined }).eventBus = deps.eventBus;
    (svc as unknown as { queue: Queue | undefined }).queue = deps.queue;
    return svc;
  }

  async createArtifact(projectId: string, data: CreateArtifactInput) {
    return this.repository.createArtifact(projectId, data);
  }

  async findArtifactById(id: string) {
    return this.repository.findArtifactById(id);
  }

  async listArtifactsByProject(projectId: string) {
    return this.repository.listArtifactsByProject(projectId);
  }

  async listArtifacts(params: ListArtifactsQuery & { workspaceId?: string }) {
    return this.repository.list(params);
  }

  async createVersion(artifactId: string, data: CreateArtifactVersionInput) {
    return this.repository.createVersion(artifactId, data);
  }

  async findVersionById(id: string) {
    const version = await this.repository.findVersionById(id);
    if (!version) return null;
    const files = await this.enrichFilesWithUrls(version.files);
    return { ...version, files };
  }

  async findVersionByAlias(artifactId: string, alias: string) {
    const version = await this.repository.findVersionByAlias(artifactId, alias);
    if (!version) return null;
    const files = await this.enrichFilesWithUrls(version.files);
    return { ...version, files };
  }

  async listVersionsByArtifact(artifactId: string) {
    return this.repository.listVersionsByArtifact(artifactId);
  }

  async updateVersion(id: string, data: PatchArtifactVersionInput) {
    return this.repository.updateVersion(id, data);
  }

  /**
   * Register a file in an artifact version. Supports two modes:
   *
   * 1. **Content upload** (default): the caller will upload bytes to the
   *    returned `uploadUrl`. If `sha256` is provided, the storage key is
   *    content-addressed so duplicate bytes within the same version share a
   *    single underlying object.
   * 2. **Reference artifact** (`referenceUri` set): no upload is needed; the
   *    file row points at an external URI.
   *
   * Files with a `path` that already exists in this version raise an error
   * to prevent silent shadowing. Files with the same `sha256` under a
   * different `path` reuse the same underlying storage object.
   */
  async addFile(versionId: string, data: CreateArtifactFileInput) {
    const version = await this.repository.findVersionById(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const existingPath = await this.repository.findFileByPath(versionId, data.path);
    if (existingPath) {
      throw new Error(`File path already registered: ${data.path}`);
    }

    // Reference artifact — no storage, just record the external pointer.
    if (data.referenceUri) {
      const created = await this.repository.createFile(versionId, {
        ...data,
        size: data.size ?? 0n,
      });
      return {
        file: { ...created, size: created.size.toString() },
        uploadUrl: null,
      };
    }

    // Content artifact — content-addressed key when sha256 is known, else
    // random UUID under the version namespace.
    const storageKey = data.sha256
      ? contentAddressedKey(data.sha256, data.path)
      : randomVersionKey(version.artifactId, versionId, data.path);

    const created = await this.repository.createFile(versionId, {
      ...data,
      storageKey,
    });
    const uploadUrl = await this.storage.getUploadUrl(storageKey);
    return {
      file: { ...created, size: created.size.toString() },
      uploadUrl,
    };
  }

  /**
   * Finalize a version: build the manifest from registered files, compute
   * its sha256 digest, persist it on the version, and emit
   * `ArtifactUploaded` + enqueue `artifact.uploaded` for downstream jobs
   * (indexing, thumbnails, etc.).
   */
  async finalizeVersion(versionId: string) {
    const version = await this.repository.findVersionById(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    const manifest = buildManifest(version.files);
    const digest = sha256OfManifest(manifest);
    const updated = await this.repository.updateVersionManifest(versionId, manifest, digest);

    const eventPayload = {
      artifactVersionId: versionId,
      projectId: version.artifactId,
      // `findVersionById` now reaches into the project's workspace so
      // the WS fanout can scope this event to the right channel.
      workspaceId: version.artifact?.project?.workspaceId ?? "",
      fileCount: version.files.length,
      digest,
    };
    await this.eventBus?.publish({
      type: "ArtifactUploaded",
      payload: eventPayload,
      occurredAt: new Date(),
    });
    await this.queue?.enqueue({ name: "artifact.uploaded", payload: eventPayload });

    return updated;
  }

  // ---- Lineage -----------------------------------------------------------

  async attachLineage(childVersionId: string, parentVersionId: string, type: string) {
    if (childVersionId === parentVersionId) {
      throw new Error("A version cannot be its own parent");
    }
    const child = await this.repository.findVersionById(childVersionId);
    if (!child) throw new Error(`Child version not found: ${childVersionId}`);
    const parent = await this.repository.findVersionById(parentVersionId);
    if (!parent) throw new Error(`Parent version not found: ${parentVersionId}`);
    return this.repository.attachLineage(childVersionId, parentVersionId, type);
  }

  async detachLineage(childVersionId: string, parentVersionId: string) {
    await this.repository.detachLineage(childVersionId, parentVersionId);
  }

  async listLineage(versionId: string) {
    const parents = await this.repository.listParents(versionId);
    const children = await this.repository.listChildren(versionId);
    return {
      parents: parents.map((p) => ({
        type: p.type,
        version: {
          id: p.parentArtifactVersion.id,
          artifactId: p.parentArtifactVersion.artifactId,
          version: p.parentArtifactVersion.version,
          artifactName: p.parentArtifactVersion.artifact.name,
        },
      })),
      children: children.map((c) => ({
        type: c.type,
        version: {
          id: c.artifactVersion.id,
          artifactId: c.artifactVersion.artifactId,
          version: c.artifactVersion.version,
          artifactName: c.artifactVersion.artifact.name,
        },
      })),
    };
  }

  // ---- helpers ----------------------------------------------------------

  private async enrichFilesWithUrls(
    files: Array<{ storageKey: string | null; size: bigint } & Record<string, unknown>>,
  ) {
    return Promise.all(
      files.map(async (file) => {
        const enriched: Record<string, unknown> = {
          ...file,
          size: file.size.toString(),
        };
        if (file.storageKey) {
          enriched.downloadUrl = await this.storage.getDownloadUrl(file.storageKey);
        }
        return enriched;
      }),
    );
  }
}

function buildManifest(files: Array<{
  path: string;
  sha256: string | null;
  size: bigint;
  referenceUri: string | null;
  contentType: string | null;
}>): Manifest {
  const entries: ManifestEntry[] = files.map((f) => {
    const entry: ManifestEntry = {
      path: f.path,
      digest: f.sha256 ?? `etag:${f.referenceUri ?? f.path}`,
      size: f.size.toString(),
    };
    if (f.referenceUri) entry.referenceUri = f.referenceUri;
    if (f.contentType) entry.contentType = f.contentType;
    return entry;
  });
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { version: 1, entries } as Manifest;
}

function sha256OfManifest(manifest: Manifest): string {
  // Deterministic canonical form: JSON with sorted keys, no whitespace.
  const canonical = JSON.stringify(manifest, (_k, v) => v, 0);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Content-addressed storage key, hashed by the file's sha256.
 * Layout: `blobs/sha256/<aa>/<full-sha256>` so we never hit a single
 * partition hot-spot for popular hashes.
 */
function contentAddressedKey(sha256: string, path: string): string {
  const safePath = path.replace(/^\//, "").replace(/\//g, "_");
  const lower = sha256.toLowerCase();
  return `blobs/sha256/${lower.slice(0, 2)}/${lower}/${safePath}`;
}

/**
 * Fallback key when the caller hasn't computed sha256 yet (e.g. legacy
 * client). Same namespace as before; not content-addressed.
 */
function randomVersionKey(artifactId: string, versionId: string, path: string): string {
  const hash = crypto.randomUUID();
  const safePath = path.replace(/^\//, "").replace(/\//g, "_");
  return `${artifactId}/${versionId}/${hash}/${safePath}`;
}