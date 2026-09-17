import { readFileSync, writeFileSync } from "node:fs";

const [templatePath, targetPath] = process.argv.slice(2);
if (!templatePath || !targetPath) {
  throw new Error("usage: merge-settings.mjs <template> <target>");
}

const template = JSON.parse(readFileSync(templatePath, "utf8"));
const current = JSON.parse(readFileSync(targetPath, "utf8"));

current.enabledModels = template.enabledModels;
current.packages = template.packages;
current.extensions = template.extensions;
writeFileSync(targetPath, `${JSON.stringify(current, null, 2)}\n`);
