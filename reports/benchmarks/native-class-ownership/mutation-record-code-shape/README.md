# Código generado en la conversión de MutationRecord

Inspección estática de los binarios A/B congelados, con sus SHA originales. No
se ejecutaron operaciones DOM, perfiles ni nuevas muestras. No demuestra la
causa del +5,776513% A/B de Node 24 ni acepta el presupuesto.

En A, ToNapiValue de NativeMutationRecord ocupa 615 bytes; no aparece un símbolo
independiente para su new_instance tipado. En B, ToNapiValue ocupa 477 bytes y
llama a un new_instance tipado de 294 bytes. Se conserva esa llamada directa y
los tres desensamblados completos. La rama adicional de destrucción pertenece
al camino de error; no se interpreta como trabajo ejecutado en cada éxito.
No se convierte tamaño de código o número estático de llamadas en coste temporal.

El símbolo compartido new_instance_raw ocupa 954 bytes en A y 962 en B. En A,
la llamada indirecta de ToNapiValue usa el GOT 0x39efc8, cuya relocación apunta
a 0x2fa120, el símbolo new_instance_raw. En B hay una llamada directa adicional
al wrapper tipado 0x165880 antes del mismo tipo de función compartida. Es una
diferencia concreta de generación de código que permite investigar inlining
sin eliminar el guard de ownership. Su efecto temporal sigue sin demostrarse.

Se obtuvo con nm -S -C, objdump -d -C --no-show-raw-insn y readelf -rW. Las
versiones y límites de cada función están en inspection.json. Para reproducir
una extracción, usar el binario cuyo SHA coincide, la dirección address como
--start-address y address + bytes como --stop-address de objdump. Los paths
históricos de los binarios aparecen en el encabezado del desensamblado.

La siguiente investigación debe comprobar el camino realmente ejecutado y el
efecto de cualquier cambio de implementación. No habilita repetir la secuencia
idéntica, cambiar presupuestos/estimador ni atribuir una mejora no medida.
