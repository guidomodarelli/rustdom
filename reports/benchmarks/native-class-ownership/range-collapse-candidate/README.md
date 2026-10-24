# Candidato: collapse nativo con owners idénticos

Esta variante ejecuta la actualización numérica de Range.collapse en Rust en
una sola llamada cuando startContainer y endContainer ya son el mismo nodo.
La ruta actual solicita collapsePlan, crea su objeto de transporte y vuelve
a cruzar N-API para escribir el extremo elegido. El nuevo binding conserva
las referencias y registros débiles que ya apuntan al mismo owner y delega
la selección y actualización de offsets a RangeState::collapse. Para nodos
distintos conserva el plan y el orden anterior de cambios de referencias.
El guard de ownership sigue intacto; no incorpora el patch de limpieza fría.

Son cuatro cambios sobre b63cf834: estado Rust, binding N-API, binding de
referencias V8 y declaración pública NativeRange.collapse(toStart):boolean.
El boolean indica si se actualizó el extremo inicial; se mantienen los planes
anteriores y los errores de estados incompletos. La operación nativa es
atómica ante esos errores y conserva copias independientes, -0 y NaN.

La variante está aislada, sin integrar al runtime principal. Este trabajo no
acepta rendimiento ni reemplaza ninguno de los estudios rechazados. La
reducción de dos invocaciones de binding a una se observa en el flujo del
código; no es una medición de tiempo ni una garantía de mejora global.

## Evidencia ejecutada

Rust1.99.1:313tests, formato y Clippy con warnings denegados. Addon local Linux
SHA26ba869062ae4226aa058c13edc43f582cfdfd3e1c519d7a1299bccab62239d3.
Se conserva como artifacts/range-collapse.node. La calificación específica
pasa51tests por Node22.12.0/24.14.1, incluyendo constructores/finalización,
errores, offsets especiales, copias, mutaciones, Selection y cruces de realms.
Los consumidores CJS y ESM compilan y ejecutan la API real en ambos Node.

Las seis suites completas pasan en cada Node:3780pruebas de compatibilidad
y9del launcher WPT,22Jest,33Vitest,34VM. El corpus HTML conserva1784casos
aprobados de1792y8exclusiones scripting-on. Siguen registrados sus fallbacks
de parsing y el runtime híbrido. Los WPT cubren240fixtures/83007assertions,
con1203no aprobados compartidos por referencia y candidato. complete=false:
range-deletion mantiene su bloqueo histórico de CDATA en jsdom27.4.0 y se
excluye el fixture que requiere test_driver/layout. No es certificación completa
de estándares ni un porcentaje de migración. qualification.json detalla todo.

## Recursos y preservación

La revisión específica observa6Window y6Document por Node, por separado,
384wrappers Range y384estados NativeRange, y12estados finales claros por Node.
Se preservan24observaciones retenidas como controles negativos entre ambos
Node, los baselines y todos los snapshots. Las cifras corresponden al probe
final específico; no se suman ejecuciones repetidas de suites como cobertura
adicional. reports/memory/range-collapse-candidate.{json,md} describe alcance.
No se midió memoria pico ni se demuestra ausencia universal de fugas.

validation/raw-qa.tar.xz conserva íntegros245archivos/171574336bytes de QA en
1482256bytes comprimidos. Cada miembro fue releído y cotejado por SHA256 y
tamaño; raw-qa-members.json enumera el contenido. Incluye logs, reportes
completos de compatibilidad/memoria/WPT, recibos, la primera falla TS2209 del
setup y la ejecución corregida con rootDir explícito. No ejecutar código de
esa evidencia. Las regresiones actuales están en functional/.

Se distinguen336archivos del scope de identidad de benchmarks/sources.cjs,
434fuentes del harness congelado y511pins del método histórico: son scopes
distintos, no denominadores sumables de migración. El árbol principal conserva
esos511pins y su runtime. before/after del candidato son5ef668c4/8a7baa9c;
la declaración de tipos se fija por separado en constants/candidate.json.

## Reproducción y siguiente calificación

Usar un checkout Git real de b63cf834 o de una publicación con los mismos
inputs canónicos; sourceCommit/sourceChanges/sourceGitErrors se registran
tal como los devuelve Git. En WSL usar un checkout Linux real. Los tests del
preparador admiten RUSTDOM_RANGE_PREPARATION_SOURCE para ese checkout;
la primera invocación desde un gitfile Windows falló y se corrigió el setup,
sin normalizar metadata ni atribuirla a otro commit.

prepare.cjs autentica el patch y los inputs antes de modificar la copia,
exige evidencia nueva fuera del checkout y conserva fallos parciales. Sus
seis contratos reales y su agrupador pasan en Linux Node22/24 y Windows24.21:
preservan evidencia/fixtures existentes, rechazan inputs alterados, salida
interna y reaplicación, y ejercen el patch y las cinco fixtures completas.

```sh
node <packet>/prepare.cjs <fresh-source> <fresh-outside-evidence>
cd <fresh-source>
npm ci
cargo fmt --check
cargo test --release --locked --lib
cargo clippy --all-targets --release --locked -- -D warnings
npm run build
npm test
npm run test:corpus
npm run test:wpt
```

El workflow range-collapse-candidate.yml califica Linux, Windows y macOS en
ambos Node, con Rust1.99.1/npm11.19.0 y60minutos por job. La etiqueta
ownership-range-collapse-functional-v1 fija el SHA a calificar. Es un build
funcional, sin sampler ni decisión de rendimiento. Conserva addon, runtime,
tipos, versiones, fuentes reales, recursos y reportes de cada job. Los binarios
hospedados se autenticarán por separado; no se supone identidad con el26ba local.
Tras esa calificación corresponde preparar un estudio prospectivo del nuevo
candidato, con método fijado y revisado antes de ejecutar, conservando los
presupuestos originales±2%/±5% y los rechazos anteriores. La autorización permanente cubre esas acciones. No tag
ni merge de ownership hasta una aceptación íntegra e integración probada.
