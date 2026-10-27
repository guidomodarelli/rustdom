# Calificación local del candidato de owners agrupados

Git base f781c3b7; diez fuentes y patch cb784c2f fijados por source.json.
Addon Linux f8c8af92763844a1128742126fbd2139b748c699a93d1c1b13245a517b3e3ec3,
Rust 1.99.1 y Node 22.12.0/24.14.1 oficiales, con hashes de ejecutables preservados.
La variante sigue aislada y el runtime híbrido; no tiene benchmark ni aceptación.

Por SDK pasaron seis contratos nuevos, 84 dirigidos, consumidores reales CJS/ESM,
3784 pruebas de compatibilidad más nueve de procesos, 22 Jest, 33 Vitest, 34 VM,
1784 casos HTML y WPT con 240 fixtures/83007 assertions. Se preservan ocho exclusiones
HTML, una exclusión WPT, una suite bloqueada y 1203 fallos compartidos con jsdom.
complete=false: no es una certificación total de estándares ni de compatibilidad.

local-qualification.zip conserva 288 miembros con stdout/stderr íntegros, comandos,
reportes, addon, metadata de build y reproducción de fuentes. summary.json incluye
el manifiesto y SHA256 del archivo y de todos sus miembros. Los datos de memoria
se copian sin normalizar a reports/memory/static-range-owner-batch/20261025/.

public-cli-qualification.zip conserva otros 150 miembros: el comando público de CI
se probó de punta a punta en Node 24 desde una preparación Git real, con 24 comandos
aprobados, sin cambios ni normalización de procedencia. Su addon tuvo el mismo SHA.
Los cuatro contratos de preparación pasaron en Windows y Linux, preservando fuentes
sucias/salidas ajenas y rechazando configuraciones transitivas alteradas antes de aplicar.
Las expansiones de sparse-checkout conservaron sourceChangesRaw exactamente.

El primer build funcional se interrumpió con 143 por una ubicación temporal que no
persistía. Un tmpfs inicial se perdió al apagarse WSL; sus logs efímeros no se
recuperaron. La evidencia preservada corresponde a una ejecución completa posterior,
con keeper y /dev/shm. No se repitieron ni añadieron muestras científicas. Las copias
anteriores de QA cuya limpieza fue rechazada por policy siguen conservadas.

El workflow nuevo tiene matriz Linux/Windows/macOS × ambos SDK, 60 minutos por job
y 40 para calificar. Actionlint pasó. La matriz funcional remota todavía está
pendiente; esta evidencia local no se presenta como Windows/macOS validado.
No ejecutar programas del ZIP: reconstruir desde Git y el patch revisado actual.
El rendimiento y su método prospectivo nuevo siguen pendientes; los rechazos
históricos, incluido run40184510898, permanecen intactos. No hay tag ni merge.
