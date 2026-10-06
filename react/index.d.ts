import type { ComponentType, CSSProperties, MouseEventHandler, ReactElement, ReactNode } from 'react';

/** Una fila de una tabla (entidad de ER, clase UML o requisito). */
export interface GraphXRow {
  name: string;
  type?: string;
  keys?: string;
  vis?: '+' | '-' | '#' | '~';
  section?: 'attr' | 'method';
  static?: boolean;
  abstract?: boolean;
}

/** La parte de una pieza de GraphX que dibuja una forma. */
export interface GraphXShapeNode {
  label: string;
  shape?: string;
  kind?: string;
  subtitle?: string;
  summary?: string;
  delta?: 'added' | 'modified' | 'removed' | 'unchanged';
  rows?: GraphXRow[];
  span?: { start: string | number; end?: string | number; milestone?: boolean; live?: boolean };
  score?: number;
  value?: number;
  badge?: string;
  avatar?: string;
  head?: boolean;
  abstract?: boolean;
  /** Árbol de ficheros: ruta, extensión, su color, cambios y cuentas de una carpeta. */
  path?: string;
  ext?: string;
  extColor?: string;
  additions?: number;
  deletions?: number;
  renamed?: boolean;
  metrics?: { label: string; value: string }[];
  tree?: GraphXFolderStats;
  /** Gráficos como piezas (`kpi`, `gauge`, `donut`) y datos de los efectos (graphx-fx). */
  unit?: string;
  decimals?: number;
  change?: number;
  good?: 'up' | 'down' | 'high' | 'low';
  min?: number;
  max?: number;
  thresholds?: [number, number];
  parts?: { label: string; value: number; color?: string }[];
  spark?: number[];
  heat?: number;
  progress?: number;
  alert?: 'crit' | 'warn' | 'info' | 'ok';
}

/** Efectos de graphx-fx: un preset, un objeto con cada efecto o false (ninguno). */
export type GraphXFxPreset = 'calm' | 'vivid' | 'neon' | 'blueprint' | 'glass' | 'present' | 'off';
export interface GraphXFxOptions {
  preset?: GraphXFxPreset;
  particles?: boolean | 'data' | 'flow' | 'all' | { mode?: 'data' | 'flow' | 'all'; speed?: number; density?: number; max?: number };
  heat?: boolean | { metric?: string; label?: string; unit?: string; domain?: [number, number]; scheme?: 'traffic' | 'heat' | 'cool' | 'viridis' | 'magma' | string[]; invert?: boolean; rollup?: 'max' | 'avg' | 'sum' | false; key?: boolean };
  spark?: boolean; progress?: boolean; alerts?: boolean; waves?: boolean; hoverFlow?: boolean; grid?: boolean;
  lod?: boolean | { k?: number };
  play?: boolean | { hop?: number; loop?: boolean; from?: string | string[] };
  spotlight?: boolean; entrance?: boolean | 'cascade'; glow?: boolean; gradient?: boolean;
  autoColor?: boolean | 'auto' | 'lanes' | 'groups' | 'kinds';
  skin?: 'neon' | 'blueprint' | 'glass' | null;
  sketch?: boolean;
}
export type GraphXFx = false | GraphXFxPreset | GraphXFxOptions;
/** Cambios de datos en vivo para `setData`. */
export interface GraphXDataPatch {
  nodes?: Record<string, Partial<GraphXShapeNode> & { summary?: string; color?: string; status?: string }>;
  edges?: Record<string, { rate?: number; weight?: number; animated?: boolean; speed?: 'fast' | 'slow' | number; emphasis?: 'hero' | 'normal' | 'muted'; label?: string; summary?: string }>;
}

/** Lo que resume una carpeta plegada: cuentas, reparto por extensión y ficheros cambiados. */
export interface GraphXFolderStats {
  files?: number;
  dirs?: number;
  exts?: { ext: string; n: number; color?: string }[];
  changed?: { name: string; path: string; additions?: number; deletions?: number; delta?: string }[];
  more?: number;
}

export interface GraphXShapeProps {
  node: GraphXShapeNode;
  shape?: string;
  width?: number;
  height?: number;
  /** Margen alrededor de la forma dentro de su <svg>. */
  pad?: number;
  dir?: 'right' | 'down';
  /** Rango de fechas del diagrama, para colocar la barra de un gantt. */
  span?: { min: number; max: number } | null;
  maxValue?: number;
  now?: number;
  state?: 'lit' | 'sel';
  delta?: GraphXShapeNode['delta'];
  /** Color de acento de la pieza (cualquier color CSS). */
  color?: string;
  /** Relleno y color de texto propios. */
  fill?: string;
  textColor?: string;
  icons?: Record<string, string>;
  className?: string;
  /** Tarjetas del árbol: el detalle abierto y las coincidencias de un filtro dentro de una carpeta. */
  open?: boolean;
  hits?: number;
  /** Devuelve un <g> en vez de un <svg>, para colocarlo dentro de otro dibujo. */
  asGroup?: boolean;
  onClick?: MouseEventHandler<SVGGElement>;
}

