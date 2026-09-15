import { describe, expect, it, vi } from "vitest";
import { registerCampaignTools } from "./webmcp";
describe("optional campaign tool contracts", () => {
  it("registers read and navigation tools, validates inputs and cleans up", () => {
    const registerTool = vi.fn();
    const navigate = vi.fn();
    const cleanup = registerCampaignTools(
      { registerTool },
      () => "prelaunch",
      navigate,
    );
    const [list, open] = registerTool.mock.calls.map((call) => call[0]);
    expect(list.name).toBe("list_playable_campaigns");
    expect(list.annotations.readOnlyHint).toBe(true);
    expect(list.execute({})).toHaveLength(4);
    expect(open.execute({ campaignId: "phood", view: "play" })).toEqual({
      path: "/campaign/phood/play",
      sampleData: true,
    });
    expect(navigate).toHaveBeenLastCalledWith("/campaign/phood/play");
    expect(() => open.execute({ campaignId: "../../outside" })).toThrow();
    expect(() => open.execute({ campaignId: "orbit", view: "play" })).toThrow();
    expect(navigate).toHaveBeenCalledTimes(1);
    cleanup();
    expect(registerTool.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("does not block browsers without modelContext", () => {
    expect(() =>
      registerCampaignTools(undefined, () => "prelaunch", vi.fn())(),
    ).not.toThrow();
  });
});
