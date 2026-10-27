import { api, ApiError } from "./api";
export type ArcadeGame = {
  aspect_width?: number;
  aspect_height?: number;
  id: string;
  name: string;
  description: string;
  instructions: string;
  cover: string;
  icon: string;
  entry_url: string;
  tags: string[];
  screenshots: string[];
  status: string;
  featured: boolean;
  sort: number;
  build: string;
  protocol: string;
  validation: string;
  metrics: {
    key: string;
    name: string;
    unit: string;
    max: number;
    show: boolean;
  }[];
  product_mode: string;
  billing: boolean;
  billing_message: string;
  saves: boolean;
  version: number;
};
export type ArcadeSession = {
  id: string;
  game_id: string;
  game: ArcadeGame;
  test: boolean;
  expires_at: string;
  campaign?: string;
};
export type ArcadeOrder = {
  id: string;
  game_id: string;
  session_id: string;
  title: string;
  description: string;
  price: number;
  payload: string;
  status: string;
  delivered: boolean;
  test: boolean;
};
export type ArcadeTask = {
  task: {
    id: string;
    game_id: string;
    campaign: string;
    name: string;
    description: string;
    reward: number;
    target: number;
    period: string;
  };
  progress: number;
  credited: boolean;
};
export const arcadeError = (e: unknown, game?: ArcadeGame) =>
  e instanceof ApiError
    ? (
        {
          23001: "Data changed. Refresh before retrying.",
        23002: e.serverMessage || game?.billing_message || "该游戏暂未开放付费，请稍后再试",
          23003: "水晶不足，充值暂未开放。",
          23004: "This game does not support this purchase method.",
          23005: "This session or order has expired.",
        } as Record<number, string>
      )[e.code] || e.message
    : e instanceof Error
      ? e.message
      : "Request failed";