export interface GraphXInstance {
  ready: Promise<void>;
  destroy(): void;
  expandTo(depth: number): Promise<void>;
  setDirection(dir: 'right' | 'down'): Promise<void>;
  toggle(id: string): Promise<void>;
  reveal(id: string): void;
  select(id: string): void;
  focusNode(id: string): void;
  trace(id: string, direction: 'up' | 'down'): void;
  goStep(index: number): void;
  showView(view: string): void;
  setPresent(on: boolean): void;
  setExplore(on: boolean): void;
  resetView(): void;
  /** Filtra por rutas: deja abiertas solo las ramas que llevan a esas piezas (ids o una función). */
  filter(sel: string[] | ((node: GraphXShapeNode & { id: string }) => boolean), opts?: { label?: string; prune?: boolean; fit?: boolean }): Promise<void>;
  clearFilter(): Promise<void> | void;
  /** Abre o cierra la tarjeta de detalle de una pieza. */
  toggleDetail(id: string, open?: boolean): Promise<void> | void;
  setMinimap(on: boolean): void;
  /** Datos en vivo (graphx-fx): cada pieza se rehace en su sitio y se anima hasta el valor nuevo. */
  setData(patch: GraphXDataPatch, opts?: { duration?: number }): Promise<void>;
  /** «▶ Flujo»: una onda que sale de los orígenes (o de `from`) y recorre el grafo. */
  playFlow(opts?: { from?: string | string[]; hop?: number; loop?: boolean }): Promise<void>;
  stopFlow(): void;
  /** La configuración de efectos resuelta, o null sin efectos. */
  fx: Record<string, unknown> | null;
}

/** Una entrada de un árbol de ficheros: una ruta o una ruta con sus datos. */
export type GraphXTreeEntry = string | { path: string; size?: number; lines?: number; additions?: number; deletions?: number; status?: 'A' | 'M' | 'D' | 'R'; from?: string; summary?: string; metrics?: { label: string; value: string }[]; dir?: boolean };
export interface GraphXTreeOptions {
  title?: string; summary?: string; lang?: 'es' | 'en';
  /** Nombre de la carpeta raíz; false, sin raíz. */
  root?: string | false;
  /** Une las cadenas de carpetas con un solo hijo (por defecto, sí). */
  compact?: boolean;
  /** 'changes' (por defecto si hay cambios), una lista de rutas o null. */
  focus?: 'changes' | string[] | null;
  prune?: boolean;
  direction?: 'down' | 'right';
  initialDepth?: number;
  links?: { repo?: string; sha?: string };
  filters?: { label: string; query?: string; paths?: string[]; delta?: string | string[]; kinds?: string[]; nodes?: string[]; prune?: boolean }[];
}
export declare const tree: {
  fromPaths(entries: GraphXTreeEntry[], opts?: GraphXTreeOptions): unknown;
  fromTreeText(text: string, opts?: GraphXTreeOptions): unknown;
  fromGit(src: { files?: string | string[]; numstat?: string; nameStatus?: string }, opts?: GraphXTreeOptions): unknown;
  parseTree(text: string): { entries: GraphXTreeEntry[]; root: string | null };
};

/** Nodo del árbol SVG que devuelven las formas. */
export interface GraphXShapeTree {
  tag: string;
  attrs: Record<string, string | number | boolean>;
  children: GraphXShapeTree[];
  text?: string;
}

export interface GraphXProps {
  /** El JSON de GraphX. */
  spec?: unknown;
  /** O el código de un diagrama de Mermaid (necesita graphx-mermaid.js). */
  mermaid?: string;
  lang?: 'es' | 'en';
  height?: number | string;
  /** Efectos (necesita graphx-fx.js cargado): manda sobre el `fx` del JSON. */
  fx?: GraphXFx;
  className?: string;
  style?: CSSProperties;
  onReady?: (instance: GraphXInstance) => void;
  onError?: (error: Error) => void;
  onWarnings?: (warnings: string[]) => void;
}

export declare function GraphX(props: GraphXProps): ReactElement;
export declare function GraphXShape(props: GraphXShapeProps): ReactElement | null;
export declare function GraphXScope(props: { children?: ReactNode; className?: string; style?: CSSProperties }): ReactElement;
export declare const Shapes: Record<string, ComponentType<Omit<GraphXShapeProps, 'shape'>>>;
export declare function toReact(node: GraphXShapeTree, key: string | number, icons: Record<string, string>): ReactElement;
declare const api: { GraphX: typeof GraphX; GraphXShape: typeof GraphXShape; GraphXScope: typeof GraphXScope; Shapes: typeof Shapes; toReact: typeof toReact };
export default api;
