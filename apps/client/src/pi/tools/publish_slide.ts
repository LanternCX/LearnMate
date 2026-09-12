import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { Slide } from "../../domain/learning";

/** Publication succeeds only when the active generation accepts the page. */
export function publishSlideTool(
  publish: (id: string, page: Omit<Slide, "id">) => number,
): AgentTool {
  return {
    name: "publish_slide",
    label: "发布课件页",
    description:
      "Publish exactly one completed presentation page so the student can see it immediately.",
    parameters: Type.Object({
      title: Type.String({
        maxLength: 32,
        description: "Plain-text page title.",
      }),
      kicker: Type.Optional(
        Type.String({
          maxLength: 24,
          description: "Optional plain-text section label.",
        }),
      ),
      body: Type.String({
        maxLength: 120,
        description: "Plain-text explanation without Markdown or SVG markup.",
      }),
      bullets: Type.Array(
        Type.String({
          maxLength: 48,
          description: "One concise plain-text point.",
        }),
        { maxItems: 6 },
      ),
      layout: Type.Union([
        Type.Literal("explain"),
        Type.Literal("steps"),
        Type.Literal("compare"),
      ]),
    }),
    executionMode: "sequential",
    execute: async (id, params) => {
      const count = publish(id, params as Omit<Slide, "id">);
      return {
        content: [{ type: "text", text: `Page ${count} is visible.` }],
        details: { page: count },
      };
    },
  };
}
