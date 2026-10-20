// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
vi.mock("../lib/relay", () => ({
  relayConfigured: vi.fn(),
  relayRequest: vi.fn(),
}));
import { relayConfigured, relayRequest } from "../lib/relay";
import RelayPaymentSwap from "./RelayPaymentSwap";
const props = {
  slug: "test",
  config: {
    configured: true,
    chain_id: 46630,
    contract: "0x1",
    rpc_url: "",
    explorer_url: "",
  },
  address: "0x" + "1".repeat(40),
  provider: { request: vi.fn() },
  payment: "0x" + "2".repeat(40),
  symbol: "Mock USDT",
  onClose: vi.fn(),
  onComplete: vi.fn(),
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("explains missing key without requesting quotes or opening wallet", async () => {
  vi.mocked(relayConfigured).mockResolvedValue({
    configured: false,
    testnet: true,
  });
  render(<RelayPaymentSwap {...props} />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "not enabled yet",
  );
  expect(relayRequest).not.toHaveBeenCalled();
  expect(props.provider.request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close swap" }));
  expect(props.onClose).toHaveBeenCalled();
});
it("blocks unsupported destination network before quoting", async () => {
  vi.mocked(relayConfigured).mockResolvedValue({
    configured: true,
    testnet: true,
  });
  vi.mocked(relayRequest).mockResolvedValue({
    chains: [{ id: 11155111, vmType: "evm" }],
  });
  render(<RelayPaymentSwap {...props} />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "does not support",
  );
  expect(screen.queryByRole("button", { name: "Review quote" })).toBeNull();
  expect(props.provider.request).not.toHaveBeenCalled();
});
