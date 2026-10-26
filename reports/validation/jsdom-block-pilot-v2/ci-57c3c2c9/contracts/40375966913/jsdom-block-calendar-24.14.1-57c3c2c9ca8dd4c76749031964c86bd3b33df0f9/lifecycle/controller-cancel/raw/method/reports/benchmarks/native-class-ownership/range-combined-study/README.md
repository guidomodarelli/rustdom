# Preparación numérica para un método prospectivo

Este directorio todavía no define un estudio ejecutable: no tiene sampler,
activador, paquete seleccionado, número de procesos congelado ni decisión de
aceptación. Los 48 pares de algunos fixtures son datos numéricos sintéticos,
no duraciones capturadas ni el tamaño aprobado de un experimento.
No reemplaza los estimadores ni los rechazos de estudios históricos.

`paired-interval.cjs` calcula el cociente de medias aritméticas y un intervalo
Fieller a partir de resúmenes emparejados por proceso. El consumidor debe
proporcionar una media por proceso y el valor crítico declarado. La fórmula
conserva la covarianza dentro de cada par; las observaciones repetidas de un
proceso no pasan a ser ejecuciones independientes por aparecer en un array.
El módulo no autentica captures ni demuestra independencia o estacionariedad.

Para n pares, medias a/b, varianzas muestrales va/vb y covarianza c:

```
h = criticalValue² / n
A = a² - h * va
B = a*b - h * c
C = b² - h * vb
interval = (B ± sqrt(B² - A*C)) / A
```

La implementación escala cada serie de duraciones por separado antes de acumular momentos con
Welford. Se comprueban además el orden de los límites y la inclusión del punto.
Un denominador no positivo devuelve `unbounded`; un cálculo no
representable devuelve `not-estimable`. Nunca se truncan intervalos al presupuesto.
Solo se admite redondear un discriminante negativo dentro de
64 × EPSILON × max(|B²|, |AC|); se registra cuando ocurre. Los resultados siempre conservan
`performanceAccepted=null` y `gateReevaluated=false`.

Referencias primarias: [Kalibera y Jones](https://kar.kent.ac.uk/33611/45/p63-kaliber.pdf)
tratan la repetición por niveles y la incertidumbre del cociente de tiempos;
[Georges, Buytaert y Eeckhout](https://users.elis.ugent.be/~leeckhou/papers/oopsla07-stat.pdf)
distinguen iteraciones de invocaciones. La variante emparejada con covarianza
es la fórmula explícita de este módulo, no una afirmación de que esos trabajos
validaron el sampler de rustdom. Los intervalos requieren supuestos estadísticos;
un cambio dentro de una ejecución no prueba causalidad JIT/GC ni steady-state.

La referencia independiente usa NumPy 2.2.6/SciPy 1.15.3 y encuentra las raíces
de la desigualdad t emparejada mediante Brent, sin copiar la fórmula cuadrática
JavaScript. Incluye proporcionalidad exacta, covarianza positiva/negativa y
baseline incierto. Los tests verifican además unidades, permutación, inversión
de labels, entradas inválidas, underflow y preservación de las entradas.

```sh
python -m pip install -r tools/reference-requirements.txt
python -B tools/generate-numerical-reference.py /salida-nueva/reference.json
python -B tools/reference.spec.py
node --test paired-interval.spec.cjs
```

Usar un entorno local aislado para la referencia científica; no se añade SciPy
como dependencia del runtime, paquete npm o capturador. Los tests usan el código
actual y los fixtures numéricos, nunca scripts archivados ni un runtime DOM.

El cálculo conserva solo acumuladores y el input de la llamada, sin caches ni
referencias persistentes. No crea Window/Document, observers ni recursos N-API;
no aporta nueva cobertura de memoria DOM ni mide memoria pico. La validación
funcional del candidato y sus probes se conservan por separado. Todavía deben
fijarse y revisarse todos los detalles de cualquier futura medición antes de
ejecutarla, con los presupuestos originales y la autorización permanente.

La primera review encontró underflow numérico en razones extremas que producía
límites invertidos o [0,0]. La versión corregida escala ambas series por separado,
conserva medias positivas y rechaza razones/porcentajes no representables o límites
inconsistentes. Se agregaron regresiones en ambas direcciones. La validación y el
código previos a la revisión se conservan como pre-review-numeric-validation;
no son el cierre del módulo corregido ni evidencia de una medición de runtime.

La segunda review encontró cancelación cerca de un denominador Fieller nulo.
Las raíces se calculan ahora con el signo del centro para evitar esa resta.
Cuando |A| / max(a², h*va) no supera sqrt(EPSILON), el resultado se declara
no estimable en lugar de publicar límites mal condicionados. Es una guarda
numérica conservadora; no modifica presupuestos de rendimiento ni el método
histórico. Se conservarán también la reproducción y las regresiones de este caso.
