# Recursos del lector y datos preservados

El lector utiliza el predicado actual de liberación y conserva todos los contadores
nativos de cada ronda, baselines y snapshots del padre. Los datos funcionales ya
existentes incluyen 768 Window y 768 Document separados, ocho primeros estados no
claros y dos estados finales claros por proceso. No se tomaron nuevas mediciones.

Se verificó el propio lector en Node 22.12.0 y 24.14.1 con ocho escrituras fallidas
reales por SDK mediante RLIMIT_FSIZE=512 y EFBIG. Antes y después de cada ciclo hubo
22 descriptores; los parciales quedaron preservados y ambos escritores se cerraron.
El caso usa el sistema operativo real, sin mocks. observations.json conserva los
conteos y hashes de SDK y lector; los logs íntegros están en el ZIP de validación.

Las pruebas cubren esos caminos de error finitos. No prueban memoria pico ni ausencia
universal de fugas del lector o del DOM. No actualizan la aceptación de rendimiento.
