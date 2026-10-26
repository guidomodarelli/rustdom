# Contraste completo en GitHub con paquetes oficiales fijados

Estado: método en preparación, sin mediciones nuevas. Debe validarse, revisarse
y publicarse antes de lanzar una única secuencia. No sustituye los resultados
anteriores ni permite reconstruir paquetes para seleccionar otros bytes.

## Pregunta y alcance

¿Calibra el control jsdom y queda C dentro de los presupuestos existentes cuando
la comparación completa se ejecuta en un runner Ubuntu 22.04 de GitHub con los
paquetes oficiales del run 39720077911 y afinidad solo del hilo principal?

El ensayo hosted antiguo usaba el candidato B anterior, solo Range y afinidad
de todos los hilos. Falló. El estudio C completo con afinidad principal se hizo
en WSL y tampoco calibró. Este contraste cambia el entorno y usa los nuevos
paquetes oficiales; no identifica por separado la causa de las diferencias.
No se atribuye a GitHub una garantía de estabilidad ni se adopta separación de
procesos, más warmup, otro estimador o presupuestos más amplios.

## Entradas fijadas antes de medir

Run 39720077911, head 2e0ae88d7afee89b1e900d36b6bd22d51dd7fb99,
artefacto 12400802735, ZIP SHA-256
`b25f1e98608c6abb50cb9a5c9feb00f825276941511f3ed9905c457480582610`.
El tar interior tiene SHA-256
`c1b65afaaaeb48f4463cd276b8edf73fe783a68b7c39d1f61cb43ab8d396b839`.
UUID `99fb5dd8-2ee8-402c-97b4-d8174069f933`.
El recibo versionado conserva huellas completas de A0/A1/C/J0/J1, dependencias,
fuentes y procedencia. Las distribuciones A/C difieren de las locales; no se
pueden verificar con sus antiguos pins. No se compila durante este contraste.
Se verifica la preparación completa antes y después de cada Node, incluidas
dependencias, fuentes, enlaces y distribuciones. C conserva la etiqueta B.

## Método y decisión

Se reutiliza sin cambios el algoritmo de paired-main-worker y createPairedStudy.
Node 22.12.0 y después 24.14.1; A/A y después A/B por Node; posiciones 0..7;
los motores alternan como en el estudio C anterior. Son 64 procesos, ocho filas,
tres warmups y nueve muestras por lote: 9.216 duraciones medidas. Las copias,
carga y orden de lotes se balancean con el diseño original.

CPU2 solo para el hilo principal; se comprueban las máscaras iniciales,
configuradas y finales. Los hilos de fondo presentes al configurar conservan
sus máscaras; también se exige al menos uno con máscara amplia al finalizar.
Estas fotografías no observan hilos transitorios entre endpoints.
Si CPU2 no está disponible o hay otra restricción, se conserva el fallo y no
se cambia de CPU ni se reintenta. Se registran CPU, sistema, memoria, Node/V8,
paquetes, fuentes, stdout/stderr y todos los procesos.

Se conserva la razón entre medianas agrupadas y el proceso como unidad
independiente. Los límites son ±2% para jsdom, ±5% para Rust A/A y +5% para
Rust A/B, todas las filas en ambos Node. Fallar calibración o presupuesto
impide aceptar. No se eliminan muestras, filas, exclusiones ni resultados.
Exit 1 con archivo completo permite continuar al siguiente Node; exit 2 por
ejecución/integridad detiene la secuencia. No hay reintentos automáticos.

La limpieza conserva tres rondas y exige los dos últimos endpoints claros:
Window y Document se observan por separado junto con los baselines nativos.
Son observaciones posteriores a GC, no picos ni prueba universal de ausencia
de fugas. El archivo conserva también las referencias observadas desde warmup.

## Publicación y límites

Las pruebas y la revisión local deben fijar los bytes del arnés antes de publicar
el workflow. La procedencia del run registra el SHA publicado y el recibo de
esa revisión; verificar --verify-set reproduce la decisión offline.
Tras publicar, se agrega una sola vez la etiqueta `ownership-hosted-main-v1`
al PR. El workflow usa el evento pull_request/labeled y no synchronize; no se
quita y reaplica la etiqueta. Los intentos de rerun superiores a uno se omiten
y no constituyen evidencia ni aceptación. Ver [eventos oficiales de GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).
Conservar todos los resultados, aunque el contraste vuelva a fallar. No iniciar
otra secuencia idéntica ni ajustar la regla para obtener verde. El gate histórico
permanece negativo hasta evaluar y publicar una integración explícita de la nueva
evidencia. Este contraste no acredita nuevas APIs ni la migración completa.
