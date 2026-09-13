import { api } from "../../api";
import type { CodeLanguage, CodeRunResult } from "../../domain/learning";

export async function listCodeLanguages() {
  return (await api<{ languages: CodeLanguage[] }>("/code/languages"))
    .languages;
}

export async function runCode(
  languageId: number,
  sourceCode: string,
  stdin: string,
) {
  return api<CodeRunResult>("/code/runs", "POST", {
    languageId,
    sourceCode,
    stdin,
  });
}
