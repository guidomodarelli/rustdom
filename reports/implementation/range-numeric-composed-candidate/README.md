# Inicialización y colapso numérico — candidato compuesto

Combina la inicialización numérica de ambos extremos de `privateData` con el
colapso atómico en Rust cuando coinciden los owners. El binding conserva las
referencias visibles a V8 y evita repetir aristas que no cambiaron. El constructor
y la validación pública de StaticRange siguen en JavaScript; `createRange()`
por defecto sigue la ruta anterior. El runtime permanece híbrido.

Se compusieron dos patches actuales autenticados mediante `git apply --check`
y `git apply` en un checkout Git Linux real de f781c3b7. El patch resultante
`47c6f7c54a6cbab05bdeca7f911c3eb4f76684912a03553dfe7a5839fa8f076f`
modifica cuatro de los 344 inputs declarados. Los mapas antes/después están
en `inputs.json`. `source.json` conserva las procedencias, sin reemplazar
los artefactos históricos ni el candidato de inicialización anterior.

No está integrado en producción ni se ha medido su rendimiento. El gate
ownership y los estudios históricos continúan rechazados. Esta composición
no utiliza la implementación Rust del constructor StaticRange del ELF4b52
rechazado; mantiene sus validaciones existentes y reutiliza solo el colapso.

## Validación y preparación

El contrato público ejecuta los casos de inicialización y de collapse reales,
y además prueba `fromEndpoints → copy → collapse → rangeText` con snapshots e
independencia. El consumidor TypeScript estricto se compila y se ejecuta contra
el export `@rustdom/rustdom/native`. No hay mocks de plataforma.

La calificación completa local de la composición **pasó en Node 22.12.0 y
24.14.1**: 18 comandos de suites y un probe adicional de memoria por SDK,
incluidos 313 tests Rust, nueve contratos dirigidos, tipos/consumidor ejecutado,
compatibilidad, Jest/Vitest/VM, corpus, WPT y liberación de recursos.
En estas dos builds Linux se obtuvo el mismo ELF
`a6a21c3c97f6972eb871be739fd4e4f9d7d4030156ab8062c69bab5a6d80c3b0`;
no se promete identidad al compilar con otra plataforma/toolchain.

WPT conserva paridad en 240 fixtures por SDK: 83007 aserciones, 81804 aprobadas
y 1203 con estados adversos compartidos con jsdom. `complete=false`, exclusiones
y suite bloqueada permanecen publicados; no es conformidad completa. El corpus
comparó 1784/1784 casos sin diferencias y excluyó ocho `script-on`.
Ambos Node liberaron los 4814 NativeRange observados, con seis ciclos por cada
probe y Document/Window separados. No es prueba de ausencia universal de fugas
ni de memoria pico. Evidencia en `reports/validation/range-numeric-composed-candidate/local-linux/`
y `reports/memory/range-numeric-composed-candidate/local-linux/`.

El rendimiento todavía no está aceptado. El workflow
prospectivo `range-numeric-composed-candidate.yml` prepara seis jobs con los
dos Node en Linux, Windows y macOS, límites de 60 minutos por job y 40 para la
calificación; cada comando tiene su propio límite de 30 minutos. Conserva
artefactos parciales con `always()`.

`tools/candidate.py --prepare CURRENT SOURCE NEW_PROOF` aplica el patch a una
fuente limpia con `.git` real y copia las pruebas declaradas. Autentica los
344 inputs y protege fuentes ajenas, pruebas previas y directorios de salida.
El helper compartido se lee por bytes y hash desde el repositorio actual,
sin importar módulos archivados o caches de esos helpers.

`tools/qualify.spec.py CURRENT SOURCE PROOF NODE` ejecuta la calificación real
con un destino de memoria heredado preexistente y prueba su conservación.
`qualification.json` es la fase de suites; **`composed-qualification.json` es
la decisión completa de calificación funcional**. Requiere suites y probe de
collapse completos, con verificación final de fuente y binario. Ninguno decide
presupuestos de rendimiento.

Se preservan los intentos fallidos del preparador y la revisión que detectó una
colisión de salidas antes de publicar el workflow. Su evidencia está en
`reports/validation/range-numeric-composed-candidate/tooling-attempts/`.
Antes de cualquier estudio faltan la matriz hosted, selección y autenticación
de su artefacto, y un protocolo prospectivo con precisión defendible.
