# Reutilización verificada de evidencia XML

Los pushes de datos activaban una medición XML idéntica aunque las fuentes no
cambiaran. El selector ahora autentica ZIP, verificador, protocolo, manifest y
metadata oficial antes de decidir reutilización o medición. Compara los dos
árboles canónicos, los inputs de build raíz presentes/ausentes, la receta del
workflow y las herramientas reales. Verificar la evidencia conserva su decisión;
un rechazo de integridad o presupuesto no autoriza otra medición ni un check verde.
El lector de metadata autenticada compara las herramientas y fuentes realmente
grabadas en el ZIP con la receta solicitada: actualizar el compilador declarado
no vuelve reutilizable una medición del compilador anterior.

Los inputs adicionales incluyen package.json, build.rs, .npmrc, shrinkwrap,
config Cargo y toolchain. Sus identidades se obtuvieron de los refs Git medidos;
no se capturó configuración privada del usuario. Los filtros CI cubren el grafo
del selector y los inputs que utiliza. El workflow omite build/medición solo tras
selección válida y recalcula todas las observaciones originales del gate XML.

Pasaron 20 contratos por Linux Node22.12.0 y Node24.14.1. Windows Node24.14.1
aprobó 16 y omitió cuatro casos Linux explícitos. Incluyen modificaciones reales
de fuentes/config, ZIP ausente/corrupto, verificador/metadata alterados y el
parcial cancelado. Sin mocks de plataforma ni del verificador.

El CLI actual, contra el checkout real y la referencia restaurada de Git, emitió
reuse=true y verificó los 468 procesos/14.976 duraciones originales con exit0.
No tomó muestras nuevas. actionlint aprobó. current-cli.json conserva comandos y
salidas; las rutas temporales de esa prueba se limpiaron al finalizar.

Las fuentes de prueba son los 324 blobs reales de checkpoint066 y las 333
fuentes C ya congeladas. La receta de reutilización de la fixture es una copia
inmutable del primer perfil de este cambio, no el YAML ejecutado al medir EA.
Las pruebas históricas usan su política explícita para permitir que futuros
candidatos o recetas rechacen la reutilización sin romper los contratos.
El CLI de la receta vigente se ejerció además sobre el árbol actual.

Alcance de memoria: operaciones de filesystem/hash y subprocesos síncronos con
salidas comprobadas. Las pruebas limpian sus árboles temporales bajo su directorio
verificado. Esta corrección no cambia ownership ni lifetimes del DOM; no aporta
una medición nueva de memoria pico o de fugas del motor.

El resultado conservado acepta únicamente XML Node24 con los inputs declarados.
La identidad completa de JavaScript sigue ausente en ese protocolo histórico;
no se añade retroactivamente ni se acepta el presupuesto separado de ownership.
