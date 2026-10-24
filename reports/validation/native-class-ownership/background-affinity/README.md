# Calificación real del contraste de afinidad auxiliar

Node22.12.0 y24.14.1:13/13contratos por versión, sin omisiones. Se ejecutaron
40workers reales por Node: cinco copias físicas y las ocho cargas completas.
Se conservaron hashes públicos, flags/RNG, Window/Document separados y endpoints
nativos previos a la salida. No se aceptó rendimiento ni se ejecutó el estudio.

El tar conserva todos los archivos regulares de QA final y de los dos intentos previos,
incluyendo fuentes, logs, muestras funcionales, procesos y recibo de interrupción.
La revisión encontró una carrera de propiedad del reporte y luego un sentinel
negativo insuficiente; ambos se corrigieron antes de QA final. El segundo intento
terminó12/13 porque /mnt/c no admite FIFO; se corrigió usando un pipe temporal
Linux real, con limpieza. Ninguno de los intentos previos se cuenta como aprobado.
Los FIFO de sincronización carecen de payload persistente;
se enumeran en receipt.json y sus efectos reales están en logs y sentinels.

Las422fuentes quedaron idénticas al snapshot. Las415fuentes anteriores permanecen
intactas. El build oficial39720077911 se restauró y verificó físicamente completo;
no se recompiló ni se sustituyó. Las muestras de QA no se utilizan para decidir,
seleccionar o certificar rendimiento. El método requiere publicación/autenticación
antes de una única secuencia prospectiva. CI y migración completos siguen pendientes.
