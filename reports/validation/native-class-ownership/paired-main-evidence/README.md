# Verificación del archivo pareado completo

Tres tests aprobaron en Linux Node 22.12.0/24.14.1 y Windows Node 24.14.1.
Ejercen el archivo real completo de 64 workers/9.216 duraciones, conservando
accepted=false y la fila A/B fuera de presupuesto. Copias privadas alteradas
demuestran rechazo de aceptación falsa y de Window retenido aunque el worker
declare clear=true y se actualice el digest del reporte. Los originales no se
modifican y los temporales propios se eliminan con verificación de path.

Esto valida la integridad y los contratos del verificador. No recoge nuevas
muestras, acepta rendimiento ni amplía cobertura de APIs DOM.
