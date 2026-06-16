/* Centro de documentación — guías por módulo, buscables y accionables.
   Reconocimiento sobre memoria: cada guía enlaza directo al módulo que explica. */
(function () {
  const React = window.React;
  const { useState, useMemo } = React;
  const { LucideIcon } = window;
  const cn = window.cn;

  /* Cada guía documenta funcionalidad REAL del sistema (sin relleno). */
  const GUIDES = [
    {
      key: "brief", icon: "Megaphone", accent: "brand", group: "Campañas",
      title: "Brief de campañas", href: "#/campanas/brief",
      what: "Configura y aprueba cada campaña del periodo: estrategia, fechas clave, comunicaciones, checklist y links de piezas.",
      steps: [
        "Habilita la campaña para el periodo: duplica la configuración del periodo anterior (con desplazamiento de fechas) o empieza en blanco.",
        "Completa el brief: audiencia, resultado esperado, fechas clave y plan de comunicaciones.",
        "Cuando esté listo, usa «Aprobar» — queda sellado con tu usuario y la fecha.",
        "Usa el modo «Lector» para revisiones limpias y «PDF» para exportar el memo ejecutivo.",
      ],
      audit: "Cada edición queda en el changelog del brief (quién, qué, antes/después) y cada guardado genera una versión comparable.",
    },
    {
      key: "speech", icon: "Mic", accent: "fuchsia", group: "Campañas",
      title: "Speech y Argumentario", href: "#/campanas/speech",
      what: "Guiones de apertura de llamada por campaña, conectados al banco central de argumentos para rebatir objeciones.",
      steps: [
        "Habilita el speech de una campaña desde su brief o desde el hub de Speechs.",
        "Escribe la apertura y activa los argumentos relevantes del banco central.",
        "El contenido de cada argumento vive solo en el Argumentario: editarlo ahí lo actualiza en todos los speechs.",
      ],
      audit: "Los argumentos guardan su fecha de última actualización.",
    },
    {
      key: "cron-comms", icon: "Send", accent: "cyan", group: "Campañas",
      title: "Cronograma de comunicaciones", href: "#/campanas/cronograma-comms",
      what: "Consolidado de todos los envíos del periodo: qué se envía, por qué canal, qué días y de qué campaña.",
      steps: [
        "Los envíos se generan automáticamente desde el plan de comunicaciones de cada brief.",
        "Filtra por brief, canal o estado; la vista timeline muestra cada ejecución día a día.",
        "Ajusta días por canal desde el brief de la campaña correspondiente.",
      ],
      audit: "El cronograma siempre refleja el brief vigente: no hay copias que se desactualicen.",
    },
    {
      key: "cron-campanas", icon: "CalendarRange", accent: "amber", group: "Campañas",
      title: "Cronograma de campañas", href: "#/campanas/cronograma-campanas",
      what: "Una fila por campaña y periodo: días de planificación previa, inicio, fin y estado de aprobación, con Gantt.",
      steps: [
        "Edita inicio/fin directamente en la tabla — el Gantt se actualiza al instante.",
        "Define «planificación (días antes)» para visualizar la ventana de preparación.",
        "Crea, edita o elimina campañas del máster desde esta vista.",
      ],
      audit: "Los cambios de fechas actualizan la marca de última modificación de la campaña.",
    },
    {
      key: "centro", icon: "Gauge", accent: "green", group: "Operativa",
      title: "Centro de operaciones", href: "#/operativa/centro",
      what: "Todas las tareas del periodo en una sola tabla: estados, prioridades, deadlines, filtros guardables y alertas.",
      steps: [
        "Los KPIs de arriba son filtros: toca «Atrasadas» para ver solo lo atrasado.",
        "Las «Alertas tempranas» comparan el avance real de cada campaña contra el esperado a hoy (la marca negra en la barra). Gap ≥ 25 pts o atrasos múltiples = En desvío.",
        "Edita estado, prioridad y responsable inline, sin abrir formularios.",
        "Guarda combinaciones de filtros como vistas para tu seguimiento diario.",
      ],
      audit: "Cada cambio de estado, responsable o update de tarea queda registrado en el changelog de su campaña.",
    },
    {
      key: "pendientes", icon: "ListChecks", accent: "violet", group: "Operativa",
      title: "Pendientes por persona", href: "#/operativa/pendiente",
      what: "Dashboard de ejecución individual: lo activo, crítico, retrasado y próximo a vencer de cada miembro.",
      steps: [
        "Selecciona a la persona en el selector superior.",
        "«Prioridades de hoy» ordena automáticamente por deadline, prioridad y riesgo.",
        "Marca avance o bloqueos directamente desde la lista.",
      ],
      audit: "Los updates por tarea (avance, bloqueo, riesgo) llevan usuario y hora.",
    },
    {
      key: "solicitudes", icon: "Palette", accent: "pink", group: "Operativa",
      title: "Solicitudes de diseño", href: "#/operativa/solicitudes",
      what: "Flujo de piezas en dos etapas: requerimiento → entrega y revisión, con timeline de acciones completo.",
      steps: [
        "Crea la solicitud con tipo, prioridad, deadline y referencias.",
        "Fija («candado») el requerimiento para congelar el alcance antes de diseñar.",
        "El flujo avanza: Pendiente → En diseño → Entregado → En revisión → Aprobado o Con feedback.",
        "Cada entrega y cada feedback quedan ligados a la solicitud.",
      ],
      audit: "El timeline registra cada acción: creación, lock, asignación, entregas, aprobaciones y comentarios.",
    },
    {
      key: "resumen", icon: "FileText", accent: "ink", group: "Operativa",
      title: "Resumen ejecutivo", href: "#/operativa/resumen",
      what: "Síntesis gerencial generada automáticamente desde los datos vivos: avance, riesgos, hitos y envíos.",
      steps: [
        "Se genera al abrirlo — no requiere mantenimiento manual.",
        "«Copiar resumen» produce el texto listo para pegar en WhatsApp o correo del día.",
        "«Imprimir / PDF» genera la versión para comité.",
      ],
      audit: "Cada cifra es trazable: los enlaces llevan al módulo de origen del dato.",
    },
    {
      key: "equipo", icon: "Users", accent: "slate", group: "Configuración",
      title: "Equipo y permisos", href: "#/configuracion/equipo",
      what: "Directorio de miembros y control de acceso por roles (RBAC) con 11 permisos granulares.",
      steps: [
        "Agrega miembros con cargo y rol de acceso (Administrador, Editor, Visualizador o roles propios).",
        "En «Roles y permisos» activa o desactiva cada permiso por rol.",
        "En «Inicio de sesión» puedes exigir login con clave por miembro.",
        "Usa «Viendo como» para probar qué ve cada rol sin cerrar tu sesión.",
      ],
      audit: "Las sesiones y aprobaciones siempre llevan el nombre del miembro activo.",
    },
    {
      key: "fechas", icon: "CalendarCog", accent: "slate", group: "Configuración",
      title: "Fechas del periodo", href: "#/configuracion/fechas",
      what: "Fechas parámetro base (teaser, inicio, pico, cierre, post-mortem) que todas las campañas del periodo heredan.",
      steps: [
        "Configúralas una sola vez al abrir el periodo.",
        "Las fechas clave de cada brief se calculan como desplazamientos sobre estos parámetros.",
        "Cambiar un parámetro reubica en cadena las fechas clave que dependen de él.",
      ],
      audit: "Mínimo esfuerzo: una edición central en vez de corregir campaña por campaña.",
    },
  ];

  const GROUP_ORDER = ["Campañas", "Operativa", "Configuración"];

  function GuideCard({ g, open, onToggle }) {
    const grad = (window.SECTION_GRAD || {})[g.accent];
    return (
      <article className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-soft">
        <button type="button" onClick={onToggle} aria-expanded={open}
          className="flex w-full items-center gap-3.5 p-4 text-left transition-colors hover:bg-surface sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: grad }}>
            <LucideIcon name={g.icon} className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-foreground">{g.title}</span>
            <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{g.what}</span>
          </span>
          <LucideIcon name="ChevronDown" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </button>
        {open && (
          <div className="border-t border-border/60 px-4 pb-5 pt-4 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cómo se usa</p>
            <ol className="mt-2 space-y-2">
              {g.steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-foreground/90">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10.5px] font-bold text-brand">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-surface p-3 text-[12px] leading-relaxed text-muted-foreground">
              <LucideIcon name="History" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2} />
              <span><span className="font-semibold text-foreground/80">Trazabilidad: </span>{g.audit}</span>
            </p>
            <a href={g.href} className="mt-4 inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 text-[12.5px] font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90">
              Ir al módulo <LucideIcon name="ArrowRight" className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </article>
    );
  }

  function AyudaPage() {
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(null);
    const nq = q.trim().toLowerCase();
    const visible = useMemo(() =>
      GUIDES.filter((g) => !nq || `${g.title} ${g.what} ${g.steps.join(" ")} ${g.group}`.toLowerCase().includes(nq)),
      [nq]);

    return (
      <div className="relative min-h-screen bg-background" data-screen-label="Centro de documentación">
        <window.SectionWash accent="brand" />
        <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <window.PageToolbar back="#/" backLabel="Volver al menú" />
          <window.SectionHeader accent="brand" icon="CircleHelp" size="lg" title="Centro de documentación"
            subtitle="Guías de cada módulo: para qué sirve, cómo se usa y dónde queda registrado." />

          <div className="relative mb-6">
            <LucideIcon name="Search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Buscar en la documentación…"
              className="h-12 w-full rounded-full border border-border bg-surface-elevated pl-11 pr-4 text-[14px] text-foreground shadow-soft placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40" />
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-12 text-center text-sm text-muted-foreground">
              Nada coincide con “{q.trim()}”. Prueba con el nombre del módulo o una acción.
            </p>
          ) : (
            GROUP_ORDER.map((grp) => {
              const items = visible.filter((g) => g.group === grp);
              if (!items.length) return null;
              return (
                <section key={grp} className="mb-7" aria-label={grp}>
                  <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{grp}</h2>
                  <div className="space-y-2.5">
                    {items.map((g) => <GuideCard key={g.key} g={g} open={open === g.key} onToggle={() => setOpen(open === g.key ? null : g.key)} />)}
                  </div>
                </section>
              );
            })
          )}
        </main>
      </div>
    );
  }

  Object.assign(window, { AyudaPage });
})();
