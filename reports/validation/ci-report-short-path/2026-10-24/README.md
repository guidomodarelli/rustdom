# Rutas Windows 8.3 en el colector de reportes

El job120965695524 del run40125425193/SHA1c3a041b falló antes de los tests
del producto: Git resolvía el temporal como C:/Users/runneradmin, mientras
fs.realpathSync conservaba C:/Users/RUNNER~1. La comprobación de raíz comparaba
dos strings distintos que identificaban el mismo directorio. Se conserva el
log hospedado íntegro y su metadata; no se reinició ese job ni el estudio frío.

El colector usa ahora fs.realpathSync.native para la raíz, el padre de salida
y los archivos leídos. La API nativa expande los aliases8.3, conservando la
prohibición de salida dentro del checkout y de leer destinos externos. No se
reemplazó la comprobación por una comparación laxa de strings ni se quitaron
los límites de propiedad de los archivos. El cleanup de fixtures usa la misma
resolución nativa antes de eliminar únicamente su temporal propio.

La prueba nueva consulta un alias8.3 real del temporal mediante cmd.exe y
prueba copia válida y rechazo de salida interna. windowsVerbatimArguments
evita que Node agregue escapes que CMD interpretaría literalmente. Si el
filesystem no ofrece alias, se informa omisión; el temporal hospedado RUNNER~1
exige ejercer el caso. En esta máquina Windows el caso8.3 sí se ejecutó.

La regresión completa se ejecutó contra el colector previo obtenido de Git
1c3a041b y contra el fix, usando la misma suite nueva y fixtures reales:
baseline11pass/1fail/1skip; corregido12pass/0fail/1skip. La omisión corresponde
al privilegio de symlink de archivo y no al caso8.3. Node local Windows24.21.0;
binario y hashes exactos en windows-receipt.json. En Linux, Node22.12.0 y
24.14.1 pasan12contratos y omiten solo el contrato específico de Windows.
No se mockearon Git, filesystem ni APIs. Se conservan los logs de las tres
plataformas/runtimes; no se crearon ventanas ni nuevas mediciones DOM.

Los511pins científicos y los estudios históricos siguen intactos. Se requiere
confirmar el nuevo SHA en CI hospedado; estas pruebas no aceptan ownership ni
el rendimiento rechazado. Los procesos síncronos terminan antes del cierre y
los streams del colector se consumen; no hay nuevas referencias persistentes
ni caches. Es validación finita, no una garantía universal de ausencia de fugas.
