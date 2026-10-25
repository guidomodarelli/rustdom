# Recursos del candidato StaticRange

Los archivos node22.json y node24.json conservan íntegros los snapshots y las
trazas del probe sobre el binario Linux aislado. Cada versión crea seis parejas
Window/Document, 774 estados válidos y 768 rechazos por tipos de nodo inválidos.
Los rechazos no incrementan el contador de estados creados. Los 774 estados
válidos se liberan y el contador NativeRange vivo termina en cero.

Cada ciclo retiene deliberadamente un StaticRange tras cerrar la ventana:
Window y Document siguen observables por separado y el control se rechaza.
Después de soltarlo, se requieren dos estados finales claros, sin supervivientes
y con los contadores nativos en su baseline. El probe conserva cada ronda,
incluidas las observaciones iniciales no claras.

RangeState contiene solo handles y offsets. Los callbacks del controlador son
síncronos y usan handles de la invocación; no se crean caches ni referencias
persistentes nuevas. El binding mantiene las referencias a nodos para que V8
trace el ownership. La propagación de excepciones se probó con objetos, Symbol,
undefined, null, NaN y -0, sin coerción a mensajes ni pérdida de identidad.
Los escenarios de GC observan liberación después de los errores.

Las pruebas generales también ejercen ciclos de creación/cierre, clones,
errores, workers y exports ESM persistentes. Los resultados son finitos y no
demuestran ausencia universal de fugas. RSS/heap/external/arrayBuffers son
snapshots del proceso; sus variaciones incluyen allocator y runtime. No se
midió memoria pico ni se calificaron Windows o macOS con este candidato.
No confundir estos datos con los del estudio de ownership ya terminado.
