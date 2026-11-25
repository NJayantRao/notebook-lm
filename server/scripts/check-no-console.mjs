import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const violations = [];

const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!sourceExtensions.has(entry.slice(entry.lastIndexOf(".")))) {
      continue;
    }
    const lines = readFileSync(fullPath, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/\bconsole\s*\.\s*(log|info|warn|error|debug|trace|dir|table)\b/.test(line)) {
        violations.push(`${relative(root, fullPath)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
};

walk(root);

if (violations.length > 0) {
  console.error("console.* calls are not allowed in server/src; use config/logger.ts:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log("No console.* calls found in server/src.");
