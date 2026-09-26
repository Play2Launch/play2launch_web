import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "../lib/api";

export type PointEntry = {
  id: string;
  kind: string;
  amount: number;
  period: string;
  created_at: string;
};
export type PointTask = {
  kind: string;
  group: string;
  reward: number;
  progress: number;
  target: number;
  status: "in_progress" | "completed" | "credited";
  resets_at?: string;
};
export type PointsPage = {
  balance: number;
  items: PointEntry[];
  next_cursor: string;
  policy: {
    first: number;
    daily: number;
    daily_three: number;
    weekly_five: number;
    min_elapsed_ms: number;
  };
  tasks: PointTask[];
  server_time: string;
};
export const pointLabels: Record<string, string> = {
  first_game: "First qualifying game",
  daily_game: "Daily play",
  daily_three: "Three games in a day",
  weekly_five: "Five active days this week",
  adjustment: "Points adjustment",
  reversal: "Points correction",
};
export function notifyPointsChanged() {
  window.dispatchEvent(new Event("p2l:points-changed"));
}
type Value = {
  page?: PointsPage;
  busy: boolean;
  error: string;
  gain: number;
  refresh: () => void;
  more: () => void;
};
const Context = createContext<Value>({
  busy: false,
  error: "",
  gain: 0,
  refresh: () => {},
  more: () => {},
});
export const usePoints = () => useContext(Context);

// Keying the inner provider makes an account change a synchronous state reset.
export function PointsProvider({
  userId,
  children,
}: {
  userId?: string;
  children: ReactNode;
}) {
  return (
    <AccountPoints key={userId || "guest"} userId={userId}>
      {children}
    </AccountPoints>
  );
}
function AccountPoints({
  userId,
  children,
}: {
  userId?: string;
  children: ReactNode;
}) {
  const [page, setPage] = useState<PointsPage>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [gain, setGain] = useState(0);
  const current = useRef<PointsPage>(),
    flight = useRef<AbortController>(),
    alive = useRef(true),
    pending = useRef(false);
  const request = useCallback(
    async (after = "") => {
      if (!userId || !alive.current) return;
      if (flight.current) {
        if (!after) pending.current = true;
        return;
      }
      const ctrl = new AbortController();
      flight.current = ctrl;
      setBusy(true);
      try {
        const result = await api.authenticated<PointsPage>(
          after
            ? `/points/me?after=${encodeURIComponent(after)}`
            : "/points/tasks",
          undefined,
          ctrl.signal,
        );
        if (
          !Number.isSafeInteger(result?.balance) ||
          !Array.isArray(result.items) ||
          !result.policy ||
          (!after &&
            (!Array.isArray(result.tasks) ||
              !Number.isFinite(Date.parse(result.server_time))))
        )
          throw new Error("Invalid points response. Please refresh.");
        if (!alive.current || ctrl.signal.aborted) return;
        const old = current.current;
        const next: PointsPage =
          after && old
            ? {
                ...old,
                balance: result.balance,
                next_cursor: result.next_cursor,
                items: [
                  ...old.items,
                  ...result.items.filter(
                    (e) => !old.items.some((o) => o.id === e.id),
                  ),
                ],
              }
            : result;
        if (old && result.balance > old.balance)
          setGain(result.balance - old.balance);
        current.current = next;
        setPage(next);
        setError("");
      } catch (e) {
        if (alive.current && !ctrl.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load points.");
      } finally {
        if (flight.current === ctrl) flight.current = undefined;
        if (alive.current && !ctrl.signal.aborted) {
          setBusy(false);
          if (pending.current) {
            pending.current = false;
            void request();
          }
        }
      }
    },
    [userId],
  );
  useEffect(() => {
    alive.current = true;
    void request();
    const visible = () => {
      if (document.visibilityState !== "hidden") void request();
    };
    let followup: ReturnType<typeof setTimeout> | undefined;
    const settled = () => {
      visible();
      clearTimeout(followup);
      followup = setTimeout(visible, 2500);
    };
    const interval = setInterval(visible, 60000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("p2l:points-changed", settled);
    return () => {
      alive.current = false;
      pending.current = false;
      flight.current?.abort();
      flight.current = undefined;
      clearInterval(interval);
      clearTimeout(followup);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("p2l:points-changed", settled);
    };
  }, [request]);
  useEffect(() => {
    if (!gain) return;
    const timer = setTimeout(() => setGain(0), 2400);
    return () => clearTimeout(timer);
  }, [gain]);
  return (
    <Context.Provider
      value={{
        page,
        busy,
        error,
        gain,
        refresh: () => {
          void request();
        },
        more: () => {
          if (current.current?.next_cursor)
            void request(current.current.next_cursor);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
