# Productor funcional real de controles jsdom

La implementación reutiliza el muestreador, operaciones públicas, scheduler,
afinidad y runner de grupos de procesos ya probados. Solo implementa
`--functional`: ni el worker ni el controlador exponen captura científica.
La matriz fija por SDK es AB/factor0, ocho filas y dos labels, en procesos
independientes. No califica todavía la matriz científica completa.

El paquete fb06276a/artefacto12628261403/ELFa277 se autenticó y extrajo sin
reconstruir Rust ni instalar dependencias. Se fijó el fingerprint B091eaf8d por
inventario; los cuatro controles conservan sus fingerprints originales. El
manifiesto protege el root completo del paquete, incluidas dependencias, y el
worker solo carga el J0/J1 declarado. Su sidecar distingue la revisión nueva del
productor de la revisión raw reutilizada; no se reescriben headers ni identidades.

La revisión detectó un P2: el controlador invocaba el assembler sin comprobar
antes su propio SHA/política. La corrección fija c12598c8/f651981f, tipos y límites
antes de cualquier spawn/import de ese grafo. Repite el verificador completo al
terminar y exige identidad idéntica. Los probes reales añaden whitespace a cada
binding en el fixture, comprueban rechazo antes de ejecutar el verificador/DOM y
restauran bytes/Git. Pasaron dos probes por SDK, sin mocks de librerías.

La época preliminar ce15d77c se conserva separada. La época corregida c5298ad1
terminó con32 positivos y12 adversos, todos según su contrato. Sus Git fields son
los observados del fixture Linux nativo, no un SHA publicado ni una normalización
de errores. Los snapshots de fuente y correcciones previas al run se conservan.

Los adversos cubren intento de capture, tuple inválido, manifiesto cambiado,
archivo previo, output dentro del paquete y callback que falla después del primer
bloque. Se conservan las duraciones/warmup y parciales de ese fallo; el error
original llega al caller y el teardown exige las dos muestras finales claras.
`analysis.json` detalla conteos y las dos primeras rondas no claras.

Los contratos escalares/CLI pasaron22 por Windows/Linux × Node22.12.0/24.14.1
(88), más los cuatro probes de integridad Linux y la matriz real descrita.
actionlint aprobó el workflow ampliado: job25min, controlador funcional15min y
worker180s, conservando logs/artifact siempre. No se cambian presupuestos
científicos anteriores ni se repiten secuencias consumidas. La nota histórica
de ruta copiada por el template en `contracts/initial-path-failure.json` está
identificada con su origen; no fue un fallo nuevo de estos88 contratos.

El CI anterior8e9, run40291196724, terminó2/2 aprobado:19 contratos más nueve
lectores por SDK. ZIP/API/logs/manifiestos completos en `previous-ci-8e9/`; sus
13 miembros incluyen la lectura de ec57 y5be. Esa evidencia no prueba este
productor nuevo. El lector de datos corrigió una expectativa inicial de12
miembros al inspeccionar el inventario completo; no se cambió ni repitió el run.

Faltan calificación hosted del productor y capturador/transporte/envelope con
publicación/revisión prospectiva para un piloto. performanceAccepted=null,
gateReevaluated=false, científico deshabilitado; ownership sigue rechazado,
sin tag ni merge. El runtime sigue híbrido.
