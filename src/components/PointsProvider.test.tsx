// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import {
  PointsProvider,
  usePoints,
  notifyPointsChanged,
} from "./PointsProvider";
const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../lib/api", () => ({ api: { authenticated: mock.request } }));
const page = (balance = 60) => ({
  balance,
  items: [],
  next_cursor: "",
  policy: { min_elapsed_ms: 15000 },
  tasks: [],
  server_time: "2026-09-26T00:00:00Z",
});
function Consumer() {
  const p = usePoints();
  return (
    <>
      <span data-testid="balance">{p.page?.balance ?? "empty"}</span>
      <span data-testid="gain">{p.gain}</span>
      <button onClick={p.refresh}>Refresh</button>
      {p.error && <p role="alert">{p.error}</p>}
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.useRealTimers();
});
it("shares one request, only animates subsequent gains and preserves balance on errors", async () => {
  mock.request
    .mockResolvedValueOnce(page())
    .mockResolvedValueOnce(page(80))
    .mockRejectedValueOnce(new Error("Offline"));
  render(
    <PointsProvider userId="ur1">
      <Consumer />
      <Consumer />
    </PointsProvider>,
  );
  await screen.findAllByText("60");
  expect(mock.request).toHaveBeenCalledTimes(1);
  expect(screen.getAllByTestId("gain")[0].textContent).toBe("0");
  fireEvent.click(screen.getAllByText("Refresh")[0]);
  await screen.findAllByText("80");
  expect(screen.getAllByTestId("gain")[0].textContent).toBe("20");
  fireEvent.click(screen.getAllByText("Refresh")[0]);
  await screen.findAllByRole("alert");
  expect(screen.getAllByTestId("balance")[0].textContent).toBe("80");
});
it("aborts and clears the old account, ignoring late responses", async () => {
  let resolve!: (value: unknown) => void;
  mock.request
    .mockResolvedValueOnce(page())
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce(page(7));
  const view = (id?: string) => (
    <PointsProvider userId={id}>
      <Consumer />
    </PointsProvider>
  );
  const r = render(view("ur1"));
  await screen.findByText("60");
  fireEvent.click(screen.getByText("Refresh"));
  const signal = mock.request.mock.calls[1][2] as AbortSignal;
  r.rerender(view("ur2"));
  expect(screen.getByTestId("balance").textContent).toBe("empty");
  expect(signal.aborted).toBe(true);
  await screen.findByText("7");
  await act(async () => resolve(page(999)));
  expect(screen.queryByText("999")).toBeNull();
  r.rerender(view());
  expect(screen.getByTestId("balance").textContent).toBe("empty");
  expect(mock.request).toHaveBeenCalledTimes(3);
});
it("refreshes on settlement and visibility, deduplicates in-flight work and skips hidden polling", async () => {
  mock.request.mockResolvedValue(page());
  render(
    <PointsProvider userId="ur1">
      <Consumer />
    </PointsProvider>,
  );
  await screen.findByText("60");
  act(() => notifyPointsChanged());
  await waitFor(() => expect(mock.request).toHaveBeenCalledTimes(2));
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => {
    vi.advanceTimersByTime(60000);
  });
  expect(mock.request).toHaveBeenCalledTimes(2);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mock.request).toHaveBeenCalledTimes(3);
});
