# Control de despacho de eventos: baseline previo a la migración

El estado publicado `ec7485eb45e21294190c1c60db0c084f3b6b1ffa` mantiene escalares
de Event en Rust, pero conserva control de despacho, path y listeners en JavaScript.
Esta etapa todavía no los declara migrados.

Se agregaron 16 contratos públicos: ocho combinaciones de visibilidad de raíces
y composed para slots anidados, y cuatro casos por motor para modificaciones
de listeners/reentrancia/AbortSignal, paths tras adopción, restauración de
window.event después de errores y rollback de activación de checkbox.

El [baseline inicial](event-dispatch/baseline.log) pasó. El arnés se reforzó para
comprobar los errores de listeners fuera de dispatch: el DOM normalmente captura
esas excepciones, lo que podría ocultar una aserción fallida. EventTarget sin
Window registra observaciones y resultados que se verifican después del despacho.
El [baseline con ese control](event-dispatch/baseline-errors-checked.log) también
pasó los 16 tests. No se usan mocks de jsdom, Rust ni APIs de plataforma.

El siguiente cambio debe migrar el control de recorrido y las transiciones de
dispatch, junto con el filtrado de composedPath, manteniendo callbacks y owners
visibles a V8. Debe reducir cruces por propiedad y volver a medir las mismas
cargas: el estado escalar registra 10,750 ms para 1.000 despachos frente a
3,348 ms en jsdom. Los tests nuevos son una referencia previa; no acreditan
rendimiento ni una implementación nativa que todavía no se integró.
