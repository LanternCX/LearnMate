import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "typebox";
import type { CodingTools } from "../tool";
import type { CodingExercise } from "../../domain/learning";

export const activityLabel = "展示编程练习";

export function showCodingExerciseTool(show: CodingTools["show"]): AgentTool {
  return {
    name: "show_coding_exercise",
    label: "展示编程练习",
    description:
      "Insert and show one interactive coding page in the lesson. The student controls editing and running after it appears.",
    parameters: Type.Object({
      title: Type.String(),
      instructions: Type.String(),
      languageId: Type.Integer({ minimum: 1 }),
      languageName: Type.String(),
      starterCode: Type.String(),
    }),
    executionMode: "sequential",
    execute: async (id, params) => {
      const exercise = show(
        id,
        params as Pick<
          CodingExercise,
          | "title"
          | "instructions"
          | "languageId"
          | "languageName"
          | "starterCode"
        >,
      );
      return {
        content: [
          {
            type: "text",
            text: `The coding page is now visible: ${JSON.stringify({ id: exercise.id, title: exercise.title, language: exercise.languageName })}. Let the student choose whether to work on it, skip it, or ask for help.`,
          },
        ],
        details: { exerciseId: exercise.id },
      };
    },
  };
}
