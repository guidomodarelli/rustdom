# Preparación de paquetes para un contraste posterior en GitHub

Esta receta construye y verifica paquetes, sin medir rendimiento ni conceder
aceptación. El estudio C anterior y el ensayo hosted antiguo mantienen sus
resultados negativos. No se relanzan.

El siguiente contraste deberá declarar por separado su hipótesis, método,
paquetes exactos y condiciones del host antes de medir. El antecedente hosted
usaba afinidad de todos los hilos; el método completo actual fija solo el principal.
Preparar paquetes en CI no demuestra por sí mismo que ese cambio estabilice
el control jsdom ni resuelva su calibración.

Esta preparación utiliza fuentes completas de checkpoint067 y C, con la identidad
canónica e inputs raíz comprobados antes/después. Exige dist ausente antes de
construir. Registra Node24.14.1, npm11.11.0, Rust1.99.1, linker, compilador C,
glibc2.35, hardware, comandos, logs y resultados. Rechaza overrides heredados
de compilación no declarados, incluidos RUSTC/CARGO_BUILD_* y configuraciones
Cargo en ancestros o CARGO_HOME. Se instala mediante npm ci --omit=dev,
sin auditoría ni mensajes de financiación, y se ejecuta
el build real de cada raíz. Las herramientas de pruebas se validan en el CI general.
Las rutas heredadas de Cargo/Rustup deben ser absolutas para que A/B no resuelvan
configuraciones o toolchains diferentes según su cwd.

Se conservan fuentes A/C, inputs adicionales de build, arnés y preparación.
Cada preparación tiene un UUID propio; los reportes funcionales deben coincidir
con ese identificador y las huellas exactas verificadas de paquetes/dependencias.
Se copian físicamente A0/A1/C/J0/J1 y todas las dependencias instaladas del
candidato bajo el nombre estándar node_modules, con huellas por archivo. Los
enlaces a dependencias son relativos;
el tar mantiene sus symlinks para poder mover el archivo. Se comparan los bytes
instalados con la copia de dependencias y se comprueba que no cambien durante
el build. El verificador recalcula
fuentes, logs, distribuciones, binarios nativos y dependencias sin lanzar cargas.
Los enlaces también se fijan y comprueban: deben ser relativos y resolverse
dentro del archivo. Esto incluye los ejecutables de node_modules/.bin.

Las pruebas funcionales posteriores ejercen parsing, mutación, clonación, Range,
eventos, Unicode e independencia de asignaciones nativas en los cinco paquetes.
Observan Window y Document por separado y exigen dos endpoints claros y baselines
nativos exactos. Son pruebas finitas, no benchmarks ni evidencia de memoria pico.

Una preparación falla si cambian fuentes, paquetes, inputs o configuración
Cargo durante el build. Las versiones de herramientas se registran y validan
solo en preflight; no se vuelven a inspeccionar sus versiones o binarios después.
Los errores preservan logs y estado parcial; no se
sobrescribe un output existente ni se modifica una referencia congelada previa.
El artefacto oficial deberá autenticarse y fijarse antes de usar sus paquetes
en una futura receta de medición. No se adopta automáticamente como baseline.

Errata documental posterior a la ejecución local: el protocolo congelado en
prepared-local.tar.gz y su hash en execution/reviewed-sources.json conservan el
texto previo, que atribuía una comprobación posterior de herramientas. Esta
corrección aclara el alcance real sin modificar código ni evidencia de ejecución.

La selección de compilador/opciones y la búsqueda jerárquica se contrastaron
con [las variables oficiales de Cargo](https://doc.rust-lang.org/cargo/reference/environment-variables.html)
y [su configuración](https://doc.rust-lang.org/cargo/reference/config.html).
