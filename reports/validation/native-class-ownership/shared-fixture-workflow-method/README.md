# CI de la calificación funcional de fixtures

El candidato `81b27131` ya pasó cuatro tests funcionales y cinco de evidencia
por Node 22/24, con los paquetes reales, HTML y hashes originales. Este
workflow agrega su ejecución remota en Ubuntu 22.04, fijando Node 22.12.0
y 24.14.1. No reconstruye paquetes ni ejecuta un estudio de rendimiento.

Autentica el ZIP y tar oficiales antes de extraer la preparación. El test
funcional comprueba nuevamente su identidad y usa jsdom J0 y candidato B
reales. Los resultados completos, logs, código de la comprobación negativa
y metadata del host se conservan como artifacts, incluso tras un fallo.
Los nombres distinguen Node, SHA y run_attempt; no se sobrescriben intentos.

## Error encontrado y cerrado antes de publicar

La revisión detectó un P1 en `node --test ... | tee ...`: un shell sin
pipefail podía devolver el éxito de tee aunque Node hubiera fallado. Se
fijó `defaults.run.shell: bash`, que incorpora pipefail según la
[documentación oficial de GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepsshell).

El workflow contiene una comprobación que provoca un fallo intencional del
test runner de Node. El step exige observar exit 1, confirma que se ejecutó
el caso esperado y conserva el log. Así, una regresión que oculte el fallo
haría fallar el job. Los tests funcionales normales no ignoran sus errores.
El `not ok` de ese log negativo es esperado; los tests reales posteriores
deben pasar normalmente.

## Validación local del comando real

Se ejecutaron los bloques run exactos del YAML, sin tests de strings de
código fuente. En cada Node se comprobó:

- Bash explícito: la comprobación reconoce el fallo de Node y termina exit 0.
- Control con shell implícito sin pipefail: la comprobación rechaza el
  pipeline que ocultó el fallo y termina exit 1.
- Bash explícito con los cinco tests reales de evidencia: termina exit 0.

Los seis casos, scripts, stdout/stderr y hashes están guardados aquí.
No ejecutaron DOM, GC ni perfiles nuevos. actionlint y git diff --check
también aprobaron. La revisión final cerró el P1 sin otros hallazgos.

La prueba remota sigue siendo funcional y de recursos. Los eventos normales
del PR pueden volver a ejecutar CI; eso no relanza las capturas consumidas.
Esta calificación no cambia el sampler congelado, estimador, presupuestos
ni el estado rechazado de ownership. No concede tag ni merge.
