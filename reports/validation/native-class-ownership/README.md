# Liberación de clases nativas ante construcción fallida

La base es `3d37f89976a48203e80cc5c435e099267f4ce346`, checkpoint 67. La
corrección cubre class returns y constructores directos del SDK vendorizado:
un guard Rust conserva el valor hasta que `napi_wrap` registra su finalizador.
Los errores anteriores destruyen el valor y los posteriores conservan el owner
JavaScript. El bookkeeping de referencias se asigna después del wrap correcto;
la bandera de fábrica recupera su estado anterior.

No cambia la API de Range ni agrega las primitivas del WIP de atributos.
`_factory` no tiene consumidores encontrados en rustdom y queda fuera del
parche. La implementación de la plataforma continúa híbrida.

## Evidencia final sobre checkpoint 67

`base67/terminal-result.json` contiene el exit 0 observado de la ejecución
original, sesión 19868. El comprobante fue escrito después del resultado
terminal; la existencia de logs no habilita el archivado. La ruta sin
comprobante se ejerció realmente y rechazó el archivado con exit 1, preservado
en `archive-negative.log`.

Fuente medida: `8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd`.
Binario: `04863365060a1be4fe135880a89bdc1a289a0ae8247a0d3da922a90a9803069f`.
`manifest.json` enumera y coteja las fuentes ejecutadas contra el worktree,
incluyendo package.json, el runner WPT y las fixtures nuevas fuera del digest
ordinario de benchmarks. `native-build-final.json` conserva la procedencia del
addon.

| Validación | Node 22.12.0 | Node 24.14.1 |
| --- | ---: | ---: |
| Contratos Node | 3.743 | 3.743 |
| Jest real | 22 | 22 |
| Vitest real | 33 | 33 |
| Vitest VM, threads y forks | 34 | 34 |
| Validación de entrypoints | 16 | 16 |
| Contratos del harness de benchmarks | 112 | 112 |
| HTML5 comparable | 1.784 | 1.784 |
| WPT fixtures / resultados | 240 / 83.007 | 240 / 83.007 |
| Modos generales de memoria | 5 | 5 |
| Gates del paquete con npm/pnpm | 20 | 20 |

Rust 1.98.1 y 1.99.1 aprobaron fmt, Clippy con warnings como errores y los 311
tests. Memcheck ejecutó los seis tests del guard real: cero errores y pérdidas
definitivas/indirectas; las restantes categorías se detallan en el informe de
memoria y el log íntegro. Las validaciones locales son Linux/WSL; Windows y
macOS del nuevo parche todavía requieren CI.

La referencia independiente de compatibilidad es jsdom 27.4.0. HTML5 conserva
ocho exclusiones script-on. WPT registra paridad en ambos Node, 1.203 fallos de
estándar compartidos, `range-deletion` bloqueada y la exclusión de coordenadas
de submitter. `complete=false`: estos resultados no certifican conformidad
completa. Se preservan mensajes, estados y observaciones.

## Reproducción y memoria

`checkpoint67-negative/` conserva la referencia sin el fix: ocho rangos, ocho
parsers y 32.824 unidades UTF-16 retenidos por Node; el test formal termina con
exit 1 por el ownership roto. `base67/constructors-*` registra cero diferencias
con el candidato y receivers originales utilizables. `base67/range-copy-*`
observa ocho workers por Node, 1.051/357 asignaciones y cero retención.

Ver `reports/memory/native-class-ownership/README.md` para metodología, heaps,
RSS y límites. El runner WPT cede un turno del event loop después de cerrar
ambos realms. Conserva assertions, deadlines y fixtures; old-space explícito
de 2.048 MiB no es un límite de RSS. Los máximos finales fueron 2.840.108 KiB en
Node 22 y 3.190.512 KiB en Node 24, guardados por `/usr/bin/time -v`.

## Evidencia intermedia e integridad

Los logs planos iniciales corresponden al primer guard de class returns sobre
checkpoint 66. `constructor-guard/` amplía esa corrección al constructor directo
antes de incorporar checkpoint 67. La corrida inicial Node 24 agotó old-space:
su log permanece como fallo. Los controles acotados posteriores y el conjunto
final `base67/` están separados. El error inicial por Valgrind no encontrado
también permanece identificado; no se cuenta como Memcheck aprobado.

El manifest final conserva 86 logs/comprobantes y 245 reportes: 386.921.399
bytes originales, 50.929.955 almacenados. Los JSON mayores a 1 MiB usan gzip
sin pérdidas, con hashes de ambas representaciones y roundtrip byte por byte.
Se incluyen rutas impresas y reportes producidos durante la vida del runtime
aislado; los nombres heredados son anteriores a esa ventana. Cada selección
queda identificada. Los cuatro lockfiles pnpm adicionales están comprobados en
`distribution-lockfiles.sha256`.

`manifest-logged-paths.json` y la versión anterior del archivador conservan el
primer alcance, que solo incluía rutas impresas. No son el índice final.
Los comandos/probes están en `commands/`; la revisión estática se registra en
`review.md`. La revisión remota y los checks del SHA publicado quedan pendientes.

El protocolo de rendimiento está declarado en
`reports/benchmarks/native-class-ownership/PROTOCOL.md`. El A/B original terminó
y está archivado: 16 bloques/64 procesos. Diez de dieciséis controles no calibran;
Range/1000 en Node 22 señala +9,4097% con control estable y requiere investigación
antes del checkpoint. El control negativo separado terminó con exit 0, pero
no calibró jsdom (−5,3452%/−20,5067%); conserva Rust −0,3895%/+0,7013% y no
modifica la aceptación original. Merge y tag siguen pendientes de resolver
la precisión/atribución de la fila señalada. No se acredita una mejora de velocidad por
la corrección de ownership.
