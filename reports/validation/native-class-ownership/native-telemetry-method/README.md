# QA del método nativo, sin captura

Esta carpeta registra la derivación y validación de
`native-mutation-telemetry-v1`. No hay procesos de diagnóstico nuevos ejecutados,
perfiles nativos nuevos ni consentimiento nuevo. La implementación y el workflow
no equivalen a autorización; no se creó/aplicó la etiqueta de captura.

`derived-code-cpu.json` y `derived-code-jit.json` son recibos externos de bytes
ejecutables/configuración y nombres del árbol generado. Se calculan con el
preparador actual sin ejecutar sus copias de código. Los recibos completos de
cada intento de derivación se conservan por separado. El sampler combinado sigue
siendo `1b773c7bc03beb024501602620fb7000efa3f220a2f35eb21145e421884bdb07`.

Pasaron cuatro contratos Python y quince por cada Node 22.12.0/24.14.1 sobre
datos auténticos existentes, modificaciones controladas y CLI reales rechazadas
antes de observar o escribir capturas. La agenda queda en 512 procesos y no se
modifica la original. Los guardas prueban rechazo de contexto local e intento 2;
no simulan Inspector ni el addon. Los prefijos RNG de fixtures históricos se usan
solo para probar igualdad/completitud de grupos, sin inventar perfiles o tiempos.

La materialización histórica reconstruye y autentica el ZIP de `39959175058`
desde sus cuatro partes, verifica tar/CRC y usa el extractor seguro actual. Solo
lee perfiles/reportes; nunca ejecuta scripts archivados. El corpus funcional de
80 workers se autentica con su recibo independiente y sirve como dato de contrato.

Actionlint aprobó ambos workflows. Los preflights de los dos Node autentican la
preparación y los binarios/inputs originales sin ejecutar DOM. Sus metadata Git
son las realmente observadas; no se normalizan para fingir un checkout limpio.
La captura/replay exige el checkout real limpio del commit fuente, comprobado
por Git, y los campos publicados del método. Los logs/iteraciones se conservan.

Estos checks no son un ensayo end-to-end del profiler nativo ni un replay
positivo de una captura de 512 procesos. Eso no puede inferirse a partir de los
perfiles jsdom históricos o de pruebas de rechazo. No hay aceptación nueva,
regresión resuelta ni evidencia nueva de memoria pico/ausencia de fugas.

El próximo paso es terminar el cierre de revisión y CI del método publicado;
solo después corresponde pedir autorización independiente para una secuencia.
Los rechazos anteriores, 26 pins y las 434 fuentes congeladas se preservan.