export type BridgeOptions = {
  frame: HTMLIFrameElement;
  session: ArcadeSession;
  user: { id: string; name: string; handle?: string; avatarUrl?: string };
  onProgress: (v: number) => void;
  onNotice: (message: string) => void;
  confirm: (order: ArcadeOrder) => Promise<boolean>;
  onReady: () => void;
  onExit: () => void;
};
export function attachArcadeBridge(o: BridgeOptions) {
  const origin = new URL(o.session.game.entry_url).origin;
  let active = true;
  let paymentBusy = false;
  let saveQueue = Promise.resolve();
  const saved = new Map<string, string>();
  const versions = new Map<string, number>();
  const pending = new Map<
    string,
    { fingerprint: string; work: Promise<unknown> }
  >();
  const call = <T>(path: string, body?: unknown) =>
    api.authenticated<T>(path, body);
  const base = `/arcade/sessions/${o.session.id}`;
  const read = async (key: string) => {
    const v = await call<{ data: string; version: number }>(
      `${base}/saves/${encodeURIComponent(key)}`,
    );
    versions.set(key, v.version);
    saved.set(key, v.data);
    return v;
  };
  const purchase = async (id: string) => {
    if (!active) throw Error("Game closed");
    if (paymentBusy) throw Error("Another purchase is awaiting confirmation.");
    paymentBusy = true;
    try {
      const order = await call<ArcadeOrder>(
        `/arcade/orders/${encodeURIComponent(id)}`,
      );
      if (
        order.session_id !== o.session.id ||
        order.game_id !== o.session.game_id
      )
        throw Error("Order does not belong to this game session.");
      if (order.status === "paid") return order;
      if (!(await o.confirm(order))) {
        await call(`/arcade/orders/${id}/cancel`, {});
        throw Error("Purchase canceled");
      }
      if (!active) throw Error("Game closed");
      return await call<ArcadeOrder>(`/arcade/orders/${id}/confirm`, {});
    } finally {
      paymentBusy = false;
    }
  };
  const dispatch = async (
    method: string,
    p: Record<string, any>,
    legacy: boolean,
  ) => {
    switch (method) {
      case "ready":
        o.onReady();
        return {
          session_id: o.session.id,
          game_id: o.session.game_id,
          capabilities: ["saves", "metrics", "tasks", "crystals", "purchase"],
          test: o.session.test,
        };
      case "getUserProfile":
        return {
          id: o.user.id,
          channelId: "",
          displayName: o.user.name,
          userName: o.user.handle || "",
          avatarUrl: o.user.avatarUrl || "",
          from: 0,
          language: navigator.language,
        };
      case "loading": {
        const n = Number(p.value);
        if (!Number.isFinite(n)) throw Error("Invalid progress");
        o.onProgress(Math.max(0, Math.min(1, n)));
        if (legacy && n >= 1) o.onReady();
        return null;
      }
      case "getData":
      case "getDataV2": {
        if (typeof p.key !== "string") throw Error("Invalid save key");
        const v = await read(p.key);
        return legacy
          ? method === "getData"
            ? btoa(v.data)
            : { key: p.key, data: btoa(v.data) }
          : { key: p.key, ...v };
      }
      case "setData": {
        if (typeof p.key !== "string" || typeof p.data !== "string")
          throw Error("Invalid save");
        let result: unknown;
        const run = saveQueue.then(async () => {
          if (!active) throw Error("Game closed");
          if (!versions.has(p.key)) await read(p.key);
          const v = await call<{ version: number }>(
            `${base}/saves/${encodeURIComponent(p.key)}`,
            {
              data: p.data,
              version: legacy
                ? versions.get(p.key)
                : (p.version ?? versions.get(p.key)),
            },
          );
          versions.set(p.key, v.version);
          saved.set(p.key, p.data);
          result = legacy ? Object.fromEntries(saved) : { key: p.key, ...v };
        });
        saveQueue = run.catch(() => {});
        await run;
        return result;
      }
      case "report":
        return call(`${base}/events`, {
          request_id: p.request_id || crypto.randomUUID(),
          metric: p.metric,
          value: p.value,
        }).then(v=>{if(active)window.dispatchEvent(new Event('p2l:points-changed'));return v});
      case "getTasks":
        return call(`/arcade/tasks?game=${o.session.game_id}`);
      case "getBalance":
        return call(`${base}/wallet`);
      case "getProducts":
        return call(`${base}/products`);
      case "getOrders":
        return (
          await call<ArcadeOrder[]>(`/arcade/games/${o.session.game_id}/orders`)
        ).filter((v) => v.test === o.session.test);
      case "getOrder": {
        const v = await call<ArcadeOrder>(
          `/arcade/orders/${encodeURIComponent(p.paymentId || p.order_id)}`,
        );
        if (v.game_id !== o.session.game_id || v.test !== o.session.test)
          throw Error("Wrong game");
        return v;
      }
      case "confirmDelivery": {
        const id = p.order_id;
        const v = await call<ArcadeOrder>(
          `/arcade/orders/${encodeURIComponent(id)}`,
        );
        if (v.game_id !== o.session.game_id || v.test !== o.session.test)
          throw Error("Wrong game");
        return call(`/arcade/orders/${encodeURIComponent(id)}/delivered`, {});
      }
      case "requestPayment":
      case "purchase": {
        const body = {
          session_id: o.session.id,
          request_id: p.request_id || crypto.randomUUID(),
          ...(p.product_id
            ? { product_id: p.product_id, quantity: p.quantity ?? 1 }
            : {
                title: p.title,
                description: p.desc ?? p.description ?? "",
                price: p.price,
              }),
          payload: p.info ?? p.payload ?? "",
        };
        const order = await call<ArcadeOrder>("/arcade/orders", body);
        if (method === "purchase") return purchase(order.id);
        return { paymentId: order.id, invoiceLink: "" };
      }
      case "openInvoice": {
        const v = await purchase(p.paymentId);
        return { paymentId: v.id, status: "paid", msg: "" };
      }
      case "requestAd":
        throw Error("广告功能暂未开放");
      case "openTelegramLink": {
        const u = new URL(String(p.value));
        if (u.protocol !== "https:" || u.hostname !== "t.me")
          throw Error("Unsupported link");
        window.open(u.href, "_blank", "noopener,noreferrer");
        return null;
      }
      case "exit":
        o.onExit();
        return null;
      default:
        throw Error("Unsupported game method");
    }
  };
  const listener = (e: MessageEvent) => {
    if (!active || e.source !== o.frame.contentWindow || e.origin !== origin)
      return;
    const legacy = !!e.data?.dashfun;
    const data = legacy ? e.data.dashfun : e.data?.p2lArcade;
    if (!data || typeof data.method !== "string") return;
    const { method, id } = data;
    if (!legacy && (typeof id !== "string" || id.length > 100)) return;
    const p =
      data.payload && typeof data.payload === "object" ? data.payload : {};
    const reply = (state: string, value: unknown) => {
      if (active && e.source === o.frame.contentWindow)
        o.frame.contentWindow?.postMessage(
          legacy
            ? {
                dashfun: {
                  method: method + "Result",
                  result: { state, data: value },
                },
              }
            : {
                p2lArcade: {
                  id,
                  method: method + "Result",
                  result: { state, data: value },
                },
              },
          origin,
        );
    };
    const key = legacy ? "" : id;
    const fingerprint = JSON.stringify([method, p]);
    const cached = key ? pending.get(key) : undefined;
    if (cached && cached.fingerprint !== fingerprint) {
      reply("error", { message: "Request ID reused with different data" });
      return;
    }
    let work = cached?.work;
    if (!work) {
      work = dispatch(method, p, legacy);
      if (key) {
        pending.set(key, { fingerprint, work });
        if (pending.size > 200) pending.delete(pending.keys().next().value!);
      }
    }
    void work
      .then((v) => reply("success", v))
      .catch((e) => {
        const msg = arcadeError(e, o.session.game);
        if (
          ["requestPayment", "purchase", "openInvoice", "requestAd"].includes(
            method,
          )
        )
          o.onNotice(msg);
        reply("error", {
          paymentId: p.paymentId,
          status: "error",
          msg,
          message: msg,
        });
      });
  };
  window.addEventListener("message", listener);
  return () => {
    active = false;
    window.removeEventListener("message", listener);
    pending.clear();
  };
}
