# Replay del contrato de tareas y recursos

El lector de procesos reutiliza `owner-batch-study/results.validateWorker` como
contrato raw inmutable. No altera headers, fuentes, duraciones o campos Git para
hacerlo coincidir. El formato no identifica el commit del productor: su identidad
requiere autenticación independiente en el futuro transporte/envelope.

Se copiaron íntegros 32 casos funcionales jsdom (Node22/24, ocho filas, dos labels,
AB/factor0) y sus recibos: 36 archivos, 22469018 bytes. La preparación comprobó
el manifiesto original SHA2b164f4c y cada binding; los tests autentican los datos
con pins junto al código. El manifiesto conserva paths y el B4b52 históricos;
solo se consumen casos jsdom. No prueban el candidato a277, otros factores ni
una ejecución nueva. No se ejecuta ningún script archivado.

El replay validó 4608 duraciones medidas, 1536 warmup y 384 Window/384 Document
separados, tres rondas y dos endpoints finales claros por proceso. Son conteos
del dataset funcional histórico, no muestras nuevas. El contexto de host/reloj
del padre en estos tests es sintético y está identificado; no se afirma una
correlación física con el reloj de los procesos históricos.

El modo funcional devuelve analysisObservation=null. El modo capture está
bloqueado mientras executionReady=false. Se rechazan muestras faltantes,
salidas públicas alteradas, retención de Window o Document en cualquiera de
los endpoints finales, relabel de factores/SDK, relojes inválidos, roles Rust y
baselines nativos inventados para jsdom. Transporte y fuente siguen siendo
responsabilidad pendiente del lector integral; los flags de salida lo indican.

Pasaron **19 contratos por SDK/plataforma** en Windows/Linux ×
Node22.12.0/24.14.1: 76 en total, con ocho contratos nuevos de raw reader.
El registro del lector hosted pasó nueve por plataforma y autenticó los CI
ec57/5be con sus conteos distintos. actionlint aprobó el workflow ampliado.
La primera invocación falló antes de leer datos por una ruta del fixture con
un parent de más; se corrigió y se conserva un resumen identificado del error.

El flujo completo local pasó ocho órdenes en Git Linux real: checkout, nueve
contratos de lector, lecturas ec57/5be y tests/calendario en ambos SDK. Fixture
cde8bf60, 888 inputs; bytes materializados preservados y Git limpio. Es un
fixture local, no un commit publicado. QA, logs y calendarios en `sparse/`.

CI hosted de los 19 contratos aún pendiente de publicación/calificación. El
CI de dispersión anterior5be terminó2/2 aprobado y su archivo íntegro se publica
en `hosted/40288143186/`; no acredita el lector de procesos nuevo.

No hubo DOM, benchmark, captura científica, tag ni merge. Faltan integración
del lector completo, capturador con límites y revisión prospectiva. El runtime
sigue híbrido y el gate ownership rechazado; performanceAccepted=null,
gateReevaluated=false, ejecución del piloto deshabilitada.
