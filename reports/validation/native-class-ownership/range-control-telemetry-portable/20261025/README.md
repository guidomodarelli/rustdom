# Calificación portable de los contratos AA

Fuente real: checkout Git Linux privado limpio
`cfa6f1679ce6bcb41175ca05791c2e71dc3843cc`, sobre la base publicada
`7b6fca9dea7ecfff0164863d715e9c153f71b383`. El commit privado conserva el
autor ya configurado y solo deshabilita signing por invocación para esa QA;
no se publicó ni cambió la configuración del checkout principal. No es un
runtime compilado nuevo. `summary.json` conserva los 599 hashes probados.

Pasaron 17 contratos en cada Node22.12.0/24.14.1 autenticado, seis contratos
Python de derivación y seis del lector histórico en Linux. Windows Python3.12
pasó cinco del lector y omitió uno por el privilegio real de symlinks
WinError1314; Linux cubrió ese caso. No sumar estos conteos como casos únicos
de compatibilidad DOM. Actionlint1.7.12 aprobó ambos workflows.

Los planes y preflights son byteidénticos entre ambos Node. La calificación
usó el productor y lector actuales, la preparación exacta publicada y las
derivaciones completas CPU/JIT de 893 archivos. Terminó con Git limpio y
conserva todos los argv, códigos de salida, logs y contexto original.

`qa.zip`: 19928725 bytes, SHA256
`0f3ced6a09a26a84b2009d7eb347f817280ba7df5ccb146415b17aff69aca9ef`,
2424 miembros íntegramente leídos y contrastados en `members.json`. Contiene
fuentes, derivaciones, comandos, logs, preflights, planes y pruebas Windows.
Es evidencia de inspección: no ejecutar código archivado.

Los inputs ya versionados no se duplican dentro del ZIP de QA. El subconjunto
data-only está en
`reports/benchmarks/native-class-ownership/range-control-telemetry/fixtures/native-mutation-subset.zip`:
15283591 bytes, SHA256
`3f249e841d668605b4c8f6a077c9fe7cd4fc5c94c9769ae7e1476dce40f11dc7`.
Son 57 archivos originales y 98362538 bytes sin comprimir, incluido el índice
completo original de512procesos. El manifiesto enlaza artifact12545165372 y
sus ZIP/tar históricos. Se incluyen ocho procesos en ambos Node/modos/motores;
los lectores reproducen96spans por runtime manteniendo su identidad y fila
MutationRecord/100. No son datos nuevos de Range. La preparación de paquetes
también está versionada con su tar/hashes originales; se conservan su comando
de extracción y recibo. No se recompiló ni reinstaló.

La capacidad sigue deshabilitada. Hay workflows y checks offline declarados,
pero aún faltan revisión íntegra, registro final al habilitar capacidad y CI
del SHA publicado final antes de una única activación nueva. La autorización
permanente está concedida, sin otra confirmación operativa pendiente.
No se ejecutaron DOM, profiling ni mediciones nuevas. No hay replay positivo
de una captura Range que todavía no existe. `performanceAccepted=null` y
`gateReevaluated=false`; ownership conserva el rechazo histórico.

Recursos y límites:
`reports/memory/range-control-telemetry-portable-20261025.md`. No se midió
memoria pico ni se demuestra ausencia universal de fugas. Sin tag ni merge.
