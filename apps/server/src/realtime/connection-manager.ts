import type { WebSocket } from "ws";

export interface RealtimeMessage {
  channel: string;
  event: string;
  payload: unknown;
}

export interface SubscriptionMessage {
  action: "subscribe" | "unsubscribe";
  channel: string;
}

export class RealtimeConnectionManager {
  private readonly connections = new Map<WebSocket, Set<string>>();
  private readonly channels = new Map<string, Set<WebSocket>>();

  addConnection(socket: WebSocket): void {
    this.connections.set(socket, new Set());

    socket.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const msg = JSON.parse(raw.toString()) as SubscriptionMessage;
        if (msg.action === "subscribe") {
          this.subscribe(socket, msg.channel);
        } else if (msg.action === "unsubscribe") {
          this.unsubscribe(socket, msg.channel);
        }
      } catch {
        // Ignore malformed messages.
      }
    });

    socket.on("close", () => {
      this.removeConnection(socket);
    });
  }

  subscribe(socket: WebSocket, channel: string): void {
    const subs = this.connections.get(socket);
    if (!subs) return;

    subs.add(channel);

    let channelSet = this.channels.get(channel);
    if (!channelSet) {
      channelSet = new Set();
      this.channels.set(channel, channelSet);
    }
    channelSet.add(socket);
  }

  unsubscribe(socket: WebSocket, channel: string): void {
    this.connections.get(socket)?.delete(channel);
    this.channels.get(channel)?.delete(socket);
  }

  removeConnection(socket: WebSocket): void {
    const subs = this.connections.get(socket);
    if (subs) {
      for (const channel of subs) {
        this.channels.get(channel)?.delete(socket);
      }
      this.connections.delete(socket);
    }
  }

  broadcast(channel: string, event: string, payload: unknown): void {
    const message = JSON.stringify({ channel, event, payload });
    const sockets = this.channels.get(channel);
    if (!sockets) return;

    for (const socket of sockets) {
      if (socket.readyState === 1 /* OPEN */) {
        socket.send(message);
      }
    }
  }
}
