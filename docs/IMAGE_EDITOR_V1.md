# Sefkira Studio — Editor de imágenes pixel art v1

## 1. Propósito

El editor de imágenes permite crear y modificar recursos `pixel_art` estáticos dentro de un proyecto de Sefkira Studio.

La v1 debe ser una herramienta completa para producir un sprite o una ilustración pixel art, guardarla en la nube y exportarla sin depender de software externo. También debe establecer un motor de imagen reutilizable por los futuros editores de animaciones y tilesets.

## 2. Principios

- Cada acción debe ser predecible a nivel de píxel.
- La transparencia forma parte nativa del documento.
- El contenido se guarda automáticamente; el usuario no debe depender de un botón `Save`.
- Las preferencias visuales personales no deben modificar el recurso compartido.
- Las herramientas deben funcionar sobre la capa activa.
- La interfaz debe seguir siendo utilizable sin abrir todos los paneles.
- El editor es desktop-first. La edición táctil avanzada y la interfaz móvil no forman parte de v1.

## 3. Alcance funcional

### 3.1 Documento

- Canvas rectangular de `1 × 1` a `256 × 256` píxeles.
- Fondo transparente por defecto.
- Cambio de ancho y alto, vinculados o independientes.
- Nueve anclajes de redimensionado.
- El contenido que queda fuera del nuevo canvas al reducirlo se recorta.
- Paleta propia del recurso.
- Color primario y secundario.
- Una o más capas.
- Máximo de `64` capas por recurso en v1.

### 3.2 Herramientas

| Herramienta | Atajo | Comportamiento v1 |
| --- | --- | --- |
| Lápiz | `B` | Pinta con el color primario. |
| Borrador | `E` | Convierte los píxeles afectados en transparentes. |
| Relleno | `G` | Rellena una región contigua mediante vecinos ortogonales. |
| Cuentagotas | `I` | Selecciona el color visible bajo el cursor y vuelve al lápiz. |
| Línea | `L` | Dibuja una línea con previsualización antes de confirmar. |
| Rectángulo | `R` | Dibuja contorno o forma rellena. |
| Elipse | `O` | Dibuja contorno o forma rellena. |
| Selección | `S` | Crea una selección rectangular. |
| Mover | `M` | Mueve la selección o, si no existe, la capa activa. |

Reglas compartidas:

- Tamaño de pincel cuadrado entre `1` y `8` píxeles.
- Las pinceladas continuas interpolan las celdas atravesadas para no dejar huecos.
- El botón derecho invierte temporalmente lápiz y borrador.
- `Shift` restringe líneas y proporciones de rectángulos/elipses.
- Las herramientas que modifican contenido no actúan sobre capas bloqueadas.
- Una pulsación, arrastre o transformación completa genera una sola entrada de historial.

### 3.3 Selección y transformaciones

- Seleccionar todo y deseleccionar.
- Borrar el contenido seleccionado.
- Cortar, copiar y pegar dentro del editor.
- Mover una selección con el puntero o las flechas del teclado.
- Flip horizontal y vertical.
- Rotación de `90°` en ambos sentidos.
- Las transformaciones se aplican a la selección; sin selección se aplican a toda la capa activa.
- El contenido trasladado fuera del canvas se recorta.
- El portapapeles de v1 es interno al editor; copiar como imagen al portapapeles del sistema queda fuera de alcance.

### 3.4 Capas

- Crear, duplicar, renombrar y eliminar capas.
- Debe existir siempre al menos una capa.
- Reordenar capas.
- Mostrar u ocultar capas.
- Bloquear o desbloquear capas.
- Opacidad de `0%` a `100%`.
- La exportación y el preview componen únicamente las capas visibles.
- No habrá modos de mezcla en v1; todas las capas usan composición alfa normal.
- El borrado afecta únicamente a la capa activa.

### 3.5 Color y paleta

- Selector de tono, saturación y luminosidad/valor.
- Entrada hexadecimal normalizada a `#RRGGBB`.
- Color primario y secundario claramente identificados.
- Intercambio rápido entre ambos colores.
- Añadir el color activo a la paleta.
- Seleccionar un color guardado.
- Eliminar un color mediante menú contextual o acción accesible equivalente.
- Evitar colores duplicados en la paleta.
- El cuentagotas toma el color compuesto visible, no solamente el de la capa activa.

### 3.6 Historial

