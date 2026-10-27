# Calibración XML inconclusa de 767aca43

CI 39693070050/job119543728758 terminó con exit 2 después de 208 procesos A/A
y 6.656 duraciones en Node 24.14.1. La fila xml-serializer-getter-error/100
registró -2,610390%, fuera de ±2%. Las otras doce filas calibraron. No ejecutó
A/B ni comparación de referencia: calibrated=false y accepted=null.

El ZIP original del artefacto 12389184971 coincide con el digest oficial
23ac55576ef5aa0510ba7ce67cc921ee367811c37552694968d5add0034740e7.
Se conservan sus 417 entradas y stdout/stderr íntegros. verify.py reutiliza el
verificador A/A histórico sin alterarlo; recalcula bytes/CRC, observaciones,
normalización, medianas, conteos y decisión. No genera nuevas mediciones.

Los campos registrados de binarios A/B, configuración, lockfile y rustc
coinciden con el resultado anterior 39679501920. Esa igualdad parcial no aporta
el manifest completo de JavaScript ausente en ese protocolo ni autoriza elegir
el histórico favorable. El resultado actual se conserva sin aceptación.

A/A ejecutó únicamente la referencia checkpoint66, por lo que no demuestra
regresión del candidato del PR ni de la compilación local C, todavía sin publicar.
Este resultado tampoco acepta el presupuesto de ownership ni habilita merge/tag.
