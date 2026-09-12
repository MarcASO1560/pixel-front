# Sefkira Studio — investigación y dirección de interfaz para el editor pixel art

Fecha de cierre de investigación: 11 de septiembre de 2026.

Este documento define la dirección visual y estructural que debe seguir el editor antes de continuar con su implementación. No es una justificación de la interfaz actual: es el criterio con el que se debe desmontar lo que no funciona y evaluar lo siguiente.

## 1. Encargo y restricciones

La revisión parte de tres capturas del estado local actual y de una indicación explícita: la interfaz no debe tratar cada grupo como una tarjeta, no debe inventar títulos innecesarios, no debe utilizar degradados y sombras como decoración, y no debe convertir el naranja en color de interfaz. El color asociado al tipo de archivo pertenece a la identidad elegida por la persona; no es el acento global del editor.

El objetivo no es imitar la apariencia de una aplicación concreta. Es adoptar los patrones de organización que se repiten en herramientas creativas maduras y traducirlos a una interfaz propia, sobria y coherente con Sefkira.

Quedan fuera de esta decisión los degradados que sí representan información: el selector HSV, el damero de transparencia y la cuadrícula del propio lienzo. Esos elementos no son decoración.

## 2. Método

Se contrastaron cuatro tipos de evidencia:

1. Documentación oficial de editores de pixel art: Aseprite y Pixelorama.
2. Documentación oficial de editores gráficos: Photoshop y Krita.
3. Sistemas de diseño para herramientas profesionales: Adobe Spectrum, Blender, VS Code, Fluent y Carbon.
4. Criterios de accesibilidad de WCAG 2.2 para tamaño, contraste y foco.

También se auditó la implementación local de `ResourceEditorShell.vue` y de los componentes `Image*.vue`, comparándola con las capturas entregadas.

## 3. Lo que se repite en editores bien resueltos

### 3.1 Un marco de aplicación, no un tablero de tarjetas

Aseprite describe su espacio de trabajo como la combinación de editor central, timeline, barra de color, preview, toolbar y status bar. Son regiones operativas de una sola aplicación, no objetos flotantes independientes.[1] Photoshop utiliza la misma gramática: ventana de documento, panel de herramientas, barra de opciones y paneles agrupables o apilables.[2]

La consecuencia para Sefkira es directa: cabecera, rail izquierdo, escenario, inspector derecho y barra de estado deben formar un bastidor continuo. Los límites se expresan mediante cambios mínimos de superficie y divisores de un píxel. Una tarjeta solo tiene sentido si el contenido es realmente autónomo o transitorio.

### 3.2 El lienzo manda

Pixelorama define el canvas central como el área principal porque allí ocurre el trabajo. Sus paneles adicionales se ocultan por defecto y la distribución se puede adaptar.[3] Aseprite tampoco muestra siempre la timeline: aparece cuando la tarea la necesita.[1]

Por tanto, Sefkira debe priorizar el lienzo visual y espacialmente. Un panel secundario no puede competir con él mediante resplandores, esquinas ornamentales, fondos con cuadrícula, sombras grandes o múltiples contenedores. Las propiedades avanzadas deben poder abrirse y cerrarse sin desestabilizar el centro.

### 3.3 Herramientas compactas; opciones en contexto

Photoshop separa el panel de herramientas de la barra que muestra las opciones de la herramienta seleccionada.[2] Aseprite coloca su context bar justo encima del editor y cambia su contenido según la herramienta o el estado del documento.[4]

Esto resuelve un problema estructural de la interfaz actual: el tamaño del pincel y el modo relleno no pertenecen dentro del bloque vertical de iconos. Deben estar en una barra contextual fina, próxima al lienzo. El rail izquierdo queda dedicado a seleccionar herramientas.

### 3.4 Los paneles se apilan y se separan; no se encapsulan repetidamente

Krita denomina “dockers” a los paneles laterales y divide el panel de capas en controles, lista y operaciones.[5] Photoshop permite agrupar y apilar paneles.[2] Spectrum representa las aplicaciones creativas mediante paneles persistentes de altura completa y divisiones internas.[6]

