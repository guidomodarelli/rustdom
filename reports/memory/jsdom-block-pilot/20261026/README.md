# Alcance de recursos del calendario prospectivo

Este cambio procesa escalares de planificación: como máximo 32 criterios,
16384 entradas de proceso y 16 pares de medias por resumen. No importa ni
instancia un runtime DOM, no crea wrappers N-API, Window, Document, timers ni
observers. Las entradas y salidas quedan en arrays propiedad del caller; no hay
caches ni estado mutable persistente añadido. La CLI escribe un archivo nuevo
de forma exclusiva y termina.

Los seis contratos por SDK/plataforma ejercen calendarios, aritmética, entradas
adversas y creación exclusiva. Son pruebas sintéticas; no se midió heap/RSS ni
memoria pico y no demuestran ausencia universal de fugas. La implementación de
captura futura deberá observar por separado Window/Document, endpoints nativos,
tres rondas y dos estados finales claros por proceso, más snapshots del padre.
No se reutilizan endpoints antiguos como evidencia de una ejecución nueva.
