# Observación prospectiva de compilación nativa

Estado: validación del método. No ejecutar la captura de diez procesos antes
de publicar, revisar y cotejar estas fuentes y pasar contratos reales Node22/24.
No repetir las capturas anteriores ni convertirlas en aceptación.

El orquestador está en `run.cjs`; comparte `command.cjs` con los contratos reales.
Las seis fuentes requeridas están declaradas en `constants/trace.json`. Antes
de invocarlo, el operador verifica en Git y GitHub el SHA publicado y los bytes
de esas seis fuentes, y escribe un recibo `{commit, files}` con hashes por path
relativo a este directorio. `verifySources` coteja bytes con ese recibo; por sí
solo no demuestra publicación remota. El recibo de derivación está fijado por
SHA-256 independiente y se autentican sus 390 partes antes de importar el sampler.

```text
node run.cjs DERIVED OFFICIAL_PREPARATION PUBLICATION.json NEW_OUTPUT NODE22 NODE24
```

El directorio de salida debe ser nuevo y disjunto de ambas entradas, resolviendo
su padre real. Se copian fuentes instrumentadas, fuentes del método y recibo.
El índice conserva comandos, PIDs, exit/signal, stdout/stderr y hashes de traces;
cualquier fallo de proceso o lectura detiene el resto sin reintentos. Se revalidan
fuentes y preparación después de cada Node. Los contratos del orquestador usan
procesos Node reales que fallan o escriben un JSON inválido: deben conservar el
primer resultado y no lanzar el siguiente. No son muestras del producto.

## Pregunta y fundamento

La captura CPU/GC publicada en `2af7a05c` conserva 960 intervalos. Los controles
de rangos no muestran GC solapado; los cambios entre primeras y últimas muestras
no tienen dirección universal. En range-control/1000 jsdom Node22, J0/J1 bajan
41,59%/40,46%; Node24 J0 baja 13,35% y J1 sube 47,97%. Es un proceso por paquete,
instrumentado en WSL: no estimación poblacional ni explicación de Azure.

Los pocos ticks hoja por operación muestran rutas reales de Range, su wrapper
y SymbolTree. No registran tiers, compilaciones o deoptimizaciones. El sampler
crea un Window en cada muestra y jsdom instala interfaces en cada Window;
su cloneRange crea otro wrapper e implementación. Esto justifica observar
actividad del compilador, sin demostrar que cause los cambios de tiempos.

Pregunta: después de los tres warmups, ¿se observan eventos de categorías de
compilación durante las operaciones o entre ellas? Separar hilo principal y
fondo, preparación, warmups, muestras y teardown. Los eventos sin nombre de
función no permiten atribución a Range o a una clase particular. Presencia
temporal de trabajo del compilador tampoco prueba que explique un delta.

## Entradas e instrumentación

Reutilizar sin modificación el wrapper y las 387 fuentes derivadas del método
`8c6dc74b`, ya validados en Node22/24 y conservados con la captura anterior.
No cambiar clocks, fixtures, ocho cargas, tres warmups, nueve muestras, aserciones,
identidades de paquetes o tres rondas de cleanup con sus dos últimas claras.
Verificar bytes de la copia y la identidad oficial completa antes y después.

Preparación oficial 39720077911, artefacto12400802735, UUID
99fb5dd8-2ee8-402c-97b4-d8174069f933; no recompilar ni sustituir paquetes.
ZIP SHA-256 b25f1e98608c6abb50cb9a5c9feb00f825276941511f3ed9905c457480582610.

Flags por proceso: `--expose-gc`,
`--trace-event-categories=v8,disabled-by-default-v8.compile` y
`--trace-event-file-pattern=RUTA_ABSOLUTA_UNICA/trace.json`.
Sin CPU profiler simultáneo. La categoría se declara en `constants/trace.json`.
Node/V8 producen el archivo nativo y conservan timestamps y threads; no se
interceptan ni reemplazan APIs del runtime. El wrapper sigue conservando spans
y GC escalares, reloj hrtime/performance y errores; no agrega referencias DOM.

La prueba de la interfaz CLI en Node22.12.0/24.14.1 emitió eventos de compilación,
optimización y fondo reales en un programa numérico con checksum. Es una prueba
de capacidad de la herramienta, no de compatibilidad DOM ni benchmark del producto.
Los contratos siguientes ejercen J0/A0 reales con las ocho cargas en ambos Node,
outputs iguales al archivo congelado, spans originales, coherencia del dominio
de reloj y endpoints finales claros. Se conservan aparte de la captura futura.

## Captura y lectura

Una captura local, Node22.12.0 y después24.14.1. J0/A0/J1/A1/B en el primero,
orden inverso en el segundo. Diez procesos, ochenta lotes, 960 spans; CPU2 solo
en el hilo principal, máscaras de fondo registradas. Conservar todo resultado,
incluido error o archivo parcial, sin reintentar procesos fallidos.

El análisis conserva todos los eventos. Se reportan por separado eventos
completos `X`, fases restantes y metadatos. Distinguir actividad de compilación,
escaneo de candidatos, instalación/finalización y GC; no sumar eventos anidados
como tiempo independiente ni confundir trabajo de fondo con pausa del hilo
principal. Reportar cada nombre observado y los casos no reconocidos. Los
eventos de categorías de compilación no implican todos una nueva compilación.

Convertir el dominio de hrtime con ambas anclas, exponiendo incertidumbre
observada y sin asumir un límite universal entre extremos. Los `tts`/`tdur`,
si están presentes, pertenecen al hilo del evento; no representan CPU de toda
la operación. No restar tiempos de compilación de muestras ni eliminar eventos,
muestras o cargas. Ausencia de evento observado no demuestra ausencia de JIT.

Host local WSL Intel y flags de tracing distintos de Azure y del CPU profiler
anterior. Hay overhead; ninguna razón de estos tiempos acepta presupuestos ni
demuestra resolver el rechazo. Mantener ±2% jsdom, ±5% Rust A/A y +5% Rust A/B
en futuras decisiones, con todas las filas y ambos Node. Las decisiones previas
siguen rechazadas. Sin merge, tag de ownership ni crédito de migración Rust.

## Fuentes de la herramienta

- [Tracing de Node22.12.0](https://nodejs.org/download/release/v22.12.0/docs/api/tracing.html).
- [Tracing de V8](https://v8.dev/docs/trace).
- [Compiler de V8 incluido en Node22.12.0](https://github.com/nodejs/node/blob/v22.12.0/deps/v8/src/codegen/compiler.cc):
  el evento OptimizeCode se emite en el flujo de compilación; no trae identidad
  de función. El alcance de otros tiers depende de la versión y de sus eventos.
