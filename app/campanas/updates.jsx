/* Task updates timeline + Brief changelog (audit log). */
(function () {
  const React = window.React;
  const { useState, useMemo } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Block } = window;
  const cn = window.cn;

  /* update types */
  const TYPES = [
    { key: "progress", label: "Avance", icon: "TrendingUp", dot: "bg-accent-green", soft: "bg-accent-green/10 text-accent-green" },
    { key: "block", label: "Bloqueo", icon: "OctagonX", dot: "bg-destructive", soft: "bg-destructive/10 text-destructive" },
    { key: "risk", label: "Riesgo", icon: "TriangleAlert", dot: "bg-accent-amber", soft: "bg-accent-amber/15 text-accent-amber" },
    { key: "change", label: "Cambio", icon: "Replace", dot: "bg-accent-violet", soft: "bg-accent-violet/10 text-accent-violet" },
    { key: "done", label: "Completado", icon: "CircleCheck", dot: "bg-brand", soft: "bg-brand/10 text-brand" },
    { key: "comment", label: "Comentario", icon: "MessageCircle", dot: "bg-muted-foreground/50", soft: "bg-muted text-muted-foreground" },
  ];
  const TYPE = Object.fromEntries(TYPES.map((t) => [t.key, t]));
  const relTime = (ts) => {
    const d = new Date(ts), now = new Date();
    const days = Math.floor((now.setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
    const time = new Date(ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    if (days === 0) return `Hoy · ${time}`;
    if (days === 1) return `Ayer · ${time}`;
    return new Date(ts).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) + ` · ${time}`;
  };

  /* ============== Task updates (inline, collapsible) ============== */
  function TaskUpdates({ updates, onAdd, onRemove, onEdit, canEdit }) {
    const [open, setOpen] = useState(false);
    const [composing, setComposing] = useState(false);
    const [type, setType] = useState("progress");
    const [text, setText] = useState("");
    const [editId, setEditId] = useState(null);
    const [editText, setEditText] = useState("");
    const [editType, setEditType] = useState("comment");
    const list = (updates || []).slice().sort((a, b) => b.ts - a.ts);
    const lastType = list[0] ? TYPE[list[0].type] : null;

    const submit = () => {
      if (!text.trim()) return;
      onAdd({ type, text });
      /* @Nombre dentro del texto → notificación a esa persona */
      try { S.notifyMentions(text, { title: "Te mencionaron en un avance", href: window.location.hash }); } catch {}
      setText(""); setComposing(false); setOpen(true);
    };
    const startEdit = (u) => { setEditId(u.id); setEditText(u.text); setEditType(u.type); };
    const saveEdit = () => { if (editText.trim() && onEdit) onEdit(editId, { text: editText.trim(), type: editType }); setEditId(null); setEditText(""); };

    return (
      <div className="ml-6 mt-0.5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOpen((o) => !o)}
            className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors",
              list.length ? "text-muted-foreground hover:bg-surface hover:text-foreground" : "text-muted-foreground/60 hover:text-foreground")}>
            <LucideIcon name={open ? "ChevronDown" : "ChevronRight"} className="h-3 w-3" />
            {list.length ? `Updates (${list.length})` : "Sin updates"}
            {!open && lastType && <span className={cn("ml-0.5 inline-block h-1.5 w-1.5 rounded-full", lastType.dot)} title={lastType.label} />}
          </button>
          {canEdit && !composing && (
            <button type="button" onClick={() => { setComposing(true); setOpen(true); }}
              className="edit-only inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-brand transition-colors hover:bg-brand/10 print:hidden">
              <LucideIcon name="Plus" className="h-3 w-3" /> Update
            </button>
          )}
        </div>

        {open && (
          <div className="mt-1.5 space-y-2 border-l border-border/70 pl-3">
            {canEdit && composing && (
              <div className="rounded-lg border border-border bg-surface-elevated p-2 shadow-soft">
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {TYPES.map((t) => (
                    <button key={t.key} type="button" onClick={() => setType(t.key)}
                      className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors", type === t.key ? t.soft + " ring-1 ring-current/30" : "bg-surface text-muted-foreground hover:text-foreground")}>
                      <LucideIcon name={t.icon} className="h-2.5 w-2.5" /> {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <Input value={text} autoFocus onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setComposing(false); setText(""); } }}
                    placeholder="¿Qué pasó? Escribe y Enter…" className="h-7 flex-1 text-[12px]" />
                  <Button size="sm" onClick={submit} disabled={!text.trim()} className="h-7 px-2 text-[11px]">Agregar</Button>
                  <button type="button" onClick={() => { setComposing(false); setText(""); }} className="h-7 w-6 text-muted-foreground hover:text-foreground"><LucideIcon name="X" className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
            {list.length === 0 && !composing && <p className="py-1 text-[11px] text-muted-foreground/70">Aún no hay actualizaciones.</p>}
            <ol className="space-y-1.5">
              {list.map((u) => {
                const ty = TYPE[u.type] || TYPE.comment;
                if (editId === u.id) {
                  return (
                    <li key={u.id} className="relative">
                      <span className={cn("absolute -left-[15px] top-2 h-2 w-2 rounded-full ring-2 ring-surface-elevated", (TYPE[editType] || ty).dot)} />
                      <div className="rounded-lg border border-border bg-surface-elevated p-2 shadow-soft">
                        <div className="mb-1.5 flex flex-wrap gap-1">
                          {TYPES.map((t) => (
                            <button key={t.key} type="button" onClick={() => setEditType(t.key)}
                              className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors", editType === t.key ? t.soft + " ring-1 ring-current/30" : "bg-surface text-muted-foreground hover:text-foreground")}>
                              <LucideIcon name={t.icon} className="h-2.5 w-2.5" /> {t.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Input value={editText} autoFocus onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditId(null); }} className="h-7 flex-1 text-[12px]" />
                          <Button size="sm" onClick={saveEdit} disabled={!editText.trim()} className="h-7 px-2 text-[11px]">Guardar</Button>
                          <button type="button" onClick={() => setEditId(null)} className="h-7 w-6 text-muted-foreground hover:text-foreground"><LucideIcon name="X" className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={u.id} className="group/u relative">
                    <span className={cn("absolute -left-[15px] top-1 h-2 w-2 rounded-full ring-2 ring-surface-elevated", ty.dot)} />
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 font-semibold", ty.soft)}><LucideIcon name={ty.icon} className="h-2.5 w-2.5" /> {ty.label}</span>
                          <span className="font-medium text-foreground">{u.user}</span>
                          <span className="tabular-nums text-muted-foreground">{relTime(u.ts)}</span>
                          {u.editedTs && <span className="text-muted-foreground/60">· editado</span>}
                        </div>
                        <p className="mt-0.5 text-[12px] leading-snug text-foreground/90">{u.text}</p>
                      </div>
                      {canEdit && (
                        <div className="edit-only flex shrink-0 items-center gap-0.5 opacity-0 group-hover/u:opacity-100 print:hidden">
                          <button type="button" onClick={() => startEdit(u)} aria-label="Editar update" className="h-4 w-4 text-muted-foreground hover:text-foreground"><LucideIcon name="Pencil" className="h-3 w-3" /></button>
                          <button type="button" onClick={() => onRemove(u.id)} aria-label="Eliminar update" className="h-4 w-4 text-muted-foreground hover:text-destructive"><LucideIcon name="X" className="h-3 w-3" /></button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    );
  }
  window.TaskUpdates = TaskUpdates;

  /* ============== Version compare (Antes / Después) ============== */
  function paramSummary(state) {
    const m = {};
    (state.params || []).forEach((p) => { if (p.label) m[p.label] = p.date || "—"; });
    return m;
  }
  function keyDateSummary(state) {
    const m = {};
    (state.keyDates || []).forEach((k) => { if (k.label) m[k.label] = `${k.offsetDays >= 0 ? "+" : ""}${k.offsetDays || 0}d · ${k.durationDays || 1}d`; });
    return m;
  }
  function diffFields(prev, curr) {
    const rows = [];
    const push = (label, b, a) => { if (String(b ?? "") !== String(a ?? "")) rows.push({ label, before: b, after: a }); };
    push("Responsable", prev.responsable || "—", curr.responsable || "—");
    push("Enlace Canva", prev.canva || "—", curr.canva || "—");
    push("Enlace Dropbox", prev.dropbox || "—", curr.dropbox || "—");
    push("Tareas (total)", prev.taskCount, curr.taskCount);
    push("Tareas completadas", prev.doneCount, curr.doneCount);
    const pp = paramSummary(prev), cp = paramSummary(curr);
    Array.from(new Set([...Object.keys(pp), ...Object.keys(cp)])).forEach((k) => push(`Fecha · ${k}`, pp[k] || "—", cp[k] || "—"));
    const pk = keyDateSummary(prev), ck = keyDateSummary(curr);
    Array.from(new Set([...Object.keys(pk), ...Object.keys(ck)])).forEach((k) => push(`Hito · ${k}`, pk[k] || "—", ck[k] || "—"));
    return rows;
  }
  function VersionCompare({ versions }) {
    const [aIdx, setAIdx] = useState(1); // older (default: previous)
    const [bIdx, setBIdx] = useState(0); // newer (default: current)
    const fmtVer = (v, i) => `${i === 0 ? "Actual" : "v" + (versions.length - i)} · ${new Date(v.ts).toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · ${v.user}`;
    const prev = versions[aIdx], curr = versions[bIdx];
    const rows = prev && curr ? diffFields(prev.state, curr.state) : [];

    return (
      <div>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Antes</p>
            <select value={aIdx} onChange={(e) => setAIdx(Number(e.target.value))} className="h-7 w-full cursor-pointer rounded-md border border-input bg-transparent px-1.5 text-[11px]">
              {versions.map((v, i) => <option key={v.id} value={i}>{fmtVer(v, i)}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Después</p>
            <select value={bIdx} onChange={(e) => setBIdx(Number(e.target.value))} className="h-7 w-full cursor-pointer rounded-md border border-input bg-transparent px-1.5 text-[11px]">
              {versions.map((v, i) => <option key={v.id} value={i}>{fmtVer(v, i)}</option>)}
            </select>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-surface/40 px-3 py-4 text-center text-[12px] text-muted-foreground">No hay diferencias entre estas dos versiones.</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-surface/30 px-3 py-2">
                <div>
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{r.label}</p>
                  <span className="inline-block rounded bg-destructive/5 px-1.5 py-0.5 text-[12px] text-destructive/80 line-through">{String(r.before)}</span>
                </div>
                <LucideIcon name="ArrowRight" className="h-3.5 w-3.5 text-muted-foreground" />
                <div className="text-right">
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/0">·</p>
                  <span className="inline-block rounded bg-accent-green/5 px-1.5 py-0.5 text-[12px] font-medium text-accent-green">{String(r.after)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">Se generan versiones cada vez que guardas el brief (máx. 20).</p>
      </div>
    );
  }

  /* ============== Brief changelog (audit log) ============== */
  const KIND = {
    done: { icon: "CircleCheck", tone: "text-accent-green", dot: "bg-accent-green" },
    block: { icon: "OctagonX", tone: "text-destructive", dot: "bg-destructive" },
    update: { icon: "MessageCircle", tone: "text-accent-violet", dot: "bg-accent-violet" },
    add: { icon: "Plus", tone: "text-brand", dot: "bg-brand" },
    remove: { icon: "Trash2", tone: "text-destructive", dot: "bg-destructive" },
    edit: { icon: "Pencil", tone: "text-muted-foreground", dot: "bg-muted-foreground/50" },
  };
  const dayKey = (ts) => new Date(ts).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  function BriefChangelog({ slug, period }) {
    const entries = S.useChangelog(slug, period);
    const versions = S.useBriefVersions(slug, period);
    const canEdit = S.useCan("editTasks") || S.useCan("editCampaigns");
    const [open, setOpen] = useState(false);
    const [userF, setUserF] = useState("all");
    const [compare, setCompare] = useState(false);

    const users = useMemo(() => Array.from(new Set(entries.map((e) => e.user))), [entries]);
    const filtered = userF === "all" ? entries : entries.filter((e) => e.user === userF);
    const groups = useMemo(() => {
      const m = new Map();
      filtered.forEach((e) => { const k = dayKey(e.ts); if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
      return Array.from(m.entries());
    }, [filtered]);

    return (
      <Block icon="History" title="Historial del brief · todos los periodos"
        action={
          <div className="flex items-center gap-2 print:hidden">
            {open && versions.length >= 2 && (
              <button type="button" onClick={() => setCompare((c) => !c)} className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors", compare ? "bg-brand/10 text-brand" : "text-muted-foreground hover:bg-surface hover:text-foreground")}>
                <LucideIcon name="GitCompare" className="h-3.5 w-3.5" /> Comparar versión anterior
              </button>
            )}
            {open && !compare && users.length > 1 && (
              <select value={userF} onChange={(e) => setUserF(e.target.value)} className="h-6 cursor-pointer rounded-md border border-input bg-transparent px-1.5 text-[11px] text-muted-foreground">
                <option value="all">Todos</option>
                {users.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
            {open && canEdit && entries.length > 0 && !compare && (
              <button type="button" onClick={() => { if (confirm("¿Limpiar el historial de cambios de TODOS los periodos de esta campaña?")) S.clearChangelog(slug); }} className="edit-only text-[11px] text-muted-foreground hover:text-destructive">Limpiar</button>
            )}
            <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-surface hover:text-foreground">
              <LucideIcon name={open ? "ChevronUp" : "ChevronDown"} className="h-3.5 w-3.5" />
              {open ? "Ocultar" : `Ver (${entries.length})`}
            </button>
          </div>
        }>
        {!open ? (
          <p className="text-[12px] text-muted-foreground">
            {entries.length === 0 ? "Sin cambios registrados todavía." : (
              <>Último cambio: <span className="font-medium text-foreground">{entries[0].user}</span> · {relTime(entries[0].ts)} — {entries[0].label || entries[0].section}</>
            )}
          </p>
        ) : compare ? (
          <VersionCompare versions={versions} />
        ) : (
          <div className="space-y-3">
            {groups.length === 0 && <p className="py-2 text-center text-[12px] text-muted-foreground">Sin cambios para este filtro.</p>}
            {groups.map(([day, items]) => (
              <div key={day}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{day}</p>
                <ol className="space-y-1.5 border-l border-border/70 pl-3">
                  {items.map((e) => {
                    const k = KIND[e.kind] || KIND.edit;
                    return (
                      <li key={e.id} className="relative">
                        <span className={cn("absolute -left-[15px] top-1.5 h-2 w-2 rounded-full ring-2 ring-surface-elevated", k.dot)} />
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <LucideIcon name={k.icon} className={cn("h-3 w-3", k.tone)} />
                          <span className="text-[12px] font-medium text-foreground">{e.user}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{new Date(e.ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="whitespace-nowrap rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">{e.section}</span>
                          {e.period && <span className="whitespace-nowrap rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-brand" title="Periodo en el que se hizo la modificación">{S.formatPeriodShort ? S.formatPeriodShort(e.period) : e.period}</span>}
                        </div>
                        <p className="mt-0.5 text-[12px] leading-snug text-foreground/90">{e.label}</p>
                        {(e.before != null || e.after != null) && (e.before !== "" || e.after !== "") && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                            {e.before != null && e.before !== "" && <span className="rounded bg-destructive/5 px-1.5 py-0.5 text-destructive/80 line-through">{String(e.before)}</span>}
                            {e.before != null && e.before !== "" && <LucideIcon name="ArrowRight" className="h-3 w-3 text-muted-foreground" />}
                            <span className="rounded bg-accent-green/5 px-1.5 py-0.5 font-medium text-accent-green">{String(e.after)}</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Block>
    );
  }
  window.BriefChangelog = BriefChangelog;
})();
