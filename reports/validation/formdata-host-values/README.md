# FormData: valores host y proyección de IDs

Se corrigieron los comentarios PR67 `4020958648` y `4020958655`, sobre baseline `65abdbc1214fc2fa73ca67c50133f16d43648e63` y base main `ece7d46c9cdb94eea3c23e517b341771ee9719d4`.

El runtime anterior rechazaba nombres no string devueltos por `toWellFormed`, y consultaba el iterador mutable del Float64Array de IDs. La reproducción definitiva encontró 37 diferencias en 40 filas por realm. Los `baseline-*` conservan los errores y las identidades observadas; los `setup-*` conservan una preparación inicial en la que querySelector se ejecutaba después de reemplazar String. Se corrigió esa preparación antes de implementar, sin debilitar el contrato.

## Representación

Los nombres y valores originales permanecen en los owners visibles al GC. Rust conserva índices independientes para texto y tokens host: no hay prefijos string ni colisiones entre namespaces. Un token nuevo usa la identidad de su primera entrada; appendHost/setHost rechazan tokens desconocidos o retirados antes de mutar la lista. El cache JS sólo conserva nombres con entradas activas, sin asignación al consultar nombres ausentes; se elimina al retirar la última entrada. NaN siempre crea una entrada y nunca coincide; +0/-0 coinciden, preservando el signo original de cada nombre; objetos, funciones y símbolos se comparan por identidad.

Los valores no string usan el marcador host ya existente y permanecen intactos en la proyección. Los tipos N-API ahora distinguen nombres numéricos opacos de nombres string y documentan los nuevos métodos; las firmas string anteriores permanecen disponibles. La construcción y el orden de la lista siguen en Rust. No se modificaron XML, loader ni napi_error.

getAll y _entries proyectan IDs mediante Array.from capturado sobre un array-like propio de prototipo null, con longitud tipada intrínseca. No consultan el iterador ni un getter length reemplazado del Float64Array. getAll conserva un snapshot completo de entradas antes de ejecutar getters de wrappers y crea el array final con propiedades propias. La prueba de setter heredado se activa desde un getter real del valor después de construir los argumentos WebIDL; se conserva el primer intento que afectaba al push de argumentos de ambos motores.

## Validación

- Build Rust/JS, cargo fmt, clippy sin warnings y cargo test: aprobados. Conteos exactos en summary.json.
- Node 22.12.0 y 24.20.0: 155/155 tests específicos FormData por versión, incluidos todos los contratos anteriores, errores de iterador/conversión, File/Blob, XHR y realms.
- Matriz ampliada: 84 filas por realm, default y VM, distinguiendo String host/window/ambos; nombres y valores objeto, función, símbolo, undefined, null, booleanos, números, NaN, ceros con signo, bigint y strings. Incluye igualdad, orden, get/getAll/has/set/delete/append, forEach, vistas y namespace string.
- Bindings reales: tokens futuros/retirados rechazados sin cambios, sin colisión al alcanzar posteriormente ese entryID. Rust verifica separación, posiciones, duplicados y capacidad.
- GC: un warmup y seis ciclos de 500 nombres/valores objeto o función con FormData padre vivo. Un serializer view externo conserva legítimamente las entradas retiradas; al soltarlo se liberan nombres, valores, Window y Document por separado. Cache host vuelve a null, capacidad de nombres vuelve al baseline y la lista se mantiene acotada; el teardown completo devuelve todos los contadores a baseline. Muestras crudas en ../../memory/formdata-host-values/.

## Rendimiento y límites

Benchmark en Node 22/24, con seis procesos separados, orden invertido, tres warmups y nueve muestras por proceso (18 por motor/caso/tamaño). getAll mide 100 lecturas de 100/1000 entradas; host-lifecycle mide append duplicado, set, get/identidad y delete para nombres objeto. Setup, GC y validaciones completas quedan fuera del tiempo.

La proyección segura tiene una regresión medida en getAll normal: +53%/+61% con 100 entradas y +44%/+39% con 1000 (Node24/22). Se conserva completa; no se afirma mejora. Los casos host se comparan contra jsdom: se omite baseline porque no puede completar ese contrato, evitando comparar éxito contra un fallo. Muestras, rangos, hashes y costos absolutos están en ../../benchmarks/formdata-host-values/.

El addon baseline793f se reutilizó sólo para reproducción/benchmark después de verificar 147 fuentes byte a byte; la candidata se compiló en este clon. Los artefactos quedan identificados por sus hashes. Las pruebas son finitas: no certifican ausencia universal de fugas ni toda compatibilidad DOM. No se repitieron validate ni paquete completos: el coordinador validará obligatoriamente la unión. Los demás outputs generados permanecen archivados localmente según generated-report-archive.json.
