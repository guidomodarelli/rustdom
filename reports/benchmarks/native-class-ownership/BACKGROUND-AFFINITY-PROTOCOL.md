# Contraste prospectivo: afinidad auxiliar separada

El estudio row-isolation completo conserva su rechazo: siete controles jsdom
fuera de ±2%, sin violaciones numéricas del presupuesto Rust. No se repite esa
secuencia. Las máscaras registradas permitían que todos los hilos auxiliares
usaran CPU2; esos endpoints no muestran dónde se ejecutaron ni prueban causalidad.

La única intervención de este método es configurar los hilos auxiliares ya
existentes en `0-1,3-15`, antes de cargar el paquete DOM. Se inicializa libuv con
una lectura real de archivo. El hilo principal conserva `0-15` hasta que el
sampler original lo fija en CPU2. Se exigen snapshots de bootstrap, inicio del
sampler, configuración y final. La aparición/desaparición de un TID observado o
una máscara distinta rechaza integridad. Un hilo transitorio entre snapshots no
es observable; no se afirma aislamiento físico, ausencia de SMT ni exclusividad
del host. No se desactiva JIT, compilación concurrente ni GC natural.

Se mantienen las cinco copias físicas del artefacto oficial12400802735,
preparación99fb5dd8-2ee8-402c-97b4-d8174069f933. No se recompilan ni se sustituyen
por el build501f. El código compilado B sigue siendo fuente0d67 y distribución99c07;
el harness canónico actual es0b485. Su diferencia histórica `scripts.test:compat`
está documentada en el replay publicado, no se oculta como igualdad de builds.
El nuevo wrapper no cambia ninguna de las415fuentes anteriores. Conserva semillas
1..16, tres lecturas RNG, todas las ocho cargas públicas, AA y AB, cuatro factores
balanceados y16posiciones. Son1024procesos y9216duraciones por Node22.12.0/24.14.1;
144duraciones por celda, mediana agrupada, jsdom±2%, RustAA±5%, RustAB+5%.
Mantiene warmup, operación pública, corrección y teardown íntegros.

No se eligen filas, semillas, resultado favorable ni cantidad de muestras después
de ver tiempos. Se ejecuta una sola secuencia con raíz nueva, revisión independiente,
publicación y autenticación previas. Un resultado negativo se publica completo y
no autoriza repetir ni ajustar el protocolo. El CLI de producción exige las dos
verificaciones de afinidad y de integridad; el resumen interno del driver base no
es por sí solo aceptación de este método.

Antes de esa secuencia se requiere calificación funcional real en ambos Node:
ocho cargas por cada una de las cinco copias, hashes públicos iguales a jsdom,
ventana/documento separados y baselines nativos liberados antes de salir, flags y
RNG sin modificar, rechazo de máscaras solapadas, tareas ausentes/duplicadas,
endpoints falsos, argumentos inválidos y archivos existentes. Los tiempos de QA
se conservan pero nunca se usan para aceptar rendimiento o seleccionar el método.
El archivo row-isolation previo debe seguir verificando el mismo rechazo y no
puede etiquetarse como este estudio. Ninguna prueba finita acredita ausencia
universal de fugas. Esta intervención del arnés no migra APIs a Rust ni habilita
tag, merge o porcentaje de migración.
