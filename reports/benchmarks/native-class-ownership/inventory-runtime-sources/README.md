# Correspondencia de auditoría y SUT actual

`sources.cjs` verifica los recibos y archivos de la propuesta a89ce898 y los
archivos que se construirán en HEAD. La integración de Range cambió el bridge
compartido native-tree.cjs; se permite únicamente ese cambio exacto ya probado,
con la comprobación completa de los 344 inputs del candidato. Los algoritmos
de tokens/dataset y todos los demás archivos mapeados siguen byte-idénticos.
No se alteran los recibos anteriores ni se equiparan hashes diferentes.

El resultado exige las pruebas públicas actuales y conserva los dos hashes
por archivo. La identidad Git corresponde al caller, que el workflow verifica
por separado; este helper solo autentica bytes. No concede crédito de
migración, aceptación de rendimiento ni permiso para ejecutar una captura.

```sh
node sources.cjs <snapshot-original> <fuente-actual>
RUSTDOM_INVENTORY_SOURCE_SNAPSHOT=<snapshot-original> \
RUSTDOM_INVENTORY_RUNTIME_SOURCE=<fuente-actual> \
node --test sources.spec.cjs
```

Los ocho tests usan la propuesta y las fuentes reales, incluido el CLI,
copias modificadas y un symlink con bytes correctos. No cargan DOM. La prueba
con el runtime real, el catálogo y los recursos de ambos SDK se conserva en
`reports/validation/inventory-current-runtime/20261027/`.
