# Recursos con tracing nativo: contratos

Cuatro procesos DOM separados J0/A0 en Node22.12.0 y24.14.1, con ocho cargas
cada uno. Se observaron 384 referencias Window y 384 Document, incluidos warmups.
Hubo 96 observaciones de cleanup: las 64 finales exigidas quedaron claras para
ambos tipos y baselines nativos. Dos observaciones iniciales aún no claras
permanecen conservadas; no representan dos objetos únicos ni una medida de fugas.

El wrapper no se modificó; drena y desconecta el observer al terminar y al fallar,
conservando GC y spans escalares. Node/V8 escribe los traces mediante sus propios
buffers e hilo de tracing. Los cuatro procesos terminaron correctamente. Los
probes CLI numéricos se guardan aparte y no crean Window/Document.

Los eventos nativos se conservan completos, incluidos sus nombres y argumentos.
El host y la instrumentación difieren de la captura con CPU profiler y de Azure;
no se comparan sus RSS como si aislaran memoria de Rust. Los valores de heap,
external y RSS tras GC están en los reportes de cada worker. No son picos ni
demuestran ausencia universal de fugas o retención en otros escenarios.

La captura prospectiva aún no se ejecutó. Artefacto, fuentes, metodología y
verificaciones en `reports/validation/native-class-ownership/compilation-diagnostics-method/`.
