# Corrección del layout anidado del CI — 2026-10-25

El run funcional 40165248396 de f2c449e6 terminó failure en sus seis jobs.
Todos pasaron preparación y fallaron antes de compilar, en cargo fmt:
Cargo buscó manifests superiores y encontró el Cargo.toml del checkout auxiliar,
sin src/lib.rs porque esa copia es sparse. El ensayo local previo tenía fuentes
en un directorio independiente y por eso no reproducía la disposición de Actions.
No se presenta esa diferencia como un fallo de los algoritmos Rust.

Se excluye únicamente /Cargo.toml del primer checkout sparse. El manifest,
lockfile, patch y fuentes del candidato anidado no cambian. Una reproducción
con dos repositorios Git reales y las mismas rutas relativas falla antes del
cambio y pasa después; ambos árboles estaban limpios antes de aplicar el patch.
Después pasaron Rust, build, Clippy, consumidores y dirigidos; summary.json fija
el prefijo exacto terminado. La calificación completa de esa estructura sigue
en la sesión 96801 al guardar este snapshot. No se declara terminada ni se
archivan como resultados completos los archivos que todavía se están escribiendo.
La QA anterior conserva suites completas de ambos SDK y de la entrada pública.

El upload añade dist, types, src y manifests completos del candidato. Esto
permite autenticar la distribución completa antes de preparar una futura
medición. No se ha elegido un paquete según resultados temporales ni se
inició una captura. Los seis jobs nuevos del SHA corregido siguen pendientes.

Se conservaron los seis ZIP de artifacts, metadata API, tamaños, digests y
manifiestos por miembro; cada ZIP se autenticó por run/commit/intento/nombre/
tamaño/digest. También se guardó el ZIP completo de logs del intento, 90 miembros,
206969 B. evidence.zip y evidence.json conservan todos esos bytes, la reproducción
negativa/positiva y logs de los comandos terminados, además de snapshots de las
dos definiciones propuestas. El código archivado es solo para inspección.

El cambio no altera ownership, recursos nativos ni algoritmos. Continúan los
límites y las pruebas de terminación ya verificadas. La evidencia finita de
memoria de la implementación no acredita memoria pico ni ausencia universal
de fugas. Conserva los 599 pins y las 48 entradas ajenas; runtime híbrido,
performanceAccepted=null, gateReevaluated=false, rechazo histórico vigente.
No tag, integración ni merge. La migración general sigue activa e incompleta.
