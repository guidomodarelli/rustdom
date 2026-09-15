# Validación del contrato de iteración XML

Alcance: métodos de iteración de `childNodes` y `attributes` en las firmas nativas `serializeXml` y `serializeXmlForest`. Referencia independiente: `w3c-xmlserializer` 5.0.0, dependencia de jsdom 27.4.0. No se alteran las particularidades compartidas de processing instructions ni system identifiers.

La reproducción inicial encontró 68 fallos entre 158 pruebas: tipo de excepción para resultados primitivos, diagnóstico de Symbol, métodos de iteración no invocables y acceso observable a `globalThis.Symbol`. Los casos de identidad de excepciones y precedencia de `return()` ya pasaban. El reporte inicial conserva los resultados esperados y obtenidos por escenario.

Decisiones:

- Crear `TypeError` mediante Node-API, conservando la clase intrínseca y los unidades UTF-16, sin consultar constructores reemplazables ni convertir valores lanzados por callbacks.
- Capturar la clave de iteración y el formateador de símbolos una vez por entorno N-API. La captura obtiene el prototipo desde un símbolo creado por Node-API; no depende de `globalThis.Symbol`. Un único contenedor pertenece al entorno y se libera en su finalización. Recargar el addon en el mismo entorno reutiliza ese contenedor. El contador `references` sigue midiendo las referencias temporales de cada serialización; el contenedor fijo de intrínsecos vive durante la vida del entorno.
- Mantener referencias del DOM únicamente durante la serialización síncrona. Los getters y callbacks continúan ejecutándose sin un préstamo mutable del estado del entorno.
- Mantener el cierre del iterador solo para errores del cuerpo y preservar el error original ante fallos de `return()`.

Límite: la captura inicial presupone que `Symbol.prototype.constructor` y `Symbol.prototype.toString` todavía son los intrínsecos del entorno. Las pruebas cubren sustitución de `globalThis.Symbol` antes de cargar el addon y sustitución de globals/métodos después de la carga; no afirman compatibilidad frente a un prototipo de Symbol ya manipulado antes de la inicialización. Los mensajes de iteración siguen el runtime Node/V8 comprobado; esto no certifica todos los motores JavaScript.

Resultados ejecutados en Linux x64 (WSL Ubuntu 22.04), Node 24.14.1, addon N-API 8:

| Gate | Resultado |
| --- | --- |
| Build nativo release + build JavaScript | Correctos |
| `cargo fmt --check` | Correcto |
| `cargo clippy --all-targets -- -D warnings` | Correcto |
| `cargo test --locked` | 220/220 |
| Contratos XML focales | 347/347, incluidos 164 casos nuevos |
| Compatibilidad completa de `npm test` | 1465/1465 |
| Jest | 8/8 |
| Vitest | 19/19 |
| Vitest VM (forks y threads) | 26/26 |

Los logs completos se conservan en `reports/validation/xml-iterator/`. El addon validado tiene SHA-256 `f7ead1ad18d917300ef105ad00f057cbdda11a8e30a92ae907572dc56bfe0114`.

Node 22.12.0: 164/164 contratos focales correctos. GC ampliado: 15/15 ciclos alcanzaron dos muestras consecutivas sin supervivientes observados; al finalizar, `Window`, `Document`, nodos, callbacks, iteradores y errores tuvieron cero supervivientes, junto con cero serializaciones y referencias temporales nativas y cero errores de limpieza. Se conservan todas las rondas en `reports/memory/2026-09-15T13-51-01.788Z-xml-serialization.json`. Son pruebas finitas de esos escenarios, no una afirmación de ausencia absoluta de fugas. Pendiente de completar: benchmark aislado. Windows y macOS no se ejecutaron localmente; corresponden a la matriz de CI.

Memoria: después de completar los primeros cinco escenarios como calentamiento, el heap pasó de 29.570.064 a 30.903.048 bytes, la memoria externa permaneció en 3.015.071 bytes y el RSS pasó de 160.788.480 a 169.885.696 bytes. Las muestras incluyen el propio reporte, que acumula trazas escalares durante los 15 ciclos; no son una medición de memoria pico ni permiten atribuir por sí solas el crecimiento a una fuga o al allocator. La evidencia de liberación corresponde a las referencias débiles y contadores comprobados en cada ciclo.