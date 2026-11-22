# Skills de diseño del proyecto

Claude Code carga cada carpeta de aquí como una *skill* (`<nombre>/SKILL.md`).

## Emil Kowalski — diseño de interfaces y animación

Copiadas tal cual de [emilkowalski/skills](https://github.com/emilkowalski/skills) (commit `64eb3de`). La
principal es `emil-design-eng`; para animar, `animate`, `review-animations` y `choreograph`; para
probar la interfaz con datos extremos, `break-ui`; para el móvil, `mobile-native`. Para actualizarlas:
`npx skills@latest add emilkowalski/skills`.

## taste-skill — webs de empresa sin aspecto «hecho por IA»

[Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (commit `f6b7657` cuando se añadió) trae un kit
de unos 40 MB (fotos, escenas, scripts de comprobación), así que no se copia aquí: se declara como
*plugin* en `.claude/settings.json` y Claude Code ofrece instalarlo al abrir el proyecto. A mano:
`/plugin marketplace add Leonxlnx/taste-skill` y `/plugin install taste-skill@taste-skill`.

## Licencias

Las dos tienen licencia MIT. Aviso de las de Emil Kowalski, que sí están copiadas aquí:

```
MIT License

Copyright (c) 2026 Emil Kowalski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
