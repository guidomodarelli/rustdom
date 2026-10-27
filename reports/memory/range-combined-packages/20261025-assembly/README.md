# Paquete hospedado: ciclos mixtos antes y después del transporte

Cuatro JSON crudos:Node22.12.0/24.14.1 antes/después del roundtrip completo.
No son réplicas de estudios históricos ni muestras de rendimiento. Cada proceso
compara CJS/ESM con jsdom y recorre6ciclos:390StaticRange,384Range,384rechazos adicionales,
6Window y6Document observados por separado.

Cada ciclo conserva un StaticRange para comprobar supervivencia controlada y
después exige dos estados claros consecutivos. Se guardan todas las rondas,
incluidas las no claras,heap/RSS/external,arrayBuffers y baselines/contadores.
En los seis ciclos se crearon/liberaron774estados nativos adicionales;live final0,baselines
restaurados ycleanupErrors0. Los controles sobrevivieron mientras correspondía.
Las clases constructoras permanentes son baseline,no ventanas vivas.
Los consumidores CJS/ESM ya habían creado/liberado4estados antes de esos ciclos;
los contadores totales por proceso terminan en778creados/liberados.

Los lectores cierran archivos/ZIP/tar y no mantienen referencias N-API o caches
DOM;no instalan ni recompilan. Las pruebas finitas no demuestran ausencia universal
de fugas ni memoria pico;tampoco atribuyen cambios deRSS a fugas del allocator.
Runtime híbrido,no integrado;rendimiento de ownership no aceptado.
