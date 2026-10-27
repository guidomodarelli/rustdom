# Validación funcional del productor, sin estudio de rendimiento

Se conservan dos épocas completas y separadas. Los directorios `node-*` son la
primera ejecución funcional del fixture Git ce15d77c, previa al binding explícito
del verificador detectado en review. Pasaron sus casos, pero **no califican la
corrección posterior**. No se eliminan ni se combinan con la época final.

`fixed-auth/node-*` corresponde al productor corregido, fixture Git Linux real
c5298ad1. Su HEAD privado y estado limpio son los observados; no se atribuyen
al commit publicado8e9. Los controles J0/J1 provienen del paquete sellado fb06276a,
verificado antes y después con el assembler/política autenticados previamente.
El ELF a277 permanece íntegro, pero esta fase solo ejecuta jsdom27.4.0.

La época final ejecutó 16 positivos y seis adversos por SDK22.12.0/24.14.1:
32 positivos y12 adversos. Se preservan todos los comandos/PID/exit/stdout/stderr,
inputs, payloads raw, sidecars, paquetes verificados y snapshots parentales.
Los positivos conservan 4608 duraciones y1536 warmup. Los dos fallos deliberados
del callback conservan32 warmup adicionales y sus parciales; no son muestras
faltantes que deban completarse ni se incorporan a un estimador de rendimiento.

Se observaron 386 Window y386 Document por separado en34 procesos con DOM,
tres rondas por proceso y dos endpoints finales claros. Dos primeras rondas
no claras quedan conservadas. Los otros diez procesos adversos rechazan entradas
o escritura antes de crear un DOM. El análisis y recursos están en
`reports/validation/jsdom-block-pilot/worker/20261026/` y
`reports/memory/jsdom-block-pilot/worker/20261026/`.

Estos tiempos prueban la invocación funcional y su contrato, **no equivalencia,
potencia ni aceptación de rendimiento**. No se ejecutó un piloto científico,
no hay observaciones estadísticamente elegibles (`analysisObservation=null`) y
se conserva el rechazo histórico de ownership. El runtime de producción sigue
híbrido. Los endpoints finitos no prueban memoria pico ni ausencia universal de fugas.
