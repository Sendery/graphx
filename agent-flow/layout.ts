import type { FlowBranch, FlowDirection } from "./types.js";

const NODE_GEOMETRY = {
  down: { width: 326, height: 156, centerX: 47, centerY: 55 },
  right: { width: 326, height: 174, centerX: 47, centerY: 73 },
  compact: { width: 156, height: 132, centerX: 78, centerY: 42 },
};
const GUTTER = 46;
const COORDINATOR_HEIGHT = 74;
const COORDINATOR_WIDTH = 200;
const CLUSTER_PAD = 18;
const CLUSTER_HEADER = 31;
export const COMPACT_SCALE = 0.48;

export function nodeGeometry(direction: FlowDirection, compact = false) {
  return NODE_GEOMETRY[compact ? "compact" : direction];
}

export type Point = { x: number; y: number };
export type Box = Point & { width: number; height: number };
export type FlowArrangement = "fit" | "lanes";

type Cluster<Branch extends FlowBranch> = {
  branch: Branch;
  box: Box;
  nodes: { task?: TaskOf<Branch>; at: Point; parent?: Point }[];
};

type TaskOf<Branch extends FlowBranch> = Branch["tasks"][number];

type Layout<Branch extends FlowBranch> = { clusters: Cluster<Branch>[]; width: number; height: number };

export function edgeGeometry(from: Point, to: Point, direction: FlowDirection, returned: boolean, clusterHeight?: number, compact = false) {
  const { width, centerX, centerY } = nodeGeometry(direction, compact);
  const a = { x: from.x + centerX, y: from.y + centerY };
  const b = { x: to.x + centerX, y: to.y + centerY };
  if (direction === "right") {
    const start = { x: a.x + 29, y: a.y };
    const end = { x: b.x - 29, y: b.y };
    let track = start.y;
    let d = `M ${start.x} ${start.y}`;
    if (clusterHeight !== undefined && to.x - from.x > width + 26) {
      const exit = from.x + width + 13;
      const bottom = clusterHeight - 8;
      d += ` H ${exit - 8} Q ${exit} ${track} ${exit} ${track + 8} V ${bottom - 8} Q ${exit} ${bottom} ${exit + 8} ${bottom}`;
      track = bottom;
    }
    if (track !== end.y) {
      const inlet = to.x - 6;
      const bend = Math.min(12, Math.abs(end.y - track) / 2);
      const step = Math.sign(end.y - track) * bend;
      d += ` H ${inlet - bend} Q ${inlet} ${track} ${inlet} ${track + step} V ${end.y - step} Q ${inlet} ${end.y} ${inlet + bend} ${end.y}`;
    }
    d += ` H ${end.x}`;
    const tip = returned ? start : end;
    const back = tip.x + (returned ? 7 : -7);
    return { d, arrow: `M ${back} ${tip.y - 4} L ${tip.x} ${tip.y} L ${back} ${tip.y + 4}` };
  }
  const start = { x: a.x, y: a.y + 29 };
  const end = { x: b.x, y: b.y - 29 };
  const mid = (start.y + end.y) / 2;
  const d = `M ${start.x} ${start.y} C ${start.x} ${mid}, ${end.x} ${mid}, ${end.x} ${end.y}`;
  const tip = returned ? start : end;
  const back = tip.y + (returned ? 7 : -7);
  return { d, arrow: `M ${tip.x - 4} ${back} L ${tip.x} ${tip.y} L ${tip.x + 4} ${back}` };
}

