# Recuperar los dos ZIP grandes

GitHub limita el tamaño de un archivo. Los artifacts 12677926698 y 12678701780
se conservan completos en partes de 32 MiB; no se modificaron los archivos ZIP,
tar, muestras ni resultados. `storage-layout.json` contiene tamaños y SHA256
de los originales autenticados y de cada parte. El manifiesto original
`completed-preservation.json` sigue describiendo los bytes originales.

Desde la raíz del repositorio, usar el lector actual con una salida nueva:

```sh
python reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9/restore-ci-artifact.py . reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9/storage-layout.json 12677926698 /tmp/artifact-12677926698.zip
```

Repetir con 12678701780. El lector verifica cada parte y el resultado completo;
rechaza una salida existente y conserva un parcial rechazado. No ejecuta
código archivado. La reconstrucción no sustituye la autenticación API ya
preservada en los recibos. `storage-qualification.json` registra las pruebas
con ambos ZIP reales y el rechazo de una parte alterada.

Para restaurar también las rutas descritas por `completed-preservation.json`,
usar como salida el `originalPath` del layout, todavía inexistente.
