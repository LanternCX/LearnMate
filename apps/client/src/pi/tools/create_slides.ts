import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { Slide } from "../../domain/learning";

export type SlideRequest = {
  goal: string;
  pageCount: number;
  replaceCurrent: boolean;
};

export const activityLabel = "准备课件";

export function createSlidesTool(
  start: (request: SlideRequest) => Promise<Slide>,
): AgentTool {
  return {
    name: "create_slides",
    label: "生成课件",
    description:
      "Start generating one or more presentation pages. Use this whenever visual teaching pages help. The first completed page is returned while remaining pages continue in the background.",
    parameters: Type.Object({
      goal: Type.String(),
      pageCount: Type.Integer({ minimum: 1, maximum: 10 }),
      replaceCurrent: Type.Boolean(),
    }),
    executionMode: "sequential",
    execute: async (_id, params) => {
      const first = await start(params as SlideRequest);
      return {
        content: [
          {
            type: "text",
            text: `The first page is now visible: ${JSON.stringify(first)}. Remaining requested pages continue in the background. Base your explanation on pages that are actually visible.`,
          },
        ],
        details: { first },
      };
    },
  };
}
