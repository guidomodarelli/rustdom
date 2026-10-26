# Recursos del lector y del análisis de dispersión

El análisis conserva 16 pares de medias y tres series de 16 contrastes por
criterio. No añade caches persistentes, wrappers, callbacks ni referencias DOM.
Los arrays retornados pertenecen al caller. Se preserva la entrada adversa o se
rechaza antes de producir intervalos; no se acumulan intentos globalmente.

El lector CI limita cada archivo/miembro a8MiB y solo interpreta datos. El
dataset real tiene dos ZIP de ≈161KiB y calendarios de ≈4MiB descomprimidos.
El ZIP no se extrae a disco ni se ejecuta. Los descriptores se cierran mediante
context managers. Los seis contratos ejercen rechazo y lectura con datos reales.

No se midieron heap/RSS ni memoria pico y estos contratos finitos no demuestran
ausencia universal de fugas. No hubo creación de Window/Document en este cambio;
sus ciclos, endpoints y recursos nativos siguen pendientes del capturador real.
No se reutilizan snapshots históricos como evidencia de una captura nueva.
