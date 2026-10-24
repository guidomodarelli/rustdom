# Memoria en la observación de identidades

La tanda final creó y cerró 48 Windows en cuatro procesos reales de jsdom,
con Document observado por separado. Se conservaron tres rondas de cleanup
por owner y los dos últimos endpoints exigidos estuvieron claros. Hay otros
24 Windows de la observación preliminar, conservada por separado. Son
pruebas finitas de estos probes; no prueban ausencia universal de fugas.

Las funciones se identifican con WeakMap, cuyos valores son IDs escalares.
El reporte no guarda constructores, métodos, globals o nodos fuertes. Los
frames que sostienen el DOM terminan antes del cleanup y Window.close se
ejecuta en finally. El número de owners está acotado por configuración.
Los objetos JSDOM/Object compartidos no se convierten en caches de Windows.

No se midieron heap JavaScript, memoria externa o RSS, ni se ejerció el addon
Rustdom. No es evidencia nueva sobre sus finalizers N-API. No se hicieron
muestras de rendimiento. Los raw están en
`reports/validation/native-class-ownership/window-identities/`.
