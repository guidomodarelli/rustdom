# Recursos tras sellar el índice

Probes locales con el verificador corregido, fixture Git Linux real y el mismo
paquete a277/fb06276a. Node 22.12.0 y 24.14.1 completaron seis ciclos cada uno,
con doce estados finales claros de Window/Document/rangos/wrappers separados.
Se preservan baselines, estados retenidos, trazas, contadores, heap, memoria
externa y RSS. Son resultados locales; no se etiquetan como GitHub Actions.

El cambio es de verificación de metadata, sin modificar Rust ni el runtime.
La lectura del índice queda limitada a 47796 bytes y no guarda referencias
persistentes al contenido inspeccionado. Esto no es una medición de memoria
pico del lector ni una prueba universal de ausencia de fugas. No hay aceptación
de rendimiento ni reevaluación del gate. Node 22 conserva su warning de parse5.
