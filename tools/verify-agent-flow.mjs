import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { fitFlowCamera, makeScene } from "graphx/agent-flow";
import { agentFlowHtml, validateAgentFlowDocument } from "./agent-flow-document.mjs";

const example = JSON.parse(fs.readFileSync(new URL("../examples/agent-flow.json", import.meta.url)));
const assets = new URL("../dist/agent-flow/", import.meta.url);

test("lays out nested tasks, a coordinator and separate runs in both orientations", () => {
  const { branches } = example.agentFlow;
  for (const direction of ["right", "down"]) {
    for (const compact of [false, true]) {
      const scene = makeScene(branches, direction, "lanes", compact);
      const [coordinator, app, checks] = scene.clusters;
      assert.equal(coordinator.branch.run.key, "coordinator");
      assert.equal(app.nodes.length, 3);
      assert.deepEqual(app.nodes[1].parent, app.nodes[0].at);
      if (direction === "right") assert.ok(app.box.y + app.box.height < checks.box.y);
      else assert.ok(app.box.x + app.box.width < checks.box.x);
      assert.ok(fitFlowCamera({ expanded: scene, compact: scene }, { width: 800, height: 600 }).scale > 0);
    }
  }
});

test("validates input and encodes text as data in a standalone page", () => {
  const fixture = structuredClone(example);
  fixture.title = "</script><img src=x>";
  validateAgentFlowDocument(fixture);
  const page = agentFlowHtml(fixture, fileURLToPath(assets), {});
  assert.ok(page.includes("&lt;/script&gt;&lt;img src=x&gt;"));
  assert.ok(page.includes("\\u003c/script>\\u003cimg src=x>"));
  assert.ok(page.includes("GraphXAgentFlow.mount"));
  assert.ok(!page.includes(fixture.title));
  fixture.agentFlow.branches[1].tasks[1].parentId = "missing";
  assert.throws(() => validateAgentFlowDocument(fixture), /must follow its parent/);
});

test("verifies the versioned ESM assets and keeps React external", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("manifest.json", assets)));
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(manifest.version, pkg.version);
  for (const [name, sha] of Object.entries(manifest.files)) {
    assert.equal(createHash("sha256").update(fs.readFileSync(new URL(name, assets))).digest("hex"), sha);
  }
  const esm = fs.readFileSync(new URL("index.mjs", assets), "utf8");
  assert.ok(esm.includes('from"react"'));
  assert.ok(Buffer.byteLength(esm) < 60 * 1024);
});
