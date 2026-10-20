# Consultas de colecciones: mediciones antes y después

Mediciones del 20/10/2026 en Linux x64/WSL2. Baseline: checkpoint-058-dom-parser
(`3652628`, árbol equivalente a `02235af`), addon Rust 1.99.1. El candidato usa
el mismo compilador y perfil release con thin LTO. Referencia: jsdom 27.4.0.

Máquina: 13th Gen Intel(R) Core(TM) i7-1360P; 16 CPUs lógicas; 6.6.87.2-microsoft-standard-WSL2.

## Qué se mide

- Seis workloads, con 100 y 1.000 descendientes de namespaces mezclados.
- `collection-class-live`, `collection-tag-live` y `collection-namespace-live`
  incluyen cien invalidaciones reales por un atributo, recálculo de la colección
  retenida y consumo de longitud/última identidad. No son solo filtros puros.
- `collection-class-create` crea una colección nueva tras cada invalidación.
- `collection-class-cached` lee una colección estable sin invalidaciones; el
  contador nativo confirma que no se recalcula el filtro durante el tiempo medido.
- `collection-class-many-live` usa dieciséis tokens y mantiene visible el costo
  de consultas mayores, además de las consultas habituales de dos clases.
- El contexto auxiliar usa HTML sin scripts y parser nativo. Los filtros del
  candidato usan Rust; HTMLCollection, su Proxy WebIDL y wrappers conservan
  el host JavaScript. El baseline ejecuta los filtros anteriores en JavaScript.
- Se incluyen la escritura de invalidación, el puente, mapeo de identidades y
  actualización pública. Se excluyen construcción del fixture, verificación,
  cierre y GC. Cada resultado y el número de recálculos se comprueban.

## Muestras y límites

Ocho reportes completos y 32 procesos aislados. Se ejecutan baseline → candidato
y candidato → baseline en Node 22.12.0 y 24.14.1; dentro de cada reporte se
invierte el orden jsdom/rustdom. Cada fila agrupa **36 muestras por motor y
etapa**, procedentes de cuatro procesos, con tres warmups y nueve muestras
medidas por proceso. No se eliminan outliers. El JSON conserva p95, mínimos,
máximos, muestras crudas, resultados por repetición e identidades de binarios.

La CPU de WSL2 se comparte con el host. Invertir el orden reduce un sesgo, pero
no elimina ruido, GC ni efectos del orden. Estas mediciones no certifican una
mejora general, equivalencia estadística o velocidad de suites completas.
Los valores de memoria son posteriores a cierre/GC; no son memoria pico.

## Resultados agrupados

| Node | Operación | Descendientes | Antes (ms) | Después (ms) | Variación | jsdom/rustdom final |
|---|---|---:|---:|---:|---:|---:|
| v24.14.1 | collection-class-live | 100 | 16.298 | 10.682 | -34.46% | 0.32× |
| v24.14.1 | collection-tag-live | 100 | 18.339 | 18.951 | +3.34% | 0.17× |
| v24.14.1 | collection-namespace-live | 100 | 4.730 | 4.583 | -3.11% | 0.50× |
| v24.14.1 | collection-class-create | 100 | 16.282 | 10.493 | -35.55% | 0.36× |
| v24.14.1 | collection-class-cached | 100 | 7.259 | 7.157 | -1.40% | 0.13× |
| v24.14.1 | collection-class-many-live | 100 | 38.867 | 19.898 | -48.81% | 0.24× |
| v24.14.1 | collection-class-live | 1000 | 131.343 | 93.278 | -28.98% | 0.17× |
| v24.14.1 | collection-tag-live | 1000 | 143.536 | 153.177 | +6.72% | 0.11× |
| v24.14.1 | collection-namespace-live | 1000 | 33.509 | 36.576 | +9.15% | 0.20× |
| v24.14.1 | collection-class-create | 1000 | 137.224 | 98.117 | -28.50% | 0.21× |
| v24.14.1 | collection-class-cached | 1000 | 71.183 | 70.382 | -1.12% | 0.05× |
| v24.14.1 | collection-class-many-live | 1000 | 328.051 | 180.055 | -45.11% | 0.19× |
| v22.12.0 | collection-class-live | 100 | 15.782 | 10.680 | -32.33% | 0.39× |
| v22.12.0 | collection-tag-live | 100 | 16.006 | 16.840 | +5.20% | 0.19× |
| v22.12.0 | collection-namespace-live | 100 | 4.160 | 4.802 | +15.43% | 0.34× |
| v22.12.0 | collection-class-create | 100 | 17.313 | 11.205 | -35.28% | 0.40× |
| v22.12.0 | collection-class-cached | 100 | 7.641 | 7.459 | -2.38% | 0.14× |
| v22.12.0 | collection-class-many-live | 100 | 35.755 | 20.748 | -41.97% | 0.46× |
| v22.12.0 | collection-class-live | 1000 | 125.444 | 94.656 | -24.54% | 0.20× |
| v22.12.0 | collection-tag-live | 1000 | 142.002 | 152.998 | +7.74% | 0.12× |
| v22.12.0 | collection-namespace-live | 1000 | 32.650 | 37.115 | +13.67% | 0.25× |
| v22.12.0 | collection-class-create | 1000 | 131.894 | 96.561 | -26.79% | 0.24× |
| v22.12.0 | collection-class-cached | 1000 | 69.557 | 70.407 | +1.22% | 0.09× |
| v22.12.0 | collection-class-many-live | 1000 | 309.575 | 184.560 | -40.38% | 0.19× |

