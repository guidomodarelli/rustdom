# Cancelación del CI general obsoleto del mismo PR

El workflow `ci.yml` permitía acumular ejecuciones de commits anteriores del
mismo PR. Ahora su grupo incluye el workflow y el número de PR; un push nuevo
cancela la ejecución anterior de ese grupo. En `main`, cada `run_id` produce un
grupo independiente y la cancelación está deshabilitada. La política se limita
al CI general. Conserva jobs, pruebas, presupuestos y límites de 60/45 minutos.

La [documentación oficial de GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
describe los grupos, el fallback al identificador de ejecución y la cancelación
condicional. La revisión aislada no encontró problemas. Actionlint 1.7.12
oficial, con SHA256 del ZIP verificado, terminó con código 0 en Windows.
El intento Linux no llegó a ejecutarse porque la distribución temporal devolvió
`WSL_E_USER_NOT_FOUND`; no se presenta como una validación Linux aprobada.
La comprobación del scheduler real requiere que GitHub procese el cambio
publicado. No se activó ni relanzó ningún estudio científico para validarlo.

## Estado del fallo de rendimiento

El CI general del commit anterior `8e9d68d0`, run `40291196776`, terminó
aprobado. Esto es independiente del check `Native class ownership`.
El log íntegro del job Node 24 `121500981859`, run `40301728369`, demuestra
que las verificaciones previas pasaron y el paso final salió con código 1:
el estudio conservado rechazó el presupuesto original. No fue un timeout ni
una excepción del lector. Ese rechazo sigue vigente. La política de
concurrencia no corrige la regresión y no autoriza presentar el PR completo
como aprobado.

`validation.json` conserva los hashes de la configuración y de actionlint,
la revisión y las limitaciones. Los otros archivos conservan respuestas de la
API y el log completo del job rechazado. Ningún código de artifact se ejecutó.
Las 48 entradas ajenas se conservaron. No hubo cambios del producto, nuevas
mediciones de rendimiento ni reevaluación del gate.
