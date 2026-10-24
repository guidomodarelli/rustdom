# Recursos del orquestador y sus contratos

Los cuatro procesos DOM recientes observaron 384 referencias Window y 384
Document, incluidos warmups. De 96 observaciones de cleanup, las 64 finales
exigidas quedaron claras para ambos tipos y baselines nativos. Dos observaciones
iniciales aún no claras se conservaron; no representan dos objetos únicos.

Los contratos de error del recorder no crean DOM. Los procesos Node de prueba
terminan con el exit esperado o escriben datos inválidos para ejercitar la
lectura real; el recorder no lanza el siguiente proceso. Los descriptores de
stdout/stderr se cierran en finally incluso si falla la apertura o el spawn.
El sampler reutilizado sigue drenando y desconectando su observer al fallar.

La memoria y buffers de los traces pertenecen a procesos acotados. Se guardan
los estados heap/external/RSS después de GC en los reportes originales; no son
picos ni se comparan con procesos sin tracing como si aislaran memoria Rust.
No se demuestra ausencia universal de fugas ni se acepta rendimiento. La
secuencia completa del nuevo `main` todavía no se ejecutó.

Fuentes y crudos: `reports/validation/native-class-ownership/compilation-orchestrator/`.
