# HTMLCollection: mediciones antes y después

Baseline: checkpoint-059-collection-queries (`a155685`, árbol equivalente a
`02f7b7d`). Ambos addons usan Rust 1.99.1 en release con thin LTO. Los filtros
getElementsBy* ya usan Rust en las dos etapas; en el baseline, namedItem y los
nombres soportados todavía recorren atributos mediante JavaScript/N-API.
El candidato ejecuta esos algoritmos en Rust y prepara las comparaciones de
metadatos sin perder UTF-16. Referencia independiente: jsdom 27.4.0.

Máquina: 13th Gen Intel(R) Core(TM) i7-1360P; 16 CPUs lógicas; 6.6.87.2-microsoft-standard-WSL2.

## Operaciones medidas

- Seis workloads previos: refresco de clases/tag/namespace, creación tras
  invalidación, consulta con dieciséis clases y lectura estable desde caché.
  Cada muestra realiza cien operaciones públicas con 100/1.000 descendientes.
- namedItem hit/miss: cien búsquedas públicas del último miembro o un nombre
  ausente sobre una colección estable de 100/1.000 elementos.
- Nombres: diez llamadas completas a Object.getOwnPropertyNames, consumiendo
  longitud y último nombre, sobre colecciones con IDs y namespaces mezclados.
- Preparación, comprobación independiente de todas las identidades/nombres,
  cleanup y GC están fuera del temporizador. Las rutas estables exigen cero
  recálculos; el contador propio se comprueba antes de las lecturas auxiliares.
- Se incluye el puente, Proxy, copia de resultados y costo público completo.
  Se preserva el host WebIDL y el runtime híbrido en ambas etapas.

## Muestras y límites

Ocho reportes y 32 workers aislados. Por Node se ejecutan las etapas baseline
→ candidato y candidato → baseline; cada reporte invierte también el orden
jsdom/rustdom. Cada fila reúne **36 muestras por motor y etapa**, con tres
warmups y nueve muestras medidas por proceso. Se conservan todos los valores,
outliers, percentiles, muestras de memoria, ambos órdenes y resultados crudos.

La CPU WSL2 se comparte con el host. Estas entradas sintéticas no certifican
velocidad de suites completas ni equivalencia estadística. Los valores de
memoria posteriores al GC no representan memoria pico.

## Medianas agrupadas

| Node | Operación | Miembros/descendientes | Antes (ms) | Después (ms) | Variación | jsdom/rustdom final |
|---|---|---:|---:|---:|---:|---:|
| v24.14.1 | collection-class-live | 100 | 10.167 | 3.612 | -64.47% | 0.97× |
| v24.14.1 | collection-tag-live | 100 | 18.565 | 3.541 | -80.92% | 0.85× |
| v24.14.1 | collection-namespace-live | 100 | 4.536 | 2.356 | -48.05% | 0.96× |
| v24.14.1 | collection-class-create | 100 | 11.062 | 3.921 | -64.56% | 1.00× |
| v24.14.1 | collection-class-cached | 100 | 7.263 | 0.646 | -91.11% | 1.48× |
| v24.14.1 | collection-class-many-live | 100 | 19.894 | 16.433 | -17.40% | 0.29× |
| v24.14.1 | collection-class-live | 1000 | 94.973 | 27.742 | -70.79% | 0.54× |
| v24.14.1 | collection-tag-live | 1000 | 157.022 | 26.926 | -82.85% | 0.63× |
| v24.14.1 | collection-namespace-live | 1000 | 38.506 | 12.982 | -66.29% | 0.58× |
| v24.14.1 | collection-class-create | 1000 | 100.216 | 29.410 | -70.65% | 0.69× |
| v24.14.1 | collection-class-cached | 1000 | 72.499 | 4.248 | -94.14% | 0.97× |
| v24.14.1 | collection-class-many-live | 1000 | 186.062 | 148.916 | -19.96% | 0.22× |
| v24.14.1 | collection-named-hit | 100 | 34.441 | 1.127 | -96.73% | 1.57× |
| v24.14.1 | collection-named-miss | 100 | 34.655 | 1.074 | -96.90% | 1.63× |
| v24.14.1 | collection-property-names | 100 | 2.715 | 1.472 | -45.79% | 0.53× |
| v24.14.1 | collection-named-hit | 1000 | 328.008 | 13.918 | -95.76% | 0.72× |
| v24.14.1 | collection-named-miss | 1000 | 322.049 | 13.536 | -95.80% | 0.78× |
| v24.14.1 | collection-property-names | 1000 | 28.568 | 15.056 | -47.30% | 0.48× |
| v22.12.0 | collection-class-live | 100 | 11.003 | 4.045 | -63.24% | 1.02× |
| v22.12.0 | collection-tag-live | 100 | 17.525 | 3.895 | -77.78% | 0.82× |
| v22.12.0 | collection-namespace-live | 100 | 4.999 | 2.552 | -48.94% | 0.64× |
| v22.12.0 | collection-class-create | 100 | 11.646 | 4.292 | -63.15% | 1.06× |
| v22.12.0 | collection-class-cached | 100 | 7.526 | 0.741 | -90.16% | 1.31× |
| v22.12.0 | collection-class-many-live | 100 | 20.442 | 17.780 | -13.02% | 0.54× |
| v22.12.0 | collection-class-live | 1000 | 94.732 | 28.172 | -70.26% | 0.66× |
| v22.12.0 | collection-tag-live | 1000 | 154.880 | 26.599 | -82.83% | 0.70× |
| v22.12.0 | collection-namespace-live | 1000 | 36.206 | 12.992 | -64.12% | 0.72× |
| v22.12.0 | collection-class-create | 1000 | 97.032 | 30.438 | -68.63% | 0.77× |
| v22.12.0 | collection-class-cached | 1000 | 70.440 | 4.379 | -93.78% | 1.50× |
| v22.12.0 | collection-class-many-live | 1000 | 180.279 | 150.889 | -16.30% | 0.24× |
| v22.12.0 | collection-named-hit | 100 | 32.161 | 1.133 | -96.48% | 1.65× |
| v22.12.0 | collection-named-miss | 100 | 32.207 | 1.119 | -96.53% | 1.56× |
| v22.12.0 | collection-property-names | 100 | 2.699 | 1.589 | -41.14% | 0.53× |
| v22.12.0 | collection-named-hit | 1000 | 326.410 | 14.915 | -95.43% | 1.00× |
| v22.12.0 | collection-named-miss | 1000 | 324.283 | 15.187 | -95.32% | 0.95× |
| v22.12.0 | collection-property-names | 1000 | 35.906 | 25.115 | -30.05% | 0.68× |

