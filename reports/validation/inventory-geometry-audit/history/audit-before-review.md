# Auditoría de geometría: propuesta pendiente de incorporar al ledger

Base: `main` / checkpoint 67, `3d37f89976a48203e80cc5c435e099267f4ce346`.
Los tres archivos `src/dom/dom-rect.cjs`, `src/dom/dom_rect.rs` y
`src/dom/dom_rect_binding.rs` coinciden con esa base. La referencia independiente
es jsdom 27.4.0: los cinco archivos originales cotejados coinciden con los
SHA-256 del catálogo. También se inspeccionaron los shims y el bridge construidos
del paquete oficial B del artefacto 12400802735, sin ejecutarlos ni modificarlos.

Esta propuesta **no modifica** `audits.json`, `classification.json` ni sus
recuentos. Antes de incorporarla hay que validar el catálogo con los tests reales
y revisar la clasificación. No se ejecutan suites adicionales mientras corre el
ensayo de rendimiento de ownership. No hay nuevo código Rust, mejora de velocidad
o porcentaje de migración atribuible a esta auditoría.

## Responsabilidades comprobadas

| Fuente de referencia | Ruta integrada y estado propuesto |
| --- | --- |
| `geometry/DOMRectReadOnly-impl.js` | Híbrido: el shim carga `createReadOnlyRectImplementation`. Cuatro escalares, lectura de dimensiones y cálculo de los cuatro bordes viven en Rust. El constructor conserva defaults en el destructuring JavaScript; `fromRect` conserva selección de factory y composición de argumentos. |
| `geometry/DOMRect-impl.js` | Híbrido: el shim carga `createMutableRectImplementation`. Getters y setters acceden al estado Rust; `fromRect` conserva su factory mutable y los argumentos en JavaScript. |
| `generated/DOMRectReadOnly.js` | Pendiente: instalación del constructor/prototipo, branding, argumentos/defaults, conversión unrestricted-double y excepciones siguen en el wrapper WebIDL. La implementación que llama usa Rust. |
| `generated/DOMRect.js` | Pendiente: WebIDL mutable, setters, coerción y selección de errores continúan en JavaScript antes del estado Rust. |
| `generated/DOMRectInit.js` | Pendiente: distingue undefined/null, rechaza otros primitivos y lee/convierte height, width, x, y en ese orden, con defaults y errores del realm. Es lógica observable de plataforma, no solo transporte N-API. |

El build reemplaza los dos módulos de implementación con shims. Que esos archivos
originales desaparezcan del runtime no completa el módulo: sus defaults, factories
y control restante se trasladaron al bridge JavaScript. El `private-require.cjs`
de los shims construidos mantiene aislamiento del paquete; no es el algoritmo
geométrico ni prueba de migración del WebIDL.

`Rect::edge` calcula la suma y selección de borde en Rust, propaga NaN, conserva
infinitos/overflow y decide el signo de cero. `NativeDomRect` guarda solo cuatro
`f64`, con getters/setters y `snapshot`; `Drop` actualiza contadores escalares.
No conserva referencias N-API, Window, Document ni callbacks. Los getters y
setters del bridge son llamadas mecánicas al estado nativo.

## Veinte anclas y APIs públicas

La propuesta ligada a IDs exactos está en `geometry-audit-proposal.json`.
Son veinte cuerpos originales: dieciséis getters/setters de escalares y bordes
se proponen como Rust existente. Constructor, ambos `fromRect` y `toJSON` quedan
híbridos. Para `toJSON` Rust elige los ocho valores y orden del snapshot, pero el
bridge conserva la copia a un objeto del realm de implementación; se mantiene
explícita esa porción en vez de declarar terminada toda la fábrica de objetos.

Se proponen diecisiete entradas de API híbridas: los dos constructores, dos
`fromRect`, doce descriptores de atributos propios y `toJSON`. No se duplican los
miembros heredados en DOMRect. Las dos entradas `@@toStringTag` se mantienen fuera
de esta propuesta; son metadata de instalación y requieren su propia decisión
de alcance, no un crédito ficticio de algoritmo Rust.

La referencia conserva 531 archivos, 4.374 entradas de API y 7.246 cuerpos.
Son dimensiones distintas. Incorporar una clasificación no implementa nuevos
algoritmos ni elimina pendientes. El alcance global sigue abierto y el porcentaje
no está determinado. Esta propuesta tampoco incorpora cambios de ramas de clone,
atributos ni ownership pendientes de integración.

## Evidencia existente y límites

`tests/dom-rect.spec.cjs` compara operaciones públicas con jsdom independiente en
realms default/VM: valores especiales, signos de cero, defaults/coerción,
fromRect y orden de lectura, herencia, descriptors, branding, reentrancia y
realm/orden del JSON. Su caso adicional de Object.prototype verifica que la
construcción del JSON no invoque setters heredados. `tests/dom-rect-native.spec.cjs`
ejercita estado, snapshots independientes y activación pública real del addon.
Las cuatro pruebas numéricas Rust están en `src/dom/dom_rect.rs`.

Los resultados históricos y su alcance están en `reports/validation/dom-rect.md`:
25 contratos públicos, tres nativos y ciclos de memoria del hito. No se presentan
como tests recién ejecutados de esta propuesta ni como una certificación de toda
Geometry Interfaces. El código de pruebas se revisó, no se ejecutó durante la
medición actual. El benchmark del inventario tampoco mediría DOMRect.

El rectángulo público conserva `_globalObject` en el bridge. Mientras el caller
retiene rectángulos puede retener Window/Document, como la referencia; no es una
fuga demostrada. `tests/helpers/dom-rect-memory.cjs` observa esos dos owners y los
rectángulos por separado, libera las referencias fuertes y conserva snapshots
desprendidos. Los reportes históricos registran 6.000 asignaciones nativas
liberadas; son escenarios finitos y no memoria pico. La liberación ante fallo
del constructor de clases N-API depende además del hito de ownership PR80, que
esta auditoría no acepta ni declara integrado.

## Salida necesaria

Tras cerrar el hito en curso, trasladar las decisiones restantes del constructor,
fromRect, creación de resultados y WebIDL a Rust, conservando bindings mecánicos,
identidades y aristas visibles al GC. Validar contra la referencia los defaults,
coerciones/reentrancia, factories de subclasses, valores IEEE-754, branding,
errores y ambos realms en Node22/24. Medir las operaciones públicas equivalentes
y observar liberación de rectángulos, Window y Document en éxito/error. Un
controlador numérico nativo no completa por sí solo sus consumidores públicos.
