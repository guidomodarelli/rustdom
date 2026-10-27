# Primer criterio completo; el piloto sigue abierto

Se autenticaron los artifacts inmutables de dos jobs ya terminados del mismo
run 40426500725, intento 1, fuente 4196c496: consumo y criterio 0
`v22.12.0/AA/jsdom/mutation-records-collect/100`. Se seleccionaron por metadata
de jobs completados antes de abrir sus duraciones. El estado real del workflow
se conserva sin normalizarlo a completed. No hay decisión del piloto completo.

Los lectores actuales fijados en Node 22.12.0 y 24.14.1 coinciden y verifican:

| Dato único de este criterio | Cantidad |
| --- | ---: |
| Procesos existentes | 512 |
| Duraciones medidas | 73.728 |
| Warmup | 24.576 |
| Window / Document, por separado | 6.144 / 6.144 |
| Primeros estados no claros | 7 |
| Estados finales claros | 1.024 |

Son datos existentes contados una vez, sin multiplicarlos por los dos lectores.
Se verifican tres rondas y dos estados finales claros por proceso. Los siete
primeros estados no claros se conservan; no se excluyó ningún proceso.
También se preservan los tres snapshots del padre y todos los baselines en el
ZIP original. No se ejecutó DOM nuevo ni código archivado.

## Análisis condicional de los bloques

Ambas etiquetas A/B ejecutan **jsdom**, no comparan Rust contra jsdom. La razón
observada entre sus medias aritméticas es 0,9927322781610515. Las 16 medias de
bloque, contrastes y diagnósticos completos están en analysis.json, sin cambios
respecto al lector. No es una afirmación de mejora del producto.

| q fijo en B−qA | Media del contraste, ms | SD muestral, ms | Límite superior unilateral 95% de SD, ms |
| --- | ---: | ---: | ---: |
| 0,98 | 0,011042861 | 0,014124952 | 0,020301871 |
| 1,00, diagnóstico | −0,006303384 | 0,014247027 | 0,020477331 |
| 1,02 | −0,023649629 | 0,014371177 | 0,020655771 |

Los intervalos son puntuales y condicionales al modelo de contrastes de bloques
iid normales, con 15 grados de libertad. No son intervalos de la razón de
medias, cobertura conjunta, potencia ni prueba de independencia. El lector
conserva `independenceEstablished=false`, pendiente temporal y autocorrelación
descriptivas. Los valores de ambos signos permanecen publicados.

El analizador escalar declara inputAuthenticationPerformed=false porque no
autentica su entrada por sí mismo. La autenticación de API, ZIP, archivos,
fuente, paquete y contexto se efectuó en la capa exterior antes de usarlo;
se conservan ambas afirmaciones originales sin reemplazar flags.

## Conservación y límites

originals.json describe dos ZIP íntegros, 80.567.677 bytes, conservados en cuatro
partes Git con lectura remota independiente antes de interpretar su contenido.
El tip de esas partes es adfd44fad38eb72f364a319ed70e4a63eb7a1c12. La concatenación
binaria de cada ZIP también se verificó desde los objetos locales importados.
reader-receipts.tar.gz conserva 573 archivos de metadata, fuentes as-run,
expectativas, inventarios, resultados, recibos de procesos y diagnósticos.
Todos tuvieron segunda lectura de tamaño/hash; no ejecutar scripts archivados.

Las 174 ejecuciones de comandos y las dos transferencias streaming cerraron
sus 176 subárboles supervisados. Ocho repositorios Git descartables se retiraron
después de confirmar los bytes remotos. El directorio
work/ del transporte terminó vacío; los journals permanecen preservados.
Sus copias exclusivas se retiraron tras ambos replays;
los ZIP originales siguen en Git. Recursos del criterio:
reports/memory/jsdom-block-pilot-v2/40426500725/criterion-0.json.
Los snapshots del padre no son memoria pico ni suma de los workers, y esta
prueba finita no demuestra ausencia universal de fugas, menos aún de Rust.

Los controles de lectura pasaron 23 casos del borde propio con payloads API
reales y corrupciones explícitas. La revisión previa y de resultados no encontró
hallazgos. El run conserva el resto de criterios en su secuencia original;
una lectura anticipada de este job no permite relanzar, ampliar o adaptar nada.

performanceAccepted=null y gateReevaluated=false en todo este diagnóstico.
Los rechazos históricos de ownership permanecen; no hay tag ni merge. El runtime
del producto continúa híbrido y la migración general está pendiente.
