# Intervalos diagnósticos de dispersión entre bloques

Se implementa el análisis de los tres contrastes fijos B−qA, q=0.98/1/1.02,
de 16 bloques completos por criterio jsdom. La unidad candidata a independiente
es el bloque completo bajo una hipótesis de trabajo explícita; no las tareas,
factores o procesos que lo componen. Cada criterio se conserva en un host.

Para cada contraste se calcula un IC bilateral95% de SD y el límite superior
unilateral95%, usando chi-cuadrado df15 bajo normalidad/iid de bloques. Son
puntuales; no hay cobertura simultánea, potencia, prueba de equivalencia ni
afirmación de independencia. La SD empírica cero produce una salida inconclusa.
Se conservan todos los valores, pendiente y autocorrelación lag1 descriptivas;
no se excluye deriva ni se filtra según significancia.

La fórmula y el significado de los cuantiles siguen [NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda358.htm),
con cotejo de sus [valores tabulados](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3674.htm).
Se calcularon cuantiles por bisección de la CDF gamma incompleta con mpmath1.3.0
a80 decimales. Residuo CDF máximo observado ≈1.06e−81. La rueda instalada se
autenticó contra metadata PyPI y sus 87 miembros contra el wheel descargado;
versión/hash reproducibles en reference-requirements.txt. Esa herramienta solo
genera referencias de desarrollo; no se agrega una dependencia a Node/rustdom.

`reference.json` contiene cuantiles, residuos, 16 pares sintéticos y resultados
calculados independientemente de Node. El generador ejecutado se conserva como
texto de procedencia. Los contratos prueban las salidas numéricas públicas,
unidades, degeneración, deriva y errores; no strings de implementación.

La validación final en `qa/` pasó once contratos por Windows/Linux ×
Node22.12.0/24.14.1 (44 en total), seis contratos de lectura offline por
plataforma y actionlint. Ningún test ejecutó DOM ni una secuencia científica.
Los tiempos de ejecución de tests no son benchmarks. La calificación hosted
de estos cambios nuevos se registrará después de publicar el commit; el run
40286292347 solo prueba los seis contratos anteriores.

También pasaron las siete órdenes combinadas del workflow ampliado en un
checkout mínimo Git Linux real: hidratación, contratos/lectura del archivo y
tests/calendario con ambos SDK. El fixture local c2f7436b no se presenta como
commit publicado. Sus 835 inputs, logs y calendarios se preservan en `sparse/`.

Faltan capturador, lector integral autenticado de tareas y recursos, límites,
transporte/revisión prospectivos. executionReady=false, performanceAccepted=null,
gateReevaluated=false; no se acepta rendimiento ni se cambian rechazos previos.
