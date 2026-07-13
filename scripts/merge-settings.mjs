import { readFileSync, writeFileSync } from "node:fs";

const [templatePath, targetPath] = process.argv.slice(2);
if (!templatePath || !targetPath) {
  throw new Error("usage: merge-settings.mjs <template> <target>");
}

const template = JSON.parse(readFileSync(templatePath, "utf8"));
const current = JSON.parse(readFileSync(targetPath, "utf8"));
const obsoletePackages = new Set([
  "git:github.com/ttttmr/pi-context",
  "git:github.com/mavam/pi-fancy-footer",
  "https://github.com/vvv850/pi-pretty-codeblocks",
]);
const packageSource = (entry) => (typeof entry === "string" ? entry : entry.source);
const sharedSources = new Set(template.packages.map(packageSource));
const personalPackages = (current.packages ?? []).filter((entry) => {
  const source = packageSource(entry);
  return source && !obsoletePackages.has(source) && !sharedSources.has(source);
});

current.packages = [...template.packages, ...personalPackages];
writeFileSync(targetPath, `${JSON.stringify(current, null, 2)}\n`);
