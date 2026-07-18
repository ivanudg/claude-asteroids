# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Clon de Asteroids en Canvas HTML5 puro. Sin dependencias, sin bundler, sin build. Toda la lógica vive en `game.js` (~420 líneas); `index.html` solo monta el `<canvas>` de 800x600 y carga el script.

## Cómo correr

No hay build ni tests. Abrir `index.html` directo en el navegador, o servir la carpeta:

```bash
npx serve .
```

## Arquitectura

Un solo archivo `game.js` con el patrón clásico de game loop:

- **Loop** (`loop`): `requestAnimationFrame` con `dt` en segundos, capado a 0.05 para evitar saltos grandes tras perder foco. Llama `update(dt)` y `draw()`.
- **Entidades** como clases (`Ship`, `Bullet`, `Asteroid`, `Particle`), cada una con `update(dt)` y `draw()`. Todas usan una bandera `dead` y se filtran del array tras cada frame.
- **Estado global** en variables sueltas (`ship`, `bullets`, `asteroids`, `particles`, `score`, `lives`, `level`, `state`). `state` es una máquina de estados: `'playing' | 'dead' | 'gameover'`, ramificada al inicio de `update()`.
- **Renderizado** con primitivas de `ctx` (líneas blancas sobre fondo negro, estilo vectorial). Los asteroides son polígonos irregulares generados en el constructor.

### Convenciones clave

- **Coordenadas toroidales**: `wrap(v, max)` envuelve posiciones en los bordes. Aplicar a cualquier entidad nueva que se mueva.
- **Todo escalado por `dt`**: velocidades en px/s, aceleraciones en px/s². Nunca sumar valores por-frame sin multiplicar por `dt`.
- **Input**: `keys[code]` = tecla mantenida (rotar, propulsar); `pressed(code)` = flanco de subida de un solo disparo (disparar, reiniciar). Usar `pressed()` para acciones que no deben repetirse mientras se mantiene la tecla.
- **Tablas indexadas por tamaño de asteroide** (índices 1–3, el 0 es relleno): `RADII`, `SPEEDS`, `POINTS`. Al tocar el comportamiento de asteroides, mantener las 3 tablas alineadas.
- **Colisiones** por distancia de círculos (`dist`), O(balas×asteroides) por frame. Los asteroides destruidos se parten vía `split()` (tamaño −1, ×2 fragmentos) hasta tamaño 1.

## Nota

El `README.md` menciona power-ups y una estrella fugaz que **ya fueron eliminados** del juego (ver commit `13e713f`). El README está desactualizado en esa parte; `game.js` es la fuente de verdad.