El inspector derecho de Sefkira debe ser una única columna continua. Preview, capas, navegación de propiedades y contenido activo pueden tener encabezados cuando sea necesario identificar el contenido, pero no un fondo, radio y sombra propios para cada nivel.

### 3.5 El color de la interfaz comunica, no decora

Spectrum recomienda que los botones de acción dentro de paneles sean monocromos por defecto para mantener la atención en el contenido; el énfasis se reserva para selecciones o acciones que realmente lo necesitan.[7] Su guía de color vincula el color a jerarquía y significado.[8] En Sefkira, el naranja actual no informa: aparece en herramientas activas, sliders, focus rings, pestañas, botones, estado de guardado y resplandores. Esa repetición le atribuye una semántica que no existe.

La interfaz base será acromática. La selección se comunicará por contraste de luminancia: fondo claro con icono oscuro o una superficie gris claramente diferenciada. El color del archivo se limitará al icono de documento. Los colores de la obra, selector y paleta siguen siendo contenido y conservan su color real. Rojo y amarillo solo se emplearán para error o advertencia auténticos.

### 3.6 Elevación solo cuando existe elevación

Fluent define las sombras como una señal de distancia y elevación, y en Windows incluso recurre a trazos para perfilar objetos.[9] La consecuencia no es “hacer sombras más suaves”; es eliminarlas de docks, barras, botones estáticos y artboard. Solo un popover, tooltip, menú o diálogo que se superpone temporalmente necesita una señal de elevación.

### 3.7 La densidad no autoriza controles diminutos

Una herramienta profesional puede ser compacta, pero WCAG 2.2 fija 24 × 24 píxeles CSS como tamaño mínimo de objetivo, salvo excepciones de espaciado.[10] Sefkira utilizará objetivos ordinarios de 30–32 px en rails densos, iconos de 16–18 px y foco visible de alto contraste. El texto no debe sustituir a un tooltip cuando un botón sea solo icono.

## 4. Auditoría del estado actual

La sobredecoración no es una impresión aislada. La auditoría estática inicial encuentra, en `ResourceEditorShell.vue` y los componentes `Image*.vue`, decenas de radios, sombras, degradados y referencias a un acento cálido. Además, `ResourceEditorShell.vue` contiene una segunda capa de estilos titulada “Cohesive editor workspace” que vuelve a sobrescribir gran parte de la presentación previa. Esto hace que la interfaz sea difícil de razonar y que pequeños cambios generen resultados inconsistentes.

Los principales problemas son:

- `TOOLBOX` duplica lo que ya comunica un rail de iconos y consume una línea visual.
- Undo/redo se ha colocado dentro de la caja de herramientas, aunque son acciones globales del documento.
- Las opciones de pincel se han encerrado dentro del selector de herramientas, mezclando navegación y configuración.
- Color y paleta se dividen en varias cajas, aunque forman una sola tarea.
- Preview, Layers, navegación del inspector y panel activo son tarjetas anidadas dentro de un dock que ya delimita su región.
- El título y los dos estados de guardado forman varias píldoras dentro de otra píldora.
- El zoom flota en otra cápsula sobre el escenario en lugar de pertenecer a una barra de estado.
- El fondo exterior añade una cuadrícula que compite con la cuadrícula funcional del artboard.
- Las marcas blancas en forma de `L` de las capturas pequeñas proceden de `image-editor-viewport::before` y `::after`; no tienen función.
- Gradientes, sombras, bordes curvos y el naranja se repiten en casi todos los niveles, por lo que no existe una jerarquía fiable.

