# Ownership de clases nativas antes de `napi_wrap`

El parche conserva la propiedad Rust de una asignación hasta registrar su
finalizador JavaScript. Cubre `new_instance<T>` y `CallbackInfo::_construct` del
SDK vendorizado; no agrega una API DOM ni acredita avance del inventario de
migración. `_factory`, sin consumidores `#[napi(factory)]` encontrados en
rustdom, permanece fuera del cambio.

## Reproducción determinista

Ocho llamadas `Reflect.apply` de cada constructor sobre un receiver ya envuelto
provocan el error original ``Failed to initialize class `constructor` ``. Se
retienen los receivers originales durante la observación y se comprueba que
continúan utilizables. Cada parser recibe 4.103 unidades UTF-16. No se requiere
GC para liberar los valores nuevos cuyo wrap fue rechazado.

| Motor | Node | Rangos adicionales vivos | Parsers adicionales vivos | Input UTF-16 adicional |
| --- | --- | ---: | ---: | ---: |
| checkpoint 67, SDK anterior | 22.12.0 | 8 | 8 | 32.824 |
| checkpoint 67, SDK anterior | 24.14.1 | 8 | 8 | 32.824 |
| candidato corregido | 22.12.0 | 0 | 0 | 0 |
| candidato corregido | 24.14.1 | 0 | 0 | 0 |

La referencia es el binario `e178142421fa9fc4b3b30525b1fae3d7a6eac8ffb9123711d09fbc915cda1a01`;
el candidato final es `04863365060a1be4fe135880a89bdc1a289a0ae8247a0d3da922a90a9803069f`.
Los JSON y la regresión negativa con exit 1 están en
`reports/validation/native-class-ownership/checkpoint67-negative/`; las
observaciones corregidas están en `base67/constructors-v*.json`.

## Terminación de workers

El probe usa `NativeRange.copy` integrado y termina ocho workers reales durante
copias repetidas. Los contadores de proceso se leen después del exit. Sobre el
candidato final se observaron 1.051 asignaciones en Node 22 y 357 en Node 24,
con cero asignaciones retenidas y creación/liberación balanceadas en cada ciclo.
Los registros están en `base67/range-copy-v*.json` dentro del informe de
validación. El test formal también exige una copia real antes de la señal de
entrada, preserva un Range y un parser originales durante los awaits y verifica
su uso posterior.

La interrupción depende del scheduler: una corrida sin retención no demuestra
que una ruta defectuosa sea segura. Los probes iniciales conservados aquí
observaron dos rangos retenidos en Node 24 con el binario anterior
`10ebf630ccc70bf2ac94fec4c4a2e8ba2aaacb90070c4f229dabcde164a96803`.
Los archivos `sdk-range-copy-isolated-*` corresponden al primer parche parcial
`f967fcecfa9172c98a643b75b31c2dd153d3f542d08f09e5ac9ac2c8c943646d`:
ya reparaba class returns, pero aún fallaba el constructor directo. No son
evidencia del binario final.

## Guard, Memcheck y proceso completo

Seis tests del guard real verifican Drop, transferencia, error y los layouts
ordinario, placeholder y alineado de tipos de tamaño cero. Memcheck los ejecutó
con cero errores, cero bytes definitivamente perdidos y cero indirectamente
perdidos. Registró 48 bytes posiblemente perdidos y 548 todavía alcanzables en
el proceso del arnés Rust, con stacks de inicialización de `std::thread`,
canales de `test` y registro de stack overflow; el log original y los stacks
permanecen publicados.
Este control no instrumenta el addon completo dentro de V8.

Los cinco modos generales (`jsdom`, `rustdom`, `native`, `vitest`, `vitest-vm`)
aprobaron en Node 22 y 24. Document y Window se observan por separado mediante
referencias débiles. En Node 24, el modo rustdom registró +1,98 MiB de heap y
+34,23 MiB de RSS después de los ciclos; las ventanas y documentos observados
terminaron en cero. La variación de RSS se conserva como tal: estos resultados
no prueban ausencia universal de fugas ni equivalencia entre RSS y memoria viva.

El runner WPT ahora cierra ambos realms y cede un turno del event loop entre
fixtures. Conserva las assertions y deadlines upstream y registra el límite
de heap. La corrida anterior que agotó old-space y sus posteriores controles
acotados permanecen en los logs; no se presenta como una corrida aprobada.
El presupuesto old-space de 2.048 MiB no es un límite de RSS del proceso.

Los comandos, fuentes, hashes, reportes generales y compresión reversible se
identifican en `reports/validation/native-class-ownership/manifest.json`.

## Recursos del diagnóstico A/A contrabalanceado

`balanced-aa-2026-10-21.json` resume las 768 observaciones del diagnóstico
A/A de 16 procesos sobre checkpoint 67 y jsdom 27.4.0; **no ejecuta el candidato
B**. Conserva los hashes de cada reporte, los contadores finales por etiqueta
y los rangos observados de RSS, heap, memoria externa y ArrayBuffers después
de la limpieza. Los máximos corresponden solo a esos endpoints, no al pico
del proceso. Window y Document quedan claros en los dos endpoints finales
de cada observación, y los contadores de Range de ambos módulos Rust se equilibran.
No acredita ausencia universal de fugas ni cubre los errores de construcción
conocidos del checkpoint 67. Los raw y tres rondas completas permanecen en
`reports/benchmarks/native-class-ownership/balanced/2026-10-21/`.
