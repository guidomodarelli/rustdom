# Captura única de collapse activada

El SHA `02291d6b7a234a26ffaf364a1f377766e2338e7a` aprobó los ocho checks requeridos antes de aplicar una sola vez
`ownership-range-collapse-v1`. Run [40137458635](https://github.com/guidomodarelli/rustdom/actions/runs/40137458635),
job `121001909695`, intento1. Autorización permanente: no pedir permiso ni
reaplicar etiquetas, relanzar o completar muestras. Presupuestos ±2%/±5%, captura
de 175 minutos dentro de un job de 180 minutos y todos los pins permanecen intactos.

Los cuatro ZIP del CI de contratos40135020053 se conservan íntegros con API,
logs, CRC, tamaño/digest y manifiestos completos: 14 tests de paquetes y 19 del método
por Node 22.12.0/24.14.1. El checkout Linux real del SHA publicado está limpio;
`--plan`/`--preflight` dan resultados idénticos entre los dos Node fijados, sin
invocar el sampler. Las identidades originales de las preparaciones se conservan.

También se conservan los siete ZIP de reportes del CI general: validación en
tres sistemas y los cuatro shards de benchmarks, con API, logs, CRC, manifiestos
y cada miembro autenticado. El checkout de ese CI es el merge sintético
`28236ed8b1da003a9770c6c20ae3945767c12267`, vinculado por sus padres al head
`02291d6b`; se preserva sin normalizarlo. Son muestras del CI existente, no
una repetición ni aceptación del nuevo estudio.

El activador pasó 7 contratos y el observador 8. Revisión aislada final sin
hallazgos: se cerraron el reemplazo no atómico del watch y el pin prematuro de
runs omitidos de otras etiquetas. La intención y los eventos exclusivos impiden
repetir el POST incluso ante una respuesta incierta. El observador exige PR80,
SHA, fecha del journal y job `compare` iniciado antes de fijar un run; después
consulta exclusivamente ese run/job y conserva fallos o rechazos.

El estado de activación autoritativo es `activation/`, respaldado por el sidecar
privado `watch-80.range-collapse-02291d6b.json`. No se reemplazó el watch compartido
ni sus autorizaciones/cambios concurrentes: sus contadores anteriores no revocan
los eventos del journal. `operator-source-data.tar.xz` preserva código operativo
como datos históricos; no ejecutarlo para activar otra secuencia.

El resultado está pendiente. No hay aceptación de rendimiento, reevaluación del
gate histórico, tag ni merge de ownership. Preservar ZIP/tar y parciales aun
ante fallo/rechazo; leer con código actual y ambos Node fijados. Los snapshots y
pruebas finitas no miden memoria pico ni garantizan ausencia universal de fugas.
Runtime híbrido; migración general pendiente; 48 entradas ajenas preservadas.
