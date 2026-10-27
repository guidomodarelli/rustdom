# Candidato aislado: construcción de StaticRange en Rust

Este candidato mueve la validación de tipos de nodo y la construcción de ambos
endpoints a Rust. **Todavía no está integrado en producción y no tiene medición
de rendimiento.** No completa una fase ni acredita migración del API publicado.
Parte del commit 4ea7de1a; tampoco incorpora el patch aislado de collapse atómico.

El controlador Rust conserva las lecturas repetidas de nodeType, la igualdad
estricta, el cortocircuito, el orden de errores y los valores lanzados originales.
Rechaza DocumentType/Attr antes de resolver handles o crear NativeRange. El estado
acepta raíces desconectadas y offsets fuera de longitud, como jsdom 27.4.0;
no introduce restricciones de Range vivo.

El binding JavaScript conserva conversión WebIDL, factories del realm y aristas
visibles al GC. Rust llama dos callbacks síncronos para resolver handles después
de validar. No hay préstamo de TreeStore durante getters o callbacks ni referencias
JavaScript persistentes en el controlador. Estas llamadas también tienen costo:
no se afirma mejora temporal por trasladar el código a Rust.

La propagación usa el patrón existente de XMLSerializer: env.throw conserva el
valor original y PendingException evita que el wrapper reconstruya Error. El
primer intento que perdía identidad y los errores de preparación se preservan
en la evidencia; no se cambiaron assertions para aceptar ese comportamiento.
La expectativa sobre la realm de llamar una clase sin new se corrigió mediante
comparación con el error real de jsdom.

El patch cubre nueve archivos. source.json fija el commit base y los hashes
antes/después. Usa contexto cero; comprobar todos los hashes y aplicar con
`git apply --check --unidiff-zero` seguido de `git apply --unidiff-zero`, siempre
en un checkout separado y limpio. La prueba de aplicación reproduce exactamente
los nueve archivos compilados. Si el runtime evolucionó, forward-portear y volver
a validar; no aplicar ciegamente sobre fuentes diferentes.

Para reproducir los contratos, construir ese checkout con las dependencias
fijadas y usar cada ejecutable Node 22.12.0/24.14.1:

```sh
RUSTDOM_STATIC_RANGE_SOURCE=/checkout-candidato node --test /repo-actual/reports/implementation/static-range-candidate/public.spec.cjs
RUSTDOM_STATIC_RANGE_SOURCE=/checkout-candidato node --expose-gc /repo-actual/reports/implementation/static-range-candidate/memory.cjs
```

public.spec.cjs ejercita DOM real, las entradas nativas CJS/ESM, getters
adversariales de nodos reales y reentrada; no sustituye librerías por mocks.
La evidencia está en reports/validation/static-range-candidate/20261024/.
Pasaron 313 tests Rust, formato y Clippy; por Node, 3775 contratos generales,
nueve del launcher, 69 Range existentes y seis públicos finales, 22 Jest,
33 Vitest y 34 VM. Las invocaciones dirigidas se solapan: no sumarlas como
tests adicionales. HTML conserva 1784 casos comparables y ocho exclusiones;
WPT conserva 240 fixtures, 83007 assertions y 1203 no aprobadas compartidas,
con complete=false. StaticRange-constructor aprueba sus 17 casos.

La calificación ejecutada es Linux x64. El ELF gzip está identificado por hash;
no atribuirle otra plataforma, commit integrado o aceptación de rendimiento.
La memoria y sus límites se documentan en
reports/memory/static-range-candidate-20261024/README.md.
No integrar/taggear este candidato antes de cerrar el hito de ownership y
completar sus validaciones pendientes.