## 5. Arquitectura aprobada

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Cabecera global | documento + estado | acciones globales | perfil   │
├──────┬───────────────────────────────────────────────────┬───────────┤
│ rail │ barra contextual de herramienta                   │ inspector │
│      ├───────────────────────────────────────────────────┤ continuo  │
│ tools│                                                   │ preview   │
│      │                 escenario / lienzo                │ ───────── │
│ color│                                                   │ layers    │
│      │                                                   │ ───────── │
│ pal. ├───────────────────────────────────────────────────┤ props     │
│      │ estado del documento                    zoom/fit  │           │
└──────┴───────────────────────────────────────────────────┴───────────┘
```

### Cabecera

- Superficie plana, un divisor inferior y sin contenedor centrado redondeado.
- Marca y regreso a proyecto a la izquierda.
- Icono de archivo con el color elegido, nombre editable y tipo de recurso.
- Un único estado de guardado inline y neutro. No se muestran simultáneamente “Saved” y “Saved to project”.
- Undo/redo y acciones globales en esta región o en el inicio de la barra contextual, según el ancho disponible.

### Rail izquierdo

- Sin título visible “Toolbox”. Se mantiene `aria-label="Drawing tools"`.
- Una columna de botones icon-only con tooltip, atajo y estado seleccionado por luminancia.
- Sin caja exterior, sin sombra y sin degradado.
- Color primario/secundario, selector y paleta forman una sección continua debajo de un divisor.
- Los nombres solo aparecen donde eliminarlos volvería ambiguo el control.

### Barra contextual

- Ocupa una línea horizontal sobre el escenario.
- Muestra la herramienta activa y solo sus parámetros válidos: por ejemplo, tamaño para lápiz/borrador/línea, y relleno para rectángulo/elipse.
- No crea una tarjeta; pertenece al bastidor.

### Escenario y artboard

- Fondo sólido, neutral y sin cuadrícula ambiental.
- Sin esquinas `L`, halos ni iluminación radial.
- El artboard conserva únicamente el borde necesario para separarlo del escenario.
- La cuadrícula interna, las subdivisiones, la selección y el hover se mantienen porque son información funcional.

### Inspector derecho

- Un dock continuo con un único borde izquierdo.
- Preview y Layers separados por hairlines.
- La navegación Resize / View / Transform / Import-Export es una fila o rail plano; su selección usa luminancia.
- El panel activo es una sección, no una tarjeta flotante.
- Se mantienen encabezados como `Layers` o el nombre de las propiedades activas cuando identifican contenido no obvio. `Preview` puede reducirse a dimensiones + miniatura si el contexto ya lo hace inequívoco.

### Barra de estado

- Franja plana al pie del escenario.
- Contiene zoom, fit y tamaño real; puede incluir dimensiones o coordenadas en una iteración posterior.
- No es una píldora flotante.

## 6. Tokens visuales

Los nombres son semánticos; los valores son la referencia inicial y se ajustarán únicamente si la prueba visual o de contraste lo exige.

| Token | Valor inicial | Uso |
| --- | --- | --- |
| `--editor-bg` | `#050505` | escenario |
| `--editor-panel` | `#0b0b0b` | docks y barras |
| `--editor-surface` | `#111111` | control en hover o campo |
| `--editor-selected` | `#f2f2f2` | selección fuerte |
| `--editor-selected-ink` | `#080808` | icono/texto sobre selección |
| `--editor-border` | `#292929` | divisores |
| `--editor-border-strong` | `#3a3a3a` | límites activos |
| `--editor-text` | `#f2f2f2` | texto principal |
| `--editor-muted` | `#9b9b9b` | texto secundario |
| `--editor-focus` | `#ffffff` | foco de teclado |
| `--resource-accent` | valor del recurso | solo icono del archivo |

Reglas:

- Radio de panes, docks, barras, filas y artboard: `0`.
- Radio de botones, campos y controles pequeños: `2px`, excepcionalmente `3–4px` si el control lo necesita.
- Píldora: solo para una semántica que realmente sea una etiqueta compacta; no para agrupar el documento o el zoom.
- Sombra: `none` en chrome persistente. Permitida únicamente en overlays transitorios.
- Transición: color o fondo, corta; sin desplazamiento vertical decorativo en hover.

## 7. Decisiones por componente

