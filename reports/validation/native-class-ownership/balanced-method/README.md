# Contratos del diagnóstico A/A contrabalanceado

Se reutilizan paquetes físicos reales de la preparación anterior:
`/tmp/rustdom-paired-copies-xkeEqd/manifest.json`. Su manifest completo está
archivado en `../paired-method/packages.json`. Rust A0/A1 son copias del mismo
checkpoint 67 y J0/J1 del mismo jsdom 27.4.0; no se sustituyen addons ni módulos.

## Evidencia que motivó el diagnóstico

`context-diagnostic.json` recalcula las medianas de todas las nueve muestras
por etiqueta, proceso y tamaño del estudio `paired/2026-10-21`. Conserva hashes
del índice y de cada reporte original. jsdom A/A de 250 tiene B más lento en
siete de ocho procesos; el rango por proceso va de −66,51% a +257,29%. Rust A/A
de 1.000 va de −47,86% a +139,52%. Es análisis descriptivo posterior al estudio,
sin nueva aceptación, ajuste de datos, inferencia de causalidad ni p-valores.

## Contratos ejecutados

Con `RUSTDOM_PAIRED_MANIFEST` apuntando a ese manifest:

```sh
node --expose-gc --test reports/benchmarks/native-class-ownership/balanced-worker.spec.cjs
```

Node 22.12.0: 6/6, 41.959 ms. Node 24.14.1: 6/6, 36.955 ms. Los logs originales
se conservan en `node22.log` y `node24.log`. Incluyen las ocho asignaciones del
plan, cuatro workers completos (ambos motores, celdas 0 y 7), probes simétricos,
hashes originales, 144 duraciones medidas y 192.000 copias públicas incluyendo
warmups por Node. La negativa de sobrescritura conserva el reporte previo.

La review nativa aislada encontró un P2 real: `mkdirSync(..., recursive: true)`
aceptaba un destino creado por otra invocación después del chequeo de existencia.
Se reemplazó por una reserva exclusiva del directorio final, antes de preparar
los paquetes. El nuevo séptimo contrato usa el filesystem real: reserva una ruta
anidada, conserva un índice de otro owner y exige `EEXIST` en el segundo intento.

```sh
node --expose-gc --test --test-name-pattern='reserves the output directory' \
  reports/benchmarks/native-class-ownership/balanced-worker.spec.cjs
```

Ese focal pasó 1/1 en ambos Node; logs `reservation-node22.log` y
`reservation-node24.log`. Los seis contratos anteriores se reutilizan porque
el worker no cambió después; no se presenta esto como otra matriz completa.
La segunda revisión nativa aislada cerró sin hallazgos antes de medir. Las diez
fuentes congeladas y los cinco archivos de evidencia previa están identificados
en `before-performance.json`; sus hashes coinciden al terminar la corrida.

## Diagnóstico completo y contratos del verificador

La sesión `94932` terminó con exit 1. Los 16 procesos, 576 duraciones y 768.000
copias públicas incluyendo warmups están archivados en
`reports/benchmarks/native-class-ownership/balanced/2026-10-21/`. Los 64 archivos
del manifest conservan código, stdout/stderr, comprobante terminal y raw.
Rust A/A varió −2,1335%/−0,3293% y jsdom −31,7389%/−7,5229% para 250/1.000.
No calibró: no se ejecutó A/B y no se acepta el rendimiento del candidato.

Después de medir, `balanced-evidence.spec.cjs` ejerció el archivo real y copias
físicas privadas de sus observaciones. Sus cinco contratos recalculan toda la
corrida y rechazan aceptación falsa, checksum público incorrecto, asignación
física errónea y retención de Range en un endpoint obligatorio. Las mutaciones
refrescan el hash interno para comprobar contratos más allá de corrupción
accidental; el original permanece intacto. Pasaron 5/5 en Node 22.12.0 y
24.14.1, con logs `evidence-node22.log` y `evidence-node24.log`. No generan
nuevas muestras de rendimiento. Este test posterior no es una fuente congelada
de la medición ni modifica las diez fuentes anteriores.

## Memoria y límites

Cada uno de los 192 samples por Node cierra su Window y ejecuta las tres rondas
fijas del helper canónico; los últimos dos endpoints de Window y Document son
claros. Los contadores de Range regresan a cero en los workers Rust. El probe
crea exactamente un Range en cada módulo y registra cero en el otro módulo en
ambos sentidos. No agrega referencias persistentes ni caches; sus resultados
son escalares. Esto no mide memoria pico ni demuestra ausencia universal de
fugas. No hay modificaciones de producción y se conserva su validación amplia.

El protocolo `BALANCED-PROTOCOL.md` limita la medición posterior a A/A. Una
calibración eventual no acepta el rendimiento del candidato B. El presupuesto
original, merge y tag siguen pendientes.