- Undo y redo mediante botones y teclado.
- Máximo inicial de `100` acciones por sesión de edición.
- El historial incluye pintura, relleno, formas, transformaciones, redimensionado y operaciones de capas.
- Cambiar zoom, cuadrícula, herramienta o color no crea una entrada.
- Una nueva acción después de undo descarta la rama de redo.
- El historial es local y no se persiste al cerrar o recargar.

### 3.7 Vista del canvas

- Zoom mediante rueda y controles explícitos.
- Rango de zoom suficiente para encajar el documento y editar píxeles individuales.
- El zoom mantiene bajo el cursor el punto observado siempre que sea posible.
- Desplazamiento mediante botón central o `Space + arrastre`.
- Acción `Fit to screen`.
- Acción `100%` para ver un píxel del recurso como un píxel de pantalla.
- Cuadrícula configurable:
  - visible u oculta;
  - color;
  - opacidad;
  - estilo sólido, discontinuo o puntos;
  - separación;
  - subdivisiones, color y grosor.
- Fondo de previsualización configurable sin alterar la transparencia real.
- Miniatura de navegación con un marco que representa el viewport actual.

### 3.8 Importación

- PNG, JPG/JPEG y WebP como imagen aplanada.
- JSON nativo de Sefkira con validación de versión.
- Las imágenes con transparencia conservan el canal alfa.
- JPG se importa sobre un fondo opaco.
- Si una imagen supera `256 × 256`, se pide reducirla o cancelar; no se recorta silenciosamente.
- Un GIF no se importa en este editor; debe abrir el flujo de creación de una animación.

### 3.9 Exportación

- PNG transparente.
- PNG con el color de fondo de previsualización.
- Escalas enteras `1×`, `2×`, `4×`, `8×` y `16×` sin suavizado.
- JSON editable de Sefkira con todo el contenido del recurso.
- Nombre de archivo basado en el nombre del recurso y normalizado para el sistema de archivos.
- Las capas ocultas no aparecen en el PNG final, pero sí permanecen en el JSON.

### 3.10 Guardado

- Autosave en PostgreSQL con debounce aproximado de `400–500 ms`.
- Estados visibles: `Saved`, `Saving…`, `Unsaved changes`, `Save failed` y `Offline`.
- Los cambios pendientes se intentan guardar antes de abandonar el editor.
- Un error no elimina los cambios locales ni muestra falsamente el estado `Saved`.
- Si llega una actualización remota mientras existen cambios locales, el editor no debe sobrescribir silenciosamente el documento. En v1 mostrará un aviso para recargar o conservar la versión local.
- Los usuarios con rol `viewer` pueden navegar y exportar, pero no modificar el recurso.

## 4. Distribución de la interfaz

### Barra superior

- Regreso a Sefkira Studio y al proyecto.
- Nombre editable del recurso.
- Tipo de recurso.
- Estado de guardado.
- Controles de undo y redo.
- Menú de importación/exportación.
- Perfil del usuario.

### Lateral izquierdo

- Herramientas de dibujo.
- Opciones contextuales de la herramienta activa, como tamaño y forma rellena.
- Selector de color y paleta.

### Centro

- Workspace navegable.
- Canvas centrado inicialmente y ajustable mediante zoom/pan.
- Overlays de hover, selección y previsualización de formas.

### Lateral derecho

- Preview/minimapa.
- Panel de capas.
- Redimensionado.
- Preferencias de visualización.
- Propiedades contextuales de selección cuando corresponda.

Los paneles secundarios pueden plegarse. La herramienta activa, los colores y el estado de guardado deben seguir siendo visibles sin depender de un panel abierto.

## 5. Atajos v1

