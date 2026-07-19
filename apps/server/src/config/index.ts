import { z } from "zod";

const storageTypeSchema = z.enum(["local", "s3"]);

const serverConfigSchema = z.object({
  // Runtime
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  port: z.coerce.number().int().positive().default(8000),
  host: z.string().default("0.0.0.0"),
  logLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

  // Observability
  requestIdHeader: z.string().default("X-Request-ID"),
  metricsEnabled: z.coerce.boolean().default(true),
  metricsPath: z.string().default("/metrics"),

  // Database
  databaseUrl: z.string().min(1, "DATABASE_URL is required"),

  // Optional future infra
  redisUrl: z.string().optional(),
  clickhouseUrl: z.string().optional(),
  clickhouseUser: z.string().optional(),
  clickhousePassword: z.string().optional(),
  clickhouseDatabase: z.string().default("default"),

  // Object storage
  storageType: storageTypeSchema.default("local"),
  localStorageBaseUrl: z.string().default("http://localhost:8000/api/v1"),
  localStoragePath: z.string().default("./uploads"),
  s3Endpoint: z.string().optional(),
  s3Bucket: z.string().default("lumina-artifacts"),
  s3Region: z.string().default("us-east-1"),
  s3AccessKeyId: z.string().default(""),
  s3SecretAccessKey: z.string().default(""),
  s3ForcePathStyle: z.coerce.boolean().default(false),

  // Workspace
  // Single-tenant deployments keep the workspace id pinned to a single
  // value. Multi-tenant deployments override via
  // `LUMINA_DEFAULT_WORKSPACE_ID` so seeded users land somewhere
  // meaningful instead of an arbitrary slug.
  defaultWorkspaceId: z.string().min(1).default("default"),

  // Dashboard URL printed in the startup banner. Defaults to the same
  // host as the API but on the conventional Vite port (3000). Override
  // via `LUMINA_DASHBOARD_URL` when the dashboard sits behind a reverse
  // proxy or runs on a different port.
  dashboardUrl: z.string().url().optional(),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type StorageType = z.infer<typeof storageTypeSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = serverConfigSchema.safeParse({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    logLevel: env.LOG_LEVEL,
    requestIdHeader: env.REQUEST_ID_HEADER,
    metricsEnabled: env.METRICS_ENABLED,
    metricsPath: env.METRICS_PATH,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    clickhouseUrl: env.CLICKHOUSE_URL,
    clickhouseUser: env.CLICKHOUSE_USER,
    clickhousePassword: env.CLICKHOUSE_PASSWORD,
    clickhouseDatabase: env.CLICKHOUSE_DB,
    storageType: env.STORAGE_TYPE,
    localStorageBaseUrl: env.LOCAL_STORAGE_BASE_URL,
    localStoragePath: env.LOCAL_STORAGE_PATH,
    s3Endpoint: env.S3_ENDPOINT,
    s3Bucket: env.S3_BUCKET,
    s3Region: env.S3_REGION,
    s3AccessKeyId: env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: env.S3_SECRET_ACCESS_KEY,
    s3ForcePathStyle: env.S3_FORCE_PATH_STYLE,
    defaultWorkspaceId: env.LUMINA_DEFAULT_WORKSPACE_ID,
    dashboardUrl: env.LUMINA_DASHBOARD_URL,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid server configuration:\n${issues.join("\n")}`);
  }

  return parsed.data;
}
