# Range público: experimento Linux independiente sin calibración

[Run 39643090437](https://github.com/guidomodarelli/rustdom/actions/runs/39643090437), intento 1, terminó con failure por los presupuestos del protocolo. No fue un fallo de infraestructura.

Node 22.12.0, Rust 1.99.1, Ubuntu 22.04, Intel(R) Xeon(R) 6973P-C, 4 CPUs lógicas, afinidad CPU 0.

Se verificaron 16 bloques, 64 procesos, 1.152 duraciones y 72 muestras por fase/etiqueta/motor/fila. Las 51 entradas del manifest original, los protocolos, las fuentes y todos los agregados coinciden. El ZIP coincide con el digest SHA-256 de GitHub; se conserva sin modificar.

| Fase | Tamaño | Rust Δ% | Control jsdom Δ% | Calibración |
| --- | ---: | ---: | ---: | --- |
| A/A | 1000 | 4.3101 | 3.6005 | No calibra |
| A/A | 250 | -0.4898 | -6.4675 | No calibra |
| A/B | 1000 | 6.4527 | 213.4203 | No calibra |
| A/B | 250 | 2.4348 | -24.8075 | No calibra |

Ninguna fila calibra. A/A carga exactamente la misma referencia; sus controles jsdom exceden ±2%. A/B conserva variaciones +213,42% y −24,81% en ese control. No permite atribuir al parche ni una mejora ni una regresión; accepted=false permanece intacto.

El resultado WSL original +9,41% sigue publicado y su presupuesto permanece pendiente. Este experimento no lo resuelve. No se relanza la misma carga para seleccionar una corrida favorable; cualquier experimento posterior debe declarar una nueva hipótesis o un cambio justificado del método.

Las fuentes canónicas, el SDK y el arnés original no cambiaron. El árbol del merge temporal coincide con el head solicitado. source-proof.json y github-provenance.json registran commits, árboles, binarios, runner, pasos y digest del artefacto.

```sh
node reports/benchmarks/native-class-ownership/hosted-experiment.cjs --verify \
  reports/benchmarks/native-class-ownership/hosted/39643090437
```

Ese comando verifica fidelidad de datos y devuelve accepted=false; no convierte la corrida en aprobada. El workflow vuelve a exigir aceptación después de verificar los archivos. Una publicación de reportes con fuentes y protocolo idénticos reutiliza esta evidencia y conserva su resultado fallido, sin repetir muestras.
