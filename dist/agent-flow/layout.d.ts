import type { FlowBranch, FlowDirection } from "./types.js";
export declare const COMPACT_SCALE = 0.48;
export declare function nodeGeometry(direction: FlowDirection, compact?: boolean): {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
} | {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
} | {
    width: number;
    height: number;
    centerX: number;
    centerY: number;
};
export type Point = {
    x: number;
    y: number;
};
export type Box = Point & {
    width: number;
    height: number;
};
export type FlowArrangement = "fit" | "lanes";
type Cluster<Branch extends FlowBranch> = {
    branch: Branch;
    box: Box;
    nodes: {
        task?: TaskOf<Branch>;
        at: Point;
        parent?: Point;
    }[];
};
type TaskOf<Branch extends FlowBranch> = Branch["tasks"][number];
type Layout<Branch extends FlowBranch> = {
    clusters: Cluster<Branch>[];
    width: number;
    height: number;
};
export declare function edgeGeometry(from: Point, to: Point, direction: FlowDirection, returned: boolean, clusterHeight?: number, compact?: boolean): {
    d: string;
    arrow: string;
};
export declare function makeScene<Branch extends FlowBranch>(branches: readonly Branch[], direction: FlowDirection, arrangement?: FlowArrangement, compact?: boolean): Layout<Branch>;
export type FlowScene<Branch extends FlowBranch = FlowBranch> = Layout<Branch>;
export type Camera = Point & {
    scale: number;
};
export type FlowLayouts = {
    expanded: FlowScene;
    compact: FlowScene;
};
export declare function fitCamera(scene: {
    width: number;
    height: number;
}, viewport: {
    width: number;
    height: number;
}, maxScale?: number): Camera;
export declare function fitFlowCamera(layouts: FlowLayouts, viewport: {
    width: number;
    height: number;
}): Camera;
export declare function laneCamera(scene: {
    width: number;
    height: number;
}, viewport: {
    width: number;
    height: number;
}): Camera;
export declare function zoomCamera(camera: Camera, point: Point, factor: number): Camera;
export declare function zoomFlowCamera(camera: Camera, point: Point, factor: number, layouts: FlowLayouts, direction: FlowDirection, time: number | null): Camera;
export declare function overlaps(a: Box, b: Box): boolean;
export {};
