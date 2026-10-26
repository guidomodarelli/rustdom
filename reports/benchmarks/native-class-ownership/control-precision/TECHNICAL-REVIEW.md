# Revisión estadística del borrador, sin captura

El reviewer local aislado revisó el borrador
`c5dfdc0b8a5a1441e6a57e2b029f74be756ca408d3efeb1acd0c25d1f3d51444`
y los datos existentes. No ejecutó DOM ni nuevas mediciones.

La razón de medias de bloques conserva el punto de todos los procesos
balanceados; `r−1` evita contar los factores internos como réplicas. El esquema
es defendible bajo supuestos explícitos, pero **todavía no está dimensionado
para demostrar precisión suficiente**. Permanece como borrador no ejecutable.

Pendientes técnicos:

1. Bloques consecutivos de una VM pueden compartir deriva temporal. El estimando
   condicionado al host no elimina esa dependencia. Se requieren permutaciones
   balanceadas predeclaradas, límites de inferencia y una política conservadora
   anterior a observar aceptación; no arreglar intervalos posteriormente.
2. El histórico aporta un solo bloque completo por criterio: no permite estimar
   variación entre bloques ni su covarianza temporal. Las potencias iid previas
   no justifican automáticamente 16 bloques jsdom y ocho Rust, ni una reducción
   del error por factor cuatro. HAC/bootstrap tampoco reparan automáticamente
   una serie de ocho/dieciséis unidades.

Como sensibilidad normal linealizada, con bloques independientes y supuestos
favorables, aproximadamente 90% de potencia por criterio exigiría desviación
relativa entre contrastes de bloque de aproximadamente 2.12 puntos para jsdom
con 16 bloques y diferencia cero; 3.53 para Rust AA con ocho bloques y diferencia
cero; y 0.78 para Rust AB con ocho bloques y diferencia verdadera +4%, cercana
al límite +5%. No es potencia exacta de Fieller ni una promesa conjunta.

Las cuentas y proyecciones sí concuerdan: 24576 procesos y aproximadamente
52.8 horas agregadas de comandos, además de preparación/transporte. El máximo
lineal por shard sería 125.58 minutos Rust y 106.51 jsdom. Encajar en el timeout
no demuestra precisión. No se activó este diseño ni se solicitó otra autorización:
la autorización humana es permanente; el trabajo pendiente es técnico.
