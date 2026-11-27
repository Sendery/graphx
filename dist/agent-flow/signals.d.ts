import type { FlowActor } from "./types.js";
export declare function contextPercent({ input, window }: {
    input: number;
    window: number;
}): number;
export declare function BeaconSignals({ actor }: {
    actor: FlowActor;
}): import("react").JSX.Element;
export declare function ToolMark({ name }: {
    name: string;
}): import("react").JSX.Element;
