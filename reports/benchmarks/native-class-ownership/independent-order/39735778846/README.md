# Ensayo completo de orden independiente: sin aceptación

El [run 39735778846](https://github.com/guidomodarelli/rustdom/actions/runs/39735778846)
terminó sobre `f5526bc1ea645946b41541350f940f5c85a7e628`. Ambos Node completaron
128 procesos, 256 en total, todos con exit 0. Los dos drivers dieron exit 1 por
presupuesto, sin errores de ejecución. Se conservan las 18.432 duraciones, 2.048
registros de proceso y carga y todas las filas agregadas. **El resultado es negativo;
no repetir el run ni quitar/reaplicar `ownership-independent-order-v1`.**

El artefacto oficial 12409208308 se conserva íntegro en
`artifact-12409208308.zip`: 65.952.903 bytes, SHA-256
`0ee75c12464aa8cfee9f3ac3b42ba81a01dd54a9ed0c15faddfedbcf4ea2f2a5`.
Su tar tiene 66.575.376 bytes, SHA-256
`928e17bfd676264bab0e2bf30f8dfe7267831752dbc3a254cb86c5abece76756`.
Se verificaron el digest de GitHub, el ZIP y las 9.485 entradas del tar con
sus seis enlaces relativos permitidos. La extracción local está en
`/tmp/rustdom-ownership-results-m7jq3638/independent-order`.

Las 387 fuentes por Node coinciden en bytes con el commit publicado: 774
comprobaciones, arnés SHA-256
`6904db29afcddf80aca5e775ec9ebe6d2a680b11891259f3bdcc8b58f4f8ff31`.
Los verificadores de esas fuentes congeladas pasaron en Node 22.12.0/24.14.1
y reprodujeron `verified=true, accepted=false`. Ambos verificaron también la
preparación completa, idéntica a la identidad fijada del run 39720077911 y su
artefacto 12400802735. La procedencia coincide con el SHA real del ensayo.
No hubo reconstrucción, selección de paquetes posteriores ni nuevas muestras.

## Presupuestos y resultado

El [protocolo previo](https://github.com/guidomodarelli/rustdom/blob/f5526bc1ea645946b41541350f940f5c85a7e628/reports/benchmarks/native-class-ownership/INDEPENDENT-ORDER-PROTOCOL.md)
mantiene ±2% para jsdom, ±5% Rustdom A/A y +5% Rustdom A/B, en las ocho cargas
y ambos Node. Tres warmups y nueve muestras por lote, dieciséis posiciones de
cuatro factores, una distribución por proceso y CPU2 solo para el hilo principal.
`order-factors.json` confirma las dieciséis combinaciones y los dos órdenes
independientes en el archivo real. Eso no demuestra la causa de la variación.

| Node | Fase | Filas calibradas | Rango Rust (%) | Rango control jsdom (%) |
| --- | --- | ---: | ---: | ---: |
| 22.12.0 | A/A | 5/8 | −2,892 a +2,934 | −1,996 a +9,059 |
| 22.12.0 | A/B | 7/8 | −2,468 a +2,585 | −4,467 a +1,169 |
| 24.14.1 | A/A | 7/8 | −1,106 a +1,976 | −0,422 a +3,295 |
| 24.14.1 | A/B | 7/8 | −0,581 a +1,571 | −2,046 a +1,899 |

Todos los puntos Rust A/A están dentro de ±5% y los A/B no superan +5%, pero
seis filas del control no calibran. No se acepta el subconjunto restante ni se
declara ausencia de regresiones a partir de filas sin calibrar. No se cambiaron
límites, estimador, procesos o muestras. `analysis/` conserva el recálculo Python
independiente, las 32 filas, 2.048 medianas por proceso/carga y CSV; coincide con
las decisiones originales. Los verificadores originales siguen siendo necesarios
para autenticar el archivo antes de utilizar ese lector descriptivo.

Host: AMD EPYC 9V45 96-Core Processor, cuatro vCPU, 16.765.390.848 bytes RAM,
Linux 6.8.0-1070-azure; workflow ubuntu-22.04. Node22 ejecutó de
06:44:21.230 a 07:17:05.527 UTC y Node24 de 07:17:06.230 a 07:43:49.948 UTC,
el 2026-10-22. Versiones V8, tiempos y máquina están en `machines.json`.
El tiempo completo del job no se interpreta como tiempo del DOM.

## Memoria, lectores y límites

Se observaron 24.576 referencias por tipo Window/Document, 6.144 observaciones
de cleanup, 182 iniciales no claras conservadas y 4.096 estados finales exigidos
claros. `memory-ranges.json` separa Node, fase, motor, tratamiento, paquete físico
y todas las rondas frente a las dos finales. Es memoria de proceso después de GC,
sin picos ni prueba universal de ausencia de fugas. Ver el reporte de memoria.

Antes del artefacto, los lectores pasaron catorce contratos: recálculo del
estudio anterior completo conservando su rechazo, rechazo de relabel 8→16,
preservación de evidencia, duración inválida y extracción con enlaces/rutas
malformados. `reader-validation/` conserva programa, recibos y logs. Después,
el lector `analyze.py` verificó el diseño real de dieciséis posiciones completo;
`real-archive-validation.json` registra ese alcance nuevo, sin aceptar el presupuesto.

Para recalcular, autenticar y extraer el ZIP/tar, verificar primero con
`independent-order-experiment.cjs --verify-set` desde el arnés congelado en ambos
Node y usar `python3 analyze.py EXTRACTED/independent-order NEW_OUTPUT independent-order-v1`.
El output debe ser nuevo y estar fuera de la extracción. `describe-resources.py`
recibe este directorio de reportes y la raíz extraída; se ejecutó de nuevo sobre
los mismos datos y produjo cinco outputs idénticos, sin medir otra vez.

Los diagnósticos de posición de muestra son descriptivos, conservan todas las
duraciones y no cambian la decisión. No se registraron tiempos de los warmups;
estos datos no prueban causas JIT, GC, I/O o scheduling. El balance independiente
no logró calibración global en esta ejecución y no permite atribuir causalidad
ni comparar hosts como si fueran un experimento controlado.

La preparación y el CI general aprobado no cierran ownership. El producto sigue
híbrido; este resultado y sus lectores no agregan APIs migradas. No hay merge ni
checkpoint del hito mientras falten rendimiento aceptado y checks/revisión del
SHA final. El siguiente paso es analizar la dispersión y las fuentes de las cargas
de control fallidas, sin repetir este ensayo ni reinterpretar sus límites.
