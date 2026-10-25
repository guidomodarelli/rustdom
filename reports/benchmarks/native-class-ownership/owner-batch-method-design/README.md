# Diseño de la medición de owners: diagnóstico offline

Se leen únicamente los datos completos del run 40184510898, publicado y rechazado.
No se ejecutan DOM, workers archivados ni nuevas muestras; tampoco se recalculan
su aceptación o sus intervalos. performanceAccepted=null y gateReevaluated=false
pertenecen a este diagnóstico; el resultado histórico sigue siendo false/true.
El runtime de rustdom continúa híbrido y el objetivo general está pendiente.

## Resultado verificable

La lectura autentica CSV, decisión e informe históricos por tamaño y SHA256.
Comprueba los 2048 procesos, sus 18432 duraciones medidas y 6144 warmup, y contrasta
cada media de proceso con los 16 pares publicados. Hay 128 grupos de factores:
dos Node × dos fases × dos engines × dos labels × ocho filas, con 16 procesos
por grupo y nueve duraciones medidas por proceso. No se descartan outliers.

En los 32 criterios jsdom rechazaron 31, y 16 estimaciones puntuales quedaron
fuera de ±2%. La mediana del ancho completo de intervalo es 9,516 puntos
porcentuales. En sus 64 grupos de label, el CV intraproceso agrupado tiene mediana
23,316%; el CV de las medias de procesos, 6,869%. Son descripciones de los datos
anteriores; no identifican una causa CPU/GC/JIT ni garantizan una solución.

Se conserva el contraste firmado s²(medias) − promedio(s² interno)/9. Es negativo
en 63 de 128 grupos y no se trunca a cero. No se lo presenta como una componente
de varianza no negativa ni como prueba de independencia, estacionariedad o
causalidad. El cociente de esos momentos puede superar uno y tampoco se recorta.
Los contrastes primer/último tercio mantienen el orden de las muestras; no son
un filtro ni reemplazan al estimador histórico.

## Cálculo y verificación independiente

```sh
python -B dispersion.py REPOSITORY NEW_DIAGNOSTIC_JSON
node verify.cjs REPOSITORY DIAGNOSTIC_JSON
python -B planning.py REPOSITORY NEW_PLANNING_JSON
```

Python usa csv y statistics de la biblioteca estándar. El verificador Node lee
cada duración y warmup del CSV autenticado, comprueba todas las identidades de
proceso y calcula medias/varianzas con una formulación independiente de dos
pasadas. El formato de estas columnas fijadas es JSON-compatible; no es un
parser CSV general. El hash de cada SDK se lee con un buffer reutilizable de
1 MiB. Las entradas de datos están acotadas a 16 MiB y las salidas existentes
se preservan.

Los nueve contratos Python de momentos/CLI pasaron en Windows y Linux, incluidos
contrastes negativos, varianzas no representables, protección de salida y rechazo
de Python optimizado. Los nueve contratos Node pasaron en ambos SDK oficiales,
con casos de muestras cambiadas, proceso duplicado/faltante, warmup faltante,
contraste truncado y aceptación o identidad fabricadas. Cada verificación real
contrastó los 2048 procesos y 128 grupos, con las 24576 duraciones originales.
Las salidas Python Windows/Linux fueron byte-idénticas. Tres contratos adicionales
de planificación y su CLI también pasaron en ambos sistemas.

Evidencia: reports/validation/owner-batch-design-diagnostic/20261025/ conserva
payload completo, logs, comandos, hashes y observaciones de planificación.
La tolerancia 1e-12 solo comprueba acuerdo numérico entre implementaciones; no se
aplica a presupuestos de rendimiento. Ninguna de estas pruebas ejecutó DOM.

## Siguiente método, todavía no ejecutable

DRAFT.md y constants/prospective.json declaran un diseño de 16 tareas por bloque,
con las ocho filas y ambos SDK conservados. Faltan implementar el sampler y sus
lectores, la calificación funcional, seleccionar/autenticar el paquete del CI y
revisar el método integral. executionReady=false refleja ese trabajo pendiente.
La autorización permanente ya cubre su ejecución cuando esté listo.
No repetir capturas consumidas ni presentar este diagnóstico como aceptación.
