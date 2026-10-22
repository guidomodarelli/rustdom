# Orquestador nativo: contratos antes de la captura

La secuencia prospectiva de diez procesos todavía no se ejecutó. Se implementó
en `reports/benchmarks/native-class-ownership/compilation-diagnostics/run.cjs`,
con el mismo constructor de comandos que los contratos DOM reales.

En Node22.12.0 y24.14.1 pasan seis casos por versión: autenticación de las 390
partes reales derivadas contra recibo publicado fijado por hash; rechazo de una
copia alterada sin cambiar sus claims; rechazo de recibo de fuentes incompleto;
diez selecciones de tratamiento contra el schedule congelado; exit7 real con
logs conservados y siguiente proceso no iniciado; y JSON inválido tras exit0
que también detiene el resto. Los dos últimos usan procesos Node reales en un
borde propio del recorder, sin mocks ni DOM y sin aceptar rendimiento.

Los contratos con el constructor compartido ejecutaron J0/A0 y las ocho cargas
en ambos Node: cuatro procesos DOM, 32 outputs iguales y 384 spans. Se verificó
la preparación oficial completa antes y después de ambos Node. El comando,
contratos y constantes no cambiaron tras esas ejecuciones. Después se agregaron
copia de fuentes/recibo y revalidación al cierre de cada Node en `run.cjs` y se
documentaron en el protocolo; los seis casos se repitieron en ambos Node sobre
el snapshot final. La secuencia completa de `main` queda para la captura única,
después de publicar y revisar, no se presenta como ya ejecutada.

`verifySources` solo coteja bytes con el recibo suministrado. El operador debe
obtener y verificar el commit y sus archivos en Git/GitHub antes de invocar el
CLI; un JSON que diga un SHA no demuestra por sí mismo publicación remota.
El propio recibo de derivación tiene un pin independiente. Los destinos deben
ser nuevos y disjuntos, resolviendo el padre real; no se sobrescriben datos.

El tar conserva snapshots inicial/final de las seis fuentes, comandos, logs,
fallos esperados, copias alteradas, cuatro traces nativos completos, outputs,
spans y memoria. Hash y tamaño en `receipt.json`. El sampler y paquetes se
referencian mediante las fuentes verificadas y preparación oficial ya publicada;
no hubo builds nuevos. Los snapshots y checks se distinguen en los índices.

No se vuelven a ejecutar Rust/Jest/Vitest/corpus completos por este cambio de
herramientas: el producto no cambió y el CI de cada SHA se sigue por separado.
Ownership continúa sin aceptación, sin merge ni tag de checkpoint.
