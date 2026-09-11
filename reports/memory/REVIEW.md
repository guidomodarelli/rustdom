# Revisión de ownership y recursos

Alcance: código propio de rustdom, puente Node-API y ciclo de vida de los entornos. La primera revisión incluye todos los archivos nuevos del repositorio. No es una auditoría completa de dependencias.

## Riesgos corregidos

1. **Retención de una ventana cerrada por el callback de teardown de Vitest.** El callback conservaba `dom`; ahora libera esa referencia y la función de reenvío de errores después del cierre. Las colecciones auxiliares de keys y descriptores también se vacían.
2. **Pérdida de globals anteriores.** `populateGlobal` reemplaza aliases de ventana sin guardar todos sus descriptores. El adaptador conserva y restaura esos aliases explícitamente.
3. **Inicialización parcial.** Un global `document` o `jsdom` no configurable podía interrumpir setup después de instalar propiedades que retenían la ventana. La instalación ahora hace rollback completo y cierra la ventana al fallar.
4. **Errores de ventana que no llegaban al runner.** Se agregó reenvío de excepciones no atendidas y se retiran los handlers al terminar, respetando los handlers registrados por el test.

Estos cambios tienen pruebas de comportamiento de setup/teardown, timers, descriptores, excepciones y fallos parciales. La prueba de memoria conserva deliberadamente los callbacks de teardown para detectar retenciones accidentales.

## Ownership del parser

- Cada llamada crea un `RcDom` temporal. Las referencias a padres son débiles; el árbol, la lista de visitas y los eventos pertenecen a esa llamada.
- El recorrido de salida es iterativo. Un test con 10.000 niveles verifica el recorrido y la destrucción sobre entrada profunda.
- La interfaz Node-API transfiere strings y atributos. No crea `External`, referencias persistentes a objetos V8, threads ni callbacks JS por nodo.
- El estado persistente propio del puente consiste en contadores y un conjunto finito de motivos de compatibilidad; no almacena documentos ni HTML.
- Los nombres únicos del stress test ejercitan el internado dinámico de nombres. Los resultados del proceso nativo registran heap, memoria externa, buffers y RSS tras warmup y GC.

## Interpretación de resultados

Los JSON con fecha conservan las observaciones. El escenario inicial mide documentos; el ampliado también observa los documentos de iframes, deja observers conectados y usa nombres de atributos únicos. Cada target se ejecuta en un proceso nuevo para separar heaps y caches.

Una referencia débil que desaparece demuestra que ese documento puede recolectarse en el escenario medido. Una RSS estable es evidencia de ausencia de crecimiento retenido en esa carga, no una prueba de que cada allocation se haya devuelto al sistema operativo. Los allocators pueden conservar páginas libres.

La cobertura ampliada también observa `Window` por separado. Esto es necesario porque `window.close()` puede liberar el documento sin que necesariamente se libere el proxy de ventana. Los informes anteriores sin `observedWindows` solo verificaban explícitamente los documentos.

La fase de entornos incorpora señales nativas retenidas fuera de la ventana, URLs de objetos con buffers y el pool VM. La primera prueba VM conservó por error la última referencia fuerte al contexto en el propio arnés (informe `2026-09-11T16-36-30.109Z-linux-x64.json`); al soltarla explícitamente se verificó la recolección de los 440 documentos y ventanas. Los informes fallidos se conservan como evidencia del diagnóstico.

No se ejecutaron ASan/LSan ni una campaña prolongada de fuzzing. Valgrind se incorporó en la fase de endurecimiento, con el alcance que se detalla abajo. Tampoco se verificó localmente el addon nativo de Windows o macOS; esas plataformas se ejercitan mediante CI. No se afirma ausencia absoluta de fugas fuera de los escenarios y límites guardados.

## Almacenamiento estructural nativo

El árbol almacena enlaces en Rust y conserva un grafo de referencias JavaScript para que V8 conozca las relaciones de ownership. Un Map de WeakRef resuelve los handles a los mismos objetos; FinalizationRegistry elimina las entradas JavaScript y los registros nativos. No hay referencias persistentes a objetos V8 dentro del árbol Rust.

El informe `2026-09-11T18-11-53.055Z-linux-x64.json` comprueba que `liveNodes` vuelve al valor inicial y coincide con `indexedNodes` al finalizar. También acota los handles reservados: son identificadores primitivos, sin registros de nodos hasta su primer uso. Su lote fijo de 128 se expone junto con el conteo reservado; no se oculta como memoria liberada.

Los errores del árbol viven en un módulo Rust puro; la conversión a N-API está separada. Los tests Rust no dependen de símbolos de Node ni de mocks de la plataforma. La comparación funcional incluye movimientos planos y anidados, filtros vivos, adopción, clones, rangos y rechazo atómico de ciclos.

## Medición consistente del punto final

