# Comparación de la intervención inline

Estado: preparación y validación; no hay una secuencia de aceptación ejecutada.
Requiere finalizar tests/reviews y publicar el método antes de medir. No acepta
ni reinterpreta los estudios anteriores.

## Intervención y pregunta

El estudio pareado anterior terminó con accepted=false y una fila A/B Node 24
fuera de +5%. Su A/A no calibró: no demuestra causalidad del SDK. La inspección
estática identificó una llamada adicional al wrapper tipado de MutationRecord.
La intervención agrega únicamente #[inline] a new_instance<T>, manteniendo
guard, errores, transferencia al finalizer y type tag/factory.

Rust 1.99.1/LLVM 23.1.1 produjo el candidato C afbf5e85e85b542d6324b9a8ce2e0295181ac1896494025dc7834ae1b4c3482f.
El símbolo tipado ya no se emite y ToNapiValue ocupa 713 bytes. Esto no demuestra
mejora de tiempo. Los 560 JavaScript reconstruidos y package.json son idénticos
a B; solo addon/metadatos difieren. El guard conserva exactamente sus bytes.
La validación funcional completa de C debe concluir antes de la comparación.

## Secuencia y criterio fijados

Se conserva el diseño completo: Node 22.12.0 y 24.14.1, ocho filas, tres warmups
y nueve muestras por lote. A es checkpoint67 y la etiqueta B representa C,
nunca el candidato anterior. A/A usa las dos copias independientes de A; el
control usa dos paquetes jsdom 27.4.0 independientes. Ocho posiciones balancean
carga, asignación física y orden de lotes. En Rust A/B, C conserva la etiqueta B.
Cada proceso ejecuta los dos paquetes y cada etiqueta recorre todas las filas.

Una sola secuencia: Node 22 y después Node 24; A/A y después A/B por Node,
posiciones 0..7, motores alternados igual que el método anterior. Son 64 procesos
y 9.216 duraciones, con el proceso como unidad independiente. Se conserva el
estimador de razón entre medianas agrupadas; no se reemplaza después de ver datos.
Los presupuestos son ±2% jsdom, ±5% Rust A/A y +5% Rust A/B, todas las filas y
ambos Nodes. Si falla la calibración o el presupuesto, no hay aceptación.

La afinidad fija solo el principal a CPU2; los hilos de fondo mantienen máscaras
más amplias. Las tres rondas de GC y los últimos dos endpoints claros exigen
liberar por separado Window/Document y los recursos nativos de ambos paquetes.
Se conservan las observaciones desde el primer lote, incluyendo warmups.
Son endpoints después de limpieza, no picos ni ausencia universal de fugas.

## Identidades y archivo

Los pins anteriores de A y jsdom se mantienen. C tiene distribución completa
9d2d14c14d17f0b1b64473bbeaed435ff893bfc8421029ebba853be67b6e7b6c,
569 archivos, y fuente canónica 0d67e1d821c70371ca1b82817870b7ad6a053f534161ae9096591d7199d0b947.
Se conservan manifests y snapshots del harness completo, resultados públicos,
muestras, stdout/stderr, afinidades, procesos y todos los intentos de limpieza.
La procedencia debe incluir build, patch, paquete y recibo del SHA revisado.
La copia de build C no tiene Git: sus campos de Git indisponibles no se presentan
como un checkout limpio. Se usan sus bytes y la procedencia explícita del build.

El worker y driver comparten el algoritmo validado mediante identidades explícitas.
Los valores por defecto del estudio anterior no cambian: su verificador debe
seguir reproduciendo sus 64 workers, 9.216 duraciones y accepted=false. Los
snapshots antiguos permanecen intactos. El nuevo alcance incluye ambas capas
de configuración y wrappers, además de todos los transitivos del método anterior.

Antes de medir se exige revisión del SHA publicado, huella del harness y todos
los paquetes. Sin otras cargas locales durante la secuencia. Exit1 de un Node
completo sin aceptación permite continuar al siguiente; exit2 de ejecución o
verificación detiene la secuencia. No hay reintentos ni repeticiones para elegir
una corrida favorable. Una diferencia calibrada fuera de presupuesto exige
investigar/corregir; no habilita cambiar límites, filas, estimador o muestras.
El resultado no reemplaza automáticamente el gate antiguo de CI ni autoriza
merge/tag: cualquier integración debe conservar su decisión real y sus checks.
