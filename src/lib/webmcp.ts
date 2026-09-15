import { campaigns, stageLabel, type Stage } from "../data";
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: unknown): unknown;
};
type ModelContext = {
  registerTool(
    tool: Tool,
    options: { signal: AbortSignal },
  ): void | Promise<void>;
};
declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}

export function registerCampaignTools(
  context: ModelContext | undefined,
  getStage: (id: string) => Stage,
  open: (path: string) => void,
) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: "list_playable_campaigns",
      description:
        "Read the same prototype campaigns shown on Discover, including launch state and whether a practice game is available.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () =>
        campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          stage: stageLabel(getStage(c.id)),
          playable: c.id === "phood",
          sampleData: true,
        })),
    },
    {
      name: "open_campaign",
      description:
        "Navigate to a campaign overview or its practice game. This does not join a team, sign in, record a score or trade.",
      inputSchema: {
        type: "object",
        properties: {
          campaignId: { type: "string", enum: campaigns.map((c) => c.id) },
          view: { type: "string", enum: ["overview", "play"] },
        },
        required: ["campaignId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input: unknown) => {
        const args = input as { campaignId?: string; view?: string };
        if (
          !args ||
          !campaigns.some((c) => c.id === args.campaignId) ||
          (args.view && !["overview", "play"].includes(args.view))
        )
          throw new Error("Invalid campaign or view");
        if (args.view === "play" && args.campaignId !== "phood")
          throw new Error("This practice game is not available yet");
        const path = `/campaign/${args.campaignId}${args.view === "play" ? "/play" : ""}`;
        open(path);
        return { path, sampleData: true };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional capability; never block the product. */
    }
  }
  return () => lifecycle.abort();
}
