# Borrador: bloques completos de factores y shards por criterio

**No ejecutable. `executionReady=false`, sin etiqueta ni captura activadas.**
Es una propuesta de planificación y debe revisarse antes de implementar o fijar
un método. No acepta el candidato numérico ni reemplaza resultados anteriores.

## Estimando y unidad

El objetivo sería la razón de medias aritméticas sobre las 16 combinaciones
fijadas de flags/semillas/factores, con peso 1/16 por combinación, **condicional
al host asignado a cada criterio**. No se afirmaría generalización a una población
de hosts. Los ocho workloads, los dos Node, fases AA/AB, paquetes físicos
independientes y presupuestos ±2%/±5% se conservarían.

Cada réplica sería un bloque completo de 16 pares de procesos nuevos, A/B
adyacentes, con todos los factores exactamente una vez. El orden de factores
de cada bloque quedaría fijado y publicado de antemano. Las mismas 16 semillas
y flags se repetirían como factores fijos; no se agregarían duraciones al
proceso ni se reutilizarían realms. Warmup y las 144 tareas medidas por proceso
permanecerían intactos.

Por bloque se calcularía una media A y B, ambas sobre las 16 medias de proceso.
Fieller operaría sobre esos pares de medias de bloque. La razón puntual conserva
la razón entre medias de todos los procesos balanceados; **no es una media de
razones**. La unidad inferencial sería el bloque completo, con r−1 grados de
libertad, no los 16r procesos ni sus tareas internas.

Supuesto explícito pendiente de revisión: independencia aproximada de los
bloques completos dentro del host, condicionada a sus factores fijos. El diseño
no puede demostrar ese supuesto por recopilar más tareas. Hay que conservar
orden temporal, tendencias, correlaciones y límites de inferencia; no eliminar
bloques por resultados desfavorables. Un único host por criterio no permite
estimar variación entre hosts.

## Tamaño y costo provisional

Como propuesta fija anterior a medir: 16 bloques para jsdom (256 pares de
procesos, 16 unidades de bloque, t15) y ocho para Rust (128 pares, ocho unidades,
t7). Las precisiones/potencias calculadas antes con procesos iid no se trasladan
automáticamente a estas unidades de bloque; no hay potencia garantizada.

Serían 24576 procesos, 3538944 duraciones medidas, 1179648 warmup externas,
294912 Window y 294912 Document separados, tres rondas de cleanup por proceso
y dos estados finales claros. El contenedor de datos preservaría todos los
bloques, tareas, tiempos, controles rechazados y snapshots; nada se seleccionaría
mirando aceptación. No habría parada al primer verde, reemplazo de muestras ni
mezcla de históricos.

Un shard por Node × fase × engine × fila produciría 64 jobs. Cada criterio
completo permanecería en un host, sin agregar resultados de distintas VMs como
si fueran procesos independientes. Con los costos crudos de los comandos del
run 40234774968, una proyección lineal da aproximadamente 125.6 minutos para
el peor shard Rust de ocho réplicas y 106.5 para el peor jsdom de 16. Son
proyecciones sin costo futuro medido, no garantías de finalización.

Se consideraría un límite fijo de captura de 170 minutos por shard dentro de
un job de 200, con controles de timeout y preservación parcial. El método aún
no está preparado ni revisado técnicamente: falta verificar almacenamiento,
concurrencia y margen del método completo. Un timeout invalidaría la decisión
integral; no permitiría completar muestras después.

## Trabajo pendiente antes de fijar un protocolo

- Revisar estimando, inferencia de bloques, tamaño y sensibilidad a dependencia
  temporal. Rechazar este borrador si no resuelve de forma defendible la precisión.
- Decidir y calificar el candidato exacto; conservar los cambios de rendimiento
  con evidencia favorable y desfavorable sin atribuir causalidad a correlaciones.
- Implementar y probar calendario, transporte, autenticación, lectores y replay
  completo con datos sintéticos y funcionales. No ejecutar código archivado.
- Fijar pins, paquetes, artefacto hosted, matriz, conteos, estimador, límites y
  revisión prospectiva antes de habilitar una única secuencia nueva.
- Mantener el gate ownership rechazado hasta una decisión integral aceptada y
  la integración posterior probada/revisada.
