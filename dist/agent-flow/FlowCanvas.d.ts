import { type CSSProperties } from "react";
import { type FlowArrangement } from "./layout.js";
import type { FlowActor, FlowBranch, FlowDirection, FlowNodeStatus, FlowRelation, FlowSelection } from "./types.js";
export declare function accentStyle(color?: string): CSSProperties;
export type CanvasProps<Branch extends FlowBranch = FlowBranch> = {
    branches: readonly Branch[];
    getColor?: (branch: Branch) => string | undefined;
    getActor: (branch: Branch, task: Branch["tasks"][number] | undefined, time: number | null) => FlowActor;
    direction: FlowDirection;
    arrangement: FlowArrangement;
    time: number | null;
    target: FlowSelection | null;
    pinnedRun: string | null;
    relations: readonly FlowRelation[];
    activeRelation?: FlowRelation;
    nodeStatus?: ReadonlyMap<string, FlowNodeStatus>;
    onRelation: (key: string) => void;
    focusRequest: {
        key: string;
        tick: number;
    } | null;
    fitRequest: string;
    empty?: {
        title: string;
        description?: string;
    };
    onSelect: (selection: FlowSelection) => void;
    onVisible: (runs: string[]) => void;
};
export declare function FlowCanvas<Branch extends FlowBranch>({ branches, getActor, getColor, direction, arrangement, time, target, pinnedRun, relations, activeRelation, nodeStatus, focusRequest, fitRequest, empty, onSelect, onVisible, onRelation, }: CanvasProps<Branch>): import("react").JSX.Element;
