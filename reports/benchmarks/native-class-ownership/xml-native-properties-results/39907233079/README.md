# XML con propiedades nativas: presupuesto aprobado

La ejecución original [39907233079](https://github.com/guidomodarelli/rustdom/actions/runs/39907233079)
midió `a5a1379d2d59827f557c44b94e7660db43619b04`, fuente canónica
`5ef668c47a78bb73ef5b0881fbf20e6d36c4d4cc9686198c26e722d8fc9c6806`.
Los trece controles AA pasan ±2% y todas las filas AB pasan +5%.
El máximo absoluto AA es 1.062615872%;
el peor AB es +3.387522314% (`xml-serializer-getter-error/1`).

Se conserva la única secuencia: 468 procesos, 14.976 duraciones medidas y
33.408 duraciones de warmup, todas las 39 celdas AA/AB/reference y sus
salidas. No se cambiaron corpus, tamaños, warmup, orden, presupuestos,
estimador o muestras. La medición es Node 24.14.1; consumir los metadatos
con Node 22 no constituye una medición de rendimiento en Node 22.

Host: INTEL(R) XEON(R) PLATINUM 8573C, 4 CPUs lógicas, kernel 6.8.0-1064-azure.
CPU 0, Linux x64/glibc 2.35, Rust 1.99.1 y jsdom independiente 27.4.0.
Las versiones y archivos completos están en el ZIP original. La preparación
tiene UUID `ef578b1d-0557-480e-af32-5a8d5a41a98e`.

A es checkpoint 066/source993a1e. El delta A/B incluye la migración del
controlador de checkpoint 067, el arreglo de ownership y las lecturas
nativas de esta sesión. El archivo anterior 39896591561 continúa rechazado
(+5,606405% en getter-error/1). Son ejecuciones en hosts separados: no es
un A/B directo entre ambos candidatos B ni prueba de una aceleración
absoluta frente al candidato anterior. Este resultado demuestra el
cumplimiento del presupuesto declarado en la ejecución actual.

## Todas las filas AB

| Operación/tamaño | A ms | B ms | Cambio % |
| --- | ---: | ---: | ---: |
| xml-serialize/100 | 7.033449250 | 7.053510750 | +0.285230 |
| xml-inner-serialize/100 | 8.357669625 | 8.265485375 | -1.102990 |
| xml-document-serialize/100 | 7.032139125 | 7.039178125 | +0.100098 |
| xml-serialize-error/100 | 8.236914375 | 8.143229125 | -1.137383 |
| xml-serialize/1000 | 73.567855000 | 73.112463000 | -0.619009 |
| xml-inner-serialize/1000 | 87.271036500 | 86.940582500 | -0.378653 |
| xml-document-serialize/1000 | 73.655830500 | 73.180214500 | -0.645728 |
| xml-serialize-error/1000 | 84.246875000 | 83.647232000 | -0.711769 |
| xml-serialize/1 | 0.131399172 | 0.130508875 | -0.677551 |
| xml-serialize/16 | 1.161420750 | 1.152064406 | -0.805595 |
| xml-serializer-getter-error/1 | 0.154748750 | 0.159990898 | +3.387522 |
| xml-serializer-getter-error/100 | 7.145495250 | 7.046697375 | -1.382660 |
| xml-serializer-getter-error/1000 | 73.752049500 | 73.077375500 | -0.914787 |

## Comparación directa con jsdom

El motor híbrido tarda entre **4.421817 y 5.998359 veces** jsdom en estas filas.
Se conserva esa deuda; no se describe el runtime como Rust puro ni como
más rápido que jsdom. La tabla incluye todos los casos de referencia.

| Operación/tamaño | jsdom ms | Híbrido ms | Híbrido / jsdom |
| --- | ---: | ---: | ---: |
| xml-serialize/100 | 1.361555875 | 6.989511750 | 5.133474 |
| xml-inner-serialize/100 | 1.505197750 | 8.268619125 | 5.493377 |
| xml-document-serialize/100 | 1.344849125 | 6.985937875 | 5.194589 |
| xml-serialize-error/100 | 1.434490750 | 8.183005500 | 5.704467 |
| xml-serialize/1000 | 15.906176500 | 72.010282500 | 4.527190 |
| xml-inner-serialize/1000 | 16.488341000 | 86.680800500 | 5.257097 |
| xml-document-serialize/1000 | 14.520807500 | 73.492110000 | 5.061159 |
| xml-serialize-error/1000 | 15.168090000 | 83.526811000 | 5.506745 |
| xml-serialize/1 | 0.021805453 | 0.130796937 | 5.998359 |
| xml-serialize/16 | 0.218242063 | 1.153846187 | 5.287002 |
| xml-serializer-getter-error/1 | 0.036286617 | 0.160452789 | 4.421817 |
| xml-serializer-getter-error/100 | 1.381665125 | 7.068142500 | 5.115670 |
| xml-serializer-getter-error/1000 | 14.545821000 | 74.540242500 | 5.124513 |

## Integridad y alcance

El ZIP oficial conserva 8542696 bytes, SHA-256 `fe23cc64fc19dd3d7faae68a4f3c81a29a4be7a7c4414f8d63dffe475730b4b5`.
Su tar.xz conserva 8540056 bytes, SHA-256 `ce5a0a3997a4ba552145fe7ac0f9df5145eda6f21af57ea4eebdd788066a2b5e`.
Hay 7972 archivos regulares/85334021 bytes crudos y 6 symlinks.
raw-members.json.gz autentica cada miembro. No se recomprimieron las
muestras: artifact.zip es el transporte oficial completo.

El lector comprueba preparación física, fuentes, dist, dependencias,
herramientas, probe del mismo UUID y before/after. Recalcula todas las
muestras y decisiones. Los JSON de Node 22/24 son idénticos. El enlace
de fuentes/inputs de build actuales se comprobó por separado; el lector
genérico conserva currentInputEligibilityVerified=false y no habilita
automáticamente un gate de otro entorno, workflow o binario local.

La revisión ampliada detectó que Python -O podía omitir aserciones.
python-opt-before.stdout.json es un diagnóstico sobre una COPIA ALTERADA,
no el resultado científico original. Ambos lectores ahora rechazan -O,
-OO y PYTHONOPTIMIZE no nulo. Once tests por Linux/Windows y cuatro tests
de la CLI completa por cada Node verifican el consumo real: ocho variantes
optimizadas rechazadas (cuatro por directorio y cuatro por ZIP). Los
resultados numéricos normales no cambian.

El CI general de a5a1379d pasó sus ocho jobs; general-ci.json conserva
la confirmación. El gate XML usa una receta separada para esta fuente,
con hashes del transporte, lectores, workflow e inputs de build completos.
Los 28 contratos históricos y nuevos pasaron por Node22/24; el perfil
de rendimiento aceptado permanece exclusivamente Node24/Linux/x64.
Ownership sigue sin aceptación. No hay tag ni merge.

Para consumir la evidencia desde la raíz del repositorio, preparar `.baseline`
con las fuentes de `checkpoint-066-reference-catalog`, usar Node24.14.1,
Linux/x64/glibc2.35 y Rust1.99.1, y ejecutar:

```sh
node reports/benchmarks/native-class-ownership/xml-native-properties-gate.cjs --select .baseline reports/benchmarks/native-class-ownership/xml-native-properties-results/39907233079
node reports/benchmarks/native-class-ownership/xml-native-properties-gate.cjs --verify .baseline reports/benchmarks/native-class-ownership/xml-native-properties-results/39907233079
```

Estos comandos comprueban identidades y recalculan las observaciones
archivadas; nunca construyen paquetes ni inician workers de benchmark.

## Memoria

El probe separado observa 15 Window y 15 Document, tres ciclos por cada
una de cinco copias físicas, con dos endpoints finales claros. Los 442
workers rustdom terminan con sesiones XML live/references/cleanupErrors
en cero, pero todos mantienen xmlParsers.live=1. No se afirma liberación
de todos los recursos ni se interpreta ese contador aislado como fuga.
Cada Window del benchmark no se observó por weak refs; RSS/heap son
snapshots y no memoria pico. La evidencia no prueba ausencia universal
de fugas. Ver el informe de memoria separado y los crudos.
