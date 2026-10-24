# Fixtures candidatos con consumidores compartidos

Variante funcional para revisar el calentamiento de ownership. El sampler
congelado y el runtime de rustdom siguen intactos; este módulo aún no los
reemplaza ni aporta una decisión de rendimiento.

## Cambio concreto

Las factories del worker original crean `produce` y `validate` en cada objeto
fixture. Las rondas de warmup construyen objetos temporales, con funciones de
identidad distinta a las del fixture medido. Eso no demuestra por sí solo que
V8 no reutilizara código compilado, ni explica los trece controles rechazados.

`MutationFixture` y `DeliveryFixture` usan métodos de prototipo compartidos
entre fixtures temporales y medidos. Los callbacks de entrega usan un target
`receive` común con objetos bound distintos, cada uno asociado a su fixture.
No se afirma que todos los callbacks tengan la misma identidad.

La calificación reutiliza `benchmarks/ownership-warmup.cjs` y sus tres rondas
originales. Los nodos del fixture medido no reciben las mutaciones de los
temporales: se comprueban atributo inicial, texto, hijos sin insertar,
ausencia de registros pendientes y ausencia de callbacks consumidos. El
trabajo medido conserva sus primeras mutaciones, sin reciclar nodos ya usados
para hacer un escenario más fácil. Los helpers Range siguen siendo los
originales, que ya comparten sus cuerpos.

El HTML es el del worker original, incluyendo tabla, atributos y entidad
decodificada. Range conserva sus filas, selección y textos originales. Cada
una de las ocho cargas debe reproducir el hash de salida público del jsdom
independiente guardado en el estudio 39921160254, además de comprobar campos,
identidades, orden y checksums. No se verifican strings del código fuente.

## Pruebas reales y recursos

Preparación oficial 39906777389, UUID b1412b0b-da1f-4147-9879-c38a821b43da:
jsdom J0 27.4.0 y candidato híbrido B/source5ef, autenticados con el verificador
existente. Se ejercitan sus APIs reales y el addon real, sin mocks de plataforma.

En Node 22.12.0 y 24.14.1 pasaron cuatro tests funcionales por perfil:

- Ocho cargas, dos ciclos por carga, en jsdom y rustdom: 32 casos por Node.
- Validación de salida fallida, seguida de cleanup idempotente.
- Carga de entrega no soportada, sin agregar hosts ni recursos nativos.
- Cancelación después de encolar una entrega, conservando la promesa pendiente.

Los fixtures descartados quedan retenidos deliberadamente por el test. Se
conservan también las promesas pendientes del último caso. Aun así, las 76
Window y 76 Document observadas por separado se liberaron antes de terminar
los procesos, con 152 estados finales requeridos claros. Se guardan las 58
primeras rondas no claras. La cancelación comprueba ausencia de efectos de
entrega en el fixture; no deduce cuántas veces entró el runtime al callback.

`dispose()` desconecta observers, retira el host y borra referencias a nodos,
registros, promesas, resolvers y observers. No agrega un cache global. En el
runtime híbrido, las categorías de liveness del helper de memoria vuelven
a sus baselines registrados: `napiClasses.live=22`, no cero.

Los cinco tests de evidencia por Node comprueban los reportes reales y el
rechazo de resultados falsificados, guards duplicados, Window omitida o
preparación sustituida. Ambos lectores producen el mismo resumen. La evidencia
íntegra y sus logs están en
`reports/validation/native-class-ownership/shared-fixture-candidate/`;
`reports/memory/shared-fixture-candidate.*` conserva rangos y límites.

## Historial conservado

El intento 1 falló por un error del test al tratar claves de carga como objetos.
Los otros dos tests pasaron y se conservan los parciales. El intento 2 pasó
con HTML funcional simple; el 3 agregó baselines nativos serializados; el 4
amplió a HTML/Range exactos y hashes del estudio original. El 5 agregó el caso
de cancelación. Todos los logs y reportes siguen disponibles. El resumen de
76 owners por tipo corresponde solo a la calificación final, no suma ensayos
anteriores. Ninguno fue una recaptura del estudio de rendimiento.

## Reproducción y siguiente criterio

Con la preparación original extraída y Node fijado, desde este checkout:

```sh
RUSTDOM_SHARED_FIXTURE_PREPARATION=/ruta/ownership-build \
RUSTDOM_SHARED_FIXTURE_EVIDENCE=/ruta/evidencia-nueva.json \
node --expose-gc --test reports/benchmarks/native-class-ownership/shared-fixture-candidate/contracts.spec.cjs
node --test reports/benchmarks/native-class-ownership/shared-fixture-candidate/evidence.spec.cjs
```

El segundo comando solo lee evidencia guardada. El primero ejecuta pruebas
funcionales y GC; no mide ni acepta rendimiento. Los snapshots de memoria no
son memoria pico ni prueban ausencia universal de fugas. El orden de runtimes
y la retención del allocator impiden interpretar sus rangos RSS como un A/B.

El paso siguiente es integrar estos consumidores en una copia prospectiva
del worker, preservando HTML, primeras mutaciones, campos, orden, preparación,
entropía, afinidad, fronteras y teardown, y calificar esa integración. La
identidad compartida no garantiza estabilidad de V8. No se elige un nuevo
número de rondas ni se recaptura nada a partir de esta calificación.

Ownership continúa `accepted:false`; esta evidencia mantiene
`performanceAccepted:null`. Los presupuestos y el estimador no cambian.
Sin tag ni merge; el objetivo de migración completa a Rust sigue pendiente.
