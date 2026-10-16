// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { LaunchTimer } from "./LaunchTimer";
import { formatTicker } from "./lib/ticker";
vi.mock("./state", () => ({ useApp: () => ({ local: { launchTimes: { cp1: 9999999999999 } } }) }));
afterEach(() => { cleanup(); vi.useRealTimers(); });
it.each(["PHOOD", "$PHOOD", "$$PHOOD", " $ $PHOOD "])("formats %s with one dollar", value => {
  expect(formatTicker(value)).toBe("$PHOOD");
});
it("counts days hours minutes seconds using server time and stops at zero", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
  const { container, rerender } = render(<LaunchTimer campaignId="cp1" live serverTime="2026-10-02T00:00:00Z" launchAt="2026-10-03T02:03:04Z" />);
  const values = () => Array.from(container.querySelectorAll("strong"), e => e.textContent);
  expect(values()).toEqual(["01", "02", "03", "04"]);
  act(() => { vi.advanceTimersByTime(1000); });
  expect(values()).toEqual(["01", "02", "03", "03"]);
  rerender(<LaunchTimer campaignId="cp1" live serverTime="2026-10-02T00:00:00Z" launchAt="2026-10-01T00:00:00Z" />);
  expect(values()).toEqual(["00", "00", "00", "00"]);
  expect(screen.getByText(/Countdown complete/)).toBeTruthy();
});
it("does not use a demo schedule when the live schedule is missing", () => {
  render(<LaunchTimer campaignId="cp1" live />);
  expect(screen.getByText("Waiting for a confirmed launch schedule.")).toBeTruthy();
});
