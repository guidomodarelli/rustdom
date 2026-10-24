# Preparación hospedada de ownership autenticada

Run40065437939, job120787588512, intento1, commitf559d37a: terminó success.
Artifact12549521134, ZIP7875525bytes, SHA256
`21a79f0d7c75c9d7ec2ce0205fa0d858df2ca73b81f444392fc0b6bd0b6f3f5e`.
Tar7872944bytes, SHA256
`045d00359af621f1956a27420fb33e80c3c171121f0a7f9a0317392eac2f06c9`.
Se autenticaron ID/run/commit/intento/nombre/tamaño/digest y CRC. Dos colecciones
independientes dieron bytes idénticos. ZIP, tar, metadata, logs y todas las
observaciones están conservados; members.json.gz cubre7889miembros,
7043archivos regulares,71747864bytes regulares y6enlaces.

## Qué prueba

El build de CI y sus ocho contratos por Node22.12.0/24.14.1 aprobaron. Los lectores
actuales pasan17regresiones de transporte en Windows y Linux y cinco contratos
de replay por Node. Incluyen identidad falsa, intento equivocado, bytes alterados,
salidas ajenas preservadas, fuentes Git adulteradas, endpoints falsamente claros
y un índice/reporte autorreseñado. La identidad y los cinco archivos consumidos
están fijados de forma independiente; no se confía solo en hashes autodeclarados.
La API puede agregar metadata no consumida sin romper estos lectores.

El extractor reutiliza código actual revisado y fijado por SHA. Compila esos bytes
verificados directamente, sin aceptar un .pyc que los sustituya. El caso adversarial
ejercita el intérprete real y confirma ese límite. No se ejecutan controladores
ni scripts del archivo. Las dos extracciones dieron el mismo manifiesto completo.

Las lecturas offline Node22/24 coinciden byte a byte, SHA256
`4b8070201abaea865bcd3733d097e2a0638ea6033cd23eb304037893e798217c`.
Verifican paquetes, inputs, productor y reportes usando código actual, sin crear
DOM ni volver a tomar muestras. Los sourceCommit/sourceChanges/sourceGitErrors
originales permanecen íntegros y se contrastan, sin normalizarlos.

## Binarios y alcance funcional

El candidato de CI es0a949fb3441baca338c7ba2b383011bdc516ba63f164bc2e4e1152f124155776,
distinto del9bab7909local; ambas huellas y sus ámbitos quedan separados.
El baseline A0/A1 es1c46896c. Las fuentes siguen siendo67523bf3/5273aae0.
No se atribuye la diferencia de bytes a una causa ni se infiere rendimiento.

Se ejercieron además14pruebas nativas por Node sobre el addon0a949 real:
errores de construcción/wrap, terminación de workers, referencias y snapshots.
La regresión de MutationRecord se promovió a tests/ para las suites habituales;
comprueba balance de asignaciones y UTF-16 realmente no emparejado. Estas pruebas
son separadas del replay, que sigue siendo solo lectura. Las suites completas
Jest/Vitest/VM/corpus previas correspondían al9bablocal; no se presentan como
ejecuciones sobre este binario de CI ni como conformidad total de estándares.

## Memoria y continuidad

Los probes canónicos de CI observaron15Window y15Document por Node, por separado:
30por clase, cero primeras rondas no claras y20estados finales claros requeridos.
Todos los traces y baselines se conservan en metadata/ y en
reports/memory/cold-cleanup-build-40065437939.json. Los contratos de relocalización
ejecutaron ciclos adicionales que no se suman a esos conteos canónicos. No son
memoria pico ni ausencia universal de fugas; napiClasses son referencias a
constructores. El runtime principal sigue híbrido y no se modificó.

Los 26/46pins y las434fuentes congeladas siguen intactos. No hubo estudio nuevo,
no hay aceptación de rendimiento, tag ni merge. Antes de cualquier secuencia
faltan calificación completa del binario de CI y método prospectivo publicado,
probado y revisado con presupuestos fijados, además de autorización independiente.

## Leer sin repetir ejecución

Usar el código del commit de esta publicación. Desde Linux/WSL, con Python3.12
o3.10con el backport tar_filter, y Node22.12.0/24.14.1 fijados:

1. transport.spec.py recibe como único argumento extra el directorio transport/.
2. extract.py recibe repositorio, transport/ y un directorio nuevo; preserva enlaces.
3. replay.cjs recibe el root cold-cleanup-preparation extraído. No ejecuta DOM.
4. replay.spec.cjs usa RUSTDOM_COLD_REPLAY_ROOT con ese mismo root.

El workflow cold-preparation-reader-contracts.yml automatiza esos comandos.
collect.py solo lee el run fijado; su salida debe ser nueva o tener el marcador
de ownership de este lector. No inicia workflows ni vuelve a aplicar etiquetas.
