const BASE = "http://localhost:8000/api/v1";
const WS = "ws://localhost:8000/ws";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function patch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

const project = await post("/projects", { name: "ws-test" });
console.log("created project:", project.id);

const ws = new WebSocket(WS);
const messages = [];
let runId;

ws.onopen = () => {
  ws.send(JSON.stringify({ action: "subscribe", channel: `project:${project.id}` }));
  console.log("subscribed to project channel");

  setTimeout(async () => {
    const run = await post("/runs", {
      project: "ws-test",
      name: "websocket-e2e-run",
      config: { lr: 0.01 },
    });
    runId = run.runId;
    console.log("created run:", runId);

    ws.send(JSON.stringify({ action: "subscribe", channel: `run:${runId}` }));

    await post(`/runs/${runId}/metrics`, {
      metrics: [
        { key: "loss", step: 0, value: 0.5 },
        { key: "acc", step: 0, value: 0.9 },
      ],
    });
    console.log("logged metrics");

    await patch(`/runs/${runId}`, { status: "finished" });
    console.log("finished run");

    setTimeout(() => {
      console.log("\nreceived messages:");
      for (const m of messages) console.log(m);
      const ok =
        messages.some((m) => m.event === "RunCreated" && m.payload.runId === runId) &&
        messages.some((m) => m.event === "MetricLogged" && m.payload.runId === runId) &&
        messages.some((m) => m.event === "RunFinished" && m.payload.runId === runId);
      console.log(ok ? "\nPASS" : "\nFAIL: missing expected events");
      ws.close();
      process.exit(ok ? 0 : 1);
    }, 500);
  }, 300);
};

ws.onmessage = (ev) => {
  messages.push(JSON.parse(ev.data));
};

ws.onerror = (err) => {
  console.error("ws error:", err.message);
  process.exit(1);
};