La ejecución macOS de CI `34632388870` mostró cero objetos observados y registros nativos retenidos, pero dos muestras tardías de heap elevadas. La comprobación de referencias ocurría después de otra colección final que no se guardaba como muestra de memoria. El arnés ahora solicita GC mayor asíncrono explícito y calcula el crecimiento con `terminalMemory`, obtenido en el mismo punto quiescente que las referencias. Se conservan todas las muestras intermedias y los mismos presupuestos; una retención persistente sigue haciendo fallar el test.

## Datos, selectores y serialización

Los atributos y el texto pertenecen al registro nativo del nodo y se eliminan al liberarlo. El informe `2026-09-11T19-32-08.878Z-linux-x64.json` comprueba que `dataNodes`, `liveNodes` e `indexedNodes` vuelven al valor inicial. Se recolectaron los 880 documentos y 880 ventanas de rustdom, y los 440 documentos y ventanas de cada modo de Vitest. El crecimiento final del heap de rustdom fue 0,55 MiB; el RSS del parser nativo creció 0,50 MiB.

El motor CSS conserva como máximo 256 selectores compilados, limita las claves cacheadas a 4.096 bytes y no guarda nodos ni ventanas. Las caches de matching se destruyen al terminar cada consulta. Los tests comprueban el límite, la invalidación por lectura de datos actuales y el aislamiento entre árboles. La serialización es iterativa y rechaza ciclos de metadatos de templates en la API nativa, evitando recursión o crecimiento sin límite ante ese input inválido.

## Optimización e instrumentación nativa

La fase de rendimiento evita el JSON por nodo en HTML común y serializa el tape del parser directamente sobre un buffer. Los strings prestados se consumen durante la visita y no escapan del `RcDom`. Las dos rutas de metadatos usan el mismo `replace_data`, por lo que comparten liberación y contabilidad. No se agregaron referencias a JavaScript, threads, timers ni caches.

`2026-09-11T19-52-03.333Z-linux-x64.json` conserva el estrés final: cero documentos, ventanas y registros nativos retenidos en los escenarios observados. Los tests adversos incluyen 240 mutaciones con transiciones UTF-16, errores de selectores, pares de atributos inválidos y serialización/liberación de un árbol nativo de 10.000 niveles.

El informe `2026-09-11T19-54-13.684Z-valgrind.json` ejecuta los 14 tests Rust reales con Valgrind 3.18.1/Memcheck: 81.377 allocations, cero errores de acceso, cero bytes `definitely lost` y cero `indirectly lost`. Se conservan **48 bytes `possibly lost`**, cuyo stack pertenece a `std::thread`/`std::sync::mpmc` desde `libtest`, y **544 bytes `still reachable`** del registro de stack del runtime Rust. No hay supresiones. Esas observaciones no se presentan como cero bytes pendientes ni como cobertura del addon cargado en V8.

Los intentos previos fallaron antes de ejecutar tests por ausencia de símbolos de glibc. Se conservan sus logs. La instalación de `libc6-dbg` de la versión exacta del sistema permitió el análisis; no se sustituyó la biblioteca de ejecución. `npm run test:native-memory` requiere Linux, Valgrind y esos símbolos. CI instala Valgrind en Linux y guarda los informes completos.

## Distribución

El resolvedor privado nuevo captura funciones de carga de módulos, sin referencias a ventanas o nodos. Los exports ESM apuntan al mismo runtime CommonJS. El estrés `2026-09-11T20-23-11.454Z-linux-x64.json` vuelve a comprobar cero documentos y ventanas observados retenidos, y retorno al nivel inicial de nodos y datos nativos. El crecimiento final de heap de rustdom fue 0,53 MiB. Los consumidores de distribución cierran sus ventanas y el servidor HTTP auxiliar; los directorios temporales de instalaciones exitosas se eliminan después de verificar sus paths.

## CharacterData canónico en Rust

El texto deja de almacenarse en un campo propio de JavaScript. Los cuatro tipos de CharacterData guardan unidades UTF-16 en `TreeStore`; el accessor de compatibilidad `_data` lee/escribe ese estado. El constructor de Node/EventTarget no conserva `privateData`, de modo que la cadena inicial no queda retenida por ese argumento después de construir el nodo. Las lecturas devuelven valores al caller, sin una caché persistente de cadenas JavaScript.

Las sustituciones construyen el nuevo buffer antes de modificar el estado y devuelven el valor anterior para MutationObserver. La estructura de relaciones no cambia; los buffers se destruyen al reemplazarlos o liberar su nodo. También se inicializan y liberan nodos que nunca se insertan en un documento. `wholeText` rechaza metadata faltante con un error controlado.

El estrés `2026-09-11T22-39-35.076Z-linux-x64.json` agrega WeakRef para 1.320 nodos CharacterData por motor, valores grandes, surrogates y observers con `characterDataOldValue`. Todos los observados de rustdom se recolectaron, junto con los 880 documentos y ventanas. La memoria nativa vuelve a los conteos iniciales; el heap final creció 0,56 MiB. Este alcance no sustituye la migración pendiente de la lógica de rangos y observadores ni demuestra ausencia absoluta de fugas.