export function makeScene<Branch extends FlowBranch>(branches: readonly Branch[], direction: FlowDirection, arrangement: FlowArrangement = "fit", compact = false) {
  const { width: nodeWidth, height: nodeHeight, centerX, centerY } = nodeGeometry(direction, compact);
  const coordinator = branches.find(({ run }) => run.marker === "coordinator");
  const slotX = nodeWidth + 26;
  const slotY = nodeHeight + 38;
  const placed = branches.filter(({ run }) => run.marker !== "coordinator").map((branch) => {
    const header = CLUSTER_HEADER + (!compact && direction === "right" ? 16 : 0);
    const depths = new Map<string, number>();
    const layers: (TaskOf<Branch> | undefined)[][] = [[undefined]];
    const tasks: readonly TaskOf<Branch>[] = branch.tasks;
    for (const task of tasks) {
      const depth = task.parentId ? (depths.get(task.parentId) ?? 0) + 1 : 1;
      depths.set(task.id, depth);
      const layer = layers[depth] ?? [];
      layer.push(task);
      layers[depth] = layer;
    }
    const breadth = Math.min(4, Math.max(...layers.map((layer) => layer.length)));
    const depth = layers.reduce((total, layer) => total + Math.ceil(layer.length / breadth), 0);
    const width = ((direction === "down" ? breadth : depth) - 1) * slotX + nodeWidth + CLUSTER_PAD * 2;
    const rows = direction === "down" ? depth : breadth;
    const height = (rows - 1) * slotY + nodeHeight + header + CLUSTER_PAD * 2;
    const positions = new Map<string, Point>();
    const nodes: Cluster<Branch>["nodes"] = [];
    let rank = 0;
    for (const layer of layers) {
      for (let index = 0; index < layer.length; index++) {
        const task = layer[index];
        const row = Math.floor(index / breadth);
        const count = Math.min(breadth, layer.length - row * breadth);
        const cross = (index % breadth) + (breadth - count) / 2;
        const at = direction === "down"
          ? { x: CLUSTER_PAD + cross * slotX, y: header + CLUSTER_PAD + (rank + row) * slotY }
          : { x: CLUSTER_PAD + (rank + row) * slotX, y: header + CLUSTER_PAD + cross * slotY };
        const parent = task?.parentId ? positions.get(task.parentId) : nodes[0]?.at;
        nodes.push({ task, at, parent });
        if (task) positions.set(task.id, at);
      }
      rank += Math.ceil(layer.length / breadth);
    }
    return { branch, width, height, nodes };
  });

  function addCoordinator(layout: Layout<Branch>): Layout<Branch> {
    if (!coordinator) return layout;
    const horizontal = direction === "right";
    const width = Math.max(layout.width, 2 * GUTTER + 192);
    const height = Math.max(layout.height, 2 * GUTTER + COORDINATOR_HEIGHT);
    const box = { x: GUTTER, y: GUTTER, width: horizontal ? COORDINATOR_WIDTH : width - 2 * GUTTER,
      height: horizontal ? height - 2 * GUTTER : COORDINATOR_HEIGHT };
    const at = { x: box.width / 2 - centerX, y: box.height / 2 - centerY };
    const dx = horizontal ? box.width + GUTTER : 0;
    const dy = horizontal ? 0 : box.height + GUTTER;
    return {
      width: width + dx,
      height: height + dy,
      clusters: [
        { branch: coordinator, box, nodes: [{ at }] },
        ...layout.clusters.map((cluster) => ({ ...cluster, box: { ...cluster.box, x: cluster.box.x + dx, y: cluster.box.y + dy } })),
      ],
    };
  }

  if (arrangement === "lanes") {
    const across = direction === "down";
    const crossSize = placed.reduce((max, group) => Math.max(max, across ? group.height : group.width), 0);
    let nextLane = GUTTER;
    const clusters = placed.map((group): Cluster<Branch> => {
      const box = across
        ? { x: nextLane, y: GUTTER, width: group.width, height: compact ? group.height : crossSize }
        : { x: GUTTER, y: nextLane, width: compact ? group.width : crossSize, height: group.height };
      nextLane += (across ? group.width : group.height) + GUTTER;
      return { branch: group.branch, box, nodes: group.nodes };
    });
    return addCoordinator({
      clusters,
      width: across ? nextLane : crossSize + 2 * GUTTER,
      height: across ? crossSize + 2 * GUTTER : nextLane,
    });
  }

  const ordered = [...placed].sort((a, b) => b.height - a.height || b.width - a.width);
  const widest = Math.max(0, ...ordered.map(({ width }) => width));
  const area = placed.reduce((sum, { width, height }) => sum + (width + GUTTER) * (height + GUTTER), 0);
  const ratio = 1.7;
  const nominal = Math.sqrt(area * ratio);
  const widths = placed.length > 140 ? [nominal] : [nominal, nominal * 1.2, nominal * 1.44, nominal * 1.68, nominal * 0.83];
  let best: Layout<Branch> | undefined;
  for (const candidate of widths) {
    const rowWidth = Math.max(widest, candidate);
    let x = GUTTER;
    let y = GUTTER;
    let tallest = 0;
    let right = 0;
    const clusters: Cluster<Branch>[] = [];
    for (const group of ordered) {
      if (x > GUTTER && x + group.width > rowWidth + GUTTER) {
        x = GUTTER;
        y += tallest + GUTTER;
        tallest = 0;
      }
      clusters.push({ branch: group.branch, box: { x, y, width: group.width, height: group.height }, nodes: group.nodes });
      tallest = Math.max(tallest, group.height);
      right = Math.max(right, x + group.width);
      x += group.width + GUTTER;
    }
    const layout = { clusters, width: right + GUTTER, height: y + tallest + GUTTER };
    if (!best || Math.max(layout.width / ratio, layout.height) < Math.max(best.width / ratio, best.height)) {
      best = layout;
    }
  }
  return addCoordinator(best ?? { clusters: [], width: GUTTER, height: GUTTER });
}

