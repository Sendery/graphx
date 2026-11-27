#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "dist", "agent-flow");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
fs.mkdirSync(out, { recursive: true });
execFileSync(process.execPath, [
  path.join(root, "node_modules", "typescript", "bin", "tsc"),
  "-p", path.join(root, "agent-flow", "tsconfig.json"), "--outDir", out,
], { stdio: "inherit" });
fs.renameSync(path.join(out, "index.d.ts"), path.join(out, "index.d.mts"));
fs.rmSync(path.join(out, "standalone.d.ts"));

const opt = { absWorkingDir: root, minify: true, target: "es2020", legalComments: "eof", logLevel: "warning" };
await Promise.all([
  build({ ...opt, entryPoints: ["agent-flow/index.ts"], outfile: path.join(out, "index.mjs"),
    jsx: "automatic", bundle: true, format: "esm", external: ["react"] }),
  build({ ...opt, entryPoints: ["agent-flow/standalone.tsx"], outfile: path.join(out, "browser.js"),
    jsx: "automatic", bundle: true, format: "iife", globalName: "GraphXAgentFlow",
    define: { "process.env.NODE_ENV": '"production"' } }),
  build({ ...opt, entryPoints: ["agent-flow/agent-flow.css"], outfile: path.join(out, "agent-flow.css") }),
]);

const license = (name, file) => fs.readFileSync(path.join(root, "node_modules", name, file), "utf8").trim();
const hugeicons = "Hugeicons React and core-free-icons (MIT)\n" + license("@hugeicons/react", "LICENSE.md");
const react = ["react", "react-dom", "scheduler"].map((name) => license(name, "LICENSE"));
for (const [file, texts] of [["index.mjs", [hugeicons]], ["browser.js", [hugeicons, ...new Set(react)]]]) {
  fs.appendFileSync(path.join(out, file), "\n/*!\n" + texts.join("\n\n").replaceAll("*/", "* /") + "\n*/\n");
}

const names = ["index.mjs", "index.d.mts", "FlowCanvas.d.ts", "types.d.ts", "layout.d.ts", "signals.d.ts", "agent-flow.css", "browser.js"];
const files = Object.fromEntries(names.map((name) =>
  [name, createHash("sha256").update(fs.readFileSync(path.join(out, name))).digest("hex")]));
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ version, files }, null, 2) + "\n");
console.log(`GraphX Agent Flow ${version} · ${fs.statSync(path.join(out, "index.mjs")).size} bytes (ESM, React external)`);
