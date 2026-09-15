# Diagnósticos intrínsecos de iteración XML y FormData

Los findings `4019357298` y `4019357304` del PR 67 están corregidos localmente. XML deja de capturar o invocar `Symbol.prototype.toString`; FormData deja de consultar `globalThis.String` para describir un resultado primitivo de `next()`. Ambos conservan el `TypeError` real que produce el motor, incluidas las unidades UTF-16 y su realm.

Base: `dce2472a1f093c6d9e4a768ffe454a5c4b2d3348`, rama `feature/native-form-data`, `main` verificada en `ece7d46c9cdb94eea3c23e517b341771ee9719d4`. Clone directo desde GitHub y copia propia en `/home/guido/rustdom-pr67-diagnostics-QUN2d1`. Se reutilizaron dependencias por symlink de lectura tras comparar ambos lockfiles y package.json. El runtime de referencia de DCE se consumió solamente para lectura desde `/home/guido/rustdom-pr67-validation-0VAe7q/dist`.

## Decisiones

- El helper compartido pertenece a `src/dom/napi_error.rs`, que ya contiene la traducción Node-API usada por XML y FormData. Construye un iterable efímero de prototipo `null` y entrega a su `next()` el primitivo que el iterador del consumidor ya devolvió. Una operación `for…of` genera el error intrínseco; `capture_pending_error` conserva el objeto original sin coerción.
- No vuelve a leer ni invoca el iterador del consumidor: la lectura de `next()`, sus efectos, su orden y `IteratorClose` permanecen en sus controladores originales. No modifica `capture_pending_error`, causas, ownership, `instance_data` ni finalizadores. El contenedor XML por Env sigue siendo un único ObjectRef y conserva únicamente la clave de iteración.
- El helper se crea dentro del handle scope de cada fallo, sin cachés ni nuevas referencias persistentes. Elimina también la retención del antiguo formateador si una función reemplazada antes de cargar el addon capturaba un DOM.
- La iteración de los datos y la construcción/serialización siguen en Rust. Esta pequeña operación JavaScript se usa solamente para obtener el diagnóstico exacto del motor. No representa una implementación íntegramente Rust ni completa la compatibilidad global del proyecto.
- Los valores del plan de muestreo y fixtures permanecen locales; no son contratos compartidos del producto.

## Verificación funcional

Runtime: Node 24.20.0 y Node 22.12.0, Linux x64 en WSL Ubuntu 22.04, Rust/Cargo 1.98.1, addon N-API 8. Oracles independientes: jsdom 27.4.0 y w3c-xmlserializer 5.0.0.

SHA-256 del binario DCE: `1f5cb1d86c660f6e1681638474c64e45d6de6c84b67919c5cc70be6a1b452f83`. Candidato: `367531b6ec645ba26ee0b296ec31ce24e0eebeed8861d73f51505cd3ed255b8a`.

| Gate | Resultado |
| --- | --- |
| Rojo DCE, fixture final y runtime completo de referencia | 10 fallos / 14 matrices |
| Matrices nuevas Node 24.20.0 | 14/14 |
| Matrices nuevas Node 22.12.0 | 14/14 |
| Regresiones XML + FormData Node 24 | 396/396 |
| Regresiones de iteradores XML + FormData + matrices Node 22 | 223/223 |
| Rust completo | 249/249; doc tests sin casos |
| Build nativo release | Correcto |
| `cargo fmt --check` y `cargo clippy --locked --all-targets -- -D warnings` | Correctos |

Las matrices nuevas cubren dos puntos de iteración XML, controles y opciones FormData, realms default/VM, doce primitivos (incluidos Symbol, bigint, NaN, NUL y surrogate aislado), getters y funciones reemplazadas. Usan Workers nuevos por motor/escenario y verifican contadores de invocación nativa positivos, liberación de llamadas/referencias y ausencia de `return()` ante un resultado primitivo. Las pruebas existentes conservan recargas de addon, globals modificados después de inicializarlo e identidad/realm de excepciones.

