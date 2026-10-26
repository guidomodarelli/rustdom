# Calendario y agregación del piloto jsdom

Implementación de preparación, **sin capturador ni activación**. El CI solo
comprueba contratos con escalares sintéticos y escribe el calendario completo.
No ejecuta DOM, no produce tiempos de rendimiento y no reevalúa el gate.

Se fija como propuesta del piloto la opción r16 de VARIANCE-PILOT-DRAFT.md:
32 criterios jsdom, cada uno con 16 bloques de las 16 combinaciones originales,
dos procesos A/B adyacentes por factor. Son 512 bloques y 16384 procesos
propuestos. Cada criterio debe permanecer en un host; no se estima variación
entre hosts ni se dimensiona RustAB con este piloto.

Cada bloque contiene todos los factores una vez. Una rotación cíclica equilibra
su posición temporal a lo largo de los 16 bloques. La semilla y las decisiones
originales de orden A/B y asignación de paquete siguen al factor original,
independientemente de su nueva posición. No se reordena el archivo de resultados
para ocultar deriva. Esta rotación no garantiza independencia.

Elegir r16 permite un límite superior puntual nominal de SD aproximadamente
1.437s bajo bloques iid normales, frente al objetivo de planificación U≤1.5s.
Se acepta explícitamente ese nivel de incertidumbre de dispersión por costo;
no es potencia, precisión conjunta de 64 bordes, margen verdadero ±50%, ni
garantía para otra VM. La proyección histórica del peor shard jsdom es 106.5
minutos; el límite propuesto es 170 dentro de 200. Aún no existe capturador que
imponga esos límites. El método sigue executionReady=false.

La justificación nominal de SD sigue el [modelo de varianza de NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda358.htm)
y su [tabla de cuantiles](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3674.htm).

`summarize` recibe medias escalares **ya autenticadas** por un futuro lector
integral. Rechaza criterios parciales, duplicados, reordenados, múltiples hosts,
procesos incompletos, conteos alterados y tiempos no finitos/solapados. No
autentica esos escalares ni demuestra corrección o cleanup: eso continúa
pendiente en el transporte y verificador integral. Conserva todas las medias
de bloques, razón de medias aritméticas, covarianza y contrastes fijos
B−qA para q=0.98/1/1.02; q=1 es diagnóstico. No calcula intervalos todavía ni
adapta el tamaño según resultados.

```sh
node --test reports/benchmarks/native-class-ownership/control-precision/pilot/blocks.spec.cjs
node reports/benchmarks/native-class-ownership/control-precision/pilot/plan.cjs /nuevo/calendar.json
```

La salida usa creación exclusiva y conserva cualquier archivo previo. Las
pruebas validan comportamiento, calendario completo, estimando, errores y CLI
real. Los arrays escalares están acotados por el diseño; no se cargan runtimes,
wrappers, realms ni referencias DOM. Esto no sustituye las pruebas de memoria
del capturador futuro. Faltan lector autenticado de tareas/recursos, intervalos,
diagnósticos de dependencia, empaquetado, límites, revisión integral y evidencia
hosted antes de cualquier captura. No tag/merge; ownership sigue rechazado.
