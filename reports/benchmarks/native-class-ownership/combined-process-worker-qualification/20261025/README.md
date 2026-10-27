# Calificación funcional del worker combinado

El archivo conserva 64 procesos funcionales, 32 por Node22.12.0/24.14.1,
con ocho filas, ambos engines y ambos labels, fase AB/posición0 fija.
Incluye los 192 warmup, 576 duraciones, 768 Window y 768 Document separados,
stdout/stderr, sidecars, manifiestos y todas las rondas de cleanup.
Los controles A y jsdom independiente permanecen completos; no se seleccionan
resultados favorables ni se aplican presupuestos a esta calificación.

evidence.zip conserva además derivaciones originales y corregidas, sus fuentes,
las inspecciones sin DOM, los contratos, replay en ambos Node y la reproducción
del CI en Git Linux real. El manifiesto autentica cada miembro. No ejecutar código
archivado: los lectores actuales verifican datos y entradas físicas originales.
El replay funcional requiere esas entradas originales y no es replay integral
transportable. La ejecución local se solapó con contratos de lectura/CI; los
tiempos son evidencia funcional, sin inferencia de rendimiento.

No se activó la captura prospectiva de 2048 procesos. executionReady=false;
performanceAccepted=null y gateReevaluated=false. Los rechazos históricos
permanecen. El candidato no está integrado y el runtime sigue híbrido.
