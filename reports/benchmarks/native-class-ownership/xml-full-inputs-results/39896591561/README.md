# XML con inputs completos: calibración válida, rendimiento rechazado

La única ejecución [39896591561](https://github.com/guidomodarelli/rustdom/actions/runs/39896591561)
terminó desde `92dd067c`, en Node 24.14.1. Conserva 468 workers, 14.976 duraciones
medidas y 33.408 duraciones de warmup. A/A pasó sus trece filas dentro de ±2%;
A/B quedó `accepted=false`: `xml-serializer-getter-error/1` dio +5,6064051645%,
por encima de +5%. No se cambian presupuestos, estimador o muestras.

Host: AMD EPYC 9V74 80-Core Processor, 4 CPUs lógicas, 6.8.0-1064-azure.
CPU 0, Rust 1.99.1, glibc 2.35 y jsdom 27.4.0. Las versiones completas, inputs
de raíz, configuración, fuentes y distribuciones antes/después están dentro
del artefacto original. A es checkpoint 066, fuente `993a1e`; B es fuente `0b485`.
La comparación incluye la migración del controlador XML del checkpoint 067;
no permite atribuir todo el delta al guard de ownership del PR #80.

`artifact.zip` conserva el transporte oficial completo: 8.537.409 bytes, SHA-256
b1e0e826b36e8f8b0fb8ce653d7d1bee1d2e2682ae86156387e3c123731738d5.
Su único tar.xz ocupa 8.534.788 bytes y conserva 7.972 archivos regulares,
85.323.956 bytes crudos y seis symlinks. `raw-members.json.gz` autentica cada
miembro; `collection.json` fija los hashes de ambos transportes. No hubo
recompresión de muestras, reintentos ni otra ejecución.

El lector verifica físicamente la preparación, el probe de recursos del
mismo UUID, fuentes, compilador, ejecutable Node, dist, dependencias y
before/after. Recalcula las 39 celdas AA/AB/reference, sus medianas,
256 muestras por etiqueta AA/AB y 64 en reference. Exige stdout/stderr
distintos vinculados al ordinal y todos los hashes públicos iguales.

Los dos consumos reales del CLI mediante Node 22.12.0 y 24.14.1 producen
`verification-node*.json` con bytes idénticos. Dos copias adversariales, con inputs
posteriores cambiados o aceptación falseada, son rechazadas. Nueve tests
con ZIPs reales pasan en Python 3.10/Linux y 3.12/Windows: cubren aceptación
histórica, A/A inválido con null y el nuevo A/B rechazado. No miden DOM.

Integridad y aceptación son decisiones distintas. `currentInputEligibilityVerified`
sigue en `false`: este lector no autoriza por sí mismo reutilizar tiempos para
fuentes actuales ni cambia el gate histórico. El resultado rechazado no
habilita tag/merge. Los gates de ownership tampoco quedan aprobados.

## Todas las filas A/B

| Operación/tamaño | A ms | B ms | Cambio % | Presupuesto |
| --- | ---: | ---: | ---: | --- |
| xml-serialize/100 | 6.553745875 | 6.710481000 | +2.391535 | dentro |
| xml-inner-serialize/100 | 7.684301250 | 7.870408375 | +2.421913 | dentro |
| xml-document-serialize/100 | 6.563006500 | 6.714018125 | +2.300952 | dentro |
| xml-serialize-error/100 | 7.674968125 | 7.744607625 | +0.907359 | dentro |
| xml-serialize/1000 | 69.716334000 | 70.351520500 | +0.911101 | dentro |
| xml-inner-serialize/1000 | 81.782981500 | 82.448305500 | +0.813524 | dentro |
| xml-document-serialize/1000 | 70.033661000 | 70.466241000 | +0.617674 | dentro |
| xml-serialize-error/1000 | 79.634350000 | 80.859651000 | +1.538659 | dentro |
| xml-serialize/1 | 0.122555844 | 0.123799484 | +1.014754 | dentro |
| xml-serialize/16 | 1.083374687 | 1.097772125 | +1.328944 | dentro |
| xml-serializer-getter-error/1 | 0.142066023 | 0.150030820 | +5.606405 | rechazado |
| xml-serializer-getter-error/100 | 6.639755125 | 6.712816375 | +1.100361 | dentro |
| xml-serializer-getter-error/1000 | 69.667696500 | 70.742020500 | +1.542069 | dentro |

Las 39 celdas completas y sus medianas originales están en `verification-node*.json`;
todos los crudos permanecen dentro del ZIP. No se usa reference como
control para normalizar o aprobar la fila que excedió su presupuesto.

## Memoria y límites

`functional.json` observa 15 Window y 15 Document por separado, tres ciclos
por cada una de cinco copias físicas, con dos endpoints finales claros.
442 workers rustdom terminan con live/references/cleanupErrors de sesiones
XML en 0. No todos los contadores nativos son 0: por ejemplo, hay workers
con `xmlParsers.live=1`. Los cierres de fixtures no prueban que cada Window
del benchmark haya sido recolectado; esa observación pertenece al probe
separado. RSS/heap son snapshots, sin picos o garantía universal de no fugas.

## Comparación directa con jsdom

En estas trece filas públicas, el motor híbrido tarda entre 4.640 y 6.301
veces el tiempo de jsdom 27.4.0. Esta deuda de rendimiento permanece visible;
aprobar otras suites no convierte estos tiempos en una mejora.
Reference usa cuatro procesos por fila, dos por motor, con 64 duraciones por motor.
Incluye el costo público del puente; no aísla Rust puro ni demuestra causalidad de un componente.

| Operación/tamaño | jsdom ms | rustdom híbrido ms | Razón rustdom/jsdom |
| --- | ---: | ---: | ---: |
| xml-serialize/100 | 1.212793875 | 6.660286125 | 5.492 |
| xml-inner-serialize/100 | 1.333064125 | 8.316416000 | 6.239 |
| xml-document-serialize/100 | 1.217383625 | 6.593564875 | 5.416 |
| xml-serialize-error/100 | 1.282675500 | 7.699797375 | 6.003 |
| xml-serialize/1000 | 15.033760000 | 70.914709000 | 4.717 |
| xml-inner-serialize/1000 | 16.630079000 | 84.035776500 | 5.053 |
| xml-document-serialize/1000 | 14.938070000 | 71.713451000 | 4.801 |
| xml-serialize-error/1000 | 15.483096500 | 81.419872500 | 5.259 |
| xml-serialize/1 | 0.019738141 | 0.124376477 | 6.301 |
| xml-serialize/16 | 0.197932750 | 1.090234500 | 5.508 |
| xml-serializer-getter-error/1 | 0.031478805 | 0.150342758 | 4.776 |
| xml-serializer-getter-error/100 | 1.298314500 | 6.758289500 | 5.205 |
| xml-serializer-getter-error/1000 | 15.380075500 | 71.363083000 | 4.640 |
