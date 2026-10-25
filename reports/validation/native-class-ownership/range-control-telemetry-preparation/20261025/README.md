# Evidencia de preparación AA, sin captura

qa.zip conserva 2711 miembros: comandos, logs, planes, manifiesto de las 434
fuentes, tres derivaciones y las ocho fuentes realmente ejercidas. members.json
enumera tamaños y hashes; no ejecutar código de este ZIP. Usar el productor
actual desde un checkout Git real para reproducir.

HEAD observado: 0dd82141 más ocho archivos nuevos sin trackear, conservados en
sourceChanges. No se presenta como un commit integrado ni un checkout limpio.
Los recibos CPU/JIT finales enumeran 893 archivos cada uno; summary.json fija
hashes del ZIP, recibos, runtimes y cobertura. El primer prepare exploratorio
mantiene su contexto observado de siete archivos; la validación final conserva
las ocho fuentes completas y la restauración del estado scoped de Python.

Pasaron cinco contratos por Node22.12.0/24.14.1 y seis de preparación real.
No se ejecutó DOM, profiling o una medición nueva. captureImplemented=false;
performanceAccepted=null y gateReevaluated=false. Los mapas son evidencia
de esta preparación, todavía no un registro que habilite captura.
