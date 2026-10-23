# Diagnóstico separado de jsdom: CPU, GC y JIT

Autorizado explícitamente por el usuario el 23 de octubre de 2026. El resultado
39921160254 permanece completo y rechazado; no se repite ni acepta su estudio.
Este protocolo produce observaciones instrumentadas, siempre `accepted:null`.

## Pregunta y alcance fijados antes de ejecutar

Observar CPU muestreada, CPU del proceso, GC y eventos de código/funciones de V8
en las ocho cargas públicas del control jsdom. Separar setup, warmups, operación
y cleanup. No afirmar que una coincidencia temporal explica los trece rechazos.

Usar la preparación oficial 39906777389, UUID b1412b0b-da1f-4147-9879-c38a821b43da,
sin reconstruir paquetes. Autenticar su identidad completa y el arnés 97284800.
Solo se cargan J0 o J1, jsdom 27.4.0; no se ejecuta el addon de rustdom. El CI general
de c71ede39 aprobó sus ocho jobs y no sustituye el presupuesto de ownership.

Captura única en un runner ubuntu-22.04 de GitHub. Node 22.12.0 y después
24.14.1, con sus ejecutables fijados. Reutilizar la secuencia row-isolation AA,
filtrada prospectivamente a jsdom y posiciones 0 y 15, con ambas etiquetas y
las ocho cargas, en el mismo orden relativo. Las semillas son 1 y 16; las
posiciones límite invierten los cuatro factores. Es una cobertura acotada del
mecanismo, no una estimación sobre las dieciséis posiciones ni un contraste A/B.

Son 64 procesos, 768 intervalos (192 warmups y 576 medidos). Cada proceso carga
una sola copia y una sola carga; conserva tres realms exteriores de warmup,
nueve medidos, warmup de operaciones, GC, aserciones y limpieza originales.
El hilo principal usa CPU2 y se conservan las afinidades de fondo originales.
Los tiempos tienen overhead de observación y no se comparan con presupuestos.

Se separan prospectivamente dos modos: etiqueta A registra CPU con Inspector
y GC; etiqueta B registra JIT y GC sin Inspector. V8 desactiva su file logger
mientras está activo el CPU profiler (log.cc, is_logging). Por eso no se mezclan
ambos en un proceso ni se rellenan sus observaciones ausentes con ceros.
En cada Node hay 16 procesos CPU y 16 JIT; cada modo recorre las ocho cargas
y ambas copias físicas entre las dos semillas. No se comparan tiempos entre
modos ni se atribuye un evento JIT del modo B a una muestra CPU del modo A.

## Instrumentación y relojes

Derivar una copia de las 434 fuentes verificadas mediante el preparador existente
sampler-diagnostics/prepare.py. Conservar todas las fuentes, hashes y el diff.
Registrar spans después del stop clock original. Agregar process.cpuUsage antes
del start clock y después del stop clock, fuera del tiempo de pared medido.
Ese contador abarca el proceso y sus threads; no es CPU exclusiva del hilo JS.
La validación de flags de la copia derivada añade únicamente los flags fijados
en constants/protocol.json; el arnés congelado no se modifica.

El wrapper registra GC con PerformanceObserver y solo conserva escalares.
Inspector Profiler usa intervalo de 100us y se detiene, deshabilita y desconecta
también ante error. Se guarda el perfil original completo. No se activa el
backend trace-events de Node, cuyo NodeTraceBuffer falló en el diagnóstico previo.

El log nativo de V8 conserva eventos de código, funciones y deoptimización.
Dos scripts vm.Script con nombres únicos, evaluados en el contexto principal
fuera de toda operación DOM,
permiten acotar el offset del reloj del log frente a performance.now usando
el evento script/create y su script-details. Se conservan ambos brackets y
su incertidumbre; no garantizan un límite global entre extremos. Para CPU se
conservan anclas hrtime/performance al inicio y fin. No sumar eventos anidados
como CPU, ni tratar duración reportada de compilación como pausa de JS.
Los brackets incluyen 1us por la cuantización entera de timestamps nativos;
no constituye una cota universal de deriva del reloj. Los puntos de JIT son
instantes de emisión del registro, no intervalos de CPU de compilación.
Los ticks del profiler nativo --prof también llevan un timestamp de emisión
desde su thread de logging, no necesariamente el instante original de muestreo;
esa alternativa se comprobó y no se adopta para atribuir CPU por operación.
Los dos intentos parciales de calificación y las pruebas de capacidad se
conservan separados; ninguno forma parte de la captura de 64 procesos.
Los deltas firmados del perfil Inspector se conservan íntegros, incluidos los
negativos observados en calificación. Se reconstruyen en su orden original y
se reportan las muestras fuera de orden; no se recortan, ordenan ni eliminan.

## Validación, ejecución y conservación

Antes de la captura: ejecutar contratos reales con las ocho cargas y ambas
copias en Node22/24, separados del estudio. Validar resultados públicos contra
el archivo original, doce spans exactos, CPU/GC/perfil/log presentes y ventanas
y documentos liberados en los dos endpoints finales. Probar errores, output
preexistente, fuente alterada y ausencia de reintentos con procesos reales.
No sumar tiempos de calificación a la captura.

Publicar método y recibo de revisión sin hallazgos, autenticar sus bytes en GitHub
y recién después activar una vez ownership-jsdom-telemetry-v1. El historial
paginado de runs no omitidos solo puede contener el run actual; no reaplicar
la etiqueta ni relanzar un proceso fallido. Un error detiene el resto y conserva
todos los parciales, logs, códigos, señales, hashes y la preparación.

Guardar los 64 reportes, 32 perfiles CPU, 32 logs V8, GC, fuentes derivadas y método,
versiones y hardware. El análisis retiene todos los intervalos y eventos; las
filas sin datos siguen desconocidas, no se convierten en cero. Separar memoria
retenida, snapshots de RSS/heap y memoria pico no medida. Observar 768 Window y
768 Document por separado, incluidos warmups, y 128 endpoints finales requeridos.
Son observaciones finitas; no prueban ausencia universal de fugas.

Los presupuestos originales permanecen jsdom ±2%, Rust AA ±5% y Rust AB +5%,
en todas las cargas y ambos Node. Este diagnóstico no concede tag, merge,
aceptación ni crédito de migración Rust. Una hipótesis respaldada no equivale
por sí sola a resolver el rechazo de Azure.

Fuentes de las herramientas: [Inspector Node22](https://nodejs.org/download/release/v22.12.0/docs/api/inspector.html),
[logger V8 de Node22](https://github.com/nodejs/node/blob/v22.12.0/deps/v8/src/logging/log.cc)
y [logger V8 de Node24](https://github.com/nodejs/node/blob/v24.14.1/deps/v8/src/logging/log.cc).
