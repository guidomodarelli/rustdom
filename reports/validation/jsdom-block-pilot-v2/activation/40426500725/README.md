# Única activación del piloto v2

La etiqueta ownership-jsdom-block-pilot-v2 se aplicó una vez, sin reintentos.
El run real es 40426500725, intento 1, fuente 4196c496. El preflight hosted
121933460641 aprobó antes de admitir los 32 jobs del calendario. Que el run
figure transitoriamente queued mientras algunos jobs ejecutan no permite
reiniciar ni reaplicar la etiqueta.

binding.json conserva los 33 IDs de jobs y los límites: 170 minutos de captura
y 200 de job por criterio. Son 16.384 procesos jsdom, 2.359.296 duraciones,
786.432 warmup, 196.608 Window y 196.608 Document esperados. No son conteos
observados ni una aceptación. Los parciales y rechazos deben conservarse.

activation-receipts.tar.gz contiene 46 archivos íntegros: preflight local,
metadata/API de ambas comprobaciones, intención exclusiva previa al único
POST, respuesta, confirmación y código revisado as-run. Cada miembro se releyó
y su tamaño/hash está en binding.json. Nunca ejecutar scripts archivados.

El ledger .cache/pilot-v2-trigger-4196/label-intent.json y el sidecar
.codex-autofix/watch-80-v2-run.json son autoritativos para esta activación.
El activador deja watch-80.json compartido en solo lectura; sus flags antiguos
de activación pendiente no autorizan un nuevo intento. No repetir activadores.

Mientras viva, consultar únicamente este run, intento y sus jobs. Al terminar,
usar el recolector mantenido tools/evidence-transport/collect.py del checkpoint
94d37f90, con la rama de evidencia en su SHA remoto actual, una raíz nueva
directamente bajo /run y el Git Linux limpio 4196 con ambos Node fijados.
El recolector autentica cada ZIP, publica el original íntegro antes de decodificar
y conserva evidencia incierta. No reconstruir el paquete ni completar muestras.

Este diagnóstico jsdom mantiene performanceAccepted=null y gateReevaluated=false.
No acepta rendimiento Rust ni sustituye los rechazos históricos; los dos checks
ownership permanecen bloqueados. Sin tag ni merge. Runtime híbrido y objetivo
general activo. Preservar las 48 entradas ajenas y los datos en RAM de WSL.
