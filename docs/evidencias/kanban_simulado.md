# Kanban simulado FDMLP

**SIMULACIÓN ACADÉMICA EXTERNA.** No es historial, exportación ni captura de Jira. No se ejecutaron las transiciones descritas.

Flujo: **Por hacer → En curso → En revisión → Listo**.

- Por hacer: historia priorizada y preparada, sin trabajo iniciado en el escenario.
- En curso: desarrollo o corrección. **WIP máximo 1**.
- En revisión: aceptación, permisos y pruebas. **WIP máximo 1**.
- Listo: aceptación satisfecha y revisión aprobada en el escenario; descontar sus SP del burndown.
- Si falla revisión, volver a En curso solo si existe capacidad WIP. El regreso no descuenta SP. Bloquear nuevas entradas cuando se alcance el límite.
- Los intervalos del Gantt incluyen revisión; En curso termina al entrar en revisión. El escenario es serial: no supera ni siquiera una historia activa total.

## Ejemplos de transición por sprint

Todas las horas y fechas siguientes son ficticias, America/Lima. Por hacer se asume al inicio de cada sprint; la entrada a En curso es 09:00, la revisión empieza a las 15:00 del día final y Listo a las 18:00 de ese día. En historias de un día, las tres etapas ocurren en la misma jornada. El descuento se registra únicamente a las 18:00.

| Sprint | Historia | En curso (09:00) | En revisión (15:00) | Listo (18:00) | SP descontados |
| --- | --- | --- | --- | --- | ---: |
| 1 | FDMLP-7 | 23/11/2026 | 24/11/2026 | 24/11/2026 | 3 |
| 1 | FDMLP-8 | 25/11/2026 | 26/11/2026 | 26/11/2026 | 3 |
| 1 | FDMLP-9 | 27/11/2026 | 27/11/2026 | 27/11/2026 | 1 |
| 2 | FDMLP-10 | 30/11/2026 | 01/12/2026 | 01/12/2026 | 3 |
| 2 | FDMLP-11 | 02/12/2026 | 03/12/2026 | 03/12/2026 | 2 |
| 2 | FDMLP-12 | 04/12/2026 | 04/12/2026 | 04/12/2026 | 2 |
| 3 | FDMLP-13 | 07/12/2026 | 08/12/2026 | 08/12/2026 | 3 |
| 3 | FDMLP-14 | 09/12/2026 | 10/12/2026 | 10/12/2026 | 3 |
| 3 | FDMLP-15 | 11/12/2026 | 11/12/2026 | 11/12/2026 | 2 |
| 4 | FDMLP-16 | 14/12/2026 | 16/12/2026 | 16/12/2026 | 3 |
| 4 | FDMLP-17 | 17/12/2026 | 18/12/2026 | 18/12/2026 | 2 |

## Capturas y configuración pendientes

El tablero Jira inspeccionado previamente tenía Por hacer / En curso / Listo y sin límites WIP. La columna En revisión y los límites de este documento son una propuesta externa, no configuración aplicada. Una captura real futura debe mostrar el estado efectivo del tablero y no este recorrido como si ya hubiera ocurrido.