| Acción | Atajo |
| --- | --- |
| Lápiz | `B` |
| Borrador | `E` |
| Relleno | `G` |
| Cuentagotas | `I` |
| Línea | `L` |
| Rectángulo | `R` |
| Elipse | `O` |
| Selección | `S` |
| Mover | `M` |
| Reducir pincel | `[` |
| Aumentar pincel | `]` |
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Y` o `Ctrl/Cmd + Shift + Z` |
| Seleccionar todo | `Ctrl/Cmd + A` |
| Copiar | `Ctrl/Cmd + C` |
| Cortar | `Ctrl/Cmd + X` |
| Pegar | `Ctrl/Cmd + V` |
| Eliminar selección | `Delete` o `Backspace` |
| Duplicar capa | `Ctrl/Cmd + J` |
| Deseleccionar / cerrar panel | `Escape` |
| Pan temporal | `Space + arrastre` |
| Zoom | Rueda del ratón |
| Fit to screen | `1` |
| Zoom 100% | `2` |

Los atajos no se ejecutan mientras el foco se encuentra en un campo de texto o control editable.

## 6. Modelo de datos v2

El recurso conserva el envoltorio actual `data.pixel_art`, pero su contenido pasa a versión `2`.

```json
{
  "pixel_art": {
    "version": 2,
    "width": 32,
    "height": 32,
    "palette": ["#FFFFFF", "#000000"],
    "layers": [
      {
        "id": "layer-uuid",
        "name": "Layer 1",
        "visible": true,
        "locked": false,
        "opacity": 1,
        "pixels": [null, "#FFFFFF"]
      }
    ]
  }
}
```

Reglas:

- `pixels` es un array lineal en orden por filas y tiene exactamente `width × height` entradas.
- Cada entrada es `null`, `#RRGGBB` o `#RRGGBBAA`; el segundo formato conserva alfa parcial importado.
- `opacity` se limita al rango `0–1`.
- Los identificadores de capa son estables y únicos dentro del recurso.
- La carga migra automáticamente el documento v1 de una sola matriz `pixels` a una capa v2.
- La migración no modifica el registro remoto hasta que exista un cambio real o el usuario confirme el guardado migrado.

No se guardan como contenido compartido:

- zoom y desplazamiento;
- herramienta activa;
- capa seleccionada;
- colores activos;
- estado de paneles;
- configuración visual de cuadrícula y fondo;
- anclaje seleccionado para la siguiente operación de redimensionado;
- historial undo/redo.

Estas preferencias se conservan localmente por usuario y, cuando corresponda, por recurso.

## 7. Arquitectura frontend propuesta

El editor no debe continuar creciendo como una única responsabilidad dentro de `ResourceEditorShell.vue`.

```text
features/pixel-art/
  components/
    ImageEditor.vue
    ImageCanvas.vue
    ImageToolbar.vue
    ImageColorPanel.vue
    ImageLayersPanel.vue
    ImagePreview.vue
    ImageInspector.vue
  composables/
    useImageDocument.ts
    useImageHistory.ts
    useImageCanvas.ts
    useImageAutosave.ts
  lib/
    color.ts
    drawing.ts
    import-export.ts
    migrations.ts
  types.ts
```

`ResourceEditorShell.vue` debe encargarse de cargar el proyecto/recurso, comprobar permisos, mostrar la navegación general y montar el editor correspondiente. La lógica de dibujo debe vivir en funciones puras siempre que sea posible.

## 8. Orden de implementación

1. Extraer el editor actual de `ResourceEditorShell.vue` sin cambiar su comportamiento.
2. Introducir el modelo v2 y la migración automática desde v1.
3. Implementar capas y composición.
4. Implementar historial transaccional y estado de guardado.
5. Añadir tamaño de pincel, línea, rectángulo y elipse.
6. Añadir selección, movimiento y transformaciones.
7. Añadir importación y exportación.
8. Completar atajos, accesibilidad, permisos y manejo de conflictos.
9. Realizar pruebas funcionales y visuales en los tamaños soportados.

## 9. Criterios de aceptación

La v1 se considera terminada cuando:

- Es posible crear una imagen desde cero, editarla con todas las herramientas v1 y recuperarla tras recargar.
- Undo/redo revierte correctamente cada acción completa.
- Las capas se componen, bloquean, ocultan y persisten correctamente.
- Redimensionar respeta los nueve anclajes y puede deshacerse.
- El editor informa de forma fiable si está guardando, guardado o en error.
- PNG y JSON sobreviven a un ciclo de exportación/importación sin pérdida inesperada.
- Un usuario `viewer` no puede alterar el recurso.
- La carga de recursos v1 existentes conserva todos sus píxeles y su paleta.
- El frontend supera `npm.cmd run check` y `npm.cmd run build`.
- No existen errores de consola durante el flujo normal de edición.

## 10. Fuera de alcance

- Frames, timeline, onion skin y exportación GIF.
- Edición de tilesets o tilemaps.
- Modos de mezcla y máscaras de capa.
- Filtros, ajustes fotográficos y efectos no destructivos.
- Pinceles personalizados o texturas.
- Edición simultánea píxel a píxel.
- Historial persistente entre sesiones.
- IA generativa.
- Interfaz móvil completa.