Variación frente al baseline: -96.90% a -13.02%.
Variación del control jsdom: -7.21% a +16.62%.
Las operaciones directas varían de -96.90% a -30.05%.
Ratio mayor que 1 favorece rustdom; menor que 1 conserva un costo frente a
jsdom. Ninguna fila o variación adversa se excluye de la comparación.

La ruta estable que motivó el perfil conserva estos resultados completos:

- v24.14.1, 100: 7.263 → 0.646 ms por cien lecturas, frente a 0.956 ms en jsdom.
- v24.14.1, 1000: 72.499 → 4.248 ms por cien lecturas, frente a 4.133 ms en jsdom.
- v22.12.0, 100: 7.526 → 0.741 ms por cien lecturas, frente a 0.972 ms en jsdom.
- v22.12.0, 1000: 70.440 → 4.379 ms por cien lecturas, frente a 6.582 ms en jsdom.

## Diagnóstico de CPU separado

Los perfiles capturan 1.000 lecturas públicas preparadas de length/item.
Antes predominaban el puente y attributeByNamespace/namedItem. Un frame
nativo compartido aparece con un nombre de serialización, pero sus ancestros
JavaScript muestran la búsqueda de nombres: ese nombre por sí solo no prueba
que se ejecutara serialización XML en el bucle.

- before: 582 muestras, 740222 µs bajo instrumentación; [resumen](profile-before.json) y perfil crudo en el inventario.
- after: 28 muestras, 88293 µs bajo instrumentación; [resumen](profile-after.json) y perfil crudo en el inventario.

El overhead del profiler impide convertir esos tiempos en una aceleración
sin instrumentación. Las medianas de arriba proceden de procesos separados.

## Evidencia reproducible

- [Comparación, percentiles y repeticiones](comparison.json).
- [Validación y ownership](../../validation/collection-members.md).
- [Inventario, fuentes y checksums](../../validation/collection-members/evidence.json).
- v24.14.1, baseline: [reporte crudo](./2026-10-20T19-33-08.843Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-20T19-35-11.943Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-20T19-40-38.536Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-20T19-42-56.865Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-20T19-45-00.538Z-linux-x64.json.gz).
- v24.14.1, baseline: [reporte crudo](./2026-10-20T19-50-21.844Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-20T19-52-38.771Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-20T19-58-03.061Z-linux-x64.json.gz).

Los datos grandes usan gzip sin pérdida. sourceHash identifica el harness y
las fuentes del candidato; runtimeSource y el SHA del addon identifican el
motor cargado, incluido el baseline histórico. El inventario verifica también
el contenido original descomprimido y el paquete instalado en ambos Node.
