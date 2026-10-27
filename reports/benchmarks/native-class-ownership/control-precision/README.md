# Precisión de los controles del estudio 40234774968

Revisión local aislada de solo lectura sobre las 64 comparaciones publicadas
en `dc0b2df4`. No se ejecutó DOM ni una nueva captura; los históricos siguen
rechazados y no se cambió el gate.

Los 32 puntos jsdom están dentro de ±2%: −1.4783% a +1.4535%. Ningún intervalo
IC95% queda enteramente fuera de ese margen y 31/32 incluyen cero. Los 19
rechazos indican que no se demostró equivalencia con la precisión disponible;
no demuestran 19 diferencias reales. El semiancho de los intervalos tiene
mediana 1.499 puntos porcentuales y máximo 3.729.

La razón de medias aritméticas por proceso y la covarianza pareada de Fieller
deben conservarse. Una media de razones individuales cambia el estimando.
Las 144 tareas de un proceso no son 144 réplicas independientes. Tampoco lo son
los nueve bloques ni el remuestreo del dataset.

Como sensibilidad de planificación —no aceptación ni potencia validada— el
reviewer estimó que, bajo procesos independientes, variabilidad futura igual
y diferencia verdadera de cero, 192–256 pares por criterio podrían alcanzar
una precisión útil. Con un desplazamiento verdadero de 0.5–1 punto porcentual,
el tamaño requerido crece mucho. Estos supuestos no están demostrados y no
incluyen que el candidato satisfaga RustAB; más precisión debe conservar el
rechazo de una regresión real superior a +5%.

El diseño actual tiene una observación por cada una de 16 combinaciones de
factores. Hay que decidir prospectivamente si el estimando es su promedio con
peso 1/16 o una población de hosts/sesiones. Al replicar factores, no asignar
automáticamente `16r−1` grados de libertad: justificar la varianza estratificada
y los grados efectivos. Si hay dependencia común de host, contar sus clústeres
y no tratar cada proceso como un host independiente.

El costo impide simplemente aumentar pares en dos jobs de 170 minutos:
32 pares proyectan aproximadamente 298/289 minutos por SDK; con 64 pares,
solo los procesos jsdom proyectan 213/207 minutos, aun sin costo Rust.
Las proyecciones no son duraciones medidas de una secuencia nueva.

Antes de otra captura corresponde revisar costo de autenticación fuera del
timer, estimando, independencia y precisión del peor control. Un método nuevo
requiere protocolo prospectivo, límites, pruebas y revisión. No elegir el tamaño
viendo si va pasando, no detener al primer verde ni mezclar históricos con
un candidato nuevo. No hay un nuevo estudio activado por esta revisión.
