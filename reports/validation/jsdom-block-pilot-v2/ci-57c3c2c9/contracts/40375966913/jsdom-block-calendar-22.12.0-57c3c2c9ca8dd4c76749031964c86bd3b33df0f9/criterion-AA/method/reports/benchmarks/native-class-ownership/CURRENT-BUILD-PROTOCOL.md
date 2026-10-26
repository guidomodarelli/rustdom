# Preparación de fuentes actuales, separada del gate histórico

La preparación original exige la huella completa del estudio C anterior,
incluido su benchmark. Al cambiar el método, el CI de b9e7f9fb falla antes de
construir: cb439f10 difiere de 0d67e1d8. Es un rechazo correcto para reutilizar
aquellos tiempos, pero impide producir un archivo nuevo de fuentes actuales.

La receta v2 registra una preparación nueva, con UUID propio, sin mediciones
ni aceptación de rendimiento. Mantiene checkpoint067 como baseline fijado.
Captura todas las fuentes del candidato, arnés e inputs adicionales/opcionales
antes de instalar; comprueba que sigan idénticos tras construir. Copia fuentes,
logs, distribuciones y dependencias, verifica los bytes tras relocación y
conserva los checks de herramientas, Cargo, flags, enlaces y liberación.

El productor y lector v1 conservan sus defaults y sus pins anteriores. Los
archivos v1/v2 se distinguen por revision de receta y política de inputs; no se
relabela un archivo antiguo. Un lector de preparación no acepta presupuestos:
measurementExecuted=false y performanceAccepted=null son invariantes.

La política v2 permite registrar un candidato diferente; no permite declararlo
equivalente a uno anterior ni reutilizar sus tiempos. El estudio que llegue a
usarlo deberá fijar el recibo y las identidades completas antes de medir, y
ejercer sus propias condiciones de aceptación. El gate anterior sigue rechazado
y la secuencia realm-warmup terminó usando la preparación v1 original
autenticada; esta corrección no modificó sus fuentes congeladas ni sus inputs.

Se reutilizan el constructor de archivo y el worker de validación funcional.
Solo la receta y captura de inputs son explícitas por variante. Herramientas,
comandos, workloads públicos, rondas de recursos y protección de descriptores
de archivo mantienen la misma configuración. La receta rechaza cambios en esas
partes compartidas. El worker observa Window/Document separados y las mismas
asignaciones nativas, sin cronometrar DOM.

Calificación local completada tras finalizar el ensayo: builds reales de A/B,
workers funcionales Node22/24 y 14 contratos actuales + 17 históricos por Node
pasan. Seis contratos de inputs también pasan en Windows con Node24.
Actionlint con shellcheck pasa. Fuentes, paquetes completos y logs están en
`reports/validation/native-class-ownership/current-build/`. La ejecución de CI
sobre el commit publicado se verifica por separado.

El ensayo caliente completo quedó rechazado por once controles jsdom; sus
datos completos están en `realm-warmup-results/2026-10-22/`. Esta preparación
nueva no aprueba ese ensayo ni los anteriores. No se ejecutaron builds ni
suites adicionales mientras estuvo activo.
