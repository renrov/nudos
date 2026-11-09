# Cómo contribuir

Corré `pnpm dev` para ver tu cambio. Antes de abrir un PR, corré `pnpm typecheck`, `pnpm lint`, `pnpm format` y `pnpm test`. La CI corre los mismos chequeos y un build.

- Un nudo nuevo es solo un `KnotDef` en `src/engine/knots/`, sin código del motor específico para ese nudo. `AGENTS.md` tiene las reglas para escribir uno.
- El test de huella del bakeo falla si un cambio altera cómo se ata un nudo. Si es a propósito, explicá por qué en el PR.
- Cambios de rendimiento: incluí los números de antes y después.
- Mirá los cambios visuales en el navegador. Ningún test cubre cómo se ve.
