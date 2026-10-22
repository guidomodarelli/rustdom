# Sensibilidad de los controles a una posición

Cuatro de los seis controles rechazados del ensayo `39735778846` permanecen
fuera de ±2% en los dieciséis escenarios que omiten una posición A/B completa.
Los otros dos pueden cruzar el límite; también lo hacen siete de las 26 filas
que nominalmente pasan. El resultado oficial conserva todas las muestras y
sigue `accepted=false`. No se propone omitir ninguna posición para aceptar.

| Node | Fase | Control rechazado | Original (%) | Mínimo al omitir (%) | Máximo al omitir (%) | Escenarios dentro de ±2% |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 22.12.0 | AA | observer-delivery-records/100 | +2,222 | +1,060 | +4,126 | 6/16 |
| 22.12.0 | AA | range-control-1000/1000 | +9,059 | +5,938 | +14,509 | 0/16 |
| 22.12.0 | AA | range-control-1000/250 | +5,970 | +3,678 | +6,268 | 0/16 |
| 22.12.0 | AB | mutation-records-collect/100 | −4,467 | −5,123 | −2,853 | 0/16 |
| 24.14.1 | AA | range-state-lifecycle-1000/250 | +3,295 | +2,247 | +3,933 | 0/16 |
| 24.14.1 | AB | observer-delivery-records/100 | −2,046 | −2,678 | −1,085 | 7/16 |

## Método y alcance

`analyze.py` lee exclusivamente los datos jsdom del archivo publicado:
128 procesos y 9.216 duraciones, ambas versiones Node, ambas fases y ocho
cargas por combinación. Los inputs y sus hashes se identifican en `result.json`.
Reutiliza el perfil congelado `independent-order-v1` y su presupuesto de ±2%.
Los verificadores originales del archivo completo siguen siendo necesarios
para autenticar la evidencia; este diagnóstico no los reemplaza.

Para cada una de las 32 filas calcula primero la razón de las medianas de
las 144 duraciones por tratamiento, idéntica al resultado oficial. Después
calcula los dieciséis escenarios de excluir las nueve muestras de A y las
nueve de B de la misma posición. Conserva cada valor, incluidos extremos y
cambios de decisión. Son 512 escenarios exploratorios; no son nuevas muestras.
No usa la mediana de las medianas de proceso, no selecciona una eliminación
favorable y no cambia el estimador del ensayo original.

Esta sensibilidad no es un intervalo de confianza, una prueba de hipótesis,
un cálculo de potencia ni una proyección de cuántas réplicas hacen falta.
Tampoco demuestra causas JIT, GC, orden, hardware o una regresión Rust. La
persistencia de cuatro rechazos exige investigar más que una única posición;
no justifica aumentar arbitrariamente warmups o repetir el ensayo esperando
otra decisión. No modifica los escenarios de memoria ni crea referencias DOM.

## Reproducción y pruebas

```sh
python3 -B -m unittest discover -s reports/benchmarks/native-class-ownership/control-sensitivity -p test_analyze.py -v
python3 -B reports/benchmarks/native-class-ownership/control-sensitivity/analyze.py reports/benchmarks/native-class-ownership/independent-order/39735778846 NEW_RESULT.json
```

Siete tests numéricos cubren controles idénticos, cambios positivos/negativos,
el estimador agrupado, eliminación emparejada, cambio de decisión y rechazo
de duraciones no utilizables o posiciones insuficientes. Tres contratos con
copias reales del archivo rechazan una observación faltante, una identidad
duplicada y una fila de referencia eliminada. Se ejercita además
la lectura real de las 32 filas contra el resultado publicado. No hay mocks.
La validación y reproducción Windows/Linux están en
`reports/validation/native-class-ownership/control-sensitivity/`.

Esta publicación no cambia el runtime, no vuelve a ejecutar DOM/Jest/Vitest
ni hace benchmarks nuevos. El CI de cada SHA se sigue por separado. El hito
de ownership permanece abierto y no recibe merge ni tag de checkpoint.
