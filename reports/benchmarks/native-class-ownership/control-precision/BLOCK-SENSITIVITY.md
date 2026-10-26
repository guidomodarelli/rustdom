# Sensibilidad de la inferencia a factores y bloques

Investigación prospectiva, sin captura ni decisión de aceptación. No modifica
los rechazos anteriores, el estimando ni los presupuestos originales. El borrador
de tamaños 16/8 continúa no ejecutable: este análisis no demuestra su potencia.

## Dos modelos explícitos

Con 16 factores fijos y r réplicas completas, el punto sigue siendo la razón
entre la media B y la media A de todos los procesos balanceados. Cada proceso
aporta su media aritmética de tareas; las tareas internas no son réplicas.

El modelo de bloques supone que los r pares de medias de bloques completos
son iid bivariados normales. Permite correlación arbitraria entre factores
dentro de un bloque, pero no dependencia entre bloques. Fieller utiliza la
covarianza de esos pares y t con r−1 grados de libertad.

El modelo estratificado supone pares iid bivariados normales dentro de cada
factor, independencia entre factores y réplicas, y medias/covarianzas estables
por factor. Para una razón candidata q, sea s_f²(q) la varianza muestral de
B−qA dentro del factor f. La varianza estimada de la media balanceada del
contraste es Σ_f s_f²(q)/(16²r). Usar t con r−1 grados de libertad resulta
conservador bajo estas hipótesis; no corresponde usar 16r−1.

Justificación: el contraste normalizado es N/√D, con N normal estándar
independiente de D=Σ_f a_f Y_f. Los pesos a_f son proporciones de varianzas
poblacionales, no pesos estimados, y cada Y_f tiene distribución χ²(r−1)/(r−1).
Para c=t(r−1,0.975), la función g(d)=2Φ(−c√d) es convexa para d>0:
g''(d)=cφ(c√d)(1+c²d)/(2d^(3/2))>0. Jensen da
E[g(Σ_f a_fY_f)]≤Σ_f a_fE[g(Y_f)]=0.05. La inversión de la desigualdad produce
cobertura puntual de al menos 95% bajo ese modelo. Varianza cero y otros casos
degenerados requieren tratamiento explícito; la prueba no autoriza aceptar por
defecto ni truncar conjuntos Fieller no acotados.

## Límite y regla conservadora posible

El ejemplo A_fj=1, B_fj=q+U_j, con un mismo U_j compartido por los 16 factores
de la réplica j, viola la independencia entre factores: la varianza estratificada
subestima por un factor 16. Crear procesos nuevos no descarta ese caso.

Una regla prospectiva podría calcular ambos conjuntos y conservar la envolvente
de su unión. Se aceptaría únicamente si ambos son acotados y toda la envolvente
entra en el presupuesto original. Un conjunto no estimable se trataría como
inconcluyente y rechazaría aceptación; no se fabricaría un intervalo finito.

La envolvente contiene cualquier conjunto válido y conserva cobertura puntual
incondicional de al menos 95% si alguno de los modelos es válido. No requiere
independencia entre ambos cálculos. Esto no afirma cobertura del 95% condicionada
a publicar solo los casos acotados, ni cobertura conjunta del 95% para 64 criterios.

Sin embargo, el modelo estratificado completo implica el modelo de bloques.
Por tanto, esta conjunción no amplía la clase cubierta respecto del modelo de
bloques y nunca aumenta la potencia. Sirve para mostrar sensibilidad y evitar
elegir el intervalo favorable después de ver los datos; **no resuelve por sí sola
la precisión pendiente**.

Ambos modelos pueden fallar ante dependencia entre bloques, deriva temporal o
sesgo de orden relacionado con A/B. Intervalos coincidentes y estrechos no prueban
ausencia de sesgo. Las pruebas de normalidad/autocorrelación con 8/16 unidades
tampoco demuestran sus hipótesis. El histórico tiene una sola réplica completa
por criterio: no identifica la varianza entre réplicas ni garantiza potencia
para un candidato nuevo. Su dispersión solo puede usarse como sensibilidad de
planificación, sin llamarla cota poblacional garantizada.

Revisión matemática local aislada: las garantías anteriores son condicionales
a sus hipótesis. No se ejecutaron DOM ni mediciones para este análisis. Sigue
pendiente dimensionar un método nuevo justificable y calificar el artefacto
hosted exacto antes de habilitarlo. La autorización humana permanente ya existe;
el pendiente es técnico.