Las variaciones de las medianas abarcan -48.81% a +15.43%.
El control jsdom varía entre -14.82% y +6.50%.
Las variaciones adversas y ambos órdenes se conservan, sin seleccionar solo
las filas favorables. Ratio mayor que 1 favorece rustdom; menor que 1 conserva
un costo frente a jsdom.

## Pendiente de rendimiento

La lectura desde caché sigue recorriendo métodos del host. El Proxy de
HTMLCollection consulta `namedItem` al resolver propiedades como `length` e
`item`, y esa implementación lee atributos a través del puente por miembro.
El benchmark exige cero recálculos nativos en esa ruta: migrar el filtro no
elimina por sí solo este costo. Las medianas completas de esa ruta son:

- v24.14.1, 100 descendientes: 7.157 ms en rustdom frente a 0.927 ms en jsdom.
- v24.14.1, 1000 descendientes: 70.382 ms en rustdom frente a 3.715 ms en jsdom.
- v22.12.0, 100 descendientes: 7.459 ms en rustdom frente a 1.027 ms en jsdom.
- v22.12.0, 1000 descendientes: 70.407 ms en rustdom frente a 6.289 ms en jsdom.

El objetivo de rendimiento sigue abierto. La siguiente optimización debe
medir ese camino y preservar orden, nombres, namespaces, descriptores,
invalidación y ownership de las colecciones.

## Evidencia

- [Comparación y distribuciones](comparison.json).
- [Validación y análisis de memoria](../../validation/collection-queries.md).
- [Inventario y checksums](../../validation/collection-queries/evidence.json).
- v24.14.1, baseline: [JSON crudo](./2026-10-20T18-25-05.650Z-linux-x64.json.gz).
- v24.14.1, candidate: [JSON crudo](./2026-10-20T18-27-28.035Z-linux-x64.json.gz).
- v22.12.0, baseline: [JSON crudo](./2026-10-20T18-30-05.303Z-linux-x64.json.gz).
- v22.12.0, candidate: [JSON crudo](./2026-10-20T18-32-39.309Z-linux-x64.json.gz).
- v24.14.1, candidate: [JSON crudo](./2026-10-20T18-35-00.895Z-linux-x64.json.gz).
- v24.14.1, baseline: [JSON crudo](./2026-10-20T18-37-30.398Z-linux-x64.json.gz).
- v22.12.0, candidate: [JSON crudo](./2026-10-20T18-40-02.517Z-linux-x64.json.gz).
- v22.12.0, baseline: [JSON crudo](./2026-10-20T18-42-38.893Z-linux-x64.json.gz).

Los reportes grandes usan gzip sin pérdida. `sourceHash` identifica el harness
y las fuentes del candidato; `runtimeSource` y el SHA del addon identifican el
motor cargado, incluido el paquete histórico. El inventario conserva también
los checksums del contenido original y el digest del baseline.
