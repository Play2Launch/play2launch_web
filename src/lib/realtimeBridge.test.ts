import { afterEach, expect, it, vi } from "vitest";
import { createRealtimeBridge, REALTIME_RULES } from "./realtimeBridge";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function setup(tickMs = 1000) {
  vi.stubGlobal("location", { origin: "http://localhost:5173" });
  const source = { postMessage: vi.fn() } as unknown as Window;
  const sockets: any[] = [];
  const request = vi.fn(async (path: string) =>
    path.endsWith("/ticket")
      ? { ticket: "b".repeat(64) }
      : {
          id: "gs1",
          starts_at: Date.now() + 3000,
          expires_at: Date.now() + 103000,
          tick_ms: tickMs,
          snapshot: {},
        },
  );
  const socket = vi.fn((url: string, protocols: string[]) => {
    const s = {
      url,
      protocols,
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    };
    sockets.push(s);
    return s;
  });
  const bridge = createRealtimeBridge({
    source: () => source,
    origin: "https://game.test",
    gameId: "gx1",
    slug: "combo",
    apiBase: "http://localhost:8088/api/v1",
    request: request as any,
    socket,
    status: vi.fn(),
  });
  const envelope = {
    protocol: "p2l-game-v1",
    game_id: "gx1",
    rules_version: REALTIME_RULES,
    instance_id: "a".repeat(32),
  };
  const send = (data: Record<string, unknown>, override = {}) =>
    bridge.receive({
      source,
      origin: "https://game.test",
      data: { ...envelope, ...data },
      ...override,
    } as MessageEvent);
  const ready = () =>
    send({ type: "p2l:ready", capabilities: ["realtime-v1"] });
  return { source, sockets, request, socket, bridge, send, ready };
}
async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}
it("keeps credentials in host and rejects spoofed origins, instances and sessions", async () => {
  const r = setup();
  r.send(
    { type: "p2l:ready", capabilities: ["realtime-v1"] },
    { origin: "https://evil.test" },
  );
  expect(r.request).not.toHaveBeenCalled();
  r.ready();
  await flush();
  expect(r.sockets).toHaveLength(1);
  expect(r.sockets[0].url).toBe(
    "ws://localhost:8088/api/v1/game/realtime/gs1/socket",
  );
  const init = (r.source.postMessage as any).mock.calls[0][0];
  expect(init.session.seed).toBeUndefined();
  expect(JSON.stringify(init)).not.toContain("b".repeat(64));
  r.send({
    type: "p2l:action",
    session_id: "wrong",
    round: 1,
    action_id: "c".repeat(32),
    direction: "long",
  });
  expect(r.sockets[0].send).not.toHaveBeenCalled();
  r.send({
    type: "p2l:action",
    session_id: "gs1",
    round: 1,
    action_id: "c".repeat(32),
    direction: "long",
  });
  expect(r.sockets[0].send).toHaveBeenCalledTimes(1);
  r.bridge.destroy();
  expect(r.sockets[0].close).toHaveBeenCalled();
});
it("reconnects with a fresh ticket and retries the same unacknowledged input", async () => {
  vi.useFakeTimers();
  const r = setup();
  r.ready();
  await flush();
  r.send({
    type: "p2l:action",
    session_id: "gs1",
    round: 1,
    action_id: "c".repeat(32),
    direction: "short",
  });
  const sent = r.sockets[0].send.mock.calls[0][0];
  r.sockets[0].onclose();
  await vi.advanceTimersByTimeAsync(500);
  await flush();
  expect(r.sockets).toHaveLength(2);
  r.sockets[1].onopen();
  expect(r.sockets[1].send).toHaveBeenCalledWith(sent);
  r.sockets[1].onmessage({
    data: JSON.stringify({
      type: "snapshot",
      snapshot: { status: "finished", round: 20, revision: 21 },
    }),
  });
  r.sockets[1].onclose();
  await vi.advanceTimersByTimeAsync(10000);
  expect(r.sockets).toHaveLength(2);
  r.bridge.destroy();
});
it("does not open a late socket after unmount", async () => {
  const r = setup();
  r.ready();
  r.bridge.destroy();
  await flush();
  expect(r.socket).not.toHaveBeenCalled();
  expect(r.source.postMessage).not.toHaveBeenCalled();
});

it('forwards the server cadence and derives the full session duration', async () => {
 const r=setup(2000);r.ready();await flush();
 const init=(r.source.postMessage as any).mock.calls[0][0];
 expect(init.session.realtime.tick_ms).toBe(2000);expect(init.session.duration_ms).toBe(203000);r.bridge.destroy();
 const bad=setup(5001);bad.ready();await flush();expect(bad.socket).not.toHaveBeenCalled();bad.bridge.destroy();
});
