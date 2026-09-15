# Rendimiento de las salidas de FileReader

El baseline publicado en `68497b6` conserva resultados correctos, pero DataURL
y UTF8 crean conversiones y asignaciones intermedias evitables. Los eventos,
estados y scheduling del host también tienen costo, que permanece incluido en
los benchmarks completos.

## Baseline y primera variante

El [baseline](../benchmarks/2026-09-15T05-26-04.858Z-linux-x64.json) midió, en
1.000 KiB, 4,228 ms para DataURL, 2,241 ms para UTF8 y 2,896 ms para Shift_JIS.
La [primera variante](../benchmarks/2026-09-15T05-52-06.474Z-linux-x64.json)
devolvió texto como UTF8 y DataURL ASCII como Latin1, evitando un Vec UTF16.
DataURL bajó a 1,797 ms y UTF8 a 1,313 ms, pero Shift_JIS subió a 8,000 ms.
Se conserva esa evidencia y no se adopta la regresión de Unicode como resultado
final. Sus 101 contratos y 1.000 ciclos de GC pasaron.

## Variante en validación

El texto decodificado ASCII usa Latin1; Unicode conserva la salida UTF16.
DataURL ASCII se construye directamente en el buffer final, sin string base64
intermedio ni Vec UTF16. Para otros MIME del API nativo se conserva cada unidad
UTF16, incluidos NUL, emoji y surrogates aislados.

Se reemplaza base64 0.22.1 por base64-simd 0.8.0, con outref 0.5.2 y vsimd 0.8.0
fijados en Cargo.lock. Su [API encode_append](https://docs.rs/base64-simd/0.8.0/base64_simd/struct.Base64.html#method.encode_append)
escribe el resultado en el String existente. Las operaciones se ejecutan
únicamente mientras el backing ordinario está prestado a Rust; devuelven
buffers propios antes de crear el string V8. No se conservan referencias JS
ocultas ni se leen buffers compartidos/desprendidos desde Rust.

Clippy, los tres tests Rust del decoder y los 102 contratos de codecs/lectores
pasaron. La regresión adicional compara contenido completo con Node en 139
tamaños, nueve offsets y MIME ASCII/Unicode: 2.502 combinaciones, incluyendo
padding y límites SIMD. Esas entradas también verifican el string binario
completo en 1.251 combinaciones.

## Salida elegida y resultados

`file_reader_output.rs` conserva un Vec propio de bytes Latin1 o unidades UTF16
hasta que las APIs seguras de N-API copian el resultado a V8. Esto permite que
el string binario use un Vec de bytes, sin expandir cada byte a u16. La única
llamada unsafe del conversor cumple el contrato ToNapiValue en el mismo env
que acaba de crear el string. No se amplía el permiso de ejecutar código N-API
dentro del préstamo del buffer de entrada.

El [benchmark final](../benchmarks/2026-09-15T06-09-26.129Z-linux-x64.json) y la
[comparación de las cuatro variantes](../benchmarks/2026-09-15T06-09-26.129Z-file-reader-output-analysis.json)
conservan todos los resultados, incluido el intento que empeoró Shift_JIS.

| 1.000 KiB | Rustdom baseline, ms | Rustdom final, ms | Cambio de mediana | jsdom final, ms |
|---|---:|---:|---:|---:|
| Texto UTF8 | 2,241 | 1,352 | −39,7% | 1,003 |
| Texto Shift_JIS | 2,896 | 2,809 | −3,0% | 5,799 |
| String binario | 1,543 | 1,309 | −15,1% | 0,971 |
| DataURL | 4,228 | 1,516 | −64,1% | 0,587 |
| ArrayBuffer | 0,813 | 0,834 | +2,6% | 0,542 |
| Aborto | 0,518 | 0,436 | −15,9% | 0,267 |

ArrayBuffer y aborto no cambiaron: sus variaciones muestran el ruido entre
corridas. Son medianas de un host con 18 muestras por motor/caso; no se calculó
un intervalo de confianza ni se atribuyen todas las diferencias al código.
Shift_JIS conserva ventaja frente a jsdom; las otras rutas siguen siendo más
lentas y el objetivo general de rendimiento continúa abierto.

La validación final pasó 241 tests Rust, 15 Jest, 26 Vitest y 26 Vitest VM. Los
[WPT de Blob/File y FileReader](../compatibility/2026-09-15T06-15-17.986Z-linux-wpt.json)
mantuvieron paridad. El [control focal de memoria](../memory/2026-09-15T06-15-42.146Z-file-reader.json)
y los [cinco modos generales](../memory/2026-09-15T06-17-11.088Z-linux-x64.json)
pasaron, sin documentos ni ventanas observados vivos al cierre. Rustdom registró
1,97 MiB de heap y 25,96 MiB de RSS de diferencia tras warmup/GC; no es memoria
pico.

Memcheck pasó 1.000 ciclos en el [control](../memory/2026-09-15T06-17-11.000Z-file-reader-performance-control-valgrind.log)
y en la [versión nativa](../memory/2026-09-15T06-17-11.000Z-file-reader-performance-native-valgrind.log):
cero errores y cero fugas definitivas/indirectas. Los remanentes coincidieron
con el baseline: 45.110 bytes posiblemente perdidos en el control, 45.226 en
el nativo y 12.956 alcanzables en ambos. Se aplicaron únicamente las dos
supresiones CppGC existentes. El helper ahora recorre los 256 valores de byte,
incluidos los bytes no ASCII; liberó los 1.000 estados nativos creados.
Son escenarios finitos, no una garantía universal de ausencia de fugas.

El paquete final tiene SHA256
`55a60089190bd5e0c7596520cd3008546c5069f526ed2683379e87690de6ec7c`.
Ese mismo archivo pasó los 18 controles de [Node 24.14.1](../distribution/2026-09-15T06-21-14.837Z-linux-x64.json)
y los 18 de [Node 22.12.0](../distribution/2026-09-15T06-23-42.972Z-linux-x64.json),
con npm/pnpm, tipos, CJS, ESM/VM, Unicode, workers y los runners reales.
El addon verificado tiene SHA256
`ccf67dfce4183b3bfbe68900512aac8889b24704cd8973a4cadd259313ce37fe`.
La validación local está completa; la revisión y los checks remotos del nuevo
commit se verifican antes de la integración.
