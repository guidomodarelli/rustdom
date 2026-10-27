# Perfil actual separado de la autenticación histórica

Este incremento prepara la vinculación de fuentes para la confirmación futura.
No implementa ni habilita el productor científico, no autentica un paquete de
runtime por sí mismo y no acepta rendimiento. `source.cjs` solo admite inspección.

En dos checkouts Git Linux reales se conservaron separados:

- El origen 4196c496, limpio, con sus 903 archivos históricos y recibo fijado.
- La fuente 7b600278 con los tres archivos nuevos del inspector sin commitear.
  `sourceChangesRaw` conserva exactamente ese estado; no se presenta como
  un productor científico limpio ni se sustituye su identidad por la histórica.

El perfil funcional abarca 947 archivos actuales, los 344 inputs completos del
candidato y doce contrapartes históricas que ahora difieren. Conserva ambos
digests; no cambia los pins ni el recibo original. El hash canónico de runtime
es 78fcc857. El propio inspector también debe coincidir con los bytes perfilados.
Los perfiles son idénticos entre SDK; sus recibos de procesos registran los
ejecutables reales de Node 22.12.0 y 24.14.1 por separado.

Pasaron ocho tests por SDK: inspección y CLI reales, estado Git sin normalizar,
copias físicas, cambio de Rust, overrides, archivo sellado cambiado, inspector
diferente, alias de roles y gitfile Windows. La primera versión omitió ocho
archivos de raíz/types del grafo; el fixture físico lo detectó y ahora exige
todos los inputs. Otro intento del fixture excedió el buffer de `git status`;
se corrigió usando sparse checkout real y un límite explícito. Los fallos están
conservados y no produjeron muestras científicas.

`qualification.tar.gz` conserva 30 archivos, 399.910 bytes, SHA-256
`2be06d7e1e6b8c3efba5e7a9cdcc73800fc57e6e4d026f26b49a1ba760e4d42c`.
Se releyeron todos los miembros y `manifest.json` conserva tamaños y hashes.
Se incluyen las dos calificaciones de ocho tests; la final movió el rol y la
opción CLI a constantes sin cambiar el comportamiento. La configuración del
workflow en el perfil funcional pertenece al commit padre, mientras que el
workflow nuevo se validó con actionlint y añadirá estos tests en CI.
No ejecutar fuentes archivadas. Actionlint verificó la adición de estos tests
al CI existente. Revisión local aislada sin hallazgos materiales.

No se ejecutó DOM, se reconstruyó un paquete ni se midió memoria pico. Los
objetos del perfil y sus descriptores se limitan a la invocación; los tests
esperan a los hijos Git y eliminan únicamente sus directorios temporales.
No se afirma ausencia universal de fugas. Faltan la vinculación de invocaciones,
productor/lector integral, revisión/publicación y la secuencia científica única.
`executionReady=false`, `performanceAccepted=null`, `gateReevaluated=false`.
