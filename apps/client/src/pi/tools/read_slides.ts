import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { SlideTools } from "../tool";

export const activityLabel = "核对课件状态";

export function readSlidesTool(read: SlideTools["read"]): AgentTool {
  return {
    name: "read_slides",
    label: "读取当前课件",
    description:
      "Read the pages that are actually visible and whether more pages are still being generated. Use this before referring to pages published after create_slides returned.",
    parameters: Type.Object({}),
    execute: async () => {
      const state = read();
      return {
        content: [{ type: "text", text: JSON.stringify(state) }],
        details: { pages: state.pages.length },
      };
    },
  };
}
