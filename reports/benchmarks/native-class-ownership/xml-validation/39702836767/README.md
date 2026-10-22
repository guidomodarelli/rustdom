# Repetición XML cancelada por fuentes y método idénticos

El push de datos 6206cc03 activó automáticamente 39702836767. Se comprobó que
las fuentes canónicas y el método no habían cambiado frente a eaeca4af. Se
solicitó la cancelación antes de inspeccionar resultados, para evitar repetir
una secuencia idéntica. El job terminó cancelled; no equivale a un check aprobado.

Se conserva el ZIP oficial 12393697950, sus 105 entradas, el estado anterior
a cancelar, la procedencia final de GitHub y la comparación de inputs. El ZIP
coincide con el digest oficial y sus CRC. Registra 52 procesos A/A y 1.664
duraciones, sin A/B, calibración completa ni decisión de aceptación.

Las versiones, binarios, lockfile, settings, órdenes y hashes de fuentes
registrados coinciden con el resultado completo anterior. No aportan el
manifest completo de JavaScript ausente en ese protocolo. No se usa este
parcial para aceptar presupuesto ni se mezcla con las muestras de otra corrida.
La corrección de CI debe seleccionar y verificar evidencia declarada para
las mismas fuentes y receta, conservando cualquier rechazo de integridad o presupuesto.

verify.py comprueba ZIP/CRC/entradas, estados, observaciones y conteos disponibles;
devuelve accepted=null y no evalúa un presupuesto con datos incompletos.
