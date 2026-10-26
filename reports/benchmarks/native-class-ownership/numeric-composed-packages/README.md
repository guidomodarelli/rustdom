# Paquete numérico hospedado, sin reconstruir

Selecciona exclusivamente Ubuntu/Node24.14.1, artefacto **12628261403** del run
**40268999071**, intento1, head **2a53f88c**. Las seis combinaciones de esa matriz
aprobaron. El ELF es
`a2777cbf00baa2cc7aa67c1098d6a5ceba4009aa6e514d558aac0b304e7ea583`.
Se conservan sus **575 archivos** de distribución, tipos y package.json.
No se usa el ELF local a6a21 ni el candidato4b52 de los estudios rechazados.

`assemble.py` reutiliza el lector actual de los artefactos autenticados y los
controles inmutables A0/A1/J0/J1 con sus dependencias físicas independientes.
No instala, recompila ni ejecuta DOM al ensamblar. Copia los344inputs declarados
desde una reproducción canónica con Git Linux real f781c3b7 y los cambios reales
del candidato. El snapshot copiado no contiene Git: conserva sourceCommit=null,
sourceChanges=null y los errores Git reales. Esa reproducción no se presenta
como el checkout del compilador hospedado ni como reproducción del ELF.

El qualifier hospedado comprobó344inputs antes/después;167 están en el ZIP y se
recomprueban directamente. Los344inputs del paquete vienen de la reproducción
canónica autenticada contra el mapa independiente, sin atribuir los177restantes
al ZIP. Los recibos conservan ambas procedencias y los cambios Git sin normalizar.

Antes de ejecutar los verificadores Node se autentica desde Python el cierre
congelado completo de786archivos, incluidas las políticas y dependencias JS.
Los helpers Python actuales se compilan desde el buffer leído/autenticado,
sin caché pyc. Los SDK22.12.0/24.14.1 Linux se autentican por versión y SHA.

`transport.py` especializa en memoria el lector estricto actual del paquete
histórico, con un manifiesto y pins nuevos. No modifica ese lector, sus pins ni
el archivo anterior. Verifica bytes/tipos/links antes de extraer en un directorio
nuevo disjunto, escribe archivos físicos antes de crear enlaces internos y
rechaza sobrescritura. **Nunca ejecutar helpers archivados.**

El archivo completo está en
`reports/validation/range-numeric-composed-package/20261026/packages.tar.xz`:
7339056bytes, SHA`fb06276a9fb0510360b4a0cf804699b2554303c3f80cf164fcd60f3f443aa72d`,
7819miembros bajo raíz,7820incluyéndola yseis enlaces internos.
`archive.json` conserva todos los nombres, tamaños y hashes.

## Pruebas del paquete

Doce contratos reales comprueban el paquete en ambos SDK, cambios JS/addon/
fuentes, procedencia Git ficticia, recibos, dependencias, symlinks, outputs y-O.
La regresión del cierre transitivo usa una copia física de los786inputs y cambia
su política, sin tocar los históricos. Transporte: cinco contratos Linux,
tres Windows ydos omisiones explícitas para extracción de enlaces Linux.

El probe actual `smoke.cjs` autentica el ensamble completo **antes** de cargar el
runtime y registra artefacto, ELF y SDK. Prueba NativeRange.fromEndpoints, copias
independientes, colapso y texto nativo, además de DOM público, mutaciones y cierre.
Los ciclos observan Window/Document/ranges/native por separado, retenidos y
liberados. El negativo con el ELF local a6a21 fue rechazado antes de cargar el
candidato. El matcher del driver esperaba un prefijo de error demasiado
específico; se conserva su fallo y la comprobación posterior de logs guardados,
sin repetir esa ejecución. También se conserva el probe inicial anterior al
guard, separado de los resultados finales autenticados.

La matriz funcional completa anterior sigue disponible, con suites reales,
Jest/Vitest, corpus y WPT y sus exclusiones. Estos probes de transporte no la
reemplazan ni son una captura científica. El paquete todavía requiere el método
prospectivo y su preparación CI antes de medir rendimiento.

No hay rendimiento aceptado ni reevaluación del gate. Los snapshots finitos
no miden memoria pico ni demuestran ausencia universal de fugas. El runtime
permanece híbrido: constructor/validación StaticRange siguen en JavaScript y
createRange por defecto mantiene su ruta anterior. No se atribuye avance de
migración al solo empaquetado, ni se integra en producción por esta calificación.

```sh
python -B reports/benchmarks/native-class-ownership/numeric-composed-packages/transport.py --verify <archivo>
python -B reports/benchmarks/native-class-ownership/numeric-composed-packages/transport.py --extract <archivo> <directorio-nuevo-linux>
python -B reports/benchmarks/native-class-ownership/numeric-composed-packages/assemble.py --verify <paquete> <node-linux>
<node-linux> --expose-gc reports/benchmarks/native-class-ownership/numeric-composed-packages/smoke.cjs <paquete>
```
