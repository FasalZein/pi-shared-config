import { readFileSync, writeFileSync } from "node:fs";

const [templatePath, targetPath] = process.argv.slice(2);
if (!templatePath || !targetPath) {
  throw new Error("usage: merge-agent.mjs <template> <target>");
}

const template = readFileSync(templatePath, "utf8");
const current = readFileSync(targetPath, "utf8");
const currentParts = current.split("---");
const parts = template.split("---");
if (currentParts.length < 3) throw new Error(`missing frontmatter: ${targetPath}`);
if (parts.length < 3) throw new Error(`missing frontmatter: ${templatePath}`);

const frontmatterValue = (text, key) =>
  text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1];
const model = frontmatterValue(currentParts[1], "model");
const allowedModels = frontmatterValue(currentParts[1], "allowed-models");

const lines = parts[1]
  .split("\n")
  .filter((line) => !line.startsWith("model:") && !line.startsWith("allowed-models:"));

if (model) {
  const thinkingIndex = lines.findIndex((line) => line.startsWith("thinking:"));
  lines.splice(thinkingIndex >= 0 ? thinkingIndex : lines.length, 0, `model: ${model}`);
}
if (allowedModels) {
  const overrideIndex = lines.findIndex((line) => line.startsWith("allow-model-override:"));
  lines.splice(overrideIndex >= 0 ? overrideIndex + 1 : lines.length, 0, `allowed-models: ${allowedModels}`);
}

parts[1] = lines.join("\n");
writeFileSync(targetPath, parts.join("---"));
