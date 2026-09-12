# Costo de las regresiones de tombstones bajo Valgrind

El job Linux `103488161545` del run `34669545627`, sobre `0d13903b083edf0ae4df650919927b3e43a1dfb3`, agotó el watchdog de 600 segundos durante Memcheck, después de aprobar 37 de 38 tests. El reporte original conserva `SIGTERM`, `ETIMEDOUT` y `pass: false`; su log no registró accesos inválidos ni pérdidas definitivas/indirectas antes de la interrupción. La ejecución incompleta no se presenta como una validación aprobada. Los tres archivos originales están copiados en esta carpeta.

## Cambio limitado a pruebas

Los tests usan un hasher que hace colisionar todas las claves. Llenar 7.168 entradas por escenario provoca trabajo cuadrático de búsqueda de claves en la preparación del fixture. La reserva se reduce de 4.096 a 256 entradas solicitadas, que en Rust 1.98.1 produce capacidad 448. Ese tamaño todavía supera el límite retenido `< 256`, que permanece intacto.

Se separan los casos vacío y ocho remanentes para mapas y sets. Se conservan las comprobaciones de longitud, las entradas supervivientes y la nueva entrada después de reutilizar tombstones. El caso de set vacío agrega cobertura; las pruebas grandes de 4.096 atributos de `attribute_capacity_tests.rs` no cambian. Sólo se modifica código dentro de `cfg(test)`; producción, dependencias y el watchdog de `scripts/native-memory.mjs` permanecen intactos.

## La regresión sigue siendo detectable

Hay dos contrastes distintos:

- **Costo:** `baseline-large.json` mide el binario original, con la implementación correcta y los fixtures grandes. `reduced-candidate.json` mide los fixtures pequeños contra la misma implementación.
- **Sensibilidad de los tests:** `capacity-only-mutant.patch` reconstruye temporalmente el compactor que decide con la capacidad declarada y usa `shrink_to`. Es un mutante experimental, no un cambio de producción que deba aplicarse al proyecto. Los cuatro tests pequeños fallaron contra él: la reinserción recuperó capacidad 448 en mapas/sets vacíos y con ocho remanentes. El log está en `capacity-only-mutant-tests.log`. Después se restauró íntegramente la implementación correcta.

Con el candidato, los cuatro casos pasan y conservan capacidad 29 en vacío y 37 con ocho remanentes, incluyendo la nueva entrada. No se cambian límites para obtener esos resultados.

## Costo observado

Memcheck 3.18.1 ejecutó cada test de forma aislada con origin tracking y análisis completo de fugas. Los argumentos, hashes de ejecutables, tiempos completos y logs sin supresiones están junto al informe.

| Escenario | Entradas originales por fixture | Tiempo original del test | Entradas reducidas | Tiempo reducido del test |
| --- | ---: | ---: | ---: | ---: |
| Mapas: vacío + ocho remanentes | 7.168 | 63,29 s | 448 | 0,26 + 0,29 s |
| Set: ocho remanentes | 7.168 | 29,55 s | 448 | 0,29 s |
| Set: vacío (caso adicional) | — | — | 448 | 0,27 s |

Los dos procesos originales tomaron 95,764 segundos incluyendo arranque; los cuatro procesos reducidos tomaron 7,067 segundos. La cantidad de procesos y escenarios difiere, por lo que esos totales no se presentan como una comparación de una suite idéntica. Los tiempos por test excluyen el arranque de Valgrind. Esta medición corresponde al costo del arnés de pruebas, no al rendimiento de producción.

## Validación

Formato y Clippy pasaron. Los 40 tests Rust completos pasaron sin Valgrind, incluyendo los casos grandes originales y el árbol de 10.000 niveles. La validación completa de Memcheck pasó los mismos 40 tests en **373,77 segundos**, conservando el watchdog de 600 segundos y todos sus flags originales. Su [reporte final](../../memory/2026-09-12T03-53-23.483Z-valgrind.json), stdout y log completo quedan guardados.

Memcheck registró cero errores de acceso, cero bytes definitivamente perdidos y cero indirectamente perdidos. Permanecen visibles 48 bytes `possibly lost` y 544 bytes `still reachable`, con stacks del runtime/harness Rust, como en las ejecuciones aisladas previas. No se introdujeron supresiones ni se interpretan estos resultados como prueba absoluta de ausencia de fugas.

El avance remoto `89c110d49379930a95ed878d1e62a8d89105fa63` modifica el endpoint de GC de JavaScript y sus pruebas. No cambia `src/`, `Cargo.toml`, `Cargo.lock`, `build.rs`, `package.json` ni `scripts/native-memory.mjs`; la unión conserva los mismos inputs de compilación y Memcheck. Se reutilizan estos gates nativos tras verificar esa equivalencia y la integridad final, sin atribuirles una ejecución repetida.
