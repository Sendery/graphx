import { useState } from "react";
import { createRoot } from "react-dom/client";
import { FlowCanvas } from "./FlowCanvas.js";
import type { FlowDocument, FlowSelection } from "./types.js";

const noop = () => {};
const getActor = (branch: FlowDocument["agentFlow"]["branches"][number], task?: typeof branch.tasks[number]) =>
  (task ? task.actor : branch.actor) ?? { name: task?.id ?? branch.run.tabTitle, label: "Recorded", tone: "idle" as const };

function AgentFlowDocument({ source }: { source: FlowDocument }) {
  const { direction = "down", arrangement = "fit", time = null, branches, relations = [] } = source.agentFlow;
  const [target, setTarget] = useState<FlowSelection | null>(null);
  const [relationKey, setRelationKey] = useState<string>();
  return (
    <div className={source.theme === "dark" ? "gx-agent-flow dark" : "gx-agent-flow"}>
      <div className="agent-flow">
        <FlowCanvas branches={branches} getActor={getActor} direction={direction} arrangement={arrangement}
          time={time} target={target} relations={relations} activeRelation={relations.find(({ key }) => key === relationKey)}
          focusRequest={null} fitRequest={`${direction}:${arrangement}`} pinnedRun={null}
          onSelect={(selection) => { setTarget(selection); setRelationKey(undefined); }}
          onVisible={noop} onRelation={(key) => { setTarget(null); setRelationKey((current) => current === key ? undefined : key); }} />
      </div>
    </div>
  );
}

export function mount(element: HTMLElement, source: FlowDocument) {
  const root = createRoot(element);
  root.render(<AgentFlowDocument source={source} />);
  return () => root.unmount();
}
