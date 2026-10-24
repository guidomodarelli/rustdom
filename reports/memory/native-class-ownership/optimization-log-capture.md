# Recursos de la captura de optimización

El sampler original ejecutó 384 Windows con Document observado por separado.
Los 32 lotes conservaron tres rondas de cleanup y sus dos endpoints finales
exigidos claros. Son 96 observaciones de cleanup y64 estados finales por tipo;
no es ausencia universal de fugas. Los casos son jsdom, no el addon Rustdom.

Las 288 mediciones instrumentadas incluyen memoria posterior a cleanup; no
son picos. No se midió aquí heap/RSS máximo del árbol de procesos o CPU exacta.
Las trazas y su overhead no se comparan con presupuestos de memoria.

El launcher dejó logs en disco, cerró descriptores y hasheó por chunks de1MiB.
El lector recorre líneas y escribe ledger sin retener todas las líneas. Conserva
contadores acotados al archivo, sin referencias DOM. No genera pyc dentro de
la captura, tampoco cuando el CLI se ejecuta sin -B. Los lectores Linux/Windows
coinciden. Ver datos en el informe de validación de igual nombre.
