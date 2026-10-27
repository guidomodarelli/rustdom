# Piloto de dispersión entre bloques: decisiones pendientes

Estado: **propuesta no ejecutable**. No hay workflow, calendario de captura ni
aceptación activados. La autorización permanente existe; falta cerrar el diseño
técnico. El paquete nuevo es el artefacto numérico12628261403 del run40268999071,
ELFa2777cbf, separado del candidato4b52 rechazado. Su ensamble y pruebas no son
mediciones de rendimiento.

## Qué estimaría

Cada unidad sería un bloque completo de16factores, con32procesos nuevos A/B
adyacentes y orden contrabalanceado predeclarado. El contraste sería
Z_j(q)=B_j−qA_j entre medias de bloques. El piloto conservaría medias, covarianza,
orden temporal, datos adversos, tareas y recursos, sin aceptar presupuestos.
No se cuentan tareas internas ni factores como réplicas independientes.

Fijar q antes de capturar: jsdom0.98/1.02, más1solo como diagnóstico; RustAA
0.95/1.05 y RustAB1.05 si se incluyeran esos criterios. No sustituir q por la
razón favorable estimada del piloto. La SD está en unidades de duración;
dividirla por una media A estimada introduce incertidumbre adicional.

Bajo bloques iid normales y ν=r−1, el límite superior unilateral95% es
U=s·sqrt(ν/χ²(0.05,ν)). El intervalo bilateral95% usa cuantiles0.975/0.025.
Son resultados condicionales del [modelo χ² para varianza de NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda358.htm),
no garantías frente a dependencia o deriva.

## Incertidumbre nominal y costo

La [tabla de cuantiles NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3674.htm)
da estos multiplicadores aproximados; el redondeo tabulado no es un nuevo
estimador de aceptación:

| Bloques r | IC bilateral95% de SD, múltiplo de s | U95 unilateral | Procesos64criterios | Solo jsdom32criterios |
|---:|---:|---:|---:|---:|
| 8 | [0.661;2.035] | 1.797 | 16384 | 8192 |
| 16 | [0.739;1.548] | 1.437 | 32768 | 16384 |
| 32 | [0.802;1.329] | 1.268 | 65536 | 32768 |

Una tolerancia nominal U≤1.5s requiere como mínimo r14 bajo el modelo; r16 la
satisface con margen. Es una opción prospectiva basada en incertidumbre de SD,
**no potencia del candidato, ni error relativo verdadero de ±50%**. Elegir la
tolerancia exige justificar riesgo de subdimensionar y costo, sin mirar si una
captura está pasando. No se ha fijado aquí esa elección como protocolo final.

Los límites anteriores son puntuales. No son simultáneos para32criterios por
dos bordes; exigir cobertura conjunta implica predeclarar otra calibración,
por ejemplo Bonferroni sobre64límites, y recalcular r y costo. No multiplicar
probabilidades por criterio sin un modelo conjunto.

Proyección lineal desde costos crudos históricos: peor shard jsdom≈53.3/106.5/
213.0min para r8/16/32; Rust≈125.6/251.2/502.3min. No son duraciones futuras
medidas. El límite propuesto170min no admite r32jsdom ni r16Rust. Repartir las
réplicas entre VMs cambia el diseño condicionado al host; no resuelve ese
desborde conservando automáticamente la misma inferencia.

## Alcance de una primera fase solo jsdom

Las ocho filas ×dos SDK ×AA/AB son32criterios. r16 permitiría estimar dispersión
de esos controles en sus hosts, bajo las hipótesis explícitas y dentro de la
proyección temporal. AA no reemplaza AB. Esa fase **no estima efecto ni varianza
RustAB, no dimensiona la captura completa y no demuestra transferencia a otra
VM**. Su resultado sería dimensionamiento o inconclusión, nunca aceptación.

Antes de activar: fijar artefactos y calendario, justificar tolerancia y alcance
puntual/conjunto, implementar/validar capturador y lectura, conservar todos los
bloques sin exclusiones por resultado y definir presupuesto y salida inconclusa.
Conservar dependencia observada; una autocorrelación no significativa no prueba
independencia. No combinar ingenuamente el piloto con la confirmación ni parar
al primer verde. La confirmación posterior requerirá tamaño predeclarado propio.

Revisión matemática aislada `review_ownership_closeout`: fórmula y costos
contrastados, sin simulaciones ni DOM. Recomienda este entregable técnico y
explicitar que el piloto solo jsdom no cierra el bloqueo integral. Los estudios
históricos y el gate siguen rechazados; no tag/merge sin aceptación.
