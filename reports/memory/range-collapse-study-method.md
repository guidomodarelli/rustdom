# Recursos y retención del método prospectivo de collapse

El método nuevo controla el orden de procesos y reutiliza exactamente los
paquetes calificados. No cambia el addon43410883 ni la distribución0d2c0835;
su evidencia finita de Window/Document/Range/NativeRange sigue en
range-collapse-package-preparation.{json,md}. La QA del método no capturó
workers de benchmark ni produce medidas nuevas de memoria del candidato.

Revisión de retención del código de control:

- plan() construye512pares por Node y1024tuplas; las colecciones se crean por
  llamada. No agrega caches globales ni conserva objetos DOM. El orden
  cambia, pero los procesos reales del plan siguen siendo2048en total.
- La proyección canónica del estimador crea un Map y un array temporales de
  referencias a todas las observaciones de la fase. No duplica sus gráficos,
  filtra muestras, agrega pesos ni muta los reportes originales.
- El productor conserva deliberadamente el índice de procesos y los valores
  escalares necesarios para recalcular el resultado completo. Su crecimiento
  está acotado por la matriz fijada; esto no es evidencia de memoria pico.
- Las derivaciones y los controles operan con archivos/JSON. El worker carga
  una sola copia física por proceso, usando el contrato original y su baseline
  nativo. Se mantienen tres rondas de cleanup y dos estados finales claros,
  con Window y Document separados. La ejecución real todavía está pendiente.
- Los helpers cierran descriptores de logs en finally, preservan parciales y
  no crean timers u observers nuevos en el runtime. Los tests limpian solo
  directorios temporales propios verificados; el proceso nuevo no reutiliza
  estado del worker anterior.

Se conserva íntegra la QA inicial fallida por relocalización del binding y la
QA corregida. Los contratos verifican que no se invoque el sampler durante
--inspect, --plan y --preflight, y ejercen rechazos de contexto/reintento antes
de crear muestras. Los14contratos de paquetes por Node sí usan el runtime real,
pero no constituyen nuevos ciclos de memoria ni una captura de rendimiento.

La captura prevista conservará baselines por proceso y tres snapshots del
padre. Aún no existen esos nuevos datos: no afirmar memoria pico, una mejora
de RSS ni ausencia universal de fugas a partir de esta revisión o pruebas
finitas. El runtime sigue híbrido y el rendimiento todavía no está aceptado.
