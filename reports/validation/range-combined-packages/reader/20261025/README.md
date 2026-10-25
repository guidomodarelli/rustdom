# Lectores de artifacts y hooks: QA real

Seis contratos del lector aprobaron en Windows/Linux sobre un artifact auténtico
anterior usado solo como fixture. Comprueban hashes, procedencia, comandos,
binarios alterados, transporte recalculado, paths ambiguos y rechazo del CLI
público sin binding completo. La matriz histórica del fixture falló: no sustituye
la matriz preseleccionada40168321423 que aún sigue viva ni prepara el candidato.

La copia de controles aprobó la verificación final en Node22.12.0/24.14.1. Los
hooks de autorización aprobaron15 pruebas Linux y14 Windows; el caso de symlink
Windows se omitió por privilegios y pasó en Linux. SessionStart/UserPromptSubmit/
PreToolUse recuerdan autorización permanente dentro de los roots instalados.
No modifican políticas del host ni ejecutan argumentos de herramientas.

Se conservan dos fallos de preparación del comando de pruebas Linux: expansión
del glob por zsh y ausencia de tomli en Python3.10. Se resolvieron con un runner
Python y la dependencia fijada instalada en un entorno local. No fueron fallos
del hook. qa.zip conserva comandos/logs/código y manifiestos por miembro.
No ejecutar scripts archivados. No hubo DOM, estudio, reconstrucción, nueva
aceptación de rendimiento ni reevaluación de resultados históricos.
