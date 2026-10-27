# Candidato de owners agrupados: CI funcional 6/6

El run 40205226009, intento 1, fuente db348de1f5be2f9fbe5b6da01f4e10a5f94fdf9d,
aprobó sus seis jobs de Linux/Windows/macOS × Node 22.12.0/24.14.1. La corrección
de preparación quedó verificada en runners reales. Cada calificación terminó
con 24 comandos aprobados y ambos consumidores extra completos. No equivale
a aceptación de rendimiento ni cumplimiento completo de estándares.

Se conservan los seis artifacts íntegros, metadata API, manifiestos de todos sus
miembros, preparación y calificación originales, logs y reportes de compatibilidad
y memoria incluidos en cada ZIP. Las calificaciones preservan el Git real base
f781c3b7, sus cambios por patch/pruebas y sourceGitErrors=[]; no se normalizan a
un checkout limpio ni al SHA del workflow. Los casos deliberadamente corruptos
de las fixtures también forman parte del archivo. No ejecutar helpers archivados.

La selección prospectiva Ubuntu/Node22 corresponde al artifact 12604810857,
ZIP 5987246 bytes SHA256 4e8be7c8582ef957fea3c1430036c5b2ee5d98d42a58c998680592a999730839.
Su ELF es 4b52a84d4f1b6f434e0b0160c5799c406f68671e2db3bb6b6fd936d1977a8d73,
distinto del ELF local f8c8af92. El futuro paquete debe conservar esta diferencia
y los controles históricos originales; no reconstruirlos para calibrar resultados.

El checkout principal que compiló el addon aporta nueve de las diez fuentes
cambiadas como archivos, además de registrar los diez hashes en preparación y
calificación. scripts/build.mjs falta bajo ese prefix, pero el ZIP sí conserva dos
copias físicas parcheadas en las fixtures positive-source de original-contracts
y shallow-contracts, ambas SHA4621ca5c… igual al esperado. No se atribuyen esas
fixtures al checkout compilador. Para una fuente completa debe fijarse el origen
canónico autenticado de ese archivo; source.json mantiene su hash. No reconstruir
ni sustituir el addon.

Los dos checks Native class ownership continúan rechazando el presupuesto del
estudio anterior. Este CI funcional mantiene performanceAccepted=null y
gateReevaluated=false. El runtime sigue híbrido; no habilita tag ni merge.
