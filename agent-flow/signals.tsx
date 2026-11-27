import { File01Icon, FileEditIcon, GlobalSearchIcon, TerminalIcon, ToolsIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { FlowActor } from "./types.js";

export function contextPercent({ input, window }: { input: number; window: number }) {
  return Math.round(Math.max(0, Math.min(1, input / window)) * 100);
}

export function BeaconSignals({ actor }: { actor: FlowActor }) {
  const context = actor.usage?.context;
  return (
    <svg className="flow-beacon-signals" viewBox="0 0 96 96" aria-hidden="true">
      <circle className="flow-beacon-calibration" cx="48" cy="48" r="43" />
      <circle className="flow-beacon-track" cx="48" cy="48" r="35" />
      <g transform="rotate(-90 48 48)">
        {actor.signals?.slice(-12).map((event, index) => (
          <circle key={event.id} className="flow-beacon-tick" data-signal={event.tone}
            cx="48" cy="48" r="37" pathLength="100"
            strokeDasharray="5.7 94.3" strokeDashoffset={-index * (100 / 12)} />
        ))}
        {context ? (
          <circle className="flow-beacon-context" cx="48" cy="48" r="43" pathLength="100"
            strokeDasharray={`${contextPercent(context)} 100`} />
        ) : null}
      </g>
    </svg>
  );
}

export function ToolMark({ name }: { name: string }) {
  const key = name.toLowerCase();
  let icon = ToolsIcon;
  let tone = "other";
  if (/(edit|write|patch|replace|create)/.test(key)) {
    icon = FileEditIcon;
    tone = "write";
  } else if (/(search|grep|glob|find)/.test(key)) {
    icon = GlobalSearchIcon;
    tone = "search";
  } else if (/(bash|shell|command|run|test|terminal|exec)/.test(key)) {
    icon = TerminalIcon;
    tone = "run";
  } else if (/(read|view|list|open)/.test(key)) {
    icon = File01Icon;
    tone = "read";
  }
  return <span className="flow-tool-mark" data-tool={tone} aria-hidden="true"><HugeiconsIcon icon={icon} size={12} /></span>;
}
