# Calentamiento de operaciones dentro de cada ventana

Método prospectivo; todavía sin aceptación de rendimiento. No repite la captura
de optimización ni modifica los estudios rechazados. No atribuye causalidad
a los logs: estos no están alineados con los cronómetros. Los fallos anteriores
y el gate vigente permanecen publicados y rechazados.

## Cambio y alcance

Los tres lotes previos calientan otras ventanas. Cada ventana de jsdom instala
funciones propias; el ensayo anterior incluía su primer uso en el intervalo.
Este contraste mide las mismas secuencias públicas después de **tres rondas
adicionales en la ventana actual**, fuera del reloj. Los dos bucles Range se
extraen a funciones compartidas por warmup y medición; esto también cambia el
sitio de llamada y debe considerarse al interpretar el contraste. No se intenta
separar esos dos factores ni se afirma que la nueva medición sea equivalente
al costo del primer uso. La cobertura de arranque sigue en las suites completas
ya publicadas; este ensayo no sustituye evidencia de arranque por operaciones
calientes ni concede por sí solo aceptación al PR.

Range usa los mismos textos/rangos preparados y no muta su contenido. Mutation
records y delivery usan hosts temporales hermanos dentro del mismo documento;
se validan todos los records, se desconectan observers y se eliminan esos hosts.
La fixture medida permanece intacta. El frame de warmup retorna y se ejecutan
dos GC major asincrónicos con turnos de event loop antes del GC/timer original.
La entrega medida se prepara después de esa limpieza, justo antes del reloj.
Las temporales no se incorporan al hash del DOM medido. No se comparten ventanas
entre lotes ni se mantienen caches de ventanas, wrappers o métodos.

## Entradas y decisión fijadas antes de medir

Se reutiliza sin reconstruir la preparación oficial 39720077911, artefacto
12400802735, UUID 99fb5dd8-2ee8-402c-97b4-d8174069f933, autenticada antes y
después de cada Node. Node22.12.0 y después Node24.14.1. Mismas ocho cargas,
fixtures, tres warmups externos y nueve muestras. Una copia por proceso,
afinidad CPU2 solo para el hilo principal. Mismas dieciséis posiciones y
cuatro factores independientes de independent-order: par, copia física, orden
de cargas y motor. A/A y A/B completos: 256 procesos, 2048 lotes y 18432 tiempos.

Mismo estimador de medianas agrupadas, ±2% jsdom, ±5% Rust A/A y +5% Rust A/B,
en todas las filas de ambos Node. No se quitan controles, muestras ni filas;
no se corrigen tiempos por perfiles, no se aflojan límites y no hay reintentos.
No usar contratos funcionales para decidir presupuestos. Una ejecución completa
rechazada se conserva y permite pasar al siguiente Node; fallo de integridad
detiene la secuencia conservando lo parcial. Sin tracing ni profiler.

## Validación y recursos

Antes de ejecutar: pruebas reales en ambos Node con jsdom y addon oficial,
hashes públicos iguales al oráculo histórico, activación nativa, 12 referencias
débiles Window/Document por lote y retorno a baseline nativo. Revisar, publicar
y autenticar el arnés completo y su recibo. Registrar commit y hash del arnés.

El worker conserva tres rondas de cleanup final, últimas dos claras; medir
Window y Document por separado y estadísticas nativas. Conservar heap/external/
RSS post-GC; no son memoria pico ni demuestran ausencia universal de fugas.
Guardar todos los crudos, comandos, versiones, hardware, stdout/stderr, samples,
fuentes, preparación e inventario. No hay crédito de migración Rust por este
cambio del benchmark ni merge/tag de ownership antes de resolver su gate.
