import type { CourseCover, StoredCourse, Slide } from "../domain/learning";
import type { SlideRequest } from "./tools/create_slides";

import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { ToolResultMessage } from "@earendil-works/pi-ai";

export type PersistedToolExecutor = (id: string) => Promise<ToolResultMessage>;

/** The host executes acknowledged calls; PI receives the persisted result or a tool error. */
export function bindPersistedTool(
  definition: Pick<AgentTool, "name" | "label" | "description" | "parameters">,
  execute: PersistedToolExecutor,
): AgentTool {
  return {
    ...definition,
    execute: async (id) => {
      const result = await execute(id);
      if (result.isError)
        throw new Error(
          result.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n"),
        );
      return { content: result.content, details: result.details };
    },
  };
}

export type CourseManagement = {
  course: StoredCourse | null;
  create: (
    title: string,
    topic: string,
    cover: CourseCover,
  ) => Promise<StoredCourse>;
  rename: (title: string, topic?: string) => Promise<StoredCourse>;
};

export type SlideTools = {
  start: (request: SlideRequest) => Promise<Slide>;
  cancel: () => void;
  read: () => { pages: Slide[]; generating: boolean };
  next: () => Promise<Slide>;
};

export type TeachingToolContext = {
  course: { id: string; title: string; topic: string };
  management: CourseManagement;
};
