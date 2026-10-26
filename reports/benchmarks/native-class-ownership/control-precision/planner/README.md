# Sensibilidad sintética de un diseño de bloques

**Planificación solamente. No ejecuta DOM, no mide rustdom y no acepta rendimiento.**
El borrador de 16 réplicas jsdom y ocho Rust continúa con `executionReady=false`.
Los rechazos históricos y el gate permanecen intactos.

El modelo genera pares de medias de bloque, no procesos, hosts ni tareas reales.
Normaliza la media A a 100 unidades sintéticas, con desviación 1. B es la razón
verdadera hipotética por A más un contraste normal. La desviación del contraste
se declara directamente **entre bloques**; no se estimó del histórico ni se
obtuvo dividiendo por √16. El modelo no reconstruye los factores internos.

Se conserva la razón entre medias aritméticas y se reutiliza el kernel Fieller
existente, con r−1 grados de libertad. Los presupuestos vienen del JSON canónico
anterior. Para r=16 se conserva t15; para r=8 se usa 2.365, redondeado hacia arriba
para planificación a partir de la [tabla NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm).
Estos cálculos no fijan un estimador de captura nuevo.

Se ejecutaron las once hipótesis y 2000 ensayos sintéticos por hipótesis en
Node22.12.0 y24.14.1 Linux. Los dos SDK produjeron los mismos conteos. Se guardan
**todos** los pares e intervalos comprimidos, resultados adversos incluidos,
semilla pública, código, hashes, SDK y hardware en `results/`. No se agregaron
muestras a ningún estudio ni se mezclaron mediciones históricas.

| Hipótesis | Razón verdadera, cambio % | SD del contraste entre bloques, pp | Correlación de retardo | Intervalos acotados que incluyen la razón, % | Intervalo dentro del presupuesto, % |
|---|---:|---:|---:|---:|---:|
| jsdom centrado, ruido bajo | 0 | 0.5 | 0 | 94.90 | 100.00 |
| jsdom centrado, ruido alto | 0 | 2 | 0 | 95.30 | 92.30 |
| jsdom desplazado, ruido bajo | 1.5 | 0.5 | 0 | 95.20 | 96.40 |
| jsdom desplazado, ruido moderado | 1.5 | 1 | 0 | 94.30 | 46.85 |
| jsdom fuera de presupuesto | 3 | 1 | 0 | 94.45 | 0.00 |
| Rust AA centrado | 0 | 2 | 0 | 95.70 | 99.90 |
| Rust AB cerca del límite, ruido bajo | 4 | 0.5 | 0 | 95.00 | 99.85 |
| Rust AB cerca del límite, ruido moderado | 4 | 1 | 0 | 95.05 | 68.55 |
| Rust AB fuera del presupuesto | 6 | 1 | 0 | 95.20 | 0.00 |
| jsdom con bloques dependientes | 0 | 1 | 0.99 | 8.65 | 94.75 |
| Rust AB fuera del presupuesto y dependiente | 6 | 1 | 0.99 | 9.85 | 13.10 |

Son frecuencias de simulación condicionadas al modelo, no potencia demostrada
para CI. El JSON incluye intervalos Wilson aproximados para el error Monte
Carlo de esas frecuencias; no representan incertidumbre sobre la varianza real
del runner ni cobertura simultánea de 64 criterios. Los 22000 intervalos de
cada SDK resultaron acotados en este dataset; no se descartan ni convierten en
acotados los casos no estimables de otro input.

Los dos últimos modelos **violan deliberadamente independencia entre bloques**.
La frecuencia de intervalos estrechos dentro del presupuesto no habilita una
decisión: el caso Rust +6% clasifica erróneamente 13.1% de los ensayos. Ni una
envolvente de dos estimadores ni agregar tareas internas demuestra independencia.
La simulación no establece que esa dependencia exista en los logs reales.

El tamaño provisional puede servir con dispersión baja y fallar cerca del límite
con otra dispersión plausible. El histórico contiene una sola réplica completa
por criterio y no identifica esa varianza. **No alcanza para activar sin más el
diseño costoso de 24576 procesos**: falta justificar la variación entre bloques
y el margen de precisión del candidato exacto. No se eligió tamaño observando
si una captura iba pasando; todavía no hay captura de este diseño.

## Implementación y validación

- `model.cjs`: modelo hipotético y clasificación numérica; importa solo el kernel
  matemático y datos canónicos, sin cargar el runtime DOM.
- `run.cjs`: directorio exclusivo, todos los datos, SDK/inputs y resultados parciales;
  no sobrescribe una ejecución previa.
- `audit.py`: suma/covarianza y cuadrática Fieller independientes, sobre cada par
  almacenado, sin ejecutar código del archivo ni autenticar una captura real.

Pasaron siete contratos numéricos por SDK y cinco del auditor en Windows/Linux.
El auditor comprobó 44000 puntos/cuadráticas. Los intentos de reutilizar el
directorio fallaron con EEXIST y conservaron todos los bytes. El modelo retiene
los datos de un caso hasta escribirlo; la lista global guarda solo resúmenes.
El estado del generador es acotado. No se midió memoria pico ni se afirma
ausencia universal de fugas; no cambió código Rust ni ownership de producto.

```sh
node --test reports/benchmarks/native-class-ownership/control-precision/planner/model.spec.cjs
node reports/benchmarks/native-class-ownership/control-precision/planner/run.cjs <directorio-nuevo>
python -B reports/benchmarks/native-class-ownership/control-precision/planner/audit.py <directorio-con-datos>
```
