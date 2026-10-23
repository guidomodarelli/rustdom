# Integración del gate ownership después del estudio activo

Actualización posterior a501f1845: el workflow WIP ya enlaza el replay íntegro
actual con un binding público y fixtures reconstruidas por CLI. Node22 aprobó
34contratos y el gate real devolvió exit1 de presupuesto, conservando los siete
controles rechazados. Node24 también aprobó34y su gate real devolvió el mismo
rechazo esperado. Ambos perfiles y el readback del paquete QA terminaron sin
fallos de integridad. Las rutas de fixtures son
absolutas por github.workspace para los hijos que cambian cwd. No se cambian
presupuestos ni se transforma accepted=false en éxito. La revisión final quedó
sin hallazgos; comprobar publicación y CI remoto sobre el SHA vigente de esta
integración antes de considerar cerrado su seguimiento.

El estudio row-isolation de a0346b13 terminó y fue rechazado en ambos Node. Este
plan no cambia el gate, sus datos, presupuestos ni las 415 fuentes congeladas.
No iniciar otras mediciones, repetir capturas o seleccionar resultados favorables.

El paquete oficial B conserva fuente compilada canónica
0d67e1d821c70371ca1b82817870b7ad6a053f534161ae9096591d7199d0b947.
El arnés estudiado conserva canonical0b4855490382ab18b7e96851dbdef95e7596268690ae169850daf097498687e9
y grafo415 SHA7b13cad926da839fc5650dc0d7a49e9e49c1c71af7fdf9192df5359ee6da51df.
Son identidades distintas y deben mantenerse explícitas en la integración.

La revisión de metadata entre los inputs preparados y el snapshot calificado
no encontró cambios de runtime o compilación. El cambio canónico comprende
benchmarks/worker.cjs y tres incorporaciones: benchmarks/constants/ownership-warmup.cjs,
benchmarks/ownership-operations.cjs y benchmarks/ownership-warmup.cjs. No hay
eliminaciones ni cambios de src/, scripts/, Cargo o dependencias fijadas.
Otros cambios en la unión de fuentes corresponden al productor/CI y método,
configuración, pruebas o documentación; no cambian las distribuciones oficiales.

Inputs adicionales: build.rs y ambas licencias permanecen iguales. package.json
cambia únicamente scripts.test:compat; exports, dependencias y comandos de build
siguen iguales. Los seis inputs opcionales permanecen ausentes. El gate futuro
debe documentar y vincular esa excepción exacta del manifiesto, sin presentar el
hash canónico global como si fuera el hash del binario.

Referencias existentes cotejadas por la revisión independiente de solo lectura:

- reports/benchmarks/native-class-ownership/pre-gc-runtime-applicability/correspondence.json:
  284rutas+inputs, checkedCommit7d5ada1f, cobertura, referencia, distribuciones ydeps.
  Su alcance es ese commit; no incluye por sí solo la excepción posterior de package.json.
- reports/validation/native-class-ownership/hosted-build-ci/39720077911/receipt.json:
  identity.inputs.sources, identity.distributions, identity.dependenciesSha256 ydigests.
- El ZIP oficial adyacente artifact-12400802735.zip contiene ownership-build.tar.gz
  con ownership-build/index.json: files, sourceProvenance.B.measuredSources,
  inputsBefore.sources.B ypreparationId. No se recompila para este análisis.
- reports/validation/native-class-ownership/row-isolation-method/source-manifest.json:
  files[], identity.measuredSources, identity.sourceHash ysha256 del arnés calificado.
- constants/ownership-evidence.json bajo reports/benchmarks/native-class-ownership/:
  inputs adicionales y ausencias históricas; el controlador viejo sigue fijado al
  estudio C rechazado y no debe volverse verde cambiando solamente sus hashes.

La futura integración debe autenticar todo el archivo final y recalcular ambas
versiones completas, incluso negativos, además de cotejar fuentes actuales,
receta y correspondencia de inputs. Conservar las mismas ocho filas, estimador
y presupuestos. Un nuevo controlador fuera del grafo415 puede enlazar esa evidencia
sin alterar el sampler ya medido. Solo integrar evidencia aceptada si todos los
controles pasan; integridad verificada por sí sola no acepta rendimiento.

Este análisis no demuestra identidad binaria con otro build ni acepta el ensayo.
La equivalencia de inputs y la integridad de distribuciones son controles
separados de aceptación, memoria y compatibilidad. No hay crédito Rust nuevo.

## Verificación posterior, sin activar el gate

El adaptador genérico y sus21contratos están fuera415. Se sumaron siete contratos
del transporte en partes; los28pasaron en Node22.12.0 y24.14.1 sin omisiones.
HANDOFF enumera archivos, fixtures y límites. La revisión corrigió el enlace de índices archivados al
harness actual y el rechazo explícito de Python optimizado. Se exige también
un sidecar auténtico del package.json compilado para comprobar la única
excepción test:compat. El CLI compartido conserva1presupuesto/2integridad.
Ambos datasets completos se recomputaron sin mocks ni nuevas mediciones. Los
recibos definitivos se conservan fuera de/tmp en el paquete QA. El estudio no
se reinició y sus siete controles jsdom rechazados permanecen publicados.

El nuevo archivo contiene7429miembros y se publica en8partes verificables de
hasta32MiB. La reconstrucción conserva exactamente el mismo SHA global; no
modifica el estimador, presupuestos o muestras. El diagnóstico ligado a hashes
autentica2051entradas para128celdas y rechaza copias con informe/índice alterados.
Ninguna cifra Rust excedió su presupuesto numérico, pero eso no acepta el conjunto.
El workflow aún fija el estudio anterior incompatible; no se lo volvió verde
mediante un cambio de pins, selección favorable o relajación de controles.
