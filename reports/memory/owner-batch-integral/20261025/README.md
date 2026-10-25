# Recursos del flujo funcional completo

resources.json conserva los64workers, sus baselines y192endpoints. Observa768
Window y768Document por separado. Cuatro primeras rondas todavía no estaban
claras; se conservan y las dos últimas de cada worker quedaron claras.

Incluye seis snapshots reales de los padres Node tras GC, antes, a mitad de pares
y al finalizar cada SDK. Memoria/CPU son endpoints, no estimaciones de pico. Se
conserva la procedencia Git real del prototipo funcional y no se atribuye al SHA
hospedado posterior. Las pruebas finitas no demuestran ausencia universal de fugas.

Los contratos del ejecutor también comprueban timeout, cancelación y un hijo
remanente tras salir su padre con procesos auténticos. Sus estados terminales
pueden registrar zombies pendientes del reaper del sistema; no se confunden con
procesos todavía ejecutándose ni con memoria DOM liberada.
