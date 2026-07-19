import type { DomainEvent } from "@/utils/domain-events";

/**
 * Single WebSocket connection for the whole app. Lazily opened when the first
 * subscription is requested; auto-reconnects with exponential backoff.
 *
 * Server protocol (apps/server/src/realtime/connection-manager.ts):
 *   client → server:  { action: "subscribe"|"unsubscribe", channel: string }
 *   server → client:  { channel, event, payload, occurredAt }
 *
 * Channels:
 *   run:<runId>           → MetricLogged, RunFinished
 *   project:<projectId>   → RunCreated, ArtifactUploaded
 */

type Channel = string;
type Listener = (event: DomainEvent) => void;

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed" | "error";

interface PendingSub {
  channel: Channel;
  action: "subscribe" | "unsubscribe";
}

class RealtimeClient {
  private socket: WebSocket | null = null;
  private url: string | null = null;
  private status: ConnectionStatus = "idle";
  private statusListeners = new Set<(s: ConnectionStatus) => void>();
  private channelListeners = new Map<Channel, Set<Listener>>();
  private pendingSubs: PendingSub[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private explicitClose = false;

  /** Compute the WS URL once, based on the current API base. */
  private resolveUrl(): string {
    const apiBase =
      import.meta.env.VITE_LUMINA_API_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    if (!apiBase) return "/ws";
    const u = new URL(apiBase);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/ws";
    u.search = "";
    u.hash = "";
    return u.toString();
  }

  private ensureSocket(): WebSocket {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return this.socket;
    }
    this.url = this.resolveUrl();
    this.explicitClose = false;
    this.setStatus("connecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch (err) {
      console.warn("[ws] failed to construct WebSocket", err);
      this.setStatus("error");
      this.scheduleReconnect();
      throw err;
    }

    ws.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      this.setStatus("open");
      // Replay queued subs.
      for (const p of this.pendingSubs) {
        ws.send(JSON.stringify(p));
      }
      this.pendingSubs = [];
    });

    ws.addEventListener("message", (e) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof e.data === "string" ? e.data : "");
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const m = parsed as { channel?: string; event?: string; payload?: unknown };
      if (!m.channel || !m.event) return;
      const event = {
        type: m.event as DomainEvent["type"],
        payload: m.payload as DomainEvent["payload"],
        occurredAt: new Date(),
      } as DomainEvent;
      const ls = this.channelListeners.get(m.channel);
      if (ls) {
        for (const l of ls) {
          try {
            l(event);
          } catch (err) {
            console.error("[ws] listener threw", err);
          }
        }
      }
    });

    ws.addEventListener("error", () => {
      this.setStatus("error");
    });

    ws.addEventListener("close", () => {
      this.setStatus("closed");
      this.socket = null;
      if (!this.explicitClose) {
        this.scheduleReconnect();
      }
    });

    this.socket = ws;
    return ws;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(30_000, 500 * 2 ** Math.min(this.reconnectAttempts, 6));
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // Only reconnect if someone still cares (active subscriptions exist).
      if (this.totalListeners() > 0) {
        try {
          this.ensureSocket();
        } catch {
          /* error already scheduled */
        }
      }
    }, delay);
  }

  private totalListeners(): number {
    let n = 0;
    for (const set of this.channelListeners.values()) n += set.size;
    return n;
  }

  private setStatus(s: ConnectionStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }

  private send(sub: PendingSub) {
    const ws = this.ensureSocket();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(sub));
    } else {
      this.pendingSubs.push(sub);
    }
  }

  subscribe(channel: Channel, listener: Listener): () => void {
    let set = this.channelListeners.get(channel);
    if (!set) {
      set = new Set();
      this.channelListeners.set(channel, set);
      this.send({ channel, action: "subscribe" });
    }
    set.add(listener);

    return () => {
      const current = this.channelListeners.get(channel);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.channelListeners.delete(channel);
        this.send({ channel, action: "unsubscribe" });
      }
    };
  }

  onStatus(listener: (s: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  /** Force-disconnect (used in tests / when leaving the app). */
  disconnect() {
    this.explicitClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    this.setStatus("closed");
  }
}

export const realtime = new RealtimeClient();