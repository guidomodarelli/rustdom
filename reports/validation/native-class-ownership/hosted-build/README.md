# Paquetes completos antes de otra medición hosted

La receta reconstruye A (checkpoint067) y C desde blobs Git completos, con dist
ausente al inicio, Node 24.14.1, npm 11.11.0, Rust/Cargo 1.99.1 y glibc 2.35.
Los cuatro comandos reales de instalación/build finalizaron con exit 0.
El target de Cargo se reutilizó como cache declarada; ambas raíces y sus dist
eran nuevas. Fuentes, inputs, configuración Cargo y dependencias se comprobaron
antes/después. Las versiones de herramientas se registraron y validaron solo
en preflight; no se revalidaron sus versiones o binarios al finalizar el build.

Los paquetes de ejecución DOM A0/A1/B/J0/J1 conservan dist/package.json o
lib/package.json, según el motor, y las dependencias de runtime instaladas.
No son tarballs npm ni una validación nueva de todas las APIs del proyecto.
Sus huellas locales coinciden exactamente con las distribuciones congeladas
del estudio C anterior: A d3608539…, C 9d2d14c1… y jsdom c458b9e9….
Esto prueba identidad de archivos en esta reconstrucción local; no acepta
rendimiento ni demuestra identidad con una futura compilación de GitHub.

## Validación real

- Node 22.12.0 y 24.14.1: 17 contratos por versión, sin fallos ni exclusiones.
- Cuatro workers funcionales, dos directos y dos tras trasladar el archivo:
  parsing, mutación, Unicode, clonación, Range, eventos y asignaciones nativas
  independientes en cinco paquetes. Los reportes se vinculan al UUID y huellas
  concretas de la preparación.
- 60 observaciones de Window y 60 de Document, 20 endpoints y 40 observaciones
  finales claras exigidas; baselines nativos exactos. Son escenarios finitos
  del realm por defecto, no memoria pico ni ausencia universal de fugas.
- Tar completo de 15.043.266 bytes, SHA-256
  `042a2f7122edaaf2db7e99b7ab94cd39a6d1b2c992044eb5222d9e42c8780ca5`.
  Se extrajo en otra carpeta y ambos Node verificaron las copias congeladas
  desde sus propias fuentes, sin cargar DOM ni usar las raíces de build originales.
- actionlint y revisión nativa local del código aprobados; el reviewer no ejecutó
  builds ni concedió aceptación de rendimiento.

`validation.json`, `preparation-index.json`, `execution/` y `offline-tar-replay.json`
conservan los resultados originales. `prepared-local.tar.gz` incluye paquetes,
dependencias, fuentes, herramientas, logs y enlaces relativos. El archivo es
para Linux x64; el recorrido de Windows se valida por separado en el CI general.

La revisión final corrigió únicamente esa descripción del control de herramientas
en este README y HOSTED-BUILD-PROTOCOL.md. El tar y reviewed-sources.json conservan
la versión histórica del protocolo; sus hashes y la evidencia original no se
reescribieron. El código ejecutado permanece idéntico al revisado y probado.

## Intentos de desarrollo conservados

`development-failures.tar.gz` y su manifest retienen fuentes, estados y logs:

1. La preparación inicial se detuvo durante npm ci tras defectos confirmados
   de revisión, antes de compilar o medir. Terminó con exit 2 y SIGTERM documentado.
2. Otro build terminó, pero el worker falló al resolver tough-cookie: llamar
   dependencies a la carpeta copiada rompía la resolución estándar de Node.
3. La siguiente versión pasó 16 contratos por Node y sus workers, pero la
   extracción segura detectó un enlace absoluto residual en .bin/tldts.
   No se presenta como evidencia portable aprobada. El verificador corregido
   rechaza ese archivo antiguo con exit 2.

La versión final preserva symlinks literalmente y exige destinos relativos
dentro del archivo antes de leer sus contenidos. Se registran y verifican los
seis enlaces. Las pruebas rechazan paquetes/dependencias alterados, reportes
de otra preparación, Document retenidos, overrides/configs externos de Cargo,
rutas relativas de herramientas y enlaces externos. Los sidecars de traslado
son únicos y el workflow conserva todos sus reportes y logs.

## CI y límites

El run general [39714488637](https://github.com/guidomodarelli/rustdom/actions/runs/39714488637)
aprobó sus ocho checks sobre 40a4adf3, incluyendo Windows, macOS, Linux, los cuatro
shards y Memcheck. Metadata y logs completos Windows/Linux están en ci-40a4adf3/.
Ese SHA confirma la reparación anterior de la espera funcional de colecciones.
No acredita aún el nuevo workflow de preparación, que necesita su ejecución
tras publicar esta receta.

No se ejecutaron benchmarks. performanceAccepted permanece null para esta
preparación y accepted=false para el estudio C previo. No hay APIs Rust nuevas,
merge ni checkpoint. Antes de medir, fijar el artefacto oficial de CI y declarar
una hipótesis/método nuevos; el ensayo hosted antiguo también falló y no se repite.

Para comprobar el tar en Linux desde la raíz del repositorio, sin compilar:

```sh
preparationRoot=$(mktemp -d)
tar -xzf reports/validation/native-class-ownership/hosted-build/prepared-local.tar.gz -C "$preparationRoot"
node "$preparationRoot/artifact/sources/reports/benchmarks/native-class-ownership/prepare-hosted-build.cjs" --verify "$preparationRoot/artifact"
```
