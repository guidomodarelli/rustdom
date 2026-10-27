# Recursos de la auditoría de Range

No se cambia el runtime con esta entrega. Los nuevos registros del inventario
contienen rutas, hashes y texto; no almacenan objetos DOM. El contrato público
adicional cierra cada Window en finally y solo devuelve strings, números y
booleanos para la comparación entre motores.

La QA de Range conserva sus pruebas reales de GC para estado, clones,
extracciones, documentos vivos con slots débiles y exports ESM persistentes.
Comprueban controles retenidos deliberadamente, liberación posterior y
Window/Document separados. Los logs de ambos Node están en el archivo de QA
de reports/validation/inventory-range-audit/20261024/; incluyen los diagnósticos
escalares que emiten esas pruebas. No se afirma que esos logs contengan todas
las trazas internas descartadas por los procesos hijos.

El primer intento omitió copiar el helper de la prueba ESM: sus demás 69
contratos pasaron y ese error se conserva. La preparación corregida ejecuta
los 70 sin omisiones. Los contratos del inventario también verifican tres
ciclos de recolección de Window/Document mientras retienen los reportes JSON.

El binario es A0, con fuentes mapeadas de Range iguales a las inspeccionadas;
estas observaciones no validan el guard de ownership del PR ni el candidato
de collapse. No se midió RSS/heap ni memoria pico en esta auditoría; tampoco
se infiere ausencia universal de fugas de estas pruebas finitas. El estudio
de rendimiento en curso conserva su secuencia y su decisión independiente.