export type FlowScene<Branch extends FlowBranch = FlowBranch> = Layout<Branch>;
export type Camera = Point & { scale: number };
export type FlowLayouts = { expanded: FlowScene; compact: FlowScene };

export function fitCamera(scene: { width: number; height: number }, viewport: { width: number; height: number }, maxScale = 1.15): Camera {
  const scale = Math.min(maxScale, Math.max(0.07, Math.min(
    (viewport.width - 26) / Math.max(scene.width, 1),
    (viewport.height - 36) / Math.max(scene.height, 1),
  )));
  return { scale, x: (viewport.width - scene.width * scale) / 2, y: (viewport.height - scene.height * scale) / 2 };
}

export function fitFlowCamera(layouts: FlowLayouts, viewport: { width: number; height: number }): Camera {
  const expanded = fitCamera(layouts.expanded, viewport);
  return expanded.scale >= COMPACT_SCALE ? expanded : fitCamera(layouts.compact, viewport, COMPACT_SCALE - 0.01);
}

export function laneCamera(scene: { width: number; height: number }, viewport: { width: number; height: number }): Camera {
  const scale = Math.max(0.56, Math.min(1, fitCamera(scene, viewport).scale));
  const freeX = viewport.width - scene.width * scale;
  const freeY = viewport.height - scene.height * scale;
  return { scale, x: Math.max(0, freeX / 2), y: Math.max(0, freeY / 2) };
}

export function zoomCamera(camera: Camera, point: Point, factor: number): Camera {
  const scale = Math.max(0.07, Math.min(2.2, camera.scale * factor));
  const ratio = scale / camera.scale;
  return { scale, x: point.x - (point.x - camera.x) * ratio, y: point.y - (point.y - camera.y) * ratio };
}

export function zoomFlowCamera(camera: Camera, point: Point, factor: number, layouts: FlowLayouts, direction: FlowDirection, time: number | null): Camera {
  const next = zoomCamera(camera, point, factor);
  const wasCompact = camera.scale < COMPACT_SCALE;
  const isCompact = next.scale < COMPACT_SCALE;
  if (wasCompact === isCompact) return next;

  const from = layouts[wasCompact ? "compact" : "expanded"];
  const to = layouts[isCompact ? "compact" : "expanded"];
  const oldNode = nodeGeometry(direction, wasCompact);
  const newNode = nodeGeometry(direction, isCompact);
  const world = { x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale };
  let closest: Cluster<FlowBranch> | undefined;
  let distance = Infinity;
  for (const cluster of from.clusters) {
    if (time !== null && cluster.branch.start > time) continue;
    const { x, y, width, height } = cluster.box;
    const gap = Math.max(0, x - world.x, world.x - x - width) ** 2
      + Math.max(0, y - world.y, world.y - y - height) ** 2;
    if (gap >= distance) continue;
    closest = cluster;
    distance = gap;
  }
  if (!closest) return next;
  const key = closest.branch.run.key;
  const destination = to.clusters.find(({ branch }) => branch.run.key === key);
  if (!destination) return next;
  const { box, nodes } = closest;
  let index = 0;
  distance = Infinity;
  nodes.forEach(({ at, task }, i) => {
    if (task && time !== null && task.at > time) return;
    const gap = (box.x + at.x + oldNode.centerX - world.x) ** 2 + (box.y + at.y + oldNode.centerY - world.y) ** 2;
    if (gap >= distance) return;
    index = i;
    distance = gap;
  });
  const start = nodes[index].at;
  const end = destination.nodes[index].at;
  return {
    ...next,
    x: next.x - (destination.box.x + end.x + newNode.centerX - box.x - start.x - oldNode.centerX) * next.scale,
    y: next.y - (destination.box.y + end.y + newNode.centerY - box.y - start.y - oldNode.centerY) * next.scale,
  };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
