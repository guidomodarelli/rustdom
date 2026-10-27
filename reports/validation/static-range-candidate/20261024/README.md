# Calificación funcional del candidato StaticRange

Se conserva el patch de nueve archivos, su aplicación a un checkout Linux real,
el ELF b9ad0d91 y toda la QA en qa.zip. summary.json contiene los hashes,
los 452 miembros del archivo y los recuentos por Node. native-build.json conserva
la procedencia del build; el binario gzip conserva el ELF exacto de las pruebas.
No ejecutar scripts históricos incluidos como diagnóstico: usar el código
actual y revisado de reports/implementation/static-range-candidate/.

Pasaron 313 tests Rust, formato, Clippy, entradas CJS/ESM y pruebas públicas en
Node 22.12.0/24.14.1. En cada versión, npm run test:compat termina aprobado con
3775 contratos y nueve del launcher; Jest pasa 22, Vitest 33 y VM 34. Los casos
dirigidos incluyen 69 contratos Range existentes y seis públicos finales.
La ejecución anterior de 74 casos se solapa con ellos y no se suma.

HTML compara 1784 casos compatibles y conserva ocho exclusiones. WPT conserva
240 fixtures/83007 assertions en paridad, con 1203 no aprobadas compartidas y
complete=false; no es certificación completa de estándares. La fixture específica
StaticRange-constructor pasa 17/17.

Se conservan los fallos iniciales de formato, import del trait JsValue y pérdida
de identidad de excepciones, además de la expectativa incorrecta de realm sin
new. Los primeros runs completos carecían de tres datos históricos del checkout
sparse. Se restauraron sus bytes del mismo commit, con hashes documentados;
el run final de compatibilidad pasa en ambos Node sin cambiar runtime o assertions.

Node 24 utiliza un checkout separado con los mismos nueve archivos aplicados
y el mismo binario de solo lectura, para separar outputs de las suites. Los
recibos preservan rutas y versiones reales, sin normalizar la identidad de build.
El candidato sigue aislado, sin rendimiento medido ni aceptación, y no altera
los paquetes o mediciones del estudio consumido de ownership. Las pruebas de
memoria y sus límites están en reports/memory/static-range-candidate-20261024/.
