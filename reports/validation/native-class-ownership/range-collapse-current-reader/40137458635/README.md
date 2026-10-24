# Lector actual del run de collapse

Se conserva la regresión real posterior al push 9d97a2f0: run.head_sha permanece
02291d6b y pull_requests[].head.sha avanza a 9d97a2f0. El lector versionado usa
la primera identidad; el run 40137458635/job 121001909695/intento 1 sigue siendo
el único observado. No se cambió el run, no se repitió captura y no se ejecutó DOM.

QA con datos reales: Linux 8/8; Windows: 7 aprobados y 1 omitido por WinError1314
(enlace de directorio, ejercido realmente en Linux). Los nueve contratos del
observador operativo corregido también quedan como datos históricos. Dos
lecturas con GitHub real conservaron exactamente los cuatro archivos del primer
snapshot. Se guardan comandos, stdout/stderr, colección, snapshots y review.

El lector nuevo y los cuatro archivos de su protocolo fueron revisados sin
hallazgos. Reutiliza el lector Git actual 18fc3458, autenticado antes de cargarlo;
no ejecuta scripts del archivo de captura. Rechaza run/fuente/intento/job ajenos,
salidas no propias y enlaces, preserva parciales y restaura GH_REPO. La versión
operativa inicial guardada en el paquete de activación se conserva como historia.

Los pins del artifact son null porque falta el resultado final autenticado.
No se ejecutaron extracción ni replay de ese resultado. Aceptación de rendimiento
pendiente, sin tag/merge; método de 563 pins/511 históricos/arnés de 434 archivos intactos y runtime
híbrido. Ver README del resultado para la invocación y los pasos terminales.
