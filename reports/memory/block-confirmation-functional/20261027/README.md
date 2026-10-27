# Endpoints del productor funcional

Los dos SDK fijados completaron 128 procesos positivos con 1.536 Window y
1.536 Document observados por separado. Cada proceso conserva tres rondas;
las dos últimas liberaron los recursos observables respecto de su baseline.
Las primeras rondas no claras fueron 10 en Node22 y una en Node24. No se
descartan. Se publican también los baselines y endpoints nativos de los
64 workers Rust.

Cada SDK conserva snapshots parentales con 0, 32 y 64 workers terminados.
`audit.json` contrasta orden, contadores, reloj, memoria y CPU. Son snapshots,
no sumas de workers ni memoria pico. Los dos fallos deliberados del productor
Rust B conservan aparte un Window/Document y su cleanup claro tras el error.

`endpoints.json` tiene todos esos datos y la evidencia original está en
`reports/benchmarks/native-class-ownership/block-confirmation-functional/20261027/`.
La matriz Node22 anterior al arreglo de cancelación se conserva como historial
y no se suma al resultado final. Se observaron 210 comandos de workers cerrados
incluyendo ese historial y los casos adversos; no implica contar todos los
subprocesos internos de autenticación del paquete.

Esta prueba finita cubre las cargas declaradas, sus errores y el teardown.
No demuestra ausencia universal de fugas, ni acepta rendimiento, ni integra
el candidato a producción. El runtime sigue siendo híbrido.
