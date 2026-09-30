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
}

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
