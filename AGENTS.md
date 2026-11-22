# Reglas operativas

## Objetivo y alcance
- Mantener la base del proyecto DevOps-Examen para resolver un enunciado desconocido en 230 minutos.
- Stack predeterminado: Next.js, TypeScript, PostgreSQL/Neon, GitHub Actions, Jira Scrum, Vercel, Vitest, ESLint, CodeQL y OWASP ZAP. Docker solo si aporta valor verificable.
- Aplicar YAGNI, KISS y DRY. Priorizar un flujo funcional completo, pruebas útiles y evidencia reproducible.
- No instalar plugins ni copiar/reutilizar archivos del proyecto anterior.
- Estructura actual: la plantilla ya se copió a la raíz de DevOps-Examen; aplicación, package.json y .github/workflows están aquí. No existe ni debe crearse template/. Esta tarea solo autoriza actualizar AGENTS.md, docs/PREFLIGHT.md y docs/PLAN.md; sin cambios de código, dependencias, workflows, configuraciones ni scripts nuevos. Sin comandos de red ni despliegues.
- YAGNI/KISS: una aplicación, una estrategia de datos, sin ORM, contenedores de aplicación, autenticación, componentes o capas adicionales hasta que el enunciado los justifique. Mantener DRY sin abstraer anticipadamente.
- Trabajar directamente en la raíz actual; no crear projects/<nombre> ni ejecutar un inicializador. Los resultados del ensayo reportados por el usuario no autorizan nuevas operaciones remotas.

## Autorización y seguridad
- No crear recursos remotos ni modificar servicios externos sin autorización explícita. Las consultas de diagnóstico son de solo lectura.
- No hacer push, despliegues, cambios de Jira, configuración remota ni escaneos contra destinos externos sin autorización aplicable.
- No instalar dependencias en esta actualización documental. No instalar plugins, cambiar políticas de ejecución ni configurar servicios del equipo.
- No leer, imprimir, copiar ni versionar .env.local. Solo los procesos de verificación autorizados pueden cargar sus variables en tiempo de ejecución. No copiar ningún archivo .env a otros proyectos.
- PostgreSQL: únicamente SELECT 1 con TLS y validación de certificado. Prohibidas tablas, migraciones y escrituras en esta etapa.
- No mostrar tokens, contraseñas ni cadenas de conexión, tampoco en errores o argumentos registrados. Comprobar presencia de secretos sin imprimir valores.
- Nunca guardar credenciales en archivos versionables. Para operaciones futuras autorizadas, usar variables de entorno locales ignoradas y secretos del servicio; ejemplos solo con marcadores vacíos.
- Respetar el sandbox: escribir únicamente en el workspace permitido. No intentar eludir restricciones ni solicitar elevación que la política rechaza.
- En esta actualización documental no inicializar Git, crear commits ni desplegar; la existencia del repositorio y el despliegue reportados no autoriza modificarlos. ZAP solo contra un destino expresamente autorizado.

## Ejecución y evidencia
- Registrar por separado: REAL (comando/consulta ejecutado y resultado observado), SIMULADA (sin ejecución real) y PENDIENTE (sin verificar). Un comando fallido es evidencia real de un bloqueo, no de funcionamiento.
- Distinguir herramienta instalada, autenticación, conectividad y permisos efectivos. Una capacidad publicada por MCP no demuestra permiso de escritura.
- Preferir herramientas conectadas existentes. No delegar en subagentes sin solicitud explícita del usuario o instrucciones aplicables.
- Usar npm.cmd/npx.cmd/vercel.cmd en PowerShell o CMD cuando los wrappers .ps1 estén bloqueados; no cambiar ExecutionPolicy.
- CMD no elimina restricciones de red ni permisos del sandbox. Las comprobaciones bloqueadas requieren una terminal del usuario fuera del sandbox.
- Si la red o Docker quedan bloqueados, no insistir: entregar un único comando para CMD externo. No repetir diagnósticos ya confirmados manualmente.
- No usar subagentes en esta etapa.
- Mantener actualizados los pendientes del preflight y las decisiones del plan. No declarar aprobados build, pruebas, análisis o despliegues sin ejecución y evidencia.
- Explicaciones breves en español. Terminar cada etapa con resultados, bloqueos y siguiente paso; respetar las pausas solicitadas.

