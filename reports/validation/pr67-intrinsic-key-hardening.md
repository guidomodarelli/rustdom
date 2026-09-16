# Captura de Symbol.iterator desde un realm limpio cuando faltan las fuentes host

El finding `4020396445` del PR 67 está corregido localmente. Si se eliminan las claves de Array e IteratorPrototype a la vez, o se corta la cadena del generador mientras falta la clave de Array, el addon obtiene el símbolo desde un realm nuevo con intrínsecos intactos. Los caminos anteriores continúan siendo perezosos y conservan los escenarios que ya funcionaban.

Base verificada: `7d3c5b38c7b21aacf3a0a1169c56210136368247`, `feature/native-form-data`; `main`: `ece7d46c9cdb94eea3c23e517b341771ee9719d4`. Clone directo de GitHub, copia propia en `/home/guido/rustdom-pr67-key-hardening-MVfhx4`. Se compararon package.json/lockfiles antes de reutilizar dependencias por un symlink de lectura. No se modificaron los clones del coordinador, FormData ni `src/dom/napi_error.rs`.

Binario de referencia: `69e8d98086fcd873dfcb08785999edd2fe595686c63ffcf3f14d8b4705d28b95`. Binario corregido: `31ee9ce18d6aba25bc563215c6b3e2a623d8c5f0d62c921d0327a07752f34411`.

La captura de realm documentada en este hito se retiró posteriormente: la implementación usa ahora el símbolo propio de arguments estricto, sin prototipos ni loader mutable. Ver [pr67-loader-hardening.md](pr67-loader-hardening.md).

## Decisión de implementación

