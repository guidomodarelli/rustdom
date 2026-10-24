# Estudio XML activado por el layout anterior

El workflow XML observaba `benchmarks/**` y se activó al agregar allí el helper
de CPU en `4f455da42c141708551490127087e1f45ddfefc6`. El traslado posterior
del helper no modifica este run ni sus datos. No se relanzó la medición.

El run `39662377152`, job `119438465359`, terminó con fallo y exit 2 de la etapa
de calibración. Node 24.14.1 completó 208 procesos A/A, 6.656 duraciones y trece
filas. La calibración no aprobó; A/B no se ejecutó y `accepted=null` significa
que no se evaluó aceptación. No demuestra una regresión del candidato, que
no se midió en esta secuencia, ni reabre como aprobado el presupuesto anterior.

`artifact.zip` conserva sin pérdidas los 417 archivos originales. Su SHA-256
`62d5df600eb603d949bf84cd67aae68e131e5064131add1c443907a9db674544`
coincide con el digest publicado por GitHub del artefacto `12376881316`.
`files.json` enumera bytes y hashes descomprimidos; `experiment.json` es una
copia idéntica del índice contenido en el ZIP. `failed-step.log` conserva la
salida de la etapa. Procedencia y resultado están en sus JSON correspondientes.

`verify.py` comprueba el ZIP, cada stdout contra sus observaciones, checksums,
cantidades, medianas normalizadas y fases, y recalcula el rechazo de calibración
con el presupuesto original. No genera nuevas muestras:

```sh
python3 reports/benchmarks/native-class-ownership/unplanned-xml/39662377152/verify.py
```

El resultado corresponde al SHA anterior. La reubicación mantiene el algoritmo,
los workflows y el capturador intactos; no cambia filtros para ocultar un fallo.
Los scopes siguen observando el arnés y XML de producción. Este archivo conserva
un estudio adicional inconcluso, sin declarar nuevas APIs migradas ni aceptación.
