# Interrupción de WPT en macOS

En el head `7fada81287850166ceed5e0f026998f6680d1b97` del PR36, el job
`103661354344` del run `34733773005` completó Rust, build, 492 contratos Node,
runners y HTML5. El gate WPT terminó con `exitCode: null` tras 171,22 segundos,
sin stack ni mensaje de aserción fallida. Su log terminó durante
Range-mutations-replaceData. El runner de validación no registraba la señal,
por lo que esta evidencia no identifica la causa de la terminación.

Se conservan `macos-failed-gates.json` y `macos-wpt-interrupted.log`, extraídos
del artefacto original `10309759767`. El job macOS `103661359320` del run
`34733774652` aprobó sobre el mismo head, al igual que Linux y Windows.

Después de inspeccionar logs y artefactos se solicitó una sola reejecución
del job interrumpido, manteniendo el mismo SHA, fixtures, assertions y límites.
La reejecución, intento2 y job `103664851809`, aprobó sobre el mismo SHA con
los mismos tests y límites. La causa de la interrupción original no quedó
identificada: no se presupone un problema de memoria ni se afirma que el
runtime esté libre de toda fuga. Una nueva recurrencia requiere diagnóstico
adicional de la señal y los recursos.
