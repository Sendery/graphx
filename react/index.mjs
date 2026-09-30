/* Entrada ESM para bundlers (Vite, esbuild, webpack): carga las formas y el puente de React y
 * exporta los componentes con el React de la aplicación. El motor (graphx.js) y el conversor de
 * Mermaid (graphx-mermaid.js) se importan aparte cuando se usa <GraphX>. */
import React from 'react';
import '../graphx-shapes.js';
import '../graphx-layouts.js';
import './graphx-react.js';

const api = globalThis.GraphXReactFactory(React, () => globalThis.GraphX || {});
export const { GraphX, GraphXShape, GraphXScope, Shapes, toReact } = api;
export default api;
