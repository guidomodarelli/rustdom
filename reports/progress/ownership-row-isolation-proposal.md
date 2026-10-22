# Ownership: hipótesis de aislamiento por carga, todavía sin implementar

El ensayo seeded original ya terminó en ambos Node, con integridad verificada y
accepted=false. Los 256 workers terminaron con exit0, sin fallos de ejecución;
cuatro controles jsdom rechazaron ±2%: dos en Node22 y dos en Node24. Todas las
filas Rust quedaron dentro de su límite numérico; eso no acepta el conjunto.
Los resultados completos y los negativos están preservados en
reports/benchmarks/native-class-ownership/seeded-pre-gc-results/2026-10-22/.
No se repetirá ese ensayo. Esta propuesta sigue sin implementar ni medir.

## Evidencia y límites del diagnóstico

El índice Node22 tiene SHA-256
1e1dcbcedda4e2773263815a858e30d1e2f7e1306787fd774da0d1ae280a70d7.
Los lectores locales read-terminal-node22-factors.py y
read-terminal-node22-physical.py conservan las 16 filas (AA/AB por ocho cargas)
y todas sus posiciones. No crean workers ni alteran el estimador o presupuesto.
Sus JSON están en .cache/seeded-pre-gc-node22-*-diagnostics.json.

J0/J1 tienen fingerprints iguales de 531 archivos. Los agrupamientos descriptivos
por copia física u orden no son el agrupamiento original A/B ni prueban efectos
causales. Por ejemplo, agrupar por copia física da para range-control-1000/250 un cambio
J1/J0 de -2.0851964494127517% en AA y +2.63652783330528% en AB; no hay evidencia
para atribuir una penalización universal a una copia o escoger un orden favorable.
Se preservan todas las filas y grupos, sin convertirlos en nuevas decisiones.

single-package-worker.cjs crea un runner y recorre las ocho cargas en un mismo
proceso. El estado de V8 sobrevive entre ellas aunque los owners observados se
recolecten. La captura V8 única ya archivada contiene invalidaciones por weak
objects y compilaciones de Range. Carece de alineación verificable con timers:
no demuestra que esas invalidaciones causen estos rechazos ni que aislar cargas
los resolverá. No se necesita ni se autoriza repetir la captura por esta propuesta.

## Contraste propuesto, condicionado al cierre del ensayo actual

La hipótesis es que el historial de otras cargas en el mismo isolate agrega
variación que el warmup del realm actual no controla. Un contraste distinto
ejecutaría una sola carga pública por proceso. No es volver a medir el método
actual, cambiar semillas después de ver tiempos ni aceptar una selección favorable.

El schedule padre debe expandir cada uno de los 128 casos originales de un Node
en ocho procesos de una carga. Debe conservar el orden global de filas del bit 4,
además de lead de motores, orden de etiquetas y asignación física. No basta con
ocho estudios consecutivos que eliminen el factor de orden: los 16 puntos originales
y sus cuatro factores deben seguir presentes en el orden global del padre.

Cada Node tendría 1024 workers, pero seguiría conservando 9216 tiempos medidos:
16 posiciones × 2 fases × 2 motores × 2 etiquetas × 8 cargas × 9 muestras. Ambos Node
conservarían 18432 tiempos y 2048 workers. No se cambia el cuerpo cronometrado,
las ocho cargas/tamaños, tres warmups exteriores, nueve muestras, calentamiento
del realm actual, sus GCs previos, semillas 1..16 ni presupuestos 2%/5%.
El GC inicial del proceso y el cierre se repetirían por carga: es parte del cambio
de aislamiento y debe registrarse, sin afirmar que su cantidad global es idéntica.

El estimador seguirá agrupando exactamente las 144 muestras por etiqueta/motor/
fase/carga y calculando las medianas originales. La aceptación exige todas las
filas y ambos Node. Deben rechazarse filas ausentes/duplicadas, rowIndex alterado,
schedule incorrecto, cambios de paquete y falsos endpoints claros. Los owners
Window/Document y baselines nativos deben liberarse ANTES de salir de cada worker;
terminar el proceso no reemplaza ese control ni prueba ausencia absoluta de fugas.

Se prefiere reutilizar las factories del worker/estudio con una política explícita
de partición, manteniendo idéntico el comportamiento default y la verificación de
todos los archivos históricos. Evitar copiar un segundo sampler o duplicar el
verificador. Se deben agregar contratos reales con las cinco copias oficiales,
las ocho cargas, los mismos hashes públicos y teardown, además de regresiones de
schedule y preservación. No usar reportes viejos relabelados como evidencia nueva.

Primero deben terminar y archivarse ambos Node del método activo, incluidos sus
negativos y fuentes congeladas. Recién después se pueden modificar las factories
compartidas, ejecutar la calificación del contraste, revisar/publicar/autenticar su
grafo y plantear una única secuencia nueva. Este documento no implementa, califica
ni inicia ese contraste, no concede aceptación y no acredita código Rust nuevo.
