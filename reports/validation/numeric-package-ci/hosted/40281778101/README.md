# CI del índice corregido: dos jobs aprobados

Run **40281778101**, intento 1, commit
`ff07406dc61d6573d08dd731f7648a27c116a77e`: Windows y Ubuntu terminaron aprobados.
El productor contiene el ensamblador c12598c8 con lectura acotada del índice,
autenticación previa al parseo y regresión que conserva el tamaño original.

| Plataforma | Job | Artefacto | Bytes | SHA256 |
|---|---:|---:|---:|---|
| Windows | 121436450215 | 12633165029 | 1068 | 243ec8d4f530d748ccf37ce958486a915461d05a44cbc3c9e2a4dcfbc2204874 |
| Ubuntu | 121436450409 | 12633200602 | 9841 | f5f1c5cfb6209852f088dc1c57556dffa4fd289f6bef50a6ddafdb9da06c51a0 |

Se conservan los ZIP íntegros, metadata API, logs completos, manifiestos de todos
los miembros y recibos de transporte. Los pins independientes están junto al
lector actual `../tools/verify.py`, en constants/40281778101.json. El lector
nunca ejecuta código archivado ni confía en el policy.json de entrada.

Pasaron siete contratos de Git por plataforma, cinco de transporte Linux y tres
Windows con dos skips Linux-only. Ubuntu pasó **trece contratos de ensamblado**,
incluido el índice canónico adulterado, y seis ciclos de runtime por SDK Node
22.12.0/24.14.1 con doce endpoints finales claros separados. El tar fb06276a,
ELF a277 y los 786 pins permanecen intactos.

La lectura offline se probó en Windows y Linux: seis contratos para el productor
f2 anterior y cinco para este productor. El selector solo permite IDs numéricos
ASCII de políticas registradas junto al código. Rechaza escapes y que f2 se use
como prueba del fix posterior. Mantiene el alcance separado: f2 tiene doce
contratos y producerCanonicalIndexSealPresent=false; este run tiene trece y true.

```sh
python -B reports/validation/numeric-package-ci/hosted/tools/verify.py reports/validation/numeric-package-ci/hosted/40281778101 40281778101
```

El cierre es de preparación y procedencia del paquete. **No acepta rendimiento**,
no reevalúa el gate ni integra producción. Los rechazos históricos siguen
vigentes, sin tag/merge. No hubo captura científica nueva. Recursos completos en
`reports/memory/numeric-package-ci/hosted/40281778101/`; los snapshots finitos no
demuestran memoria pico ni ausencia universal de fugas. El runtime sigue híbrido.
