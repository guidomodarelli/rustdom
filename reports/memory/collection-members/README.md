# Memoria de HTMLCollection

Mediciones del 20/10/2026 en Linux x64/WSL2. Fuentes, versiones, comandos,
checksums y archivos crudos en el
[inventario de evidencia](../../validation/collection-members/evidence.json).

## Ownership de las colecciones

La prueba de 30 escenarios pasa en Node 22.12.0 y 24.14.1. Incluye los motores
reales, realms default/VM y owners retenidos/liberados. Dos casos nuevos
mantienen únicamente los IDs numéricos y los nombres, mientras se exige que
Document, Window, nodos y colección se recolecten por separado y que los
contadores nativos vuelvan al baseline. El transporte permanece legible.

Rust no incorpora un owner del DOM ni una caché global de nombres. La lista
JavaScript conserva sus owners existentes; cada actualización reemplaza la
instantánea de números. El conjunto de deduplicación y los strings temporales
Rust pertenecen a la llamada y se destruyen al finalizarla.

## Estrés general después de warmup y GC en Node 24.14.1

| Modo | Documentos retenidos/observados | Ventanas retenidas/observadas | Heap JS, MiB | RSS, MiB |
|---|---:|---:|---:|---:|
| jsdom | 0/1.762 | 0/882 | +2,75 | +2,74 |
| rustdom | 0/1.762 | 0/882 | +1,95 | +13,24 |
| native | 0/0 | 0/0 | +0,02 | +0,25 |
| vitest | 0/1.760 | 0/880 | +4,09 | +25,35 |
| vitest-vm | 0/1.760 | 0/880 | +3,72 | +26,38 |

Los cinco modos aprobaron. Son valores posteriores al GC y cierre, no memoria
pico ni diferencias causales frente al hito anterior. El modo native mide
recursos propios sin instanciar Document/Window; 0/0 no prueba su recolección.
La memoria externa y todas las muestras están conservadas en los JSON crudos.

## Memcheck

Valgrind ejecutó los **275 tests Rust en nueve lotes** sobre el mismo binario de
debug identificado en los reportes. Todos terminaron correctamente:

- **0 errores** de Memcheck.
- **0 bytes definitivamente perdidos** y **0 indirectamente perdidos**.
- Se conservan **48 bytes posiblemente perdidos** y **548 alcanzables** por
  proceso. Los stacks corresponden a thread-local, canales y harness de tests
  de la biblioteca estándar; coinciden con el control de Rust 1.99.1 anterior.

No se suprimieron esos diagnósticos ni se cambiaron los controles para aprobar.
El último lote incluye la prueba de árboles profundos y tomó unos 329 segundos
bajo instrumentación. No es una medición de rendimiento del producto release.

Estos controles finitos detectan retenciones en los escenarios ejecutados;
no demuestran ausencia absoluta de fugas en todos los inputs y plataformas.
