import { promises as fs } from "fs";
import path from "path";

const PROMPT_DIR = path.join(process.cwd(), "prompts");

function applyTemplate(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((acc, [key, value]) => {
    const token = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    return acc.replace(token, value);
  }, template);
}

function normalizeSection(value?: string) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "None provided.";
}

export async function renderPrompt(
  name: string,
  vars: Record<string, string | undefined>
) {
  const filePath = path.join(PROMPT_DIR, `${name}.txt`);
  let template = "";
  try {
    template = await fs.readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Failed to load prompt '${name}' from ${filePath}: ${String(error)}`
    );
  }
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    normalized[key] = normalizeSection(value);
  }
  return applyTemplate(template, normalized);
}
