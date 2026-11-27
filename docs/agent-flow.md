# Agent Flow

GraphX can render a live or recorded agent map with the renderer shared by Terax AI. A map contains branches with agents or shell processes, nested tasks, and optional relay or file relations. It supports both directions, fitted or lane layout, a compact overview, pan, zoom and a minimap.

## Open a standalone map

```sh
node graphx-build.mjs examples/agent-flow.json --out /tmp/agent-flow.html
node graphx-build.mjs examples/agent-flow.json --check
```

The builder recognizes a top-level `agentFlow` object and emits a self-contained page. The page uses the dedicated browser bundle without ELK or the standard graph engine. The bundled example shows the document fields. Branch keys are unique. Tasks have unique IDs within a branch and follow their parent in the task list. When `time` is set, the renderer hides branches and tasks that start later. Use timestamps in milliseconds. The standalone renderer does not read session logs or reconstruct activity from raw events.

## Embed a map with React

Import `FlowCanvas` from `graphx/agent-flow` and `graphx/agent-flow.css` for its styles. The component requires React 18 or later and a parent with the `agent-flow` class and an assigned height. It receives branches, relations, a time cursor and selection callbacks. Its `getActor` callback converts application data into node presentation as the renderer needs it, and can supply an application icon. All coordinates, layout, culling, navigation and node/edge presentation belong to GraphX.

```sh
npm ci
npm run build:agent-flow
```

`dist/agent-flow/index.mjs` is the ES module with React external. It ships with type declarations, stylesheet and a manifest of file hashes. `browser.js` is the separate standalone build with React included. Run `npm run dist` to build both GraphX distributions together. The kit and release include the Agent Flow build.
