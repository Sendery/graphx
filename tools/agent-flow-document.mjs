import fs from "node:fs";
import path from "node:path";

const oneOf = (...values) => (value) => values.includes(value);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const string = (value) => typeof value === "string";
const nonempty = (value) => string(value) && value.trim() !== "";
const list = (item) => (value) => Array.isArray(value) && value.every(item);
const optional = (check) => (value) => value === undefined || check(value);
const bool = (value) => typeof value === "boolean";
const number = Number.isFinite;
const color = (value) => string(value) && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value);
const shape = (fields) => (value) => record(value)
  && Object.entries(fields).every(([key, check]) => check(value[key]));

const event = shape({ id: nonempty, at: number, label: string, text: optional(string),
  file: optional((value) => value === null || string(value)) });
const actor = shape({
  name: nonempty, label: string, agentLabel: optional(string), markerLabel: optional(string),
  tone: oneOf("active", "waiting", "complete", "error", "idle"),
  activity: optional(event), speech: optional(event), tools: optional(list(event)),
  signals: optional(list(shape({ id: nonempty, tone: oneOf("message", "tool", "branch", "return", "attention", "state") }))),
  usage: optional(shape({ tokens: number, cost: optional(number),
    context: optional(shape({ input: number, window: (value) => number(value) && value > 0 })) })),
  processActivityAt: optional(number),
});
const task = shape({
  id: nonempty, at: number, returnedAt: optional(number), parentId: optional(nonempty),
  running: optional(bool), actor: optional(actor),
  process: optional(shape({ kind: oneOf("monitor", "loop", "background"),
    state: optional(oneOf("running", "listening", "scheduled", "paused")), cadence: optional(string) })),
});
const branch = shape({
  start: number, actor: optional(actor), tasks: list(task),
  run: shape({ key: nonempty, tabTitle: nonempty, paneLabel: optional(string), color: optional(color),
    marker: optional(oneOf("coordinator", "shell", "background")), active: optional(bool) }),
});
const relation = shape({
  key: nonempty, from: nonempty, to: nonempty, kind: oneOf("relay", "file"), label: string,
  description: optional(string), coordinator: optional(bool),
});

export function validateAgentFlowDocument(source) {
  if (!shape({ title: optional(string), theme: optional(oneOf("light", "dark")),
    agentFlow: shape({ direction: optional(oneOf("right", "down")), arrangement: optional(oneOf("fit", "lanes")),
      time: optional(number), branches: Array.isArray, relations: optional(list(relation)) }) })(source)) {
    throw new Error("Invalid Agent Flow document, settings or relations.");
  }
  const flow = source.agentFlow;
  const runs = new Set();
  let coordinator;
  flow.branches.forEach((entry, index) => {
    if (!branch(entry)) throw new Error("Invalid Agent Flow branch at index " + index + ".");
    const { key, marker } = entry.run;
    if (runs.has(key)) throw new Error("Duplicate Agent Flow branch: " + key);
    runs.add(key);
    if (marker === "coordinator") {
      if (coordinator !== undefined) throw new Error("Agent Flow allows one coordinator.");
      coordinator = key;
    }
    const tasks = new Set();
    for (const task of entry.tasks) {
      if (tasks.has(task.id)) throw new Error("Duplicate task " + task.id + " in " + key);
      if (task.parentId && !tasks.has(task.parentId)) {
        throw new Error("Task " + task.id + " must follow its parent " + task.parentId);
      }
      tasks.add(task.id);
    }
  });
  const relations = new Set();
  for (const edge of flow.relations ?? []) {
    if (relations.has(edge.key)) throw new Error("Duplicate Agent Flow relation: " + edge.key);
    relations.add(edge.key);
    if (!runs.has(edge.from) || !runs.has(edge.to)) throw new Error("Unknown branch in relation " + edge.key);
    if (edge.coordinator && (edge.kind !== "relay" || edge.from !== coordinator)) {
      throw new Error("Coordinator relation " + edge.key + " must start at the coordinator.");
    }
  }
}

export function agentFlowHtml(source, assets, { title, height, fragment }) {
  const mount = '<div class="gx-agent-flow-figure"><div data-gx-agent-flow></div>'
    + '<script type="application/json">' + JSON.stringify(source).replace(/</g, "\\u003c") + "</script></div>";
  const css = fs.readFileSync(path.join(assets, "agent-flow.css"), "utf8");
  const engine = fs.readFileSync(path.join(assets, "browser.js"), "utf8").replace(/<\/script/gi, "<\\/script");
  const figureHeight = Number(height);
  if (height !== undefined && (!Number.isFinite(figureHeight) || figureHeight <= 0)) {
    throw new Error("Agent Flow height must be a positive number.");
  }
  const styles = "<style>" + css + "\n.gx-agent-flow-figure > [data-gx-agent-flow]{height:"
    + (height === undefined ? "min(80vh, 860px)" : figureHeight + "px") + "}</style>";
  const script = "<script>" + engine + "\n;document.querySelectorAll('[data-gx-agent-flow]:empty').forEach("
    + "el=>GraphXAgentFlow.mount(el, JSON.parse(el.nextElementSibling.textContent)));</script>";
  if (fragment) return styles + mount + script;
  const caption = (title ?? source.title ?? "Agent Flow").replace(/[&<>]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
  return "<!doctype html>\n<html lang=\"en\"><meta charset=\"utf-8\">"
    + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>" + caption + "</title>"
    + "<style>body{margin:1rem;font:15px system-ui,sans-serif;color:#182230;background:#f8fafc}"
    + "main{max-width:1320px;margin:auto}h1{font-size:1.5rem}</style>"
    + styles + "<main><h1>" + caption + "</h1>" + mount + "</main>" + script + "</html>\n";
}
