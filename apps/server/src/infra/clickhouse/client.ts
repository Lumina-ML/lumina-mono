import { createClient, type ClickHouseClient } from "@clickhouse/client";

export interface ClickHouseConfig {
  url: string;
  username?: string;
  password?: string;
  database?: string;
}

export function createClickHouseClient(config: ClickHouseConfig): ClickHouseClient {
  return createClient({
    url: config.url,
    username: config.username,
    password: config.password,
    database: config.database ?? "lumina-database",
    request_timeout: 30_000,
    max_open_connections: 10,
  });
}

export async function setupClickHouseSchema(config: ClickHouseConfig, client: ClickHouseClient): Promise<void> {
  if (config.database && config.database !== "default") {
    const adminClient = createClickHouseClient({ ...config, database: "default" });
    await adminClient.exec({
      query: `CREATE DATABASE IF NOT EXISTS ${config.database}`,
    });
    await adminClient.close();
  }

  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS metrics (
        runId String,
        projectId String,
        key String,
        step UInt32,
        value Float64,
        metadata String,
        loggedAt DateTime64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMMDD(loggedAt)
      ORDER BY (projectId, runId, key, step)
    `,
  });

  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS system_metrics (
        runId String,
        projectId String,
        key String,
        step UInt32,
        value Float64,
        loggedAt DateTime64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMMDD(loggedAt)
      ORDER BY (projectId, runId, key, step)
    `,
  });

  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS log_lines (
        runId String,
        projectId String,
        level String,
        message String,
        step Nullable(UInt32),
        timestamp DateTime64(3)
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMMDD(timestamp)
      ORDER BY (projectId, runId, timestamp)
    `,
  });

  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS traces (
        projectId String,
        runId Nullable(String),
        traceId String,
        name String,
        status String,
        latencyMs Nullable(UInt32),
        metadata String,
        startedAt DateTime64(3),
        finishedAt Nullable(DateTime64(3))
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMMDD(startedAt)
      ORDER BY (projectId, traceId, startedAt)
    `,
  });

  await client.exec({
    query: `
      CREATE TABLE IF NOT EXISTS spans (
        traceId String,
        parentSpanId Nullable(String),
        spanId String,
        name String,
        kind String,
        input String,
        output String,
        latencyMs Nullable(UInt32),
        status String,
        startedAt DateTime64(3),
        finishedAt Nullable(DateTime64(3))
      ) ENGINE = MergeTree()
      PARTITION BY toYYYYMMDD(startedAt)
      ORDER BY (traceId, spanId, startedAt)
    `,
  });
}