| Componente | Decisión |
| --- | --- |
| `ResourceEditorShell.vue` | Definir el bastidor, eliminar títulos redundantes, esquinas decorativas, fondo ambiental, cards anidadas y cascadas visuales duplicadas. |
| `ImageToolbar.vue` | Rail simple; separar herramientas de historial y mover opciones contextuales fuera de la caja. |
| `ImageColorSwatches.vue` | Integrarlo visualmente en la sección de color; conservar damero funcional; botones neutros. |
| `ImageLayersPanel.vue` | Panel plano con lista y barra de operaciones; selección por luminancia. |
| `ImageZoomControls.vue` | Control inline para barra de estado, sin cápsula. |
| `ImageSaveStatus.vue` | Un estado inline; saved/saving/dirty neutros, error/offline semánticos. |
| `ImageTransformPanel.vue` | Grupos por proximidad y divisores; no tarjetas dentro del panel. |
| `ImageImportExportPanel.vue` | Jerarquía tipográfica y filas; color solo para estados o contenido. |
| avisos/conflictos | Pueden conservar color semántico y elevación únicamente mientras sean overlays reales. |

## 8. Qué no se debe hacer

- No reemplazar el naranja por otro “color de marca” global.
- No corregir la saturación manteniendo la misma arquitectura de tarjetas.
- No esconder la falta de jerarquía con bordes, radios o sombras adicionales.
- No utilizar gradientes decorativos en chrome.
- No añadir nombres a regiones cuyo significado ya es inequívoco.
- No eliminar labels accesibles, tooltips, focus rings ni áreas de interacción al limpiar la superficie.
- No tocar la persistencia, historial, dibujo, capas o exportación para resolver un problema visual.

## 9. Criterios de aceptación

La iteración solo se considera lista para revisión cuando:

1. No aparece `TOOLBOX` ni otro rótulo redundante.
2. No existen las dos marcas `L` del escenario.
3. No hay gradientes decorativos en cabecera, docks, cards, botones o escenario.
4. No hay sombras en elementos persistentes.
5. El naranja no aparece en ningún control, estado seleccionado, borde, slider o focus ring.
6. El color del recurso sigue visible exclusivamente en su icono.
7. Herramientas, opciones contextuales, escenario, inspector y zoom ocupan regiones claras del bastidor.
8. Las áreas laterales no se perciben como cajas apiladas.
9. Los controles interactivos conservan un objetivo mínimo de 24 × 24 px, tooltip o nombre accesible y foco visible.
10. Autosave, guardado manual, dibujo, capas, undo/redo, importación/exportación y navegación siguen pasando sus pruebas.
11. Se revisan capturas reales en el navegador a escritorio ancho y a un ancho reducido, no solo el DOM o el build.

## 10. Fuentes primarias

1. [Aseprite — Workspace](https://www.aseprite.org/docs/workspace/)
2. [Adobe Photoshop — Workspace overview](https://helpx.adobe.com/photoshop/desktop/get-started/learn-the-basics/workspace-overview.html)
3. [Pixelorama — User Interface Basics](https://pixelorama.org/user_manual/user_interface/user_interface_basics/)
4. [Aseprite — Context Bar](https://www.aseprite.org/docs/context-bar/)
5. [Krita — Layers Docker](https://docs.krita.org/en/reference_manual/dockers/layers.html)
6. [Adobe Spectrum — Application Frame](https://spectrum.adobe.com/page/application-frame/)
7. [Adobe Spectrum — Action Button](https://spectrum.adobe.com/page/action-button/)
8. [Adobe Spectrum — Using Color](https://spectrum.adobe.com/page/using-color/)
9. [Fluent 2 — Elevation](https://fluent2.microsoft.design/elevation)
10. [W3C — Understanding SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
11. [Blender — Human Interface Guidelines](https://developer.blender.org/docs/features/interface/human_interface_guidelines/)
12. [VS Code — UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)
13. [Carbon — Color overview](https://carbondesignsystem.com/elements/color/overview/)
