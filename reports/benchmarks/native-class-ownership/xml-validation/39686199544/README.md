# Calibración XML inconclusa del SHA 3d682ab4

La ejecución 39686199544/job119520760520 terminó con código 2, tras 208 procesos
A/A y 6.656 duraciones medidas en Node 24.14.1. No ejecutó A/B ni comparación de
referencia. complete=true significa secuencia terminada, no aceptación:
calibrated=false y accepted=null se conservan.

El control de xml-serialize/1 dio -2,256625%, fuera de ±2%. Las otras doce filas
quedaron dentro. Esto no demuestra una regresión ni acepta al candidato: los
procesos A/A ejecutaron únicamente la referencia checkpoint 66.

El ZIP original del artefacto 12385844144 coincide con el digest de GitHub.
Se conservan sus 417 entradas, stdout/stderr completos, índice y procedencia.
verify.py reutiliza sin modificar el verificador A/A histórico: verifica bytes,
CRC, observaciones originales, tiempos normalizados, medianas por fase/mitades,
conteos y la decisión de calibración. No se ejecutaron nuevas cargas.

input-comparison.json registra que los campos de binarios A/B, configuración,
lockfile y rustc coinciden con la ejecución anterior aceptada 39679501920.
Esa igualdad parcial no aporta el manifest completo de distribución JavaScript
ausente ni autoriza reemplazar este resultado por el anterior favorable. Ambos
archivos permanecen separados y con su alcance real; no se reintenta la secuencia
para elegir una corrida aprobada. El presupuesto de ownership sigue abierto.
