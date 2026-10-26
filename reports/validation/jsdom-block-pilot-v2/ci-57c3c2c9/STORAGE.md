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

## Árboles expandidos y checkout Windows

Los cuatro árboles bajo `contracts/40375966913/jsdom-block-*` son copias de
los miembros de sus ZIP originales. Se retiran del checkout para evitar
`Filename too long` en Git Windows: 9624 archivos expandidos, con rutas de
hasta 308 caracteres relativos. Los cuatro ZIP completos, sus partes,
metadata, logs, inventarios y resultados permanecen intactos. Los tar,
muestras, warmup y snapshots contenidos en esos ZIP también se conservan.

`expanded-artifact-layout.json` enlaza cada árbol con el artifact, ZIP,
inventario y SHA256. `expanded-retirement-audit.json` registra que cada blob
Git retirado coincide con el miembro autenticado; no afecta los 850 pins.
`completed-preservation.json` describe el conjunto histórico recuperable,
incluidos los árboles que ya no se materializan físicamente en el checkout.
El commit 525e2be6 conserva además esa representación expandida histórica.

Después de reconstruir un ZIP grande en una ruta externa corta, usar el
lector actual para materializar sus miembros en otro directorio nuevo:

```sh
python reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9/materialize-ci-artifact.py . 12678701780 /tmp/artifact-12678701780.zip /tmp/ci-12678701780
```

Repetir por ID para los demás artifacts. Los dos ZIP pequeños permanecen como
archivos completos en `contracts/40375966913/`. El lector exige destino fuera
del repositorio; verifica recibo, ZIP y cada miembro, preserva parciales ante
error y rechaza destinos existentes, aliases, enlaces y rutas no portables.
En Windows usar una raíz externa corta. Mantener `core.autocrlf=false` para
preservar los bytes exactos de los recibos. Nunca ejecutar el código archivado.
