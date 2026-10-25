# Validación del lector de recursos

El lector se probó en Git Linux real sobre 74ec308b con sus archivos nuevos sin
commitear, conservados como tales en la procedencia. Los datos corresponden a la
calificación funcional original de 64 procesos; no se ejecutó DOM ni se añadieron
mediciones. El estudio científico 40184510898 sigue fijado a 95e64bd2.

Pasaron tres contratos por SDK oficial 22.12.0/24.14.1: exportación íntegra de datos,
rechazo de retención/baselines alterados/entradas modificadas/alias de directorio,
y cierre de escritores ante errores reales EFBIG. Ocho errores por SDK conservaron
los 22 descriptores iniciales. Actionlint y el checkout separado de 738 dependencias
pasaron; los 724 archivos científicos y los 599 pins históricos no cambiaron.

qa.zip conserva 88 miembros: cuatro etapas de la validación, sus logs, comandos,
fuentes exactas y scripts de calificación solo para auditoría. No ejecutar código
archivado. summary.json registra tamaños y SHA256 del ZIP, sus miembros y cada
exportación. La etapa final es combined-resource-export-qualification-20261025-ci-alias.

Los CSV/JSONL resultaron idénticos byte por byte entre SDKs; las salidas de memoria
conservan separadamente las versiones, hashes y procedencia reales del lector.
performanceAccepted=null y gateReevaluated=false. Falta el CI remoto de este nuevo
lector; su workflow independiente no modifica ni reinicia el experimento activo.
