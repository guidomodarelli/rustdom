# Reglas de trabajo de rustdom

## Comunicación

- Responder en español. Escribir en español planes, preguntas, updates, resultados, hallazgos y comentarios de review.
- Mantener código, identificadores, paths, comandos y errores literales en su idioma original. Documentar APIs con los comentarios del lenguaje apropiados.
- Avanzar autónomamente hasta completar el trabajo autorizado. No solicitar confirmaciones repetidas.

## Instalación y herramientas

- El usuario autoriza instalar las herramientas, librerías y dependencias necesarias. **No preguntarle si se pueden instalar**; instalarlas directamente.
- Preferir herramientas locales al proyecto y registrar versiones reproducibles en lockfiles. Evitar cambios globales innecesarios.
- Consultar MCP `memory` al inicio cuando esté disponible; verificar en el repositorio los hechos recuperados. Guardar hechos duraderos según el alcance del proyecto. Si no está disponible, informarlo sin inventar recuerdos.
- Antes de analizar o modificar código, aplicar `~/.agents/rules/payload-validation-boundaries.md`. En esta máquina también existe la fuente en `~/system-config/configs/.agents/rules/payload-validation-boundaries.md`. Esa regla es la fuente canónica; no duplicar ni contradecir su contrato aquí.

## Objetivo y diseño

- Construir un clon de jsdom respaldado por Rust que funcione con Jest y Vitest y priorice **máxima compatibilidad con jsdom**.
- Objetivo activo: **100% de la implementación migrada a Rust y 100% de compatibilidad verificable**. La versión híbrida y sus checkpoints son avances intermedios; no satisfacen el objetivo final. No reducir el alcance a las pruebas que ya pasan ni cerrar el objetivo mientras queden módulos o rutas delegadas a jsdom/parse5.
- Reutilizar bibliotecas maduras cuando corresponda, incluyendo `html5ever`, para evitar reimplementar trabajo existente.
- Buscar alto rendimiento mediante mediciones, no por suponer que Rust será más rápido.
- Explicar con precisión qué partes ejecutan Rust, cuáles siguen en JavaScript y qué modos utilizan rutas de compatibilidad. No presentar el motor híbrido como un DOM íntegramente en Rust.
- Mantener módulos cohesionados, identidades estables y nombres claros; evitar duplicación, abreviaciones ambiguas y extracciones de constantes sin utilidad.
- Documentar decisiones relevantes y conservar contratos públicos. Tras cambios significativos, comunicar brevemente qué se validó y qué falta.

## Testing obligatorio

- Cada parte y cada cambio funcional deben quedar bien probados. Agregar o actualizar pruebas de comportamiento, integración y regresión según corresponda.
- Antes de considerar un cambio terminado o crear su checkpoint, ejecutar los tests relevantes y comprobar que pasan. Informar explícitamente cualquier validación que no pudo ejecutarse y la causa.
- Ejercer Rust, el addon real, Jest, Vitest y las bibliotecas de plataforma relevantes. Preferir integraciones reales a mocks de librerías internas, UI o SDKs.
- No introducir mocks de bibliotecas internas o de plataforma sin una imposibilidad técnica concreta, justificada y documentada, o un pedido explícito del usuario. Conservar protecciones existentes justificadas contra timers o listeners cuando retirarlas reintroduzca problemas.
- Los tests deben comprobar comportamiento observable y contratos. No verificar strings del código fuente, imports escritos de una forma determinada ni arneses que únicamente comprueban compilación/importación.
- Comparar contra un jsdom independiente para detectar divergencias. Registrar versión de referencia, corpus, casos excluidos y diferencias conocidas. No equiparar pruebas diferenciales con una certificación completa de estándares.

## Benchmarks y resultados

- Ejecutar benchmarks reales y **guardar los resultados en el repositorio** en `reports/benchmarks/`.
- Conservar muestras crudas y resultados históricos, junto con versiones, hardware, configuración, entradas, warmup, metodología y límites.
- Comparar tareas equivalentes y verificar que producen resultados correctos. Medir el costo del puente Rust/JavaScript y de la operación completa cuando sea el objetivo del benchmark.
- Identificar qué mediciones ejecutan Rust y cuáles usan el parser original. Reportar también regresiones; no seleccionar únicamente resultados favorables.
- No afirmar mejoras sin evidencia ejecutada. Distinguir microbenchmarks, tiempo completo de suites, memoria retenida y memoria pico.

## Memoria y recursos

- Analizar posibles **memory leaks** en cada cambio relevante. No introducir retención sin límite ni fugas conocidas.
- Revisar ownership y destrucción del árbol Rust, transferencias N-API, referencias persistentes, wrappers, caches, eventos, timers, observers y teardown de cada entorno.
- Agregar pruebas de ciclos repetidos de creación/mutación/cierre y comprobar liberación de referencias donde sea observable.
- Observar `Document` y `Window` por separado: liberar el documento durante `close()` no demuestra que el proxy de ventana haya sido recolectado.
- Medir heap JavaScript y memoria externa/RSS del proceso tras warmup y GC cuando corresponda. Distinguir retención del allocator de una fuga y comparar con jsdom cuando sea útil.
- Guardar metodología y resultados de memoria en `reports/memory/`. No afirmar ausencia absoluta de fugas a partir de pruebas finitas; indicar escenarios, alcance y límites.

## Checkpoints Git

- Por cada hito de cambios bien probado y validado, **hacer commit y push** para guardar el avance.
- Crear y subir un **tag de checkpoint** que identifique ese estado funcional; utilizar nombres incrementales y no mover tags ya publicados.
- No crear checkpoints de trabajo que se sabe que falla. Incluir resultados de validación y benchmarks correspondientes cuando formen parte del hito.
- Usar una rama `feature/*` al iniciar desde una rama por defecto, salvo instrucción explícita diferente.
- El usuario autoriza crear PRs, completar sus checks y mergearlos desde la terminal de forma autónoma. Usar `main` como base; crearla si no existe. Tras cada merge, eliminar las ramas ya integradas y conservar los tags.
- Por cada PR nuevo, aplicar `codex-autofix-loop`: atender comentarios inline, generales y cuerpos de review; verificar fixes y su publicación antes de cerrar hallazgos; pedir nueva review después de cambios y comprobar el SHA revisado antes del merge. Mantener el seguimiento activo mientras haya trabajo o revisión pendiente.
- Si los PRs no se pueden mergear desde la terminal, el usuario autoriza trabajar directamente sobre `main`; no saltar checks ni protecciones que requieran intervención externa.
- Continuar con las fases pendientes después de cada hito, sin detenerse a pedir permiso para el siguiente. Mantener un registro verificable del avance y no declarar completa una fase cuya implementación siga pendiente.
- No usar force-push ni sobrescribir trabajo ajeno. La autorización no incluye publicar paquetes npm automáticamente.
