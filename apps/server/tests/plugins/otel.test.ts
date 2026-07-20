import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { buildTestApp } from "../helpers/build-app.js";
import { createFakePrisma } from "../helpers/fake-prisma.js";
import { otelPlugin } from "../../src/plugins/otel.js";

const mockStart = vi.fn();
const mockShutdown = vi.fn();
const mockTraceExporter = vi.fn();
const mockResource = vi.fn();

vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: mockStart,
    shutdown: mockShutdown,
  })),
}));

vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: mockTraceExporter,
}));

vi.mock("@opentelemetry/resources", () => ({
  Resource: mockResource,
}));

vi.mock("@opentelemetry/semantic-conventions", () => ({
  ATTR_SERVICE_NAME: "service.name",
  ATTR_SERVICE_VERSION: "service.version",
}));

describe("otel plugin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    mockStart.mockReset();
    mockShutdown.mockReset();
    mockTraceExporter.mockReset();
    mockResource.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("does not initialize SDK when OTEL_EXPORTER_OTLP_ENDPOINT is absent", async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const app = await buildTestApp({ prisma: createFakePrisma() });
    await app.register(otelPlugin);
    await app.ready();

    expect(mockStart).not.toHaveBeenCalled();
    expect(app.tracer).toBeDefined();
    expect(typeof app.tracer.startSpan).toBe("function");
  });

  it("initializes NodeSDK when OTEL_EXPORTER_OTLP_ENDPOINT is set", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318/v1/traces";
    process.env.OTEL_SERVICE_NAME = "test-service";

    const app = await buildTestApp({ prisma: createFakePrisma() });
    await app.register(otelPlugin);
    await app.ready();

    expect(mockTraceExporter).toHaveBeenCalledWith({
      url: "http://collector:4318/v1/traces",
    });
    expect(mockResource).toHaveBeenCalledWith({
      "service.name": "test-service",
      "service.version": "0.1.0",
    });
    expect(mockStart).toHaveBeenCalled();
  });

  it("shuts down SDK on app close", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318/v1/traces";

    const app = await buildTestApp({ prisma: createFakePrisma() });
    await app.register(otelPlugin);
    await app.ready();
    await app.close();

    expect(mockShutdown).toHaveBeenCalled();
  });

  it("falls back to NoopTracer when SDK initialization throws", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318/v1/traces";
    mockTraceExporter.mockImplementationOnce(() => {
      throw new Error("missing dependency");
    });

    const app = await buildTestApp({ prisma: createFakePrisma() });
    await app.register(otelPlugin);
    await app.ready();

    expect(app.tracer).toBeDefined();
    expect(typeof app.tracer.startSpan).toBe("function");
  });
});
