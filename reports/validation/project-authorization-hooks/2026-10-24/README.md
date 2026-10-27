# Hooks de autorización operativa

Se instalaron y registraron las tres definiciones de contexto para
SessionStart, UserPromptSubmit y PreToolUse. hooks/list las devolvió como
trusted y enabled en el repositorio principal y el worktree de ownership.
La confianza se registró con config/value/write usando los hashes devueltos
por Codex después de la revisión local, mediante su interfaz normal.

La suite usa Git real, worktrees reales y el ejecutable instalado en un
directorio temporal. Aprobó 15 pruebas en Linux/Python3.10 y 14 en
Windows/Python3.12. Windows omitió una prueba porque crear un symlink requiere
un privilegio ausente; esa prueba aprobó en Linux. La instalación Windows
real preservó el symlink ya existente del config hacia los dotfiles del
usuario, así como su política, hooks y estado de confianza anteriores.

Siete invocaciones adicionales del hook instalado verificaron los tres
eventos en ambos roots y el silencio en otro proyecto. Los archivos de la
instalación permanecieron iguales tras las llamadas. Los roots locales y
las copias privadas del config permanecen en la instalación de la máquina;
este informe publica hashes, resultados y logs de pruebas, sin copiar el
config privado ni los argumentos de herramientas del usuario.

El comando registrado se ejecutó además con el payload real de PreToolUse
desde cmd.exe, Windows PowerShell5.1 y PowerShell7: las tres comprobaciones
devolvieron additionalContext y exit0. No se ejecutó la herramienta pendiente.

Durante la preparación se detectó que Git2.34 no admite -z para worktree
list. Se sustituyó por el formato porcelain con core.quotePath=false y
decodificación literal de paths citados. Las pruebas finales ejercen los
paths reales con espacios y Unicode en ambas plataformas. El primer intento
de consultar el socket del daemon compartido encontró el socket inactivo;
se usó el transporte stdio oficial del app-server sin crear una conversación
ni ejecutar un modelo. Esos diagnósticos permanecen en los registros locales.

El cambio es de instrucciones y hooks de contexto; no modifica el DOM ni
acepta rendimiento. Los 511 pins del método b63cf834 y la captura única
40113188886 permanecen intactos. La captura de ownership sigue pendiente de
su decisión final. Los límites del análisis de memoria del hook se explican
en reports/memory/project-authorization-hooks.md.