La captura conserva Array y el generador como rutas previas. Si la cadena del generador termina en null, esa fuente se considera no disponible. Cuando ninguna ofrece la clave, el addon usa las APIs públicas [process.getBuiltinModule](https://nodejs.org/api/process.html#processgetbuiltinmoduleid) y [vm.runInNewContext](https://nodejs.org/api/vm.html#vmruninnewcontextcode-contextobject-options) para ejecutar únicamente `Symbol.iterator`. `getBuiltinModule` existe desde Node 22.3.0, anterior al mínimo 22.12.0 del proyecto; ambos runtimes soportados se ejercieron realmente.

El sandbox tiene prototipo null para que un atributo Symbol heredado del host no oculte el builtin del realm nuevo. El resultado debe ser un Symbol y se verifica con el probe de `for…of`, por identidad de protocolo y no por descripción. El array de verificación define su elemento propio mediante Node-API, evitando setters heredados. No se consulta el servicio de built-ins si alguna ruta anterior funciona: dos contrapruebas reemplazan su getter por una función que falla y pasan sin invocarla.

Sólo el símbolo primitivo cruza el boundary del realm y se conserva. El sandbox, el objeto del módulo VM y sus funciones quedan en el handle scope. El ObjectRef por Env, `instance_data` y su finalizador no cambian. No se emplea ABI privada V8 ni se agrega un export o bootstrap público al loader: el addon directo también resuelve la captura.

Esta captura usa pequeñas operaciones JavaScript y APIs de Node; la serialización permanece en Rust. El resultado no constituye una implementación íntegramente Rust ni certifica compatibilidad completa. Las APIs de Node forman parte del boundary de bootstrap de la ruta extrema; no se agregan como requisito de los caminos anteriores.

## Reproducción y contratos

Oracles independientes: w3c-xmlserializer 5.0.0 y jsdom 27.4.0. El serializador de referencia se carga antes de las mutaciones y recibe iterables propios. El addon se carga después. Los casos públicos restauran los globals antes de importar las demás dependencias de JSDOM, y comprueban que la serialización pública usa el addon ya inicializado; no afirman que todas las dependencias de jsdom funcionen con Array.iterator eliminado.

El binario de referencia falla en siete de las dieciséis matrices. Las combinaciones cubren ambas claves eliminadas, cadena cortada, Symbol/String/Array ausentes, getters de Symbol.constructor/toString y un Symbol heredado host que arroja. También se conservan las ausencias individuales, getters, símbolos falsos de igual descripción y las contrapruebas del loader de built-ins.

Cada Worker repite cuatro cargas y ejerce serialización correcta, resultado primitivo de next, error del cuerpo con causa e IteratorClose. Los contadores demuestran invocación nativa y ausencia de referencias/calls activos al terminar. Dos matrices adicionales verifican el XMLSerializer público sobre un DOM real después de inicializar el addon en las combinaciones extremas.

## Validación ejecutada

Linux x64 en WSL Ubuntu 22.04, Rust/Cargo 1.98.1, Node 24.20.0 y 22.12.0, N-API 8.

| Gate | Resultado |
| --- | --- |
| Rojo sobre referencia | 7 fallos / 16 matrices |
| Node 24: matrices de claves + iteradores XML + diagnósticos | 199/199 |
| Node 22: mismas suites | 199/199 |
| Build nativo release | Correcto |
| `cargo test --locked xml` | 9/9; 240 tests fuera del filtro |
| Formato y Clippy `--all-targets -- -D warnings` | Correctos |
| GC de realms, 24 cargas por runtime | Correcto |
| DOM/XML después de forzar captura limpia | 15/15 ciclos por runtime |
| Regresión de diagnósticos/causas/formatter | 12/12 ciclos |

Los logs se guardan en `reports/validation/pr67-intrinsic-key-hardening/`; sólo se normalizaron finales de línea y espacios finales. Los JSON conservan las observaciones completas. El primer arnés de GC usaba assert.ok mientras Array.iterator estaba eliminado; se movieron las aserciones fuera de esa mutación. La salida `realm-memory-node24.fixture.log` es un fallo del arnés descartado, no un resultado del gate final.

La validación de la unión, paquetes y matrices globales queda en el coordinador; no se afirma haberla repetido en este subtrabajo.

## Recolección del realm y del DOM

`intrinsic-realm-memory.cjs` usa la API pública `v8.getHeapStatistics`, sin handles internos. Tras calentar el módulo VM, el baseline tenía un native_context y cero detached_contexts. En las 24 cargas de cada versión, el conteo subió a dos antes de GC y volvió a uno después de GC; detached_contexts permaneció en cero. Se alternaron ambas claves eliminadas y cadena del generador cortada, también sin los globals Symbol/String/Array. Cada carga ejecutó XML y comprobó su TypeError real.

Evidencia final: `reports/memory/2026-09-15T22-02-49.595Z-intrinsic-realm-contexts.json` y `reports/memory/2026-09-15T22-02-50.052Z-intrinsic-realm-contexts.json`. Las muestras anteriores también se conservan, pero no incluían el conteo previo a GC.

Para comprobar el DOM, se forzó primero la captura limpia desde el addon real y después se ejecutaron los quince escenarios XML existentes: `reports/memory/2026-09-15T21-59-13.951Z-xml-serialization.json` y `reports/memory/2026-09-15T21-59-15.624Z-xml-serialization.json`. Se observaron Window y Document por separado, junto con nodos/callbacks/iteradores/errores. La regresión adicional de formateador, causas y errores está en `reports/memory/2026-09-15T21-59-17.044Z-iterator-diagnostics.json`.

Son pruebas finitas de liberación observable. No se afirma ausencia absoluta de fugas ni se interpreta RSS como memoria pico o como prueba aislada de una fuga.

## Inicialización normal y fallback

Se amplió el benchmark existente con `--include-hardened`, conservando su modo de dos artefactos. En una ventana exclusiva se ejecutaron 45 Workers secuenciales: tres warmups y doce muestras por variante, con orden rotado. El modo endurecido elimina las dos claves host antes del intervalo y las restaura después; la validación de XML y errores, la salida del Worker y GC quedan fuera del tiempo medido.

| Variante | Mediana (ms) | Mínimo (ms) | Máximo (ms) |
| --- | ---: | ---: | ---: |
| Referencia normal | 0,7823 | 0,6574 | 0,8374 |
| Candidato normal | 0,7708 | 0,6774 | 1,1668 |
| Candidato con captura de realm limpio forzada | 1,6758 | 1,4847 | 1,8529 |

La diferencia normal observada fue −1,46%, con rangos superpuestos; no se afirma una mejora. El tercer valor es costo absoluto de un camino nuevo, no una comparación equivalente con la referencia, que no puede cargarse en ese escenario.

Tras nueve Workers de calentamiento, el heap del proceso pasó de 5.035.808 a 5.100.424 bytes, RSS de 70.074.368 a 72.409.088 y la memoria externa permaneció en 2.158.639. El informe acumula muestras escalares; no es memoria pico. Todos los Workers completaron las operaciones y la salida.

Hardware, versiones, configuración, hashes y muestras crudas: `reports/benchmarks/2026-09-15T22-04-15.200Z-xml-intrinsics-init.json`. Memoria por salida de Env: `reports/memory/2026-09-15T22-04-15.200Z-xml-intrinsics-envs.json`.