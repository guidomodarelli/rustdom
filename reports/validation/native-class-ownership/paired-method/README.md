# Validación previa al estudio emparejado

El método conserva un DOM nuevo por muestra y la operación pública original.
La comparación emparejada cambia el contexto de muestreo; no convierte el
estudio independiente anterior en aprobado. Leer `PAIRED-PROTOCOL.md` antes de
ejecutar y no iniciar otra corrida del mismo estudio según sus resultados.

Las copias físicas de paquetes se prepararon y verificaron contra sus archivos
originales. `packages.json` conserva sus fingerprints, binarios, dependencias
compartidas y fuentes: 331 archivos en A y 333 en B para el digest canónico de
benchmarks. Ese alcance es distinto de los 337 archivos de la validación amplia.

## Contratos reales

Cinco tests pasaron en Node 22.12.0 y 24.14.1. Cargan addons independientes,
comprueban contadores separados, outputs del corpus original, 1.000 copias por
muestra, endpoints originales, orden de etiquetas/tamaños, liberación de owners
y protección de reportes históricos. Los dos workers completos de cada suite
ejercen 96 DOMs frescos; también se prueban las cinco implementaciones aisladas.
No se usan mocks de plataforma ni se consideran esas duraciones un benchmark.

Los primeros contratos fallaron: una ronda de limpieza observaba todavía vivos
Window y Document tanto en jsdom como en A y B. Se conservan los logs síncronos
y el control posterior con una ronda asíncrona. No se capturó un hash de esas
versiones preliminares; no se los atribuye al código final.

El diagnóstico con el helper canónico encontró liberación en la segunda ronda
y otro endpoint claro en la tercera en ambos Node. Antes de medir se fijaron
tres rondas iguales, con traza completa, exigencia de los últimos dos endpoints
claros y sin prolongar según resultados. Los logs `final-node*.log` corresponden
a esa comprobación final; `before-performance.json` liga sus resultados y los
seis archivos relevantes mediante SHA-256 antes de iniciar el estudio.

## Revisión y límites

El reviewer nativo Codex aislado `review_name_queries` revisó los cinco archivos
del método contra `9c195d88`: cero hallazgos accionables. Verificó carga, copias,
orden, 1.152 duraciones y 1.536.000 copias previstas, limpieza y evidencia parcial.
Solo lectura y cálculos, sin ejecutar cargas ni certificar rendimiento. Después
solo se corrigió una palabra española en el protocolo.

Los observadores de memoria son finitos y posteriores a limpieza; no representan
memoria pico ni una garantía universal de ausencia de fugas. Los diagnósticos
y su código están en `reports/memory/native-class-ownership/paired-method/`.

Para preparar las copias reales y ejecutar los contratos tras construir ambas
versiones, seleccionar los paquetes con `paired-experiment.cjs --prepare`, guardar
su ruta en `RUSTDOM_PAIRED_MANIFEST` y ejecutar:

```sh
node --expose-gc --test reports/benchmarks/native-class-ownership/paired-worker.spec.cjs
```

La medición completa se ejecuta por separado, sin builds, tests ni otras
mediciones locales concurrentes. Su aceptación requiere datos completos y la
verificación final; estos contratos por sí solos no aprueban el presupuesto.

## Cierre de la única corrida

La sesión `77662` terminó con exit 1, datos completos y aceptación falsa. El
archivo `reports/benchmarks/native-class-ownership/paired/2026-10-21/` conserva
los 32 procesos, 1.152 duraciones y 1.536.000 copias. El verificador recalculó
todos los agregados y los seis archivos congelados coinciden también con sus
blobs Git en `ec80a0e4`.

El mismo reviewer nativo independiente verificó los 106 archivos conservados,
recalculó tiempos, cantidades y endpoints, y confirmó terminal y límites:
cero hallazgos accionables. Solo lectura y cálculos. La calibración A/A sigue
fallando; la fila A/B de 1.000 dentro del margen no aprueba el conjunto.
