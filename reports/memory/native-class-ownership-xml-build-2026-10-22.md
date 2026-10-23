# Liberación finita de las preparaciones XML y ownership

GitHub probó 385072cc en Node 22.12.0 y 24.14.1. Los runs 39886057332 y
39886057190 terminaron con success. Los cuatro perfiles ejercitaron tres ciclos
por cada copia física A0/A1/B/J0/J1: creación, mutación, clonación, Range, evento
y close. Se observaron Window y Document por separado antes de salir.

Los 60 Window y 60 Document observados se liberaron. Los veinte endpoints
llegaron a dos muestras claras, con límite de 64 rondas y 10 segundos. Los
constructores N-API persistentes conservaron su baseline, sin cleanupErrors;
no se afirma que todos los contadores nativos sean cero.

El JSON compañero conserva los veinte snapshots RSS/heap/external/arrayBuffers,
hashes y paths de los probes crudos. Son muestras de endpoints, no memoria pico
ni una comparación de consumo entre motores. No demuestran ausencia universal
de fugas ni cubren procesos longevos o todos los ciclos XML. Los 455 tests XML
por Node se ejecutaron aparte y no se suman a las observaciones de memoria.

La evidencia completa está en
reports/validation/native-class-ownership/xml-build-ci/39886057332/.
Los paquetes se verificaron y trasladaron físicamente en GitHub; no se ejecutó
una suite, build o probe local mientras sigue activo el estudio original.
