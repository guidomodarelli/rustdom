# CI funcional del candidato combinado

Estas herramientas reconstruyen el candidato en un checkout limpio del base
f781c3b7. No cambian la producción, los 599 pins, paquetes o resultados históricos;
no ejecutan un sampler ni aceptan rendimiento.

`prepare.py` autentica el manifest, patch, diez preimages y cuatro manifests de
build. Rechaza también un Cargo.toml alterado que Git oculte con assume-unchanged.
Antes de copiar verifica los cinco tests originales y el test combinado nuevo.
Requiere un directorio Git real del sistema de archivos actual, un origen limpio
y un destino nuevo de evidencia. Conserva el commit, status y errores reales de
Git, incluyendo los fallos; no los sustituye por valores limpios.

`qualify.py` construye el addon desde esas fuentes y ejecuta formato, 315 tests Rust,
Clippy, consumidores CJS/ESM, 84 dirigidos y las suites completas de compatibilidad,
Jest, Vitest, VM, HTML y WPT. Después observa recursos con los dos probes finitos.
Cada plataforma registra su propio ELF/DLL/dylib y hash de Node; no se exige el
hash del binario Linux local al compilar en otra plataforma o ruta.

```sh
python3 -B reports/implementation/range-combined-candidate/tools/prepare.py \
  "$CURRENT" "$CLEAN_BASE_CHECKOUT" "$NEW_PROOF_DIRECTORY"
python3 -B reports/implementation/range-combined-candidate/tools/qualify.py \
  "$CURRENT" "$CLEAN_BASE_CHECKOUT" "$NEW_PROOF_DIRECTORY" "$PINNED_NODE"
```

El workflow combined-range-candidate.yml crea seis jobs independientes:
Linux/Windows/macOS por Node 22.12.0/24.14.1, con Rust 1.99.1. Los checkouts
sparse conservan las fuentes y fixtures necesarias; depth 2 permite los contratos
de rechazo de un commit ancestral. core.autocrlf=false afecta solo esos jobs.
No se instala un npm global: se utiliza y registra el incluido con cada Node.

Cada job tiene límite de 60 min, la calificación de 40 min y la subida de 5 min, dejando margen
para checkout e instalación. Cada comando permite hasta 20 min y 30 s de cleanup.
`command.py` conserva stdout/stderr en bytes, argv, PID, exitCode y timeouts,
incluso errores de arranque. En el deadline termina su grupo POSIX o el árbol
Windows mediante taskkill; espera al proceso directo. Los descendientes que
creen sesiones independientes quedan fuera del alcance de un grupo POSIX.
Los artifacts se suben también ante fallos, con reportes parciales y binario
cuando exista. Los tiempos de estas verificaciones no son benchmarks del DOM.

Pruebas de herramientas sobre Git/procesos reales, sin mocks:

```sh
python3 -B reports/implementation/range-combined-candidate/tools/prepare.spec.py \
  "$CURRENT" "$GIT_ORIGIN_WITH_BASE_AND_PARENT"
python3 -B reports/implementation/range-combined-candidate/tools/command.spec.py
```

La segunda prueba mata un proceso propio y su descendiente para comprobar el
cleanup. La primera crea repositorios Git temporales con un object store compartido;
no clona ni transporta todo el historial cuando el origen es shallow. Copia
su límite shallow real y usa checkout de los commits auténticos. No modifica el origen.
La limpieza verifica el directorio temporal resuelto antes de borrarlo.
El calificador deja sourceChangesRaw intacto y no convierte fallos de Git en
una aprobación. qualification.json solo indica calificación funcional, nunca
aceptación de rendimiento ni conformidad completa de estándares; las exclusiones
y fallos compartidos de WPT/HTML permanecen en los reportes crudos.
