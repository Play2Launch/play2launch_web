import type { Campaign, Stage } from "../data";
export const launchCopy = {
  prelaunch: {
    title: "A community away.",
    detail: "Play together. Unlock the launch.",
    action: "Play to unlock",
  },
  ready: {
    title: "You played. We unlocked.",
    detail: "Community goal reached. Waiting for a confirmed launch schedule.",
    action: "View launch progress",
  },
  countdown: {
    title: "The next chapter is close.",
    detail: "The launch schedule is set. Launch still requires confirmation.",
    action: "View launch countdown",
  },
  live: {
    title: "From players to launch.",
    detail: "Launched-state preview. No live token or trading is connected.",
    action: "View launch details",
  },
} satisfies Record<Stage, { title: string; detail: string; action: string }>;
export function launchPlayers(campaign: Campaign, _stage: Stage) {
  return campaign.players;
}
export function launchPoints(campaign: Campaign) {
  return campaign.unlockPoints ?? 0;
}
