# Comparación con afinidad del principal interrumpida

El método v1 de `2567e7e1` comenzó una secuencia fija de Node 22 y después
Node 24. Se detuvo tras confirmar el comentario remoto 4341492148: la huella
de fuentes excluye dist y el método no había fijado toda la distribución
JavaScript de A/B que realmente cargaba. No se usan estos datos para aceptar
rendimiento o atribuir diferencias al guard de ownership.

Se conservan las doce fuentes congeladas y todos los archivos originales.
Node 22 inició veinte procesos A/A; diecinueve completaron 1.368 duraciones
medidas. Diez usaron Rust A y nueve jsdom. El vigésimo fue terminado, sin
endpoint final. No se completó A/A, no se inició A/B, no se ejecutó el candidato
B ni Node 24. `complete=false`, sin aceptación. El índice original sigue intacto.

termination.json identifica shell, driver y worker propios a los que se envió
SIGTERM, después de verificar sus comandos y parentesco. La sesión 54959 terminó
con exit 1; se comprobó que no quedó ninguno ejecutándose. No se detuvo por
seleccionar un resultado de rendimiento: se corrigió un defecto de identidad
del método antes de ejecutar otra comparación.

verify.py comprueba el manifest exterior, los hashes internos y el comportamiento
observable reportado por los diecinueve procesos completos: orden, runtime,
afinidad, conteos, resultados públicos iguales y duraciones válidas. Verifica
un archivo parcial; deliberadamente no calcula aceptación ni lo presenta como
una fase completa. No puede demostrar retroactivamente la identidad dist que
faltaba antes de medir. Se ejecuta con `python3 verify.py`.

memory-summary.json conserva mínimos/máximos de las observaciones posteriores
a limpieza del worker original. No son picos, no observan Window/Document por
separado y no sustituyen las regresiones de ownership publicadas. Se publica
también en reports/memory/native-class-ownership/.
