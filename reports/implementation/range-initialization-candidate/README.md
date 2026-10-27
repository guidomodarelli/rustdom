# Inicialización numérica de Range — candidato v1

Este candidato reduce las llamadas explícitas al addon al recibir ambos extremos
en `privateData`: crea el estado numérico completo mediante
`NativeRange.fromEndpoints`. Conserva el constructor y los setters anteriores
cuando falta algún extremo. El `document.createRange()` por defecto no se
beneficia de esta ruta. El constructor público de StaticRange y sus decisiones
de validación siguen en JavaScript; el runtime continúa híbrido.

El patch **no está integrado en producción**. No incluye el candidato StaticRange
ELF `4b52a84d` que rechazó el estudio 40234774968, ni cambia su decisión.
No hay medición de rendimiento de este candidato: `performanceAccepted=null`.
El gate ownership continúa rechazado y no corresponde crear tag ni merge.

## Diseño y memoria

- Rust valida las dos identidades antes de incrementar los contadores de estados
  nativos. Los offsets mantienen la semántica numérica previa del binding.
- Se usa un método estático ordinario `#[napi] -> Result<Self>`, igual que la
  conversión protegida utilizada por `copy`. No se usa `#[napi(factory)]`: ese
  camino del SDK tiene un ownership distinto y no formó parte de esta build.
- El wrapper N-API todavía se construye internamente. Reducir tres llamadas
  explícitas a una no demuestra reducir a uno todos los cruces ABI ni mejorar
  el tiempo total.
- Solo cambian tres de los 344 inputs del compilador/runtime autenticados.
  Los hashes de todos los inputs, antes y después, están preservados.

## Validación ejecutada

Fuente Git Linux real: `f781c3b7549a86b6aa8b5a34d2bbb32038c315b7` más este patch.
La identidad y los cambios crudos de la fuente no se normalizaron. Rust 1.99.1,
Node 22.12.0 y 24.14.1 oficiales, con hashes comprobados antes de ejecutar.

Los **26 comandos terminaron con código 0**: formato, 311 tests Rust, build nativo,
build JavaScript, Clippy, y en cada Node: tres contratos del binding/API pública,
TypeScript estricto con consumidor ejecutado, compatibilidad, Jest, Vitest, VM,
corpus HTML, WPT y ciclos de memoria.

El corpus comparó 1784/1784 casos sin diferencias, con ocho casos `script-on`
excluidos. WPT comparó 240 fixtures por SDK contra jsdom 27.4.0, revisión upstream
`8d124dbe46f46f55531f28f13eccf1113f794c12`. Su resultado es paridad en el alcance
ejecutado, **no conformidad completa**: conserva fallos compartidos, un fixture
excluido por necesitar layout/test_driver y la suite range-deletion bloqueada
por el bootstrap CDATA de la referencia. Los informes dicen `complete=false`.
En cada SDK hay 83007 aserciones: 81804 aprobadas y 1203 con estado adverso,
exactamente las mismas cantidades que en jsdom. Los resultados crudos se conservan.

En los seis ciclos de memoria por SDK se observaron estados retenidos, luego solo
StaticRange y finalmente liberación. Ambos acabaron con NativeRange
`created=4814`, `released=4814`, `live=0`. Document y Window se observaron por
separado. Estos escenarios finitos no prueban ausencia universal de fugas ni
memoria pico; las muestras heap/external/RSS son snapshots.

Los logs completos, informes diferenciales, recibos y ELF comprimido están en
[`reports/validation/range-initialization-candidate/local-linux`](../../validation/range-initialization-candidate/local-linux/).
Los recursos están en
[`reports/memory/range-initialization-candidate/local-linux`](../../memory/range-initialization-candidate/local-linux/).
`manifest.json` conserva tamaños y SHA-256; `summary.json` identifica también
los tamaños y hashes originales de JSON comprimidos sin pérdida.

## Reproducción funcional en otro checkout

Usar un checkout Git Linux real de la base indicada y aplicar
`range-initialization.patch` con `git apply --check` y `git apply`.
Copiar `public.spec.cjs` a `tests/range-initialization-candidate.spec.cjs` y
`consumer.cts` a `tests/consumers/range-initialization.cts`.
Instalar desde los lockfiles, usar Rust 1.99.1 y fijar cada Node oficial indicado.
Ejecutar los comandos registrados en `build.json` adaptando únicamente los paths
de herramientas, fuente y salida. Para los tres contratos se necesita
`RUSTDOM_RANGE_INITIALIZATION_SOURCE` apuntando a la fuente.

Los archivos `.py.txt` son el registro de los preparadores usados y se conservan
solo para auditoría; no ejecutar scripts archivados. Antes de medir hay que fijar
un protocolo prospectivo distinto y revisar su precisión y costo. Nunca reutilizar
la autorización de una secuencia consumida para repetir sus mediciones.
