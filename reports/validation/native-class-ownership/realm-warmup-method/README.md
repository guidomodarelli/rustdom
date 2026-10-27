# Calificación del warmup por ventana

Node22.12.0 y24.14.1: 23 tests por versión (9 contratos de worker,4 de warmup,
6 de runtime predeterminado y4 de realms). Se ejercen jsdom y addons oficiales
A0/A1/B, sin recompilar ni modificar la preparación. Las ocho salidas públicas
conservan sus hashes históricos. El verificador rechaza metadata de warmup
ausente y liberación falsa; el ensayo anterior permanece verified/rejected.

Por Node, los16 lotes funcionales y40 de workers observan672 Windows y672
Documents por separado. Endpoints finales claros y estadísticas nativas de
vuelta al baseline; las1008 duraciones de ambos Node son validación funcional,
no un ensayo de aceptación. Los tests del modo predeterminado incluyen CLI
real, Vitest normal/VM y release de owners. Crudos, comandos, PIDs, resultados,
versiones, fixtures, fuentes completas e intentos previos se conservan en el
tar y raw-files.json, con readback exacto. El fallo inicial de aserción usaba
rangeClones (cloneContents) en lugar de rangeStates (cloneRange/StaticRange);
queda preservado como histórico y corregido en los tests finales.
El primer test del CLI también conserva dos fallos por dependencias locales
ausentes. Se instaló con npm ci desde el lockfile, sin tocar las copias oficiales
ni los lockfiles, y se repitieron esos tests funcionales después de resolverlo.
La preparación mínima de microbenchmarks no incluye src/environments; los
tests predeterminados de Vitest usan el paquete completo ya calificado para
las suites, con el mismo dist oficial B. También se conserva ese fallo de setup.

No se repitió la captura de optimización. El nuevo estudio untraced aún no
se ejecutó; presupuestos y gate siguen sin aceptar. El alcance prospectivo de
operaciones calientes está explícito en REALM-WARMUP-PROTOCOL.md. No aporta
crédito de implementación Rust ni una prueba universal de ausencia de fugas.
