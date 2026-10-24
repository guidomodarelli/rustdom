# Integridad de la captura diagnóstica

Captura única local conforme al protocolo publicado en `8c6dc74b` y cotejado
antes de iniciar: diez procesos y perfiles completos, exit 0 en todos ellos.
La secuencia, comandos, PIDs, tiempos, flags y hashes individuales están en
`index.json`; las comprobaciones contra los outputs del ensayo original y
los cuatro checks de la preparación oficial están en `verification.json`.

`capture-and-profiles.tar.gz` conserva todos los perfiles CPU originales,
reportes, GC, memoria, stdout/stderr y fuentes. Incluye las 387 fuentes derivadas,
las siete fuentes publicadas del método, patch, manifest, controlador real,
lector inicial fallido y final, y análisis. SHA-256 y tamaño en `receipt.json`.
No contiene una nueva copia de los paquetes oficiales: se referencian mediante
sus manifests e identidad y el ZIP oficial ya versionado en
`reports/validation/native-class-ownership/hosted-build-ci/39720077911/artifact-12400802735.zip`,
SHA-256 `b25f1e98608c6abb50cb9a5c9feb00f825276941511f3ed9905c457480582610`.

Los datos del método y sus contratos no se incorporan a esta captura. La copia
instrumentada y los paquetes se verificaron por separado; el arnés original
de aceptación no se modificó. Los archivos externos nombrados en los perfiles
se resuelven mediante las fuentes derivadas y el artefacto oficial anteriores.

El lector final tiene cinco casos de comportamiento numérico y un replay real
de todos los perfiles. No modifica los crudos ni decide aceptación. La lectura
inicial falló por asumir deltas CPU no negativos; conservarla no vuelve inválida
la captura ni autoriza repetirla. Los timestamps se reconstruyen y ordenan con
sus IDs, sin eliminar las 71 entradas con delta negativo.

Reproducir solo postproceso (sin DOM, nuevas muestras, build ni profiler):

```text
python3 -B analyze.py EXTRACTED_CAPTURE NEW_ANALYSIS.json
```

El resultado no resuelve por sí solo el rechazo de rendimiento del runner Azure.
El inventario de migración sigue separado y no recibe crédito por estas herramientas.

El CI general previo de `12eaeb82` aprobó ocho checks; metadata completa en
`ci-12eaeb82.json`. El CI de `8c6dc74b` y del SHA que publique esta evidencia
se siguen aparte: ese resultado previo no los aprueba.
