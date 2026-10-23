# Preparación de un posible diagnóstico de MutationRecord

Estado: **preparación y lector individual, sin productor ni workflow de captura**. No hay
diagnóstico nuevo ejecutado ni autorización nueva solicitada o recibida.
`captureImplemented=false`, `performanceAccepted=null`, `gateReevaluated=false`.
El estudio `40012710923` está terminado y rechazado; su autorización se consumió
en esa única ejecución y no alcanza a este trabajo futuro.

## Dato faltante

En `40012710923`, Node 22 AB `mutation-records-collect/100` excede +5%, pero
su control jsdom también excede ±2%. Las trayectorias varían también en AA.
No contienen GC/JIT ni CPU profiles del candidato dentro de los spans.
Los perfiles nativos anteriores de `profiles/v2` cubren Range y el candidato
`8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd`,
no esta fila con el runtime actual `5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806`.
El diagnóstico reciente `39959175058` solo ejecutó jsdom.

## Plan de diagnóstico propuesto

El plan conserva el orden original de `current-ownership-experiment.cjs`,
seleccionando explícitamente `mutation-records-collect/100` como caso de
diagnóstico. No es un nuevo estudio de aceptación de rendimiento.

- Node 22.12.0 y 24.14.1.
- Modos CPU/GC y JIT/GC independientes; cada modo incluye ambas etiquetas.
- AA y AB, jsdom y Rustdom, etiquetas A/B y las 16 semillas/posiciones originales.
- 128 procesos por Node/modo; 256 por Node y 512 propuestos en total.
- Tres warmup y nueve mediciones por proceso, sin recortar posiciones o extremos:
  1536 warmup y 4608 duraciones medidas, 6144 spans en total.
- 6144 Window y 6144 Document esperados por separado; tres rondas y dos estados
  finales claros requeridos por proceso, con los baselines nativos originales.

Son cantidades **planificadas**, no observadas. La selección de una fila tiene
un propósito diagnóstico explícito y no permite sustituir la matriz completa,
aceptar presupuesto, cambiar estimador o conceder una mejora. Los CPU profiles
de V8 no garantizan stacks internos de funciones Rust y la instrumentación
altera el contexto; sus tiempos no se agregarán a un A/B no instrumentado.

## Preparación que ya puede probarse sin DOM

`schedule.cjs` solo construye el plan y no lanza procesos.
`prepare.py` combina dos derivaciones existentes del repositorio actual:

1. El sampler instrumentado de `jsdom-telemetry/prepare.py`, con CPU del proceso
   y límites de setup/warmup/operación/cleanup alrededor del reloj original.
2. Los hooks de fixtures compartidos de `shared-fixture-worker/prepare.py`.

La preparación autentica las 434 fuentes contra un recibo externo publicado,
no solo contra el hash que declare el input. Exige el sampler compartido
calificado `d24c7282…` y el patch compartido canónico antes de aplicarlo sobre
la copia instrumentada. La fuente original no se modifica. Conserva los recibos,
patches y fuentes derivados, y registra hashes de todos sus archivos.

El wrapper antiguo exclusivo de jsdom se conserva como referencia sin ejecutar;
no se expone como productor nativo nuevo. Las copias de código son material de
preparación, no resultados de una medición. No ejecutar sus samplers para
"comprobar" este método sin la autorización de una captura independiente.

Los contratos ejercen ambas derivaciones reales, todos los archivos generados,
un grafo falsificado, preservación de un output existente y Python optimizado.
Los contratos Node comprueban el plan completo y que su mutación no pueda cambiar
la agenda o presupuestos originales. No se mockean addons ni plataformas.

`analyze.cjs` adapta el lector de reloj publicado, reutiliza sus funciones de
intersección y conserva la incertidumbre, ticks negativos y eventos completos.
Exige que el motor y las revisiones de report/telemetry coincidan con una identidad
explícita. Rechaza clasificar un perfil histórico como nativo o como captura nueva;
para Rust exige un baseline nativo y retorno de recursos mediante `isReleased`.
Exige las tres rondas de cleanup y los dos finales claros, junto con tres warmup
y nueve muestras medidas; una traza vacía o requisitos relajados no son válidos.
Exige también un batch completo y doce Window/Document observados por separado.
La validación usa cuatro perfiles auténticos anteriores (CPU/JIT de ambos Node),
contrastando todos los resultados contra el lector original del repositorio
actual. Esto no es una prueba end-to-end de un profiler nativo nuevo ni hace pasar
un perfil jsdom por Rust. El contrato de corrupción solo comprueba que ese relabel
inválido sea rechazado; no produce una muestra positiva ni una medición sintética.

## Trabajo pendiente antes de pedir una ejecución

Faltan el wrapper nativo de profiling, colector de ejecución, replay colectivo y
workflow de activación. Deben conservar los invariantes siguientes:

- Autenticar los dos binarios y la preparación original antes del primer worker,
  sus hashes después, los pins del método y la distribución completa A/B.
- Publicar y revisar el método completo y sus contratos Node 22/24; no declarar
  validación end-to-end del profiler nativo basándose solo en estas preparaciones.
- Mantener identidades nuevas explícitas en cada reporte; no convertir perfiles
  históricos de jsdom o Range en datos nativos nuevos.
- Cerrar y desconectar Inspector/observers en éxito y errores; preservar muestras,
  GC/JIT, perfiles completos, intervalos de reloj e incertidumbre, incluidas cotas
  negativas o eventos desconocidos, sin corregirlos para obtener una conclusión.
- No aceptar rendimiento desde un diagnóstico; no relanzar ante error, timeout o
  resultado negativo. Conservar todos los parciales y el transporte íntegro.
- Exigir autorización humana explícita independiente antes de activar una única
  secuencia. No crear/aplicar una etiqueta mientras falten código, revisión o esa
  autorización. El protocolo definitivo deberá fijar también límites de tiempo,
  orden de modos/Node, identidad publicada y recepción de artifacts.

Los 26 pins y el grafo congelado de 434 archivos del estudio terminado permanecen
intactos. El runtime continúa híbrido; el hito de ownership y la migración completa
no están resueltos. No hay tag ni merge con rendimiento rechazado.
