# Verificador y transporte de evidencia real

Los28contratos pasaron en Node22.12.0 y24.14.1, sin omisiones:21del replay de
datasets completos y7del transporte. Los CLI reales conservan exit1 para un
presupuesto rechazado y exit2 para inputs/integridad incompatibles. No cargan
el addon ni ejecutan nuevos tiempos DOM. También se probaron dos rechazos de
datos alterados en el diagnóstico; el caso positivo autentica2051archivos.

qualification.tar.gz conserva todos los logs finales, procesos, fixtures JSON,
fuentes exactas, recibos, baseline Git, guards originales y antecedentes fallidos.
raw-files.json identifica cada miembro; receipt.json confirma el readback.
Los datos grandes usados por las fixtures están publicados por separado en
row-isolation-results/2026-10-22/ y seeded-pre-gc-results/2026-10-22/. Las rutas
absolutas conservadas son las de la ejecución original; al reproducir en otra
máquina deben apuntar a copias de esos mismos bytes y a nuevas salidas propias.

Los logs definitivos se escribieron directamente en Windows tras recuperar los
datasets en un directorio persistente de/home. Los recibos de una calificación
anterior en/tmp se perdieron y no se usan como prueba final. Se conserva un
intento de recuperación fallido antes de los tests por un ref incorrecto,
corregido en la continuación. scope.json documenta ese límite, la ausencia de
stderrGit de aquel intento y el diagnóstico histórico sin binding de inputs.

El estudio de rendimiento completo sigue rechazado por siete controles jsdom.
Esta calificación comprueba replay, integridad, errores y transporte; no acepta
rendimiento, no agrega APIs Rust y no equivale a una aprobación GitHub remota.