Los primeros borradores del fixture incluían una consulta de selector después de reemplazar String y luego un override incompleto del directorio de runtime. Se corrigió el fixture antes de tomar el rojo final; el contador positivo de llamadas nativas impide aceptar ese falso negativo. Esas salidas preliminares se conservan como exploratorias, no como evidencia del gate final. Los logs de validación normalizan solamente finales de línea y espacios finales; las observaciones JSON conservan todos los casos.

La suite global Jest/Vitest/VM y la matriz Windows/macOS corresponden a la validación de la unión del coordinador; no se afirma haberlas ejecutado aquí.

## Memoria y excepciones

`tests/helpers/iterator-diagnostics-memory.cjs` pasó en Node 22 y Node 24. Primero instala antes del import un formateador que captura un Window/Document real, lo restaura después del import y comprueba la recolección de ventana, documento y callback. Después ejecuta doce ciclos, alternando realms default y VM; cada ciclo genera cien fallos XML y cien FormData con String reemplazado. También comprueba identidad y causa de errores en `next()` y en el cuerpo, y la precedencia del error original cuando `return()` arroja otro error.

Los doce ciclos de cada versión alcanzaron dos muestras consecutivas sin supervivientes observados de Window, Document, callbacks, iteradores, errores ni causas. Los contadores de referencias XML y llamadas FormData volvieron a cero. El escenario XML general adicional pasó sus quince ciclos.

Entre el primer y el último ciclo, Node 24 pasó de 37.534.552 a 39.298.144 bytes de heap, de 144.490.496 a 146.874.368 bytes RSS y mantuvo 3.309.755 bytes externos. Node 22 pasó de 36.490.800 a 38.233.440 bytes de heap, de 133.173.248 a 134.352.896 bytes RSS y mantuvo 2.866.664 bytes externos. Las muestras incluyen el reporte que acumula estados escalares; no son memoria pico ni distinguen por sí mismas el allocator de una fuga. La evidencia demuestra liberación observable en estos escenarios finitos, no ausencia absoluta de fugas.

Reportes: `reports/memory/2026-09-15T19-49-56.868Z-iterator-diagnostics.json`, `reports/memory/2026-09-15T19-49-58.738Z-iterator-diagnostics.json` y `reports/memory/2026-09-15T19-50-00.415Z-xml-serialization.json`.

## Benchmark de la ruta de error

Se ejecutaron cuatro procesos secuenciales en una ventana exclusiva, alternando DCE/candidato. Cada proceso alterna batches XML/FormData, con tres warmups y nueve muestras medidas de cien errores por operación. Hay dieciocho muestras medidas por versión/operación. Se verifican tipo, mensaje y contadores nativos. GC ocurre antes de cada muestra, fuera del intervalo.

| Operación, 100 errores | DCE mediana (ms) | Candidato mediana (ms) | Diferencia observada |
| --- | ---: | ---: | ---: |
| XML nativo + captura del error | 1,0240 | 1,1915 | +16,4% |
| Constructor público FormData + captura del error | 1,3463 | 1,3816 | +2,6% |

La versión corregida fue más lenta en ambas medianas; no se afirma una mejora. La diferencia equivale aproximadamente a 1,68 microsegundos por error XML y 0,35 microsegundos por error FormData en esta ejecución. No se generaliza a operaciones exitosas: la nueva operación efímera se invoca sólo cuando `next()` devuelve un primitivo.

El intervalo incluye llamada nativa/constructor y comprobación del tipo/texto del error; excluye import, construcción del fixture, GC explícito y teardown. No había globals modificados durante el timing: esos contratos se verifican por separado. Hardware, versiones, configuración, hashes y muestras crudas se conservan en `reports/benchmarks/2026-09-15T19-53-20.036Z-iterator-diagnostics.json`.