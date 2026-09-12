import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { SlideTools } from "../tool";

export const activityLabel = "切换下一页";

export function showNextSlideTool(next: SlideTools["next"]): AgentTool {
  return {
    name: "show_next_slide",
    label: "切换下一页",
    description:
      "Show the next generated page. Call this only after your streamed explanation of the current page is complete. The tool waits if the next page is still being prepared.",
    parameters: Type.Object({}),
    executionMode: "sequential",
    execute: async () => {
      const slide = await next();
      return {
        content: [
          {
            type: "text",
            text: `The next page is now visible: ${JSON.stringify(slide)}. Explain only this page before advancing again.`,
          },
        ],
        details: { slide },
      };
    },
  };
}
