# DOMTokenList nativo

classList, relList y htmlFor usan conjuntos ordenados UTF16 en Rust. La validación,
parsing, membresía, inserción/eliminación/reemplazo, toggle, supported tokens y
decisiones de escritura están en el backend nativo. El host conserva el Element
como owner visible a V8 y ejecuta los hooks reales de atributos, observers y
custom elements después de recibir el plan.

El estado lee atributos canónicos del TreeStore y se invalida desde attrModified.
Valor en namespace nulo y presencia por nombre calificado se evalúan por separado,
igual que la referencia. Sincronizar reemplaza el conjunto; los snapshots previos
no retienen el Element ni el forest y conservan sus propios datos. La pertenencia
usa hashing, mientras el vector mantiene el orden y los strings se comparten dentro
del conjunto mediante Rc. Se reutiliza CompactSet/compact_vector para liberar
capacidad de grandes conjuntos que se vuelven dispersos.

Se conserva el orden particular de validación: add/remove procesan cada token,
mientras replace busca cualquier vacío antes de comprobar espacios. Solo HT, LF,
FF, CR y SPACE separan tokens. No se confunden VT/NBSP/NUL/surrogates con espacios.
Operaciones sin cambios pueden normalizar el atributo, pero toggle con force puede
devolver sin escribir. supports no fuerza sincronización ni valida como add.

## Evidencia focal

El [baseline](dom-token-list/baseline.log) y la [integración](dom-token-list/integration.log)
pasaron 175 contratos sobre siete familias HTML/SVG/XML, con MutationObserver,
conversión reentrante, índices e iteración viva. Cuatro tests Rust verifican reglas,
orden y liberación de capacidad; los contratos nativos ejercen planes, separación
de forests y snapshots. Los seis fixtures WPT incorporados mantienen los bytes
originales y sus hashes en el manifest.

El [primer WPT focal](../compatibility/2026-09-14T22-23-35.262Z-linux-wpt.json)
registró 1.609 resultados en paridad, 1.601 aprobados por el estándar y ocho fallos
compartidos. No se modificaron las assertions ni se contaron esos fallos como
conformidad. El corpus general mantiene sus exclusiones documentadas.

El primer control de GC retuvo la última variable de un for-of en el frame async
de la prueba. El [control independiente](dom-token-list/gc-harness-control.json)
reprodujo el mismo comportamiento con jsdom: sobrevivía solo la tercera lista.
Al terminar ese bucle en una función síncrona, las tres se recolectaron. Se conserva
el [fallo inicial](../memory/2026-09-14T22-23-50.839Z-dom-token-list.json) y el
[control corregido](../memory/2026-09-14T22-26-49.253Z-dom-token-list.json), que pasó
seis ciclos de listas y un snapshot retenido sin su árbol/lista originales.

## Validación general y memoria

[La validación general](dom-token-list/validation.json) pasó formato, Clippy,
224 tests Rust, 1.482 Node, 9 Jest, 20 Vitest y 26 Vitest VM. HTML5 mantuvo 1.784
casos comparables y ocho exclusiones de scripting. El [WPT general final](../compatibility/2026-09-14T22-39-09.311Z-linux-wpt.json)
tuvo 46.957 resultados en paridad: 45.891 aprobados por el estándar y 1.066 fallos
compartidos. El bootstrap de Range-deleteContents sigue excluido y documentado.

El [GC focal final](../memory/2026-09-14T22-41-47.486Z-dom-token-list.json) pasó los
ciclos de listas y el snapshot retenido. El [estrés general](../memory/2026-09-14T22-43-16.012Z-linux-x64.json)
aprobó los cinco modos: rustdom liberó 1.762 documentos y 882 ventanas observados;
cada modo Vitest liberó 1.760 documentos y 880 ventanas. Las listas, conjuntos y
unidades UTF16 nativas volvieron al baseline. Se conservaron deltas RSS de 17,59 MiB,
25,41 MiB y 42,38 MiB para rustdom, vitest y vitest-vm respectivamente.

[Memcheck](../memory/2026-09-14T22-43-16.000Z-dom-token-list-valgrind.log) ejecutó
cuatro tests del núcleo sin errores ni bytes definitivamente o indirectamente
perdidos. Conserva 48 bytes posiblemente perdidos y 544 alcanzables de std/libtest,
sin supresiones. Los controles finitos no demuestran ausencia absoluta de fugas.

El paquete preparado tiene SHA-256
`e70e2a270835bc5265dd8c4fc88afbd8690e1a8c25da08c3cede3aeb57581d0a`.
Pasó 18 controles en [Node 24](../distribution/2026-09-14T22-44-17.531Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-14T22-46-34.299Z-linux-x64.json), con npm/pnpm,
tipos CJS/ESM, workers y runners reales. Ambos archivos de evidencia corresponden
al mismo archivo y al binario
`4ffe2bed64ebe2bac4cbf3198758e8a3a1b2d1f848c3e8c853255954974413c8`.
Los 11 tests del arnés de benchmarks también aprobaron. El hito queda validado
localmente para publicación; el checkpoint requiere CI/revisión del SHA e integración.

## Benchmarks

La [primera medición](../benchmarks/2026-09-14T22-51-03.496Z-linux-x64.json) conservó
una aserción sobre el booleano de replace dentro del tramo cronometrado. Se movió
esa comprobación fuera del tramo, conservando el consumo del booleano como parte
del checksum, y se repitieron las mismas cargas. No se cambiaron los algoritmos
nativos ni el paquete entre ambas mediciones.

El [benchmark final](../benchmarks/2026-09-14T22-53-02.157Z-linux-x64.json) guarda
18 muestras por motor/operación en dos procesos por motor, tres warmups y orden
alternado. No hubo compilaciones, tests ni controles de memoria concurrentes.
El tamaño indica tokens únicos; la validación verifica todos los tokens, orden,
duplicados, valor crudo/normalizado y hashes de salida fuera del tramo medido.

| Operación | Tokens | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| token-parse | 4 | 0,066 | 0,080 | 0,83× |
| token-contains | 4 | 0,040 | 0,063 | 0,64× |
| token-add | 4 | 0,139 | 0,216 | 0,64× |
| token-replace | 4 | 0,145 | 0,208 | 0,70× |
| token-parse | 1000 | 2,213 | 0,221 | 10,00× |
| token-contains | 1000 | 2,848 | 2,127 | 1,34× |
| token-add | 1000 | 1,278 | 0,491 | 2,60× |
| token-replace | 1000 | 0,144 | 0,305 | 0,47× |

Ratio = mediana jsdom / mediana rustdom. Hay mejoras en parsing, búsquedas y altas
de listas grandes, pero reemplazo y listas pequeñas siguen siendo más lentos.
Estos resultados no acreditan una mejora universal ni completan la meta global.
