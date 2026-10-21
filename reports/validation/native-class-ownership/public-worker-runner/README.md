# Worker público reutilizable y preflight de fuentes

El cambio permite vincular el worker real a exports de un paquete mediante
createBenchmarkRunner. measureWorkload reutiliza la implementación original;
el CLI conserva selección, sharding, errores de engine y carga del paquete.
No se sustituyen fixtures, cuerpos cronometrados, assertions o limpieza.
Nombre y tamaño de la llamada directa se validan antes de crear un DOM.

La interfaz pasa runtime/engine/URL como argumentos en lugar de globals del
módulo. Puede cambiar el contexto de optimización de V8 aunque el cuerpo
cronometrado permanezca igual: no se presume neutralidad de rendimiento.
Los tiempos históricos de v2 no se presentan como mediciones de este harness.

## Validación real

Se ejecutó la suite completa de benchmarks: 118/118 tests por Node 22.12.0 y
24.14.1 (112 previos más seis nuevos). La copia Linux propia conserva las
fuentes exactas del workspace y un lockfile idéntico; carga el dist/addon B
ya validado, sin recompilar Rust. Se documentan por separado la fuente del
harness y la procedencia del binario, sin afirmar que dist se reconstruyó.

Las pruebas nuevas ejercen las ocho filas sobre jsdom, B y A reales, con
salidas iguales al archivo independiente histórico. Comprueban aislamiento de
contadores de parsers, rechazo de nombres/tamaños antes de allocations,
ambos motores por CLI y entornos Vitest/VM reales. No hay mocks de plataforma.
Los diez reportes CLI guardados incluyen éxitos y fallos intencionales de los
contratos existentes. Son trazas funcionales, no una comparación nueva A/A/A/B
ni una aceptación de rendimiento. Las duraciones de tests tampoco son benchmarks.

## Protección de CI

El nuevo harness tiene sourceHash
`6e0a5ffedad775ea2aa48dbd3d550e799bed86164f9b451b26035f605b6134e0`;
la huella canónica sigue enumerando 333 archivos. El método hosted antiguo
declara otra fuente. Cuando no puede reutilizar su historia, el workflow ahora
comprueba las fuentes declaradas antes de instalar toolchain, construir paquetes
o medir. Para este harness debe fallar antes de esos pasos; no cambia el gate
para obtener verde ni acepta el presupuesto.

El preflight solo compara fuentes, no distribuciones compiladas. El contrato
de manifests completos de A/B permanece independiente e intacto. Los fixtures
históricos se materializan desde los mismos snapshots inmutables verificados,
con limpieza bajo el directorio temporal propio.

Pasaron 33 contratos de preflight/historia/archivo en cada Node; los 17 de
preflight/historia/hosted también pasaron en Windows Node 24. actionlint aprobó.
La invocación real rechaza el harness actual (exit 1/declared=false) y acepta
las fuentes históricas (exit 0/declared=true), sin construir o iniciar workers.
Los archivos de evidencia históricos siguen verificándose.

## Recursos y límites

El runner retiene exports y un plan acotado mientras el caller lo conserva;
no agrega caches globales, referencias N-API, timers, listeners o DOMs al
resultado. La limpieza original y los ciclos reales Vitest/VM se mantienen.
No es una nueva demostración de liberación de Window/Document ni de ausencia
universal de fugas. La regresión de ownership anterior conserva su alcance.

No se completó una API de plataforma ni un hito de migración a Rust. El método
de comparación dentro de un proceso con afinidad del principal todavía debe
definirse, probarse y revisarse antes de medir. El PR sigue sin aceptación,
merge o tag de checkpoint.
