# Recursos de los lectores

`observations.json` conserva resultados y SDKs de la validación final. Por SDK,
32 autenticaciones binarias rechazadas del ZIP real mantienen cuatro descriptores
abiertos antes y después. Los contratos Node comprueban 32 rechazos previos a
abrir un ejecutable sobredimensionado y 32 errores posteriores a abrir un archivo
real de procfs; el conteo de descriptores no cambia.

Los hashes de archivos se leen en bloques reutilizables de 1 MiB; el límite por
snapshot es 64 MiB, por ejecutable 256 MiB y por lectura JSON 16 MiB. La prueba
de preparación conserva también el ZIP real de 23 MB y verifica su hash, sin
confundirlo con el límite de JSON. Los descriptores se cierran en `finally`.

Estos contratos no crean Document/Window, no miden el DOM ni memoria pico y no
demuestran ausencia universal de fugas. La extracción completa preserva los
miembros como datos; sus implementaciones archivadas no se ejecutan. El incidente
de E/S del WSL anterior y la reproducción en una distribución aislada están
documentados con sus logs en la QA de este hito.
