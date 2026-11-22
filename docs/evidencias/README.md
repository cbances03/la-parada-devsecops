# Evidencias académicas FDMLP

## Procedencia y alcance

**SIMULACIÓN ACADÉMICA.** Estos archivos ilustran una planificación y un escenario de seguimiento; no describen cuatro periodos reales de desarrollo ni resultados de productividad medidos.

Los metadatos fueron verificados en Jira en la etapa anterior: tablero FDMLP ID 35; sprints futuros 39, 40, 41 y 42; once historias FDMLP-7 a FDMLP-17 con sus épicas y estimaciones; distribución 7/7/8/5 SP. Las fechas académicas se guardaron realmente en Jira, pero siguen siendo un calendario ficticio. En aquella consulta las historias estaban Por hacer. Esta generación no vuelve a consultar ni modifica Jira y no afirma que ese estado sea una lectura nueva.

Las fechas por historia, dependencias propuestas, cierres diarios, hitos, burndowns, recorridos Kanban y puntos terminados son **SIMULADOS EXTERNAMENTE**. No se extrajeron de transiciones ni informes históricos de Jira. No se modificaron estados para fabricar métricas. No se usan los commits, PR ni checks reales de GitHub como prueba de estos periodos simulados.

| Sprint | ID Jira | Fechas académicas 2026 | Historias | Compromiso |
| --- | --- | --- | --- | ---: |
| 1 | 39 | 23–27 noviembre | FDMLP-7, FDMLP-8, FDMLP-9 | 7 SP |
| 2 | 40 | 30 noviembre–4 diciembre | FDMLP-10, FDMLP-11, FDMLP-12 | 7 SP |
| 3 | 41 | 7–11 diciembre | FDMLP-13, FDMLP-14, FDMLP-15 | 8 SP |
| 4 | 42 | 14–18 diciembre | FDMLP-16, FDMLP-17 | 5 SP |

## Convenciones y fórmulas

- Zona: America/Lima, UTC−05:00. D0 es el inicio del primer día a las 09:00; D1 es el cierre de ese mismo día a las 18:00. D2–D5 son los otros cierres laborables a las 18:00. D0 no es un sexto día de trabajo.
- Ideal en Dn = compromiso × (5 − n) / 5. La línea ideal es una referencia continua; sus fracciones no significan historias parcialmente terminadas.
- Restante simulado = compromiso − suma de SP de historias cuya fecha de fin del Gantt ya llegó. Se descuentan SP solo al pasar a Listo, completos y una sola vez.
- Las fechas de fin del Gantt incluyen la revisión de aceptación. Todos los requisitos de finalización del escenario son supuestos académicos, no evidencia de ejecución real.
- Velocidad simulada = SP terminados en el escenario; compromiso = SP planificados al inicio. Ambos coinciden aquí porque se propone cumplimiento completo, no porque se haya medido ese resultado.
- Promedio simulado = (7 + 7 + 8 + 5) / 4 = **6,75 SP/sprint**. La velocidad real permanece **NO DISPONIBLE**; no es cero.
- Los hitos tienen 0 SP y no vuelven a sumar puntos. La columna de dependencias del Gantt es funcional; la secuencia adicional responde a WIP 1, sin inventar dependencias técnicas entre todas las tareas.
- CSV: UTF-8 con BOM, separador coma, decimales con punto para lectura automática; varias claves se separan por punto y coma. Los SVG presentan notación decimal española cuando corresponde.

## Archivos

- burndown_simulado.csv: 24 registros D0–D5, con fechas, historias finalizadas y SP descontados.
- burndown_s1.svg a burndown_s4.svg: ideal frente a avance simulado, con identificación visible.
- velocidad_simulada.csv y velocidad_simulada.svg: compromiso, terminados simulados y media; ninguna velocidad real atribuida.
- gantt_simulado.csv y gantt_simulado.svg: once historias y cuatro hitos, fechas y dependencias.
- kanban_simulado.md: reglas WIP y ejemplos externos de transición.
- jira/: reservado para capturas reales futuras. .gitkeep solo conserva la carpeta; no es una captura.

## Validación de consistencia

Se validan 11 historias únicas y 27 SP; sumas por sprint 7/7/8/5; cinco días laborables por sprint; dependencias finalizadas antes de sus sucesoras; burndown no creciente y final cero; descuentos iguales a los SP de las historias que finalizan ese día; 27 SP descontados una sola vez; media 6,75. Los escenarios seriales mantienen como máximo una historia en trabajo o revisión. El XML de los seis SVG es válido.

Los seis gráficos se rasterizaron localmente y se inspeccionaron visualmente: títulos, ejes, leyendas, fechas y etiquetas legibles, sin recortes observados. Los SVG son vectoriales y no usan recursos externos. Insertar burndowns y velocidad con anchura suficiente para leer las etiquetas. Para Gantt, usar página horizontal y ancho completo; no comprimirlo en una columna estrecha. SVG conserva nitidez al exportar a PDF. Las previsualizaciones de QA no son evidencias de Jira.

## Evidencias reales pendientes

Obtener capturas auténticas del backlog, objetivos/fechas/asignaciones de los cuatro sprints y tablero actual. Anotar fecha de captura, procedencia y contexto; no mostrar credenciales ni tokens. No sustituir la falta de En revisión o WIP configurado en Jira por un diagrama presentado como captura real. Burndown y velocidad nativos solo se atribuirán a Jira si existen y se inspeccionan; estos archivos externos no prueban su existencia.
