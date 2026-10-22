# Recursos de parsing y construcción de documentos

Las trazas crudas del conjunto inicial se conservan dentro de `initial/validation/`
en el tar de validación, con sus fuentes y comandos. Se usaron jsdom independiente
y A0 real, en Node 22.12.0/24.14.1 y realms default/VM. La corrección posterior
solo cambia clasificación, documentación y el test del ledger: no modifica
helpers de memoria, producto o pruebas de comportamiento. No se afirma haber
repetido los ciclos de dominios después de corregir metadata.

El recálculo offline da:

- DOMParser: 800 referencias Window, 800 Document del owner y 800 documentos
  recuperados, incluyendo los warmups registrados. Se ejercen parsers, Text,
  Range, clonación/normalización, valores lanzados y errores intrínsecos.
- DOMImplementation: 2.400 documentos creados y 24 referencias Window de sus
  ciclos registrados, junto con owners, doctypes y errores. Los warmups de este
  helper se verifican al ejecutar, pero sus trazas no están en `cycles`; quedan
  fuera de estos contadores.
- Los dominios conservan 131 observaciones de cleanup, incluidas tres iniciales
  no claras, y los 128 estados finales exigidos claros. Tres observaciones no
  equivalen a tres objetos únicos ni demuestran tres fugas.
- Los logs separados del generador registran seis Window y seis Document con
  reportes escalares retenidos. No se suman otras invocaciones del helper
  realizadas dentro de los tests.

Window y Document se observan por separado. Los helpers exigen liberación
observable y acuerdo de los contadores nativos vivos definidos por su protocolo;
no se exige igualdad de contadores acumulativos de operaciones. `analysis.json`
conserva rangos heap/external/RSS por Node, dominio, motor y realm, y todas las
trazas crudas permanecen en el tar. Para recalcular sin DOM o nuevas muestras,
autenticar y extraer el tar y ejecutar `python3 describe-memory.py EXTRACTED/initial`.

Son escenarios finitos y estados de proceso después de GC, sin picos ni prueba
universal de ausencia de fugas. El máximo RSS del CLI se presenta por separado
y no se atribuye a una fuga del addon o retención del allocator. El estudio de
ownership de GitHub continúa independiente y no se modificó.
