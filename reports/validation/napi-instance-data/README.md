# Aislamiento de instance_data entre addons Node-API

Se evaluó el comentario 4019357313 del PR67 contra Node22.12.0 y Node24.20.0. El finding presupone que dos addons del mismo proceso comparten un napi_env; el código de ambos runtimes crea un entorno distinto al registrar cada módulo.

Fuentes oficiales: [Node24.20, registro por módulo](https://github.com/nodejs/node/blob/v24.20.0/src/node_api.cc#L733-L735) y [Node22.12, mismo registro](https://github.com/nodejs/node/blob/v22.12.0/src/node_api.cc#L676-L677). El slot es único dentro de ese entorno; eso no lo convierte en un slot compartido por todos los addons del proceso.

## Prueba ejecutada

Se compiló `slot-probe.cc` como un addon real e independiente mediante c++17, Node-API8 y los headers oficiales de Node24.20. El addon reserva un estado propio por Env, lo registra con napi_set_instance_data y expone callbacks que comparan el puntero del slot con su propio callback data, sin interpretar ni desreferenciar un puntero extranjero. Su finalizador libera la única asignación.

`probe.cjs` carga los dos addons en ambos órdenes. En cada proceso repite 25 escrituras del slot del segundo addon, verifica su identidad/token, ejecuta la serialización XML real y provoca el TypeError de un resultado Symbol inválido. Así se ejercen también las lecturas de los intrínsecos de rustdom después de cada escritura ajena.

| Runtime | Orden | Ciclos | Resultado |
|---|---|---:|---|
| Node22.12.0 | segundo addon antes de rustdom | 25 | PASS |
| Node22.12.0 | rustdom antes del segundo addon | 25 | PASS |
| Node24.20.0 | segundo addon antes de rustdom | 25 | PASS |
| Node24.20.0 | rustdom antes del segundo addon | 25 | PASS |

Los cuatro JSON guardados en este directorio contienen tokens y resultados. El segundo addon conservó su slot en todos los casos; las serializaciones y errores esperados de rustdom se mantuvieron. Sus estadísticas XML terminaron con live, references y cleanupErrors en cero después de cada ciclo. Se utilizó el runtime final de PR67, addon SHA-256 `1f5cb1d86c660f6e1681638474c64e45d6de6c84b67919c5cc70be6a1b452f83`.

No se modificó el runtime a partir de esta premisa. La prueba cubre addons independientes que usan sus entornos correctamente en estos Node; no es una garantía universal de seguridad frente a código nativo arbitrario ni sustituye el análisis de los otros hallazgos de memoria.
