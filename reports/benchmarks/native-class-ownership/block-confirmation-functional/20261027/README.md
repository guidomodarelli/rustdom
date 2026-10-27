# Calificación funcional del productor Rust/jsdom

La matriz final pasó con Node 22.12.0 y 24.14.1 fijados: 64 workers y seis
casos adversos por SDK. Ejercita el addon real sellado `a2777cbf`, los controles
Rust y jsdom 27.4.0, AA/AB y las ocho cargas. El factor funcional es 0; no es
la secuencia científica de todos los factores/bloques.

Los 128 positivos finales conservan 18.432 duraciones medidas y 6.144 warmup,
1.536 Window y 1.536 Document separados. Hubo 11 primeras rondas no claras,
que se publican también; los 256 estados finales requeridos fueron claros.
Dos fallos deliberados del observer del productor añaden aparte 32 warmup,
dos Window y dos Document, con cleanup final claro. No se suman a los positivos.

La revisión detectó que la cancelación durante el último GC podía publicar
éxito. El arreglo comprueba la señal y el plazo después del GC/postflight y
cede un turno para recibir señales pendientes. Cinco regresiones con GC,
SIGTERM y plazos reales pasan en ambos SDK. También pasan 12 tests restantes
de calendario, comparación, planificación y replay adverso; tres tests Python
por SDK verifican el auditor. Los planes de ambos SDK son byte idénticos.

Se conservan una matriz Node22 anterior al arreglo, excluida de los totales
finales, y dos fallos de preflight antes de DOM por nueve dependencias de
metadata ausentes del staging local. Estas se copiaron de la fuente congelada
verificada. No cambió el paquete ni se desactivó un control. La QA local usa
un perfil real de archivos, sin inventar una identidad Git para el staging.

`evidence.tar.gz` conserva 1.317 miembros: datos, tareas, warmup, comandos,
logs de hijos, perfiles de fuentes y ambas versiones del controlador. SHA-256:
`a78084c765e5c2db2530c0d8722171c143ed5a11be6cc00fc489a2292ddc94db`.
Se releyó cada miembro contra `manifest.json`. El progreso stdout exterior de
los controladores locales no se exportó desde la herramienta; los datos y
streams de cada worker están completos. No ejecutar código archivado.

El exportador normal produjo ese archivo con comprobaciones activas. Después
se corrigió su guard contra Python optimizado, sin reexportar ni modificar
el archivo válido. Se conservaron fuentes exactas as-run/current y nueve
rechazos CLI de `-O`, `-OO` y `PYTHONOPTIMIZE=1` para los tres lectores de QA
en `reports/validation/block-confirmation-functional/20261027/`.

`candidate-production-difference.json` conserva los cuatro inputs que todavía
difieren de producción. No hay integración ni aceptación de rendimiento,
revaluación del gate o certificación universal de memoria. La captura formal
sigue deshabilitada; no hay tag ni merge de ownership.
