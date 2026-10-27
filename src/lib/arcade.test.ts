// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { attachArcadeBridge, type ArcadeSession } from "./arcade";
import { api, ApiError } from "./api";
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
  vi.restoreAllMocks();
});
function setup() {
  const source = { postMessage: vi.fn() } as unknown as Window;
  const session = {
    id: "as1",
    game_id: "ga1",
    test: false,
    game: { entry_url: "https://game.example", billing_message: "计费关闭" },
  } as ArcadeSession;
  const ready = vi.fn(),
    notice = vi.fn(),
    confirm = vi.fn(async () => true);
  const stop = attachArcadeBridge({
    frame: { contentWindow: source } as HTMLIFrameElement,
    session,
    user: { id: "ur1", name: "Player" },
    onProgress: vi.fn(),
    onReady: ready,
    onNotice: notice,
    confirm,
    onExit: vi.fn(),
  });
  cleanups.push(stop);
  const send = (
    method: string,
    payload: object = {},
    legacy = true,
    override: object = {},
  ) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source,
        origin: "https://game.example",
        data: legacy
          ? { dashfun: { method, payload } }
          : { p2lArcade: { method, payload, id: "rpc1" } },
        ...override,
      }),
    );
  return { source, send, ready, notice, confirm, stop };
}
async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
it("ignores messages from another frame or origin", async () => {
  const call = vi.spyOn(api, "authenticated");
  const r = setup();
  r.send("getBalance", {}, true, { origin: "https://evil.example" });
  r.send("getBalance", {}, true, { source: null });
  await flush();
  expect(call).not.toHaveBeenCalled();
  expect(r.source.postMessage).not.toHaveBeenCalled();
});
it("preserves DF base64 saves and serializes optimistic save versions", async () => {
  const call = vi
    .spyOn(api, "authenticated")
    .mockImplementation(async (_path, body) =>
      body ? { version: 5 } : ({ data: '{"level":1}', version: 4 } as any),
    );
  const r = setup();
  r.send("getData", { key: "main" });
  await flush();
  expect(r.source.postMessage).toHaveBeenLastCalledWith(
    {
      dashfun: {
        method: "getDataResult",
        result: { state: "success", data: btoa('{"level":1}') },
      },
    },
    "https://game.example",
  );
  r.send("setData", { key: "main", data: "next" });
  await flush();
  expect(call).toHaveBeenLastCalledWith("/arcade/sessions/as1/saves/main", {
    data: "next",
    version: 4,
  });
});
it("shows a closed-billing notice and replies with a legacy failure", async () => {
  vi.spyOn(api, "authenticated").mockRejectedValue(new ApiError(403, 23002));
  const r = setup();
  r.send("requestPayment", { title: "Sword", price: 3 });
  await flush();
  expect(r.notice).toHaveBeenCalledWith("计费关闭");
  expect(r.confirm).not.toHaveBeenCalled();
  expect(r.source.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      dashfun: expect.objectContaining({
        result: expect.objectContaining({ state: "error" }),
      }),
    }),
    "https://game.example",
  );
});
it("new loading completion waits for ready while DF retains loading completion", async () => {
  const r = setup();
  r.send("loading", { value: 1 }, false);
  await flush();
  expect(r.ready).not.toHaveBeenCalled();
  r.send("loading", { value: 1 });
  await flush();
  expect(r.ready).toHaveBeenCalledOnce();
});
it("does not reuse an RPC ID with different parameters", async () => {
  const call = vi
    .spyOn(api, "authenticated")
    .mockResolvedValue({ balance: 10 });
  const r = setup();
  r.send("getBalance", {}, false);
  await flush();
  r.send("purchase", { product_id: "evil" }, false);
  await flush();
  expect(call).toHaveBeenCalledOnce();
  expect(r.source.postMessage).toHaveBeenLastCalledWith(
    {
      p2lArcade: {
        id: "rpc1",
        method: "purchaseResult",
        result: {
          state: "error",
          data: { message: "Request ID reused with different data" },
        },
      },
    },
    "https://game.example",
  );
});
it("does not debit after the container is destroyed during confirmation", async () => {
  const call = vi
    .spyOn(api, "authenticated")
    .mockResolvedValue({
      id: "or1",
      game_id: "ga1",
      session_id: "as1",
      status: "pending",
    });
  const r = setup();
  let accept!: (v: boolean) => void;
  r.confirm.mockImplementation(
    () =>
      new Promise((resolve) => {
        accept = resolve;
      }),
  );
  r.send("openInvoice", { paymentId: "or1" });
  await flush();
  r.stop();
  accept(true);
  await flush();
  expect(call).toHaveBeenCalledOnce();
});
