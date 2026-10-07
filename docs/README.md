# Documentación de GraphX

| Documento | Para qué |
|---|---|
| [catalogo.md](catalogo.md) | todo lo que se puede dibujar, por familias: tarjetas, formas, gráficos, contenedores, aristas, iconos, bloques del panel, vistas y color |
| [efectos.md](efectos.md) | los efectos clasificados por función (lo dibujan los datos, responde al lector, ayuda a leer, estilo), cómo se configuran y recetas |
| [demo.md](demo.md) | la página de demostración, pestaña a pestaña |
| [ejemplos.md](ejemplos.md) | los ejemplos del repositorio, qué demuestra cada uno y cómo se regenera |
| [referencia.md](referencia.md) | la referencia del JSON campo a campo, la API y las herramientas |

Las capturas (`img/*.webp`) se regeneran con:

```bash
npm i -D playwright && npx playwright install chromium   # una vez
node tools/build-dist.mjs                                 # dist/ al día (la demo lo usa)
node tools/capture-docs.mjs                               # todas; o solo algunas: … demo-panel fx-ondas
```

Los GIF de los README (`gif/es/*.gif` y `gif/en/*.gif`) se graban de la demo en cada idioma (necesita ffmpeg):

```bash
node tools/capture-gifs.mjs                 # todos, en los dos idiomas; o: … diagramas efectos --lang en
```

El script de capturas construye cada página en un directorio temporal, la abre en Chromium, prepara la escena (un panel
abierto, el impacto, las 13:00 en la línea de tiempo, una piel…) y guarda la captura en WebP.
