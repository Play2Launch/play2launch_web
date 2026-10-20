export const REALTIME_RULES = "market-combo-v2";
type Start = {
  id: string;
  starts_at: number;
  expires_at: number;
  tick_ms: number;
  snapshot: Record<string, unknown>;
};
type Socket = Pick<
  WebSocket,
  | "send"
  | "close"
  | "readyState"
  | "onmessage"
  | "onclose"
  | "onerror"
  | "onopen"
>;
type Dependencies = {
  source: () => Window | null;
  origin: string;
  gameId: string;
  slug: string;
  apiBase: string;
  request: <T>(path: string, body: unknown, signal: AbortSignal) => Promise<T>;
  socket: (url: string, protocols: string[]) => Socket;
  status: (text: string) => void;
};

// The parent owns authentication and the socket. Only round state crosses the
// iframe boundary; neither bearer credentials nor the single-use ticket do.
export function createRealtimeBridge(d: Dependencies) {
  const ctrl = new AbortController();
  let instance = "",
    session: Start | undefined,
    ws: Socket | undefined,
    busy = false,
    terminal = false,
    disposed = false;
  const pending = new Map<
    number,
    { round: number; action_id: string; direction: string }
  >();
  let reconnect: ReturnType<typeof setTimeout> | undefined,
    failures = 0,
    generation = 0;
  const post = (type: string, data: Record<string, unknown> = {}) =>
    d.source()?.postMessage(
      {
        protocol: "p2l-game-v1",
        game_id: d.gameId,
        rules_version: REALTIME_RULES,
        instance_id: instance,
        session_id: session?.id ?? null,
        type,
        ...data,
      },
      d.origin,
    );
  const init = () =>
    post("p2l:init", {
      session: {
        id: session!.id,
        expires_at: session!.expires_at,
        duration_ms: session!.tick_ms * 100 + 3000,
        allow_pause: false,
        realtime: {
          version: "realtime-v1",
          tick_ms: session!.tick_ms,
          starts_at: session!.starts_at,
        },
      },
    });
  function scheduleReconnect() {
    if (disposed || terminal || reconnect) return;
    d.status("Reconnecting · the server clock continues");
    reconnect = setTimeout(
      () => {
        reconnect = undefined;
        void connect();
      },
      Math.min(500 * 2 ** failures++, 5000),
    );
  }
  async function connect() {
    if (disposed || !session || terminal) return;
    const current = ++generation;
    try {
      const grant = await d.request<{ ticket: string }>(
        `/game/realtime/${session.id}/ticket`,
        {},
        ctrl.signal,
      );
      if (disposed || current !== generation) return;
      if (!/^[a-f0-9]{64}$/.test(grant.ticket))
        throw Error("Invalid connection ticket");
      const base = new URL(d.apiBase || "/api/v1", location.origin);
      const url = new URL(
        `${base.href.replace(/\/$/, "")}/game/realtime/${session.id}/socket`,
      );
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      ws?.close();
      const socket = d.socket(url.href, [
        "p2l-realtime-v1",
        `ticket.${grant.ticket}`,
      ]);
      ws = socket;
      socket.onopen = () => {
        if (current !== generation) return;
        failures = 0;
        for (const action of pending.values())
          socket.send(JSON.stringify(action));
        d.status("Round in progress");
      };
      socket.onmessage = (event) => {
        if (
          disposed ||
          current !== generation ||
          typeof event.data !== "string" ||
          event.data.length > 100000
        )
          return;
        let message: Record<string, any>;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === "snapshot" && message.snapshot) {
          const value = message.snapshot;
          if (!["playing", "finished", "cancelled"].includes(value.status))
            return;
          terminal = value.status !== "playing";
          for (const [round] of pending)
            if (round <= value.round || round === value.pending?.round)
              pending.delete(round);
          post("p2l:snapshot", { snapshot: value });
          if (terminal)
            d.status(
              value.status === "finished"
                ? "Score verified"
                : "Round closed without a score",
            );
        } else if (message.type === "action_ack") {
          pending.delete(message.round);
          post("p2l:action-ack", {
            round: message.round,
            action_id: message.action_id,
            accepted: message.accepted,
          });
        }
      };
      socket.onerror = () => {
        if (current === generation) socket.close();
      };
      socket.onclose = () => {
        if (current === generation) scheduleReconnect();
      };
    } catch (error) {
      if (!disposed && current === generation) {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403 || status === 404) {
          terminal = true;
          d.status(
            "Session unavailable. Return to the campaign and sign in again.",
          );
          post("p2l:error", {
            code: "SESSION_UNAVAILABLE",
            message: "Session unavailable",
            retryable: false,
          });
        } else scheduleReconnect();
      }
    }
  }
  async function start() {
    if (busy || disposed) return;
    busy = true;
    try {
      const next = await d.request<Start>(
        `/campaigns/${encodeURIComponent(d.slug)}/realtime-sessions`,
        {},
        ctrl.signal,
      );
      if (disposed) return;
      if (
        !/^gs[0-9a-z]{1,13}$/.test(next.id) ||
        !Number.isInteger(next.tick_ms) ||
        next.tick_ms < 1000 ||
        next.tick_ms > 5000 ||
        next.tick_ms % 100 !== 0 ||
        !Number.isSafeInteger(next.starts_at) ||
        !Number.isSafeInteger(next.expires_at) ||
        next.expires_at <= Date.now()
      )
        throw Error("Invalid realtime session");
      pending.clear();
      session = next;
      terminal = false;
      init();
      void connect();
    } catch (e) {
      if (!disposed) {
        const message =
          e instanceof Error ? e.message : "Could not start round";
        d.status(message);
        post("p2l:error", {
          stage: "init",
          code: "START_FAILED",
          message,
          retryable: true,
        });
      }
    } finally {
      busy = false;
    }
  }
  return {
    receive(event: MessageEvent) {
      const m = event.data;
      if (
        disposed ||
        event.source !== d.source() ||
        !event.source ||
        event.origin !== d.origin ||
        !m ||
        m.protocol !== "p2l-game-v1" ||
        m.game_id !== d.gameId ||
        m.rules_version !== REALTIME_RULES ||
        !/^[a-f0-9]{32}$/.test(m.instance_id ?? "")
      )
        return;
      if (m.type === "p2l:ready") {
        instance = m.instance_id;
        if (
          !Array.isArray(m.capabilities) ||
          !m.capabilities.includes("realtime-v1")
        ) {
          post("p2l:error", {
            stage: "init",
            code: "SDK_UPDATE_REQUIRED",
            message: "This game requires realtime-v1",
            retryable: false,
          });
          return;
        }
        if (session) {
          init();
          return;
        }
        void start();
        return;
      }
      if (instance !== m.instance_id || !session || m.session_id !== session.id)
        return;
      if (m.type === "p2l:exit") {
        disposed = true;
        generation++;
        ctrl.abort();
        if (reconnect) clearTimeout(reconnect);
        ws?.close();
        d.status("Game closed");
        return;
      }
      if (m.type === "p2l:restart" && terminal) {
        void start();
        return;
      }
      if (m.type === "p2l:sync") {
        if (ws?.readyState !== 1) void connect();
        return;
      }
      if (
        m.type === "p2l:action" &&
        !terminal &&
        Number.isSafeInteger(m.round) &&
        m.round >= 1 &&
        m.round <= 100 &&
        /^[a-f0-9]{32}$/.test(m.action_id) &&
        ["long", "short"].includes(m.direction)
      ) {
        const previous = pending.get(m.round);
        if (
          (previous &&
            (previous.action_id !== m.action_id ||
              previous.direction !== m.direction)) ||
          (!previous && pending.size >= 2)
        )
          return;
        const action = {
          round: m.round,
          action_id: m.action_id,
          direction: m.direction,
        };
        pending.set(m.round, action);
        if (ws?.readyState === 1) ws.send(JSON.stringify(action));
      }
    },
    destroy() {
      disposed = true;
      generation++;
      ctrl.abort();
      if (reconnect) clearTimeout(reconnect);
      ws?.close();
    },
  };
}
