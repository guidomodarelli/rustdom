# Identidad de las distribuciones del método v2

Esta validación corrige el contrato de identidad de
`main-affinity-public-v2`. No ejecuta la secuencia completa A/A + A/B ni
produce una nueva decisión sobre rendimiento. El parcial v1 y sus snapshots
permanecen bajo la custodia del archivo correspondiente; no se usan como v2.

## Evidencia independiente y alcance

`pinned-manifests.json` conserva los manifests completos obtenidos de los
paquetes originales A/B y comprobados por igualdad profunda contra
`packages.distributions.A0` y `B` de `paired/2026-10-21/index.json`. Incluye
el SHA-256 de ese index histórico, los paths originales, los digests de
fuentes y el diff de paths, tamaños y hashes de las distribuciones. No se
recompiló ningún paquete para obtenerlos.

Cada distribución incluye 569 archivos. No hay altas ni bajas entre A/B;
solo cambian `dist/native-build.json`, `dist/rustdom.node` y `package.json`.
Los 560 archivos `.js`, `.cjs` y `.mjs`, incluido `dist/index.cjs`, son
idénticos byte a byte. Esto describe el alcance de los artefactos congelados;
no atribuye una diferencia de rendimiento a ningún componente.

Los digests completos fijados son:

| Paquete | Digest SHA-256 de `fingerprint(root, ['dist', 'package.json'])` |
|---|---|
| A | `d360853908d14614fb552c5578e300ce9b7b28dc6925f6558d14e5631e2dc248` |
| B | `efc4f2df4eface0daeb4cd2ea045ee6ffd3ff7ccc2c3425ed0fb050fa13c012d` |

## Contratos ejercidos

`identity.spec.cjs` usa copias físicas de las fuentes y distribuciones reales,
con un link a las dependencias compartidas. Nunca altera los originales ni
mockea `captureSourceIdentity`, `fingerprint`, el proceso o el filesystem.
Añade un salto de línea real a `dist/index.cjs` de cada copia y comprueba que
el hash de fuentes y el del addon permanecen iguales.

El driver real rechaza esos paquetes antes de iniciar cualquier worker:
`node22-rejections/rejected-before-A` y sus equivalentes contienen
`complete=false`, el manifest real distinto, `failure` y `runs=[]`. Los
snapshots del método incluidos en esas carpetas pertenecen únicamente a
esta prueba de rechazo, sin muestras de rendimiento.

El guard que se ejecuta al finalizar el driver se prueba sobre las mismas
copias: acepta el preflight, rechaza la distribución cambiada después y
vuelve a aceptar sus bytes originales tras restaurarlos. Se ejecuta el guard
final de producción directamente para evitar una secuencia de 64 workers
solo para introducir una alteración deliberada.

El verificador offline rechaza listas alteradas aunque conserven un campo de
digest fijado, manifests finales diferentes, manifests ausentes, metadata
que solo contiene digests y la revisión v1. Los `index.json` de las carpetas
`invalid-*`, `missing-*` y `digest-only-*` son inputs negativos deliberadamente
incompletos del verificador, sin observaciones inventadas ni aceptación de
rendimiento; no son archivos de un estudio.

Las pruebas funcionales existentes de `main-affinity.spec.cjs` ejecutan tres
workers reales por Node: A, B y jsdom independiente. Conservan sus stdout,
stderr y sidecars bajo `node22-functional` y `node24-functional`. Comprueban
las ocho filas públicas, la paridad de salidas, la afinidad, los errores y la
aritmética de los presupuestos. Sus duraciones son trazas funcionales y no se
utilizan para decidir si el presupuesto del estudio aprueba.

## Ejecución y límites

Las salidas crudas de los contratos y de las pruebas funcionales acompañan a
`validation.json`, que registra comandos, versiones y resultados. Los
comandos requieren `RUSTDOM_MAIN_AFFINITY_BASELINE` y
`RUSTDOM_MAIN_AFFINITY_CANDIDATE` apuntando a los paquetes originales fijados.
`RUSTDOM_DISTRIBUTION_IDENTITY_TEST_OUTPUT` y
`RUSTDOM_MAIN_AFFINITY_TEST_OUTPUT` reservan directorios nuevos para preservar
sus resultados. Las copias temporales de los contratos se eliminan al
terminar cada proceso de tests.

No se alteraron fuentes de producción, `dist`, los workers cronometrados,
operaciones, timers, muestras, umbrales ni teardown nativo. No fue necesario
un build Rust o una instalación. La captura del driver retiene un número
acotado de entradas de manifest por estudio; no agrega listeners, referencias
N-API ni caches globales. Esta revisión de ownership del tooling no demuestra
una ausencia absoluta de fugas del DOM. La verificación positiva de un archivo
completo v2 queda para la única secuencia posterior del método corregido.
