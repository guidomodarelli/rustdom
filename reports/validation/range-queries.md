# Consultas de Range en Rust

`comparePoint`, `isPointInRange` e `intersectsNode` ahora usan operaciones
nativas completas para sus decisiones. Rust comprueba raíces antes que tipo
y offset, preserva las diferencias entre las tres APIs y reutiliza el comparador
de puntos. El binding traduce resultados tipados a DOMException en el realm
del nodo o del Range, según el comportamiento original.

No se agrega estado persistente de Range. El comparador interno acepta offsets
u64 para no estrechar índices de hijos; los argumentos públicos conservan sus
conversiones WebIDL u32. La longitud para validación reproduce la omisión de
CDATA de jsdom27.4.0, por lo que no se reclaman correcciones de estándares en
esa familia. Setters, representación y otras operaciones de Range quedan
pendientes de migración.

Pasaron formato, Clippy, **71 tests Rust** y ocho contratos focales de Range,
incluidos errores entre tres realms y orden de validación. El
[foco WPT](../compatibility/2026-09-12T08-09-04.692Z-linux-wpt.json) mantuvo
paridad en los 22.988 casos y los 922 fallos compartidos documentados.
La validación completa pasó **71 tests Rust, 253 contratos Node, 7 Jest,
11 Vitest, 4 VM y 1.784 casos HTML5**. El
[informe completo](../compatibility/2026-09-12T08-16-31.666Z-linux-wpt.json)
mantiene **26.517 casos en paridad, 25.587 aserciones de estándares aprobadas
y 930 fallos compartidos**. Rendimiento, memoria y distribución se registrarán
al terminar sus ejecuciones.

El [benchmark](../benchmarks/2026-09-12T08-19-52.444Z-linux-x64.md) registra
1.000 conjuntos de comparePoint/isPointInRange/intersectsNode, con preparación
y validación fuera del reloj, cuatro procesos alternados y muestras completas:

| Nodo consultado | Filas | jsdom | rustdom | Ratio |
| --- | ---: | ---: | ---: | ---: |
| Element | 250 | 5,025 ms | 2,650 ms | 1,90× |
| Text | 250 | 5,950 ms | 2,933 ms | 2,03× |
| Element | 1.000 | 5,443 ms | 3,054 ms | 1,78× |
| Text | 1.000 | 6,348 ms | 3,922 ms | 1,62× |

El [estrés](../memory/2026-09-12T08-20-28.300Z-linux-x64.json) pasó en ambos
motores: 1.000 Range, 882 Document/Window y 1.500 nodos comparados recolectados,
con nodos/datos nativos en cero. Rustdom registró heap +1,92 MiB y RSS +18,08 MiB;
se conserva toda la variación y no se interpreta RSS como memoria pico o prueba
aislada de fuga. El
[Memcheck focal](../memory/2026-09-12T08-21-31Z-range-queries-valgrind.log)
pasó las tres pruebas de decisiones/errores sin errores ni pérdidas definitivas
o indirectas. Los residuos posibles/alcanzables del runtime permanecen visibles
sin supresiones; no se afirma haber repetido el análisis completo de V8.

El [paquete instalado](../distribution/2026-09-12T08-21-24.383Z-linux-x64.json)
pasó los 18 controles npm/pnpm. Su SHA-256 es
`e82f74937ac42423f44851e6b7aac0e6c971c6af66143c6b4f7fd6dbb6e07256`.
