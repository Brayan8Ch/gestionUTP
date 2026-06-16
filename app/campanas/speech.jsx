/* Speech & Argumentario — speech de apertura por campaña+periodo y banco central de argumentos.
   Relación por IDs: el speech guarda enabledArgIds; el contenido vive solo en la central. */
(function () {
  const React = window.React;
  const { useState, useMemo, useRef, useEffect } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Textarea, toast, Checkbox, Block } = window;
  const cn = window.cn;

  /* ---------- shared bits ---------- */
  const matches = (arg, q) => {
    if (!q) return true;
    const n = q.trim().toLowerCase();
    return (arg.titulo || "").toLowerCase().includes(n) || (arg.keywords || []).some((k) => String(k).toLowerCase().includes(n));
  };

  function KeywordChips({ list, className }) {
    if (!list || !list.length) return null;
    return (
      <div className={cn("flex flex-wrap gap-1", className)}>
        {list.map((k) => <span key={k} className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">{k}</span>)}
      </div>
    );
  }

  function Switch({ checked, onChange, label, disabled }) {
    return (
      <button type="button" role="switch" aria-checked={!!checked} disabled={disabled} onClick={() => onChange(!checked)}
        className="inline-flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50">
        <span className={cn("relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-200", checked ? "border-brand bg-brand" : "border-border bg-muted")}>
          <span className={cn("absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-glide", checked && "translate-x-4")} />
        </span>
        <span className="whitespace-nowrap text-[13px] font-medium text-foreground">{label}</span>
      </button>
    );
  }

  function SearchBox({ value, onChange, placeholder, autoFocus }) {
    return (
      <div className="relative w-full">
        <LucideIcon name="Search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={value} onChange={(e) => onChange(e.target.value)} type="search" placeholder={placeholder} autoFocus={autoFocus}
          className="h-11 w-full rounded-full border border-border bg-surface-elevated pl-10 pr-4 text-[14px] text-foreground shadow-soft placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40" />
      </div>
    );
  }

  /* ---------- argument editor (create / edit) ---------- */
  function ArgEditor({ arg, onSave, onCancel }) {
    const [titulo, setTitulo] = useState(arg.titulo || "");
    const [keywords, setKeywords] = useState((arg.keywords || []).join(", "));
    const [contenido, setContenido] = useState(arg.contenido || "");
    const save = () => {
      const kws = keywords.split(",").map((k) => k.trim()).filter(Boolean);
      onSave({ titulo: titulo.trim(), keywords: kws, contenido: contenido.trim() });
    };
    return (
      <div className="rounded-2xl border border-brand/40 bg-surface-elevated p-4 shadow-soft">
        <div className="space-y-2.5">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Título</p>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Objeción: …" autoFocus className="h-9 bg-surface/50 text-[14px] font-semibold" />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Keywords de indexación <span className="normal-case tracking-normal text-muted-foreground/70">· separadas por coma</span></p>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="precio, caro, pago…" className="h-9 bg-surface/50 text-[13px]" />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Argumento</p>
            <Textarea value={contenido} onChange={(e) => setContenido(e.target.value)} rows={4} placeholder="Respuesta completa para rebatir la objeción…" className="bg-surface/50 text-[13px] leading-relaxed" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={save} disabled={!titulo.trim()}>Guardar</Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- argument card (mural) ---------- */
  function ArgCard({ arg, canEdit, onEdit, onRemove }) {
    return (
      <div className="group/arg flex flex-col rounded-2xl border border-border/60 bg-surface-elevated p-4 shadow-soft transition-[transform,box-shadow] duration-200 ease-glide hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-foreground">{arg.titulo || "—"}</h3>
          {canEdit && (
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/arg:opacity-100">
              <button type="button" onClick={onEdit} aria-label="Editar" className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"><LucideIcon name="Pencil" className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={onRemove} aria-label="Eliminar" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><LucideIcon name="Trash2" className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
        <KeywordChips list={arg.keywords} className="mb-2.5" />
        <p className="text-[13px] leading-relaxed text-foreground/80">{arg.contenido}</p>
      </div>
    );
  }

  /* ============== Global section: Argumentario (mural) ============== */
  function ArgumentarioPage() {
    const args = S.useArgs();
    const canEdit = S.useCan("editCampaigns");
    const [q, setQ] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [creating, setCreating] = useState(false);
    const visible = useMemo(() => args.filter((a) => matches(a, q)), [args, q]);

    return (
      <div className="min-h-screen bg-background" data-screen-label="Argumentario">
        <window.SectionWash accent="ink" />
        <main className="mx-auto w-full max-w-6xl px-4 pb-6 pt-0 sm:px-6 sm:pb-8 lg:px-8">
          <window.PageToolbar back="#/">
            {canEdit && (
              <Button variant="primary" onClick={() => { setCreating(true); setEditingId(null); }} className="gap-1.5">
                <LucideIcon name="Plus" className="h-4 w-4" /> Nuevo argumento
              </Button>
            )}
          </window.PageToolbar>

          <window.SectionHeader accent="ink" icon="Quote" size="lg" title="Argumentario" subtitle="Banco central de argumentos para rebatir objeciones. Cada speech habilita un subconjunto para su campaña." />

          <div className="mb-5 max-w-md">
            <SearchBox value={q} onChange={setQ} placeholder="Buscar por título o keyword…" />
          </div>

          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creating && (
              <ArgEditor arg={{}} onCancel={() => setCreating(false)}
                onSave={(data) => { S.addArg(data); setCreating(false); toast("Argumento creado"); }} />
            )}
            {visible.map((a) => (
              editingId === a.id ? (
                <ArgEditor key={a.id} arg={a} onCancel={() => setEditingId(null)}
                  onSave={(data) => { S.updateArg(a.id, data); setEditingId(null); toast("Argumento actualizado"); }} />
              ) : (
                <ArgCard key={a.id} arg={a} canEdit={canEdit}
                  onEdit={() => { setEditingId(a.id); setCreating(false); }}
                  onRemove={() => { S.removeArg(a.id); toast("Argumento eliminado"); }} />
              )
            ))}
          </div>

          {visible.length === 0 && !creating && (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-14 text-center">
              <LucideIcon name="Quote" className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">{q ? <>Ningún argumento coincide con “{q.trim()}”.</> : "Aún no hay argumentos en la central."}</p>
              {!q && canEdit && <Button variant="primary" size="sm" onClick={() => setCreating(true)} className="mt-4 gap-1.5"><LucideIcon name="Plus" className="h-3.5 w-3.5" /> Crear el primero</Button>}
            </div>
          )}
        </main>
      </div>
    );
  }

  /* ============== Speech page (per campaign + period) ============== */
  function SpeechPage({ slug }) {
    const qstr = (window.location.hash.split("?")[1] || "");
    const pParam = new URLSearchParams(qstr).get("p");
    const [currentPeriod] = S.useCurrentPeriod();
    const period = pParam || currentPeriod;
    const campaign = S.campaigns.find((c) => c.slug === slug) || { title: slug };
    const speech = S.useSpeech(slug, period);
    const args = S.useArgs();
    const canEdit = S.useCan("editTasks") || S.useCan("editCampaigns");

    const [drafting, setDrafting] = useState(false);
    const [setupOpen, setSetupOpen] = useState(false);
    const [q, setQ] = useState("");

    /* speech textarea auto-grows to content */
    const taRef = useRef(null);
    const fit = () => { const el = taRef.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } };
    useEffect(() => { fit(); }, [speech.text, drafting]);

    const enabledIds = speech.enabledArgIds || [];
    const enabledArgs = useMemo(() => args.filter((a) => enabledIds.includes(a.id)), [args, enabledIds.join("|")]);
    const results = useMemo(() => enabledArgs.filter((a) => matches(a, q)), [enabledArgs, q]);
    const toggleArg = (id) => S.writeSpeech(slug, period, { enabledArgIds: enabledIds.includes(id) ? enabledIds.filter((x) => x !== id) : [...enabledIds, id] });

    const hasSpeech = Boolean((speech.text || "").trim()) || drafting;

    return (
      <div className="min-h-screen bg-background" data-screen-label={`Speech · ${campaign.title}`}>
        <window.SectionWash accent="fuchsia" />
        <main className="mx-auto w-full max-w-4xl px-4 pb-6 pt-0 sm:px-6 sm:pb-8 lg:px-8">
          <window.PageToolbar back={`#/brief/${slug}?p=${period}`} backLabel="Volver al brief" />

          <header className="mb-6">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-muted-foreground"><LucideIcon name="Mic" className="h-3 w-3" /> Speech</span>
              <span className="whitespace-nowrap tabular-nums">{S.formatPeriodLabel(period)}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{campaign.title}</h1>
          </header>

          <Block icon="Mic" title="Speech de apertura">
            {!hasSpeech ? (
              <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-12 text-center">
                <LucideIcon name="Mic" className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">Aún no hay speech para esta campaña.</p>
                {canEdit && <Button variant="primary" size="sm" onClick={() => setDrafting(true)} className="mt-4 gap-1.5"><LucideIcon name="Plus" className="h-3.5 w-3.5" /> Crear speech</Button>}
              </div>
            ) : (
              <Textarea ref={taRef} value={speech.text} readOnly={!canEdit} rows={3} autoFocus={drafting && !speech.text}
                onChange={(e) => S.writeSpeech(slug, period, { text: e.target.value })} onInput={fit}
                placeholder="Hola, ¿hablo con …? Te llamo de … para contarte que…"
                className="resize-none overflow-hidden border-0 bg-transparent p-0 text-[15px] leading-relaxed text-foreground shadow-none focus-visible:ring-0" />
            )}
          </Block>

          <div className="mt-5">
            <Block icon="Quote" title="Argumentario"
              action={speech.argumentarioEnabled ? (
                <a href="#/argumentario" className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">Banco central <LucideIcon name="ArrowRight" className="h-3 w-3" /></a>
              ) : null}>
              <Switch checked={speech.argumentarioEnabled} disabled={!canEdit}
                onChange={(v) => { S.writeSpeech(slug, period, { argumentarioEnabled: v }); if (v && enabledIds.length === 0) setSetupOpen(true); }}
                label="Habilitar Argumentario" />

              {speech.argumentarioEnabled && (
                <div className="mt-4 space-y-4">
                  {/* setup: which central arguments are enabled for this campaign-period */}
                  <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
                    <button type="button" onClick={() => setSetupOpen((o) => !o)}
                      className="flex w-full items-center justify-between gap-2 text-left">
                      <span className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-foreground">
                        <LucideIcon name="Settings2" className="h-3.5 w-3.5 text-muted-foreground" /> Argumentos habilitados
                        <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{enabledArgs.length} de {args.length}</span>
                      </span>
                      <LucideIcon name={setupOpen ? "ChevronUp" : "ChevronDown"} className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {setupOpen && (
                      <div className="mt-3 space-y-1">
                        {args.length === 0 && (
                          <p className="px-1 py-2 text-[12px] text-muted-foreground">La central está vacía. <a href="#/argumentario" className="font-medium text-brand hover:underline">Crea argumentos en el Argumentario</a>.</p>
                        )}
                        {args.map((a) => {
                          const on = enabledIds.includes(a.id);
                          return (
                            <button key={a.id} type="button" disabled={!canEdit} onClick={() => toggleArg(a.id)}
                              className={cn("flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors", on ? "border-brand/40 bg-brand/5" : "border-transparent hover:bg-surface")}>
                              <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors", on ? "border-brand bg-brand text-white" : "border-border bg-surface-elevated")}>
                                {on && <LucideIcon name="Check" className="h-3 w-3" strokeWidth={3} />}
                              </span>
                              <span className="min-w-0">
                                <span className={cn("block text-[13px] font-medium leading-snug", on ? "text-foreground" : "text-muted-foreground")}>{a.titulo || "—"}</span>
                                <KeywordChips list={a.keywords} className="mt-1" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* usage: fast keyword search over enabled arguments only */}
                  {enabledArgs.length > 0 ? (
                    <div>
                      <SearchBox value={q} onChange={setQ} placeholder="El alumno respondió… busca por palabra clave (ej. precio, tiempo)" />
                      <div className="mt-3 space-y-2.5">
                        {results.map((a) => (
                          <div key={a.id} className="rounded-2xl border border-border/60 bg-surface-elevated p-4 shadow-soft">
                            <h3 className="text-[14px] font-semibold leading-snug tracking-tight text-foreground">{a.titulo}</h3>
                            <KeywordChips list={a.keywords} className="mt-1.5" />
                            <p className="mt-2.5 text-[13px] leading-relaxed text-foreground/80">{a.contenido}</p>
                          </div>
                        ))}
                        {results.length === 0 && (
                          <p className="rounded-xl border border-dashed border-border bg-surface/50 px-3 py-6 text-center text-[12px] text-muted-foreground">Sin coincidencias para “{q.trim()}” entre los argumentos habilitados.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-border bg-surface/50 px-3 py-6 text-center text-[12px] text-muted-foreground">Habilita argumentos de la central para usarlos durante la llamada.</p>
                  )}
                </div>
              )}
            </Block>
          </div>
        </main>
      </div>
    );
  }

  /* ============== Speechs hub — all campaign speeches for the current period ============== */
  /* Hub de speechs con filtro de periodo compartido: todos · varios · uno. */
  function SpeechPeriodSection({ p, q, campaigns, args, canEdit, showHeader }) {
    const rows = campaigns.map((c) => {
      const configured = S.isCampaignConfigured(c.slug, p);
      const meta = configured ? S.readConfigMeta(c.slug, p) : {};
      const speech = S.readSpeech(c.slug, p);
      return { c, configured, includes: Boolean(meta.includesSpeech), speech };
    });
    const withSpeech = rows.filter((r) => r.configured && r.includes);
    const without = rows.filter((r) => r.configured && !r.includes);
    const argCount = (speech) => (speech.enabledArgIds || []).filter((id) => args.some((a) => a.id === id)).length;
    const enableFor = (slug) => { S.writeConfigMeta(slug, p, { includesSpeech: true }); window.location.hash = `#/speech/${slug}?p=${p}`; };
    const nq = q.trim().toLowerCase();
    const visWith = nq ? withSpeech.filter((r) => r.c.title.toLowerCase().includes(nq)) : withSpeech;
    const visWithout = nq ? without.filter((r) => r.c.title.toLowerCase().includes(nq)) : without;

    return (
      <section className="mb-8">
        {showHeader && (
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-brand">
              <LucideIcon name="CalendarRange" className="h-3 w-3" /> {S.formatPeriodLabel(p)}
            </span>
            <span className="h-px flex-1 bg-border/60" />
          </div>
        )}
        {visWith.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface/50 px-3 py-2 text-[12.5px] text-muted-foreground">
            <LucideIcon name="Mic" className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            {nq ? <>Sin coincidencias con “{q.trim()}” en {S.formatPeriodLabel(p)}.</> : <>Sin speech habilitado en {S.formatPeriodLabel(p)}{without.length > 0 && canEdit ? " — actívalo aquí abajo." : "."}</>}
          </p>
        ) : (
          <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visWith.map(({ c, speech }) => {
              const hasText = Boolean((speech.text || "").trim());
              const n = speech.argumentarioEnabled ? argCount(speech) : 0;
              return (
                <div key={c.slug} className="group flex flex-col rounded-2xl border border-border/60 bg-surface-elevated p-5 shadow-soft transition-[transform,box-shadow] duration-200 ease-glide hover:-translate-y-0.5 hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <LucideIcon name="Mic" className="h-6 w-6 shrink-0 text-brand" strokeWidth={1.75} />
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", hasText ? "bg-accent-green/10 text-accent-green" : "bg-accent-amber/15 text-accent-amber")}>{hasText ? "Speech listo" : "Sin contenido"}</span>
                      {speech.argumentarioEnabled && (
                        <span className="whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{n} argumento{n === 1 ? "" : "s"}</span>
                      )}
                    </div>
                  </div>
                  <h3 className="text-[17px] font-semibold tracking-tight text-foreground">{c.title}</h3>
                  <p className={cn("mt-2 flex-1 text-[13px] leading-relaxed", hasText ? "line-clamp-3 text-foreground/75" : "italic text-muted-foreground/70")}>
                    {hasText ? speech.text : "Aún sin guion — entra para crearlo."}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3.5">
                    <span className="text-[12px] font-medium text-muted-foreground">{hasText ? "Abrir speech" : "Crear speech"}</span>
                    <a href={`#/speech/${c.slug}?p=${p}`} aria-label={`Abrir speech de ${c.title}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform duration-200 group-hover:scale-105">
                      <LucideIcon name="ArrowRight" className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {visWithout.length > 0 && canEdit && (
          <div className="mt-5">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Campañas sin speech · {S.formatPeriodLabel(p)}</p>
            <div className="flex flex-wrap gap-2">
              {visWithout.map(({ c }) => (
                <button key={c.slug} type="button" onClick={() => enableFor(c.slug)} title={`Habilitar speech para ${c.title}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-surface/50 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:bg-brand/5 hover:text-foreground">
                  <LucideIcon name="Plus" className="h-3.5 w-3.5" /> {c.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  function SpeechsPage() {
    const campaigns = S.useCampaigns();
    S.useAvailablePeriods();
    const { periods: sel } = S.useSelectedPeriods("all");
    const args = S.useArgs();
    const canEdit = S.useCan("editCampaigns");
    const [q, setQ] = useState("");

    return (
      <div className="min-h-screen bg-background" data-screen-label="Speechs">
        <window.SectionWash accent="fuchsia" />
        <main className="mx-auto w-full max-w-6xl px-4 pb-6 pt-0 sm:px-6 sm:pb-8 lg:px-8">
          <window.PageToolbar back="#/" left={
            <div className="relative w-52">
              <LucideIcon name="Search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Buscar campaña…" aria-label="Buscar campaña" className="!h-9 !rounded-full pl-8 text-sm" />
            </div>
          }>
            <window.PeriodFilter defaultMode="all" />
          </window.PageToolbar>

          <window.SectionHeader accent="fuchsia" icon="Mic" size="lg" title="Speechs" subtitle="Guiones de apertura de llamada por campaña." />

          {sel.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-14 text-center">
              <p className="text-sm text-muted-foreground">Ningún periodo seleccionado — elige uno o más en el filtro de arriba.</p>
            </div>
          )}
          {sel.map((p) => (
            <SpeechPeriodSection key={p} p={p} q={q} campaigns={campaigns} args={args} canEdit={canEdit} showHeader={sel.length > 1} />
          ))}
        </main>
      </div>
    );
  }

  Object.assign(window, { SpeechPage, ArgumentarioPage, SpeechsPage });
})();
