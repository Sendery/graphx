import type { ReactNode } from "react";
export type FlowDirection = "down" | "right";
export type FlowSelection = {
    run: string;
    task?: string;
    event?: string;
};
export type SignalTone = "message" | "tool" | "branch" | "return" | "attention" | "state";
export type FlowTask = {
    id: string;
    at: number;
    parentId?: string;
    returnedAt?: number;
    running?: boolean;
    process?: {
        kind: "monitor" | "loop" | "background";
        state?: "running" | "listening" | "scheduled" | "paused";
        cadence?: string;
    };
};
export type FlowBranch = {
    run: {
        key: string;
        tabTitle: string;
        paneLabel?: string;
        color?: string;
        marker?: "coordinator" | "shell" | "background";
        active?: boolean;
    };
    start: number;
    tasks: readonly FlowTask[];
};
export type FlowRelation = {
    key: string;
    from: string;
    to: string;
    kind: "relay" | "file";
    label: string;
    description?: string;
    coordinator?: boolean;
};
export type FlowNodeStatus = {
    pending?: string;
    notice?: {
        id: string;
        at: number;
        tone: string;
        read: boolean;
        label: string;
    };
    working?: boolean;
};
type DisplayEvent = {
    id: string;
    at: number;
    label: string;
    text?: string;
    file?: string | null;
};
export type FlowActor = {
    name: string;
    label: string;
    agentLabel?: string;
    markerLabel?: string;
    glyph?: ReactNode;
    tone: "active" | "waiting" | "complete" | "error" | "idle";
    activity?: DisplayEvent;
    speech?: DisplayEvent;
    tools?: readonly DisplayEvent[];
    signals?: readonly {
        id: string;
        tone: SignalTone;
    }[];
    usage?: {
        tokens: number;
        cost?: number;
        context?: {
            input: number;
            window: number;
        };
    };
    processActivityAt?: number;
};
type DocumentActor = Omit<FlowActor, "glyph">;
type DocumentTask = FlowTask & {
    actor?: DocumentActor;
};
export type FlowDocument = {
    title?: string;
    theme?: "light" | "dark";
    agentFlow: {
        direction?: FlowDirection;
        arrangement?: "fit" | "lanes";
        time?: number;
        branches: readonly (Omit<FlowBranch, "tasks"> & {
            actor?: DocumentActor;
            tasks: readonly DocumentTask[];
        })[];
        relations?: readonly FlowRelation[];
    };
};
export {};
