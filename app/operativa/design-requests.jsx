/* Design requests — two-stage workflow: requerimiento → entrega/revisión, with action log + visual timeline. */
(function () {
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useState, useMemo } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Textarea, Label, OwnerSelect, toast } = window;
  const cn = window.cn;

  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";
  const fmtDT = (ts) => ts ? new Date(ts).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtDL = (s) => { if (!s) return "—"; const [y, m, d] = s.split("-").map(Number); if (!y) return "—"; return new Date(y, m - 1, d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }); };
  const relDays = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); if (!y) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(y, m - 1, d) - t) / 86400000); };
  const TONE = { brand: "text-brand bg-brand/10", violet: "text-accent-violet bg-accent-violet/10", green: "text-accent-green bg-accent-green/10", amber: "text-accent-amber bg-accent-amber/15", red: "text-destructive bg-destructive/10", muted: "text-muted-foreground bg-muted" };

  function StatusBadge({ status, size = "sm" }) {
    const m = S.DR_STATUS[status] || S.DR_STATUS.pending;
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full font-medium", m.soft, size === "lg" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} /> {m.label}
      </span>
    );
  }
  function PriorityTag({ p }) {
    const m = S.DR_PRIORITY[p] || S.DR_PRIORITY.med;
    return <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium", m.soft)}><span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />{m.label}</span>;
  }
  function DeadlinePill({ deadline, status }) {
    const dl = relDays(deadline);
    if (deadline === "" || dl === null) return <span className="text-[11px] text-muted-foreground">Sin deadline</span>;
    const done = status === "approved";
    const tone = done ? "text-muted-foreground" : dl < 0 ? "text-destructive font-medium" : dl <= 2 ? "text-accent-amber font-medium" : "text-muted-foreground";
    const txt = done ? fmtDL(deadline) : dl < 0 ? `${Math.abs(dl)}d atraso` : dl === 0 ? "Vence hoy" : `${fmtDL(deadline)} · ${dl}d`;
    return <span className={cn("inline-flex items-center gap-1 text-[11px] tabular-nums", tone)}><LucideIcon name="CalendarClock" className="h-3 w-3" />{txt}</span>;
  }

  /* ============ Stepper (status machine, visual) ============ */
  function Stepper({ status }) {
    const main = ["pending", "in_design", "delivered", "in_review"];
    const isFeedback = status === "feedback";
    const isApproved = status === "approved";
    // delivered is transient; treat in_review/approved/feedback as past-delivered
    const reachedIdx = { pending: 0, in_design: 1, delivered: 2, in_review: 3, approved: 4, feedback: 3 }[status] ?? 0;
    return (
      <div className="flex items-center gap-1.5">
        {main.map((s, i) => {
          const m = S.DR_STATUS[s];
          const active = i <= reachedIdx;
          return (
            <React.Fragment key={s}>
              <div className={cn("flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium transition-colors", active ? m.soft : "bg-muted/50 text-muted-foreground/60")}>
                <LucideIcon name={m.icon} className="h-3 w-3" /> {m.label}
              </div>
              {i < main.length - 1 && <span className={cn("h-px w-3", i < reachedIdx ? "bg-foreground/30" : "bg-border")} />}
            </React.Fragment>
          );
        })}
        <span className={cn("h-px w-3", reachedIdx >= 3 ? "bg-foreground/30" : "bg-border")} />
        <div className={cn("flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium",
          isApproved ? S.DR_STATUS.approved.soft : isFeedback ? S.DR_STATUS.feedback.soft : "bg-muted/50 text-muted-foreground/60")}>
          <LucideIcon name={isFeedback ? S.DR_STATUS.feedback.icon : S.DR_STATUS.approved.icon} className="h-3 w-3" />
          {isFeedback ? "Con feedback" : "Aprobado"}
        </div>
      </div>
    );
  }

  /* ============ Tracking de pedido (estilo package-tracking) ============ */
  const REACHED_IDX = { pending: 0, in_design: 1, delivered: 2, in_review: 3, approved: 4, feedback: 3 };
  /* Fecha real en que el pedido alcanzó cada etapa, derivada del log de trazabilidad. */
  function stageTs(r, key) {
    const sorted = [...(r.log || [])].sort((a, b) => a.ts - b.ts);
    const first = (pred) => { const e = sorted.find(pred); return e ? e.ts : null; };
    const last = (pred) => { const e = [...sorted].reverse().find(pred); return e ? e.ts : null; };
    switch (key) {
      case "pending": return r.createdAt || first((e) => e.kind === "created");
      case "in_design": return first((e) => e.kind === "assigned") || first((e) => e.kind === "status" && /dise/i.test(`${e.after || ""}${e.label || ""}`));
      case "delivered": return first((e) => e.kind === "delivery");
      case "in_review": return r.status === "feedback" ? last((e) => e.kind === "feedback") : last((e) => e.kind === "delivery");
      case "approved": return first((e) => e.kind === "approved");
      default: return null;
    }
  }
  const fmtStage = (ts) => ts ? new Date(ts).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : null;

  /* Progreso 0–100 del pedido según su etapa, para la barra de la tarjeta. */
  const DR_PROGRESS = { pending: 8, in_design: 35, delivered: 65, in_review: 80, feedback: 55, approved: 100, cancelled: 0 };
  function drProgress(r) {
    if (r.status === "cancelled") return REACHED_IDX[r.prevStatus] != null ? (DR_PROGRESS[r.prevStatus] || 0) : 0;
    return DR_PROGRESS[r.status] ?? 0;
  }

  /* Tarjeta de pedido estilo módulos de campañas: #Nro, nombre, resumen,
     pieza, deadline, quién/cuándo solicitó, y barra de progreso abajo.
     Al entrar se abre la TRAZABILIDAD completa como sección principal. */
  function TrackingCard({ r, onOpen }) {
    const st = S.DR_STATUS[r.status] || S.DR_STATUS.pending;
    const isCancelled = r.status === "cancelled";
    const isApproved = r.status === "approved";
    const isFeedback = r.status === "feedback";
    const nDeliv = (r.deliveries || []).length;
    const pct = drProgress(r);
    const barTone = isCancelled ? "bg-muted-foreground/40" : isApproved ? "bg-accent-green" : isFeedback ? "bg-destructive" : "bg-brand";
    const num = typeof r.num === "number" ? r.num : "—";
    return (
      <button type="button" onClick={onOpen}
        className="group flex w-full flex-col rounded-2xl border border-border bg-surface-elevated p-5 text-left shadow-soft transition-[transform,box-shadow] duration-200 ease-glide hover:-translate-y-0.5 hover:shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-foreground/90 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-background">#{num}</span>
              <PriorityTag p={r.priority} />
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"><LucideIcon name="Shapes" className="h-3 w-3" /> {r.type}</span>
              {r.locked && <span className="inline-flex items-center gap-1 rounded-full bg-accent-violet/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-violet"><LucideIcon name="Lock" className="h-3 w-3" /> Fijado</span>}
            </div>
            <h3 className="mt-2 text-[16px] font-semibold leading-snug text-foreground">{r.title || "(sin título)"}</h3>
            {(r.description || "").trim() && (
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{r.description.trim()}</p>
            )}
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><LucideIcon name="User" className="h-3.5 w-3.5" /> {r.designer ? <>Diseña <span className="font-medium text-foreground">{r.designer}</span></> : "Sin diseñador"}</span>
              <span className="inline-flex items-center gap-1"><LucideIcon name="Inbox" className="h-3.5 w-3.5" /> Pidió <span className="font-medium text-foreground">{r.requester}</span> · {fmtDate(r.createdAt)}</span>
              {nDeliv > 0 && <span className="inline-flex items-center gap-1"><LucideIcon name="Upload" className="h-3.5 w-3.5" /> {nDeliv} entrega{nDeliv === 1 ? "" : "s"}</span>}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusBadge status={r.status} size="lg" />
            <DeadlinePill deadline={r.deadline} status={r.status} />
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[10.5px] font-medium">
            <span className={cn(isCancelled ? "text-muted-foreground" : isApproved ? "text-accent-green" : isFeedback ? "text-destructive" : "text-brand")}>{st.label}</span>
            <span className="tabular-nums text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-[width] duration-500 ease-glide", barTone, isCancelled && "opacity-50")} style={{ width: pct + "%" }} />
          </div>
        </div>
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          <LucideIcon name="History" className="h-3.5 w-3.5" /> Ver trazabilidad completa
          <LucideIcon name="ArrowRight" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </button>
    );
  }

  function PipelineStrip({ counts, statusF, setStatusF }) {
    const FLOW = ["pending", "in_design", "delivered", "in_review", "approved", "feedback", "cancelled"];
    return (
      <div className="mb-4 grid grid-cols-4 gap-1.5 rounded-2xl border border-border bg-surface-elevated p-2 shadow-soft sm:grid-cols-7">
        {FLOW.map((s) => {
          const m = S.DR_STATUS[s];
          const active = statusF === s;
          const n = counts[s] || 0;
          return (
            <button key={s} type="button" onClick={() => setStatusF(active ? "all" : s)} title={active ? "Quitar filtro" : `Ver solo ${m.label.toLowerCase()}`}
              className={cn("rounded-xl px-2 py-2.5 text-center transition-colors", active ? "bg-foreground text-background" : "hover:bg-surface")}>
              <p className={cn("text-[22px] font-bold leading-none tabular-nums", active ? "text-background" : n === 0 ? "text-foreground/25" : s === "feedback" ? "text-destructive" : s === "approved" ? "text-accent-green" : "text-foreground")}>{n}</p>
              <p className={cn("mt-1.5 flex items-center justify-center gap-1 whitespace-nowrap text-[10px] font-medium", active ? "text-background/80" : "text-muted-foreground")}>
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-background/70" : m.dot)}></span>{m.label}
              </p>
            </button>
          );
        })}
      </div>
    );
  }

  /* ============ Create / edit form ============ */
  function RequestForm({ initial, onClose }) {
    const isEdit = !!initial;
    const [title, setTitle] = useState(initial ? initial.title : "");
    const [description, setDescription] = useState(initial ? initial.description : "");
    const [priority, setPriority] = useState(initial ? initial.priority : "med");
    const [type, setType] = useState(initial ? initial.type : S.DR_TYPES[0]);
    const [deadline, setDeadline] = useState(initial ? initial.deadline : "");
    const [designer, setDesigner] = useState(initial ? initial.designer : "");
    const [refs, setRefs] = useState(initial ? (initial.refs || []) : []);
    const [refInput, setRefInput] = useState("");
    const valid = title.trim().length > 2;

    const addRef = () => { const v = refInput.trim(); if (!v) return; setRefs((r) => [...r, { id: S.uuid ? S.uuid() : String(Math.random()), label: v }]); setRefInput(""); };

    const save = () => {
      if (!valid) return;
      if (isEdit) {
        S.updateDesignRequest(initial.id, { title: title.trim(), description: description.trim(), priority, type, deadline, designer, refs }, { log: { kind: "edited", detail: { label: title.trim() } } });
        toast("Requerimiento actualizado");
      } else {
        S.addDesignRequest({ title, description, priority, type, deadline, designer, refs });
        toast("Solicitud creada");
      }
      onClose();
    };

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/30 p-4 backdrop-blur-sm sm:p-8" onClick={onClose}>
        <div className="my-auto w-full max-w-lg rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{isEdit ? "Editar requerimiento" : "Nueva solicitud de diseño"}</h2>
            <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"><LucideIcon name="X" className="h-4 w-4" /></button>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Banner principal — Lanzamiento" className="bg-surface" autoFocus />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Descripción</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Qué se necesita, mensaje clave, formatos, especificaciones…" className="bg-surface text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prioridad</Label>
                <div className="flex gap-1">
                  {["high", "med", "low"].map((p) => {
                    const m = S.DR_PRIORITY[p];
                    return <button key={p} type="button" onClick={() => setPriority(p)} className={cn("flex-1 rounded-lg border px-1 py-1.5 text-[11px] font-medium transition-colors", priority === p ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-muted-foreground hover:text-foreground")}>{m.label}</button>;
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo de diseño</Label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-input bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {S.readDRTypes().map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Deadline</Label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-surface tabular-nums" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Diseñador (opcional)</Label>
                <OwnerSelect framed value={designer} onChange={setDesigner} placeholder="Sin asignar" className="bg-surface" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Referencias adjuntas</Label>
              <div className="flex gap-1.5">
                <Input value={refInput} onChange={(e) => setRefInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRef(); } }} placeholder="Nombre de archivo o enlace…" className="h-9 flex-1 bg-surface text-sm" />
                <Button variant="outline" size="sm" onClick={addRef} className="h-9 gap-1"><LucideIcon name="Paperclip" className="h-3.5 w-3.5" /> Añadir</Button>
              </div>
              {refs.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {refs.map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[11px] text-foreground">
                      <LucideIcon name="File" className="h-3 w-3 text-muted-foreground" /> {r.label}
                      <button type="button" onClick={() => setRefs((x) => x.filter((y) => y.id !== r.id))} className="text-muted-foreground hover:text-destructive"><LucideIcon name="X" className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={save} disabled={!valid} className="gap-1.5"><LucideIcon name="Check" className="h-4 w-4" /> {isEdit ? "Guardar" : "Crear solicitud"}</Button>
          </div>
        </div>
      </div>
    );
  }

  /* ============ Timeline ============ */
  function Timeline({ log }) {
    const items = [...(log || [])].sort((a, b) => a.ts - b.ts);
    if (!items.length) return <p className="text-[12px] text-muted-foreground">Sin actividad registrada.</p>;
    return (
      <ol className="relative space-y-3.5 pl-6">
        <span className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />
        {items.map((it) => {
          const k = S.DR_LOG_KINDS[it.kind] || { label: it.kind, icon: "Circle", tone: "muted" };
          return (
            <li key={it.id} className="relative">
              <span className={cn("absolute -left-6 top-0 flex h-[19px] w-[19px] items-center justify-center rounded-full ring-2 ring-surface-elevated", TONE[k.tone])}>
                <LucideIcon name={k.icon} className="h-2.5 w-2.5" />
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[12px] font-semibold text-foreground">{k.label}</span>
                <span className="text-[10px] text-muted-foreground">{fmtDT(it.ts)}</span>
              </div>
              {(it.label || it.after || it.before) && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {it.before && it.after ? <><span className="line-through">{it.before}</span> → <span className="text-foreground">{it.after}</span></>
                    : it.after ? <span className="text-foreground">{it.after}</span>
                      : it.label}
                </p>
              )}
              <p className="mt-0.5 text-[10px] text-muted-foreground/80">por {it.user || "—"}</p>
            </li>
          );
        })}
      </ol>
    );
  }

  /* ============ Detail panel: TRAZABILIDAD como sección principal ============
     El requerimiento es el primer punto del timeline; las acciones (entregar,
     revisar, gestionar) viven en el punto ACTIVO al final, según el rol. */
  function DetailPanel({ req, persp = "all", onClose, canEdit, canReview }) {
    const [delivNote, setDelivNote] = useState("");
    const [delivLink, setDelivLink] = useState("");
    const [reviewComment, setReviewComment] = useState("");
    const [cancelReason, setCancelReason] = useState("");
    const [showReq, setShowReq] = useState(false);
    const r = S.useDesignRequests().find((x) => x.id === req.id) || req;
    const session = S.useSession();
    const myName = session && session.name;
    const active = r.status !== "approved" && r.status !== "cancelled";
    const isDesigner = !!myName && r.designer === myName;
    const isRequester = !!myName && r.requester === myName;
    /* Entregar: el diseñador del pedido, o un gestor (canEdit) si no hay match.
       Revisar/aprobar: el solicitante, o un gestor. Un diseñador no aprueba su
       propio trabajo salvo que también sea gestor. */
    let canDeliver = active && (isDesigner || (canEdit && !isRequester));
    let canReviewHere = active && (isRequester || (canReview && !isDesigner) || canEdit);
    /* Además, la PERSPECTIVA activa acota la vista: en "Soy diseñador" solo se
       ve la acción de entregar; en "Soy solicitante" solo la de revisar. Así no
       aparecen ambas a la vez aunque la persona tenga los dos permisos. */
    if (persp === "designer") canReviewHere = false;
    if (persp === "requester") canDeliver = false;
    const st = S.DR_STATUS[r.status] || S.DR_STATUS.pending;
    const num = typeof r.num === "number" ? r.num : "—";
    const nDeliv = (r.deliveries || []).length;
    const pct = drProgress(r);

    const submitDelivery = () => {
      if (!delivNote.trim() && !delivLink.trim()) { toast("Agrega una nota o enlace de entrega"); return; }
      S.addDRDelivery(r.id, { note: delivNote, links: delivLink.trim() ? [delivLink.trim()] : [] });
      setDelivNote(""); setDelivLink(""); toast("Entrega registrada · en revisión");
    };
    const doReview = (verdict) => {
      if (verdict !== "approved" && !reviewComment.trim()) { toast("Escribe el feedback para el diseñador"); return; }
      S.addDRReview(r.id, verdict, reviewComment);
      setReviewComment(""); toast(verdict === "approved" ? "Entrega aprobada" : "Feedback enviado");
    };

    /* Timeline unificado: requerimiento (siempre primero) + eventos del log. */
    const events = [...(r.log || [])].sort((a, b) => a.ts - b.ts);

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30 backdrop-blur-sm" onClick={onClose}>
        <div className="flex h-full w-full max-w-xl flex-col border-l border-border bg-surface-elevated shadow-elevated" onClick={(e) => e.stopPropagation()}>
          {/* Header compacto: #Nro, título, pieza, solicitante, progreso */}
          <div className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-foreground/90 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-background">#{num}</span>
                  <StatusBadge status={r.status} size="lg" />
                  <PriorityTag p={r.priority} />
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"><LucideIcon name="Shapes" className="h-3 w-3" /> {r.type}</span>
                </div>
                <h2 className="text-lg font-semibold leading-tight text-foreground">{r.title}</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Solicitó {r.requester} · {fmtDate(r.createdAt)}{r.designer ? ` · diseña ${r.designer}` : ""}</p>
              </div>
              <button type="button" onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground"><LucideIcon name="X" className="h-4 w-4" /></button>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10.5px] font-medium">
                <span className="flex items-center gap-1.5 text-muted-foreground"><LucideIcon name="History" className="h-3.5 w-3.5" /> Trazabilidad del pedido</span>
                <span className="tabular-nums text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-[width] duration-500", r.status === "approved" ? "bg-accent-green" : r.status === "feedback" ? "bg-destructive" : "bg-brand", r.status === "cancelled" && "bg-muted-foreground/40 opacity-50")} style={{ width: pct + "%" }} />
              </div>
            </div>
          </div>

          {/* Cuerpo: TIMELINE protagonista */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <ol className="relative space-y-0 pl-7">
              <span className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-border" />

              {/* PUNTO 1 — Requerimiento (origen del pedido), desplegable */}
              <li className="relative pb-5">
                <span className="absolute -left-7 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand text-white ring-2 ring-surface-elevated">
                  <LucideIcon name="FileText" className="h-3 w-3" />
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[12.5px] font-semibold text-foreground">Requerimiento</span>
                  <span className="text-[10px] text-muted-foreground">{fmtDT(r.createdAt)}</span>
                </div>
                <button type="button" onClick={() => setShowReq((v) => !v)} className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-brand hover:underline">
                  <LucideIcon name={showReq ? "ChevronDown" : "ChevronRight"} className="h-3 w-3" /> {showReq ? "Ocultar detalle" : "Ver detalle del requerimiento"}
                </button>
                {showReq && (
                  <div className="mt-2 space-y-2.5 rounded-xl border border-border bg-surface/50 p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Deadline"><DeadlinePill deadline={r.deadline} status={r.status} /></Field>
                      <Field label="Diseñador">{r.designer ? <span className="text-[13px] font-medium text-foreground">{r.designer}</span> : <span className="text-[12px] text-muted-foreground">Sin asignar</span>}</Field>
                    </div>
                    <Field label="Descripción"><p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{r.description || "—"}</p></Field>
                    <Field label={`Referencias (${(r.refs || []).length})`}>
                      {(r.refs || []).length ? <div className="flex flex-wrap gap-1.5">{r.refs.map((f) => <span key={f.id} className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[11px] text-foreground"><LucideIcon name="File" className="h-3 w-3 text-muted-foreground" /> {f.label}</span>)}</div> : <span className="text-[12px] text-muted-foreground">Sin adjuntos</span>}
                    </Field>
                    {canEdit && (
                      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-2.5">
                        {!r.locked ? (
                          <>
                            <Button size="sm" onClick={() => S.setDRLocked(r.id, true)} className="h-8 gap-1.5"><LucideIcon name="Lock" className="h-3.5 w-3.5" /> Fijar</Button>
                            <Button variant="outline" size="sm" onClick={() => window.__drEdit && window.__drEdit(r)} className="h-8 gap-1.5"><LucideIcon name="Pencil" className="h-3.5 w-3.5" /> Editar</Button>
                          </>
                        ) : (
                          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><LucideIcon name="Lock" className="h-3.5 w-3.5 text-accent-violet" /> Fijado. <button type="button" onClick={() => S.setDRLocked(r.id, false)} className="text-brand hover:underline">Reabrir</button></p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>

              {/* PUNTOS 2..N — eventos del log */}
              {events.filter((it) => it.kind !== "created").map((it) => {
                const k = S.DR_LOG_KINDS[it.kind] || { label: it.kind, icon: "Circle", tone: "muted" };
                return (
                  <li key={it.id} className="relative pb-5">
                    <span className={cn("absolute -left-7 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full ring-2 ring-surface-elevated", TONE[k.tone])}>
                      <LucideIcon name={k.icon} className="h-3 w-3" />
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[12.5px] font-semibold text-foreground">{k.label}</span>
                      <span className="text-[10px] text-muted-foreground">{fmtDT(it.ts)}</span>
                    </div>
                    {(it.label || it.after || it.before) && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {it.before && it.after ? <><span className="line-through">{it.before}</span> → <span className="text-foreground">{it.after}</span></> : it.after ? <span className="text-foreground">{it.after}</span> : it.label}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground/80">por {it.user || "—"}</p>
                  </li>
                );
              })}

              {/* PUNTO ACTIVO — acciones según rol y estado, donde "está esperando" */}
              {active && (canDeliver || canReviewHere) && (
                <li className="relative">
                  <span className="absolute -left-7 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-brand bg-surface-elevated text-brand ring-2 ring-surface-elevated">
                    <LucideIcon name="ArrowDown" className="h-3 w-3" strokeWidth={2.6} />
                  </span>
                  <div className="space-y-3 rounded-2xl border-2 border-dashed border-brand/30 bg-brand/[0.03] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand">
                        <LucideIcon name="Zap" className="h-3.5 w-3.5" /> Acción pendiente
                      </p>
                      {canDeliver && canReviewHere && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground" title="Tienes ambos roles en este pedido">
                          <LucideIcon name="ShieldCheck" className="h-3 w-3" /> Gestor (entregas y revisión)
                        </span>
                      )}
                      {canDeliver && !canReviewHere && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-pink/10 px-2 py-0.5 text-[10px] font-medium text-accent-pink"><LucideIcon name="Palette" className="h-3 w-3" /> Como diseñador</span>
                      )}
                      {!canDeliver && canReviewHere && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent-violet/10 px-2 py-0.5 text-[10px] font-medium text-accent-violet"><LucideIcon name="Inbox" className="h-3 w-3" /> Como solicitante</span>
                      )}
                    </div>

                    {/* Diseñador: subir entrega */}
                    {canDeliver && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-foreground">Subir entrega</p>
                        <Textarea value={delivNote} onChange={(e) => setDelivNote(e.target.value)} rows={2} placeholder="Nota de entrega: qué incluye esta versión…" className="bg-surface-elevated text-sm" />
                        <Input value={delivLink} onChange={(e) => setDelivLink(e.target.value)} placeholder="Enlace (Drive, Figma…) — opcional" className="h-8 bg-surface-elevated text-sm" />
                        <div className="flex justify-end"><Button size="sm" onClick={submitDelivery} className="h-8 gap-1.5"><LucideIcon name="Upload" className="h-3.5 w-3.5" /> Registrar entrega</Button></div>
                      </div>
                    )}

                    {/* Revisor: aprobar / rebotar — solo si hay entregas */}
                    {canReviewHere && nDeliv > 0 && (
                      <div className="space-y-2 border-t border-border/60 pt-2.5">
                        <p className="text-[11px] font-semibold text-foreground">Revisar la última entrega</p>
                        <Textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={2} placeholder="Comentario / feedback para el diseñador…" className="bg-surface-elevated text-sm" />
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => doReview("comment")} className="h-8 gap-1.5"><LucideIcon name="MessageCircle" className="h-3.5 w-3.5" /> Comentar</Button>
                          <Button variant="outline" size="sm" onClick={() => doReview("feedback")} className="h-8 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"><LucideIcon name="CornerUpLeft" className="h-3.5 w-3.5" /> Rebotar</Button>
                          <Button size="sm" onClick={() => doReview("approved")} className="h-8 gap-1.5 bg-accent-green text-white hover:bg-accent-green/90"><LucideIcon name="Check" className="h-3.5 w-3.5" /> Aprobar</Button>
                        </div>
                      </div>
                    )}
                    {canReviewHere && nDeliv === 0 && !canDeliver && (
                      <p className="text-[11.5px] text-muted-foreground">Esperando la primera entrega del diseñador para poder revisar.</p>
                    )}

                    {/* Gestión: cancelar */}
                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5">
                        <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo de cancelación (opcional)…" className="h-8 min-w-[160px] flex-1 bg-surface-elevated text-sm" />
                        <Button variant="outline" size="sm" onClick={() => { S.cancelDR(r.id, cancelReason); setCancelReason(""); toast("Pedido cancelado — registrado en la trazabilidad"); }} className="h-8 gap-1.5 whitespace-nowrap border-destructive/40 text-destructive hover:bg-destructive/10">
                          <LucideIcon name="Ban" className="h-3.5 w-3.5" /> Cancelar pedido
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              )}

              {/* Estado final: aprobado */}
              {r.status === "approved" && (
                <li className="relative">
                  <span className="absolute -left-7 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent-green text-white ring-2 ring-surface-elevated"><LucideIcon name="CheckCircle2" className="h-3 w-3" /></span>
                  <p className="flex items-center gap-1.5 rounded-lg bg-accent-green/10 px-3 py-2 text-[12px] font-medium text-accent-green"><LucideIcon name="CheckCircle2" className="h-4 w-4" /> Pedido aprobado y cerrado.</p>
                </li>
              )}

              {/* Estado final: cancelado, con opción de reactivar */}
              {r.status === "cancelled" && (
                <li className="relative">
                  <span className="absolute -left-7 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-muted-foreground/60 text-white ring-2 ring-surface-elevated"><LucideIcon name="Ban" className="h-3 w-3" /></span>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
                    <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-muted-foreground">Cancelado{r.cancelReason ? ` — “${r.cancelReason}”` : ""}. Al reactivar vuelve a su etapa previa.</p>
                    {canEdit && <Button size="sm" onClick={() => { S.reactivateDR(r.id); toast("Pedido reactivado"); }} className="h-8 gap-1.5 whitespace-nowrap"><LucideIcon name="RotateCcw" className="h-3.5 w-3.5" /> Reactivar</Button>}
                  </div>
                </li>
              )}
            </ol>

            {/* Entregas y revisiones detalladas (referencia, bajo el timeline) */}
            {(nDeliv > 0 || (r.reviews || []).length > 0) && (
              <div className="mt-6 space-y-3 border-t border-border/60 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Entregas y revisiones</p>
                {(r.deliveries || []).map((d, i) => (
                  <div key={d.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-foreground">Entrega v{i + 1}</span>
                      <span className="text-[10px] text-muted-foreground">{d.by} · {fmtDT(d.ts)}</span>
                    </div>
                    {d.note && <p className="mt-1 text-[12px] text-foreground">{d.note}</p>}
                    {(d.links || []).length > 0 && <div className="mt-1 flex flex-col gap-0.5">{d.links.map((l, j) => <a key={j} href={l} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline"><LucideIcon name="Link2" className="h-3 w-3" /> {l}</a>)}</div>}
                  </div>
                ))}
                {(r.reviews || []).map((v) => (
                  <div key={v.id} className={cn("rounded-xl border p-3", v.verdict === "approved" ? "border-accent-green/30 bg-accent-green/5" : v.verdict === "feedback" ? "border-destructive/30 bg-destructive/5" : "border-border bg-surface")}>
                    <div className="flex items-center justify-between">
                      <span className={cn("inline-flex items-center gap-1 text-[12px] font-semibold", v.verdict === "approved" ? "text-accent-green" : v.verdict === "feedback" ? "text-destructive" : "text-foreground")}>
                        <LucideIcon name={v.verdict === "approved" ? "CheckCircle2" : v.verdict === "feedback" ? "MessageSquareWarning" : "MessageCircle"} className="h-3.5 w-3.5" />
                        {v.verdict === "approved" ? "Aprobado" : v.verdict === "feedback" ? "Con feedback" : "Comentario"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{v.by} · {fmtDT(v.ts)}</span>
                    </div>
                    {v.comment && <p className="mt-1 text-[12px] text-foreground">{v.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function Field({ label, children }) {
    return <div className="space-y-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>{children}</div>;
  }

  /* ============ Page ============ */
  /* ============ Gestor de tipos de solicitud (lista editable) — BUG-3DD4 ============ */
  function TypesManagerModal({ onClose }) {
    const types = S.useDRTypes();
    const [items, setItems] = useState(types.slice());
    const [draft, setDraft] = useState("");
    const add = () => { const t = draft.trim(); if (!t) return; if (items.some((x) => x.toLowerCase() === t.toLowerCase())) { toast("Ese tipo ya existe"); return; } setItems([...items, t]); setDraft(""); };
    const del = (i) => setItems(items.filter((_, idx) => idx !== i));
    const move = (i, d) => { const a = items.slice(); const j = i + d; if (j < 0 || j >= a.length) return; const t = a[i]; a[i] = a[j]; a[j] = t; setItems(a); };
    const save = () => { S.writeDRTypes(items); toast("Tipos de solicitud actualizados"); onClose(); };
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[2px]" role="dialog" aria-label="Tipos de solicitud"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-3xl border border-border bg-surface-elevated shadow-elevated">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-pink/10 text-accent-pink"><LucideIcon name="Tags" className="h-5 w-5" /></span>
              <h3 className="text-[15px] font-semibold text-foreground">Tipos de solicitud</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface"><LucideIcon name="X" className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-5 py-3">
            {items.map((t, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface/40 px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{t}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface disabled:opacity-30"><LucideIcon name="ChevronUp" className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-surface disabled:opacity-30"><LucideIcon name="ChevronDown" className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => del(i)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><LucideIcon name="Trash2" className="h-3 w-3" /></button>
              </div>
            ))}
            {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Sin tipos. Agrega al menos uno.</p>}
          </div>
          <div className="border-t border-border/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Nuevo tipo (ej. Tótem, Valla…)" className="h-9 flex-1 bg-surface text-sm" />
              <Button variant="outline" size="sm" onClick={add} className="h-9 gap-1"><LucideIcon name="Plus" className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={save} className="gap-1.5"><LucideIcon name="Check" className="h-3.5 w-3.5" /> Guardar</Button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  function DesignRequestsPage() {
    const requests = S.useDesignRequests();
    const canEdit = S.useCan("editTasks") || S.useCan("createTasks");
    const canCreate = S.useCan("createTasks");
    const canReview = S.useCan("editCampaigns") || S.useCan("editTasks");
    const session = S.useSession();
    const myName = session && session.name;
    const [view, setView] = useState("tracking"); // tracking | board | list
    const [persp, setPersp] = useState("all"); // all | designer | requester
    const [form, setForm] = useState(null); // null | {} | request
    const [detail, setDetail] = useState(null); // request id
    const [typesOpen, setTypesOpen] = useState(false);
    const [statusF, setStatusF] = useState("all");
    const [query, setQuery] = useState("");

    React.useEffect(() => { window.__drEdit = (r) => { setDetail(null); setForm(r); }; return () => { delete window.__drEdit; }; }, []);

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      return requests.filter((r) => {
        if (persp === "designer" && r.designer !== myName) return false;
        if (persp === "requester" && r.requester !== myName) return false;
        if (statusF !== "all" && r.status !== statusF) return false;
        if (q && !(r.title.toLowerCase().includes(q) || (r.designer || "").toLowerCase().includes(q) || (r.type || "").toLowerCase().includes(q))) return false;
        return true;
      });
    }, [requests, statusF, query, persp, myName]);
    const mineAsDesigner = useMemo(() => requests.filter((r) => r.designer === myName).length, [requests, myName]);
    const mineAsRequester = useMemo(() => requests.filter((r) => r.requester === myName).length, [requests, myName]);

    const counts = useMemo(() => {
      const c = { all: requests.length };
      S.DR_STATUS_ORDER.forEach((s) => c[s] = 0);
      requests.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
      return c;
    }, [requests]);

    const detailReq = detail ? requests.find((r) => r.id === detail) : null;
    const COLUMNS = ["pending", "in_design", "in_review", "approved", "feedback", "cancelled"];

    return (
      <div className="min-h-screen bg-background" data-screen-label="Solicitudes de diseño">
        <window.SectionWash accent="pink" />
        <main className="mx-auto w-full max-w-7xl px-4 pb-6 pt-0 sm:px-6 sm:pb-8 lg:px-8">
          <window.PageToolbar back="#/">
            <div className="inline-flex rounded-full border border-border bg-surface-elevated p-0.5">
              {[["tracking", "PackageSearch", "Tracking"], ["board", "LayoutGrid", "Tablero"], ["list", "List", "Lista"]].map(([v, ic, lb]) => (
                <button key={v} type="button" onClick={() => setView(v)} className={cn("flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors", view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                  <LucideIcon name={ic} className="h-3.5 w-3.5" /> {lb}
                </button>
              ))}
            </div>
            {canCreate && <Button size="sm" onClick={() => setForm({})} className="h-9 gap-1.5"><LucideIcon name="Plus" className="h-4 w-4" /> Nueva solicitud</Button>}
          </window.PageToolbar>

          {/* Perspectiva: cada quien ve su lado del pedido (BUG-E77E) */}
          {myName && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-full border border-border bg-surface-elevated p-0.5">
                {[["all", "Layers", "Todas", requests.length],
                  ["designer", "Palette", "Soy diseñador", mineAsDesigner],
                  ["requester", "Inbox", "Soy solicitante", mineAsRequester]].map(([k, ic, lb, n]) => (
                  <button key={k} type="button" onClick={() => setPersp(k)}
                    className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors", persp === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                    <LucideIcon name={ic} className="h-3.5 w-3.5" /> {lb} <span className={cn("tabular-nums", persp === k ? "opacity-80" : "opacity-60")}>{n}</span>
                  </button>
                ))}
              </div>
              {persp !== "all" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] text-muted-foreground">
                  <LucideIcon name={persp === "designer" ? "Palette" : "Inbox"} className="h-3 w-3" />
                  {persp === "designer" ? "Pedidos donde tú diseñas — enfócate en entregar y mover el estatus." : "Tus pedidos — sigue tiempos, estado y comentarios."}
                </span>
              )}
              {canCreate && (
                <button type="button" onClick={() => setTypesOpen(true)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  <LucideIcon name="Tags" className="h-3.5 w-3.5" /> Tipos de solicitud
                </button>
              )}
            </div>
          )}
          {typesOpen && <TypesManagerModal onClose={() => setTypesOpen(false)} />}

          <window.SectionHeader accent="pink" icon="Palette" title="Solicitudes de diseño" subtitle="Tracking de pedidos: del requerimiento a la aprobación, con trazabilidad completa." />

          {/* Pipeline centralizado (visibilidad del avance de todos los pedidos) */}
          {view === "tracking" && <PipelineStrip counts={counts} statusF={statusF} setStatusF={setStatusF} />}

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative">
              <LucideIcon name="Search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar título, diseñador, tipo…" className="!h-8 !rounded-full w-56 pl-8 text-sm" />
            </div>
            {view !== "tracking" && (
            <div className="flex flex-wrap gap-1">
              <FilterChip active={statusF === "all"} onClick={() => setStatusF("all")} label="Todas" count={counts.all} />
              {S.DR_STATUS_ORDER.map((s) => <FilterChip key={s} active={statusF === s} onClick={() => setStatusF(s)} label={S.DR_STATUS[s].label} count={counts[s]} dot={S.DR_STATUS[s].dot} />)}
            </div>
            )}
            {view === "tracking" && statusF !== "all" && (
              <button type="button" onClick={() => setStatusF("all")} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                <LucideIcon name="X" className="h-3 w-3" /> Quitar filtro · {S.DR_STATUS[statusF].label}
              </button>
            )}
          </div>

          {/* Tracking (vista principal) */}
          {view === "tracking" ? (
            filtered.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-14 text-center text-sm text-muted-foreground">Sin pedidos para este filtro.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {[...filtered].sort((a, b) => {
                  const O = { feedback: 0, in_review: 1, delivered: 2, in_design: 3, pending: 4, approved: 5, cancelled: 6 };
                  const d = (O[a.status] ?? 9) - (O[b.status] ?? 9);
                  if (d) return d;
                  if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
                  if (a.deadline) return -1; if (b.deadline) return 1;
                  return (b.createdAt || 0) - (a.createdAt || 0);
                }).map((r) => <TrackingCard key={r.id} r={r} onOpen={() => setDetail(r.id)} />)}
              </div>
            )
          ) : view === "board" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {COLUMNS.map((col) => {
                const m = S.DR_STATUS[col];
                const cards = filtered.filter((r) => r.status === col);
                return (
                  <div key={col} className="flex flex-col rounded-2xl border border-border/70 bg-surface/50 p-2">
                    <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground"><span className={cn("h-2 w-2 rounded-full", m.dot)} /> {m.label}</span>
                      <span className="rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{cards.length}</span>
                    </div>
                    <div className="space-y-2">
                      {cards.length === 0 && <p className="px-1.5 py-3 text-center text-[11px] text-muted-foreground/70">—</p>}
                      {cards.map((r) => <BoardCard key={r.id} r={r} onOpen={() => setDetail(r.id)} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface-elevated">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Requerimiento</th>
                    <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
                    <th className="px-3 py-2.5 text-left font-medium">Prioridad</th>
                    <th className="px-3 py-2.5 text-left font-medium">Diseñador</th>
                    <th className="px-3 py-2.5 text-left font-medium">Deadline</th>
                    <th className="px-3 py-2.5 text-left font-medium">Estado</th>
                    <th className="w-8 px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-muted-foreground">Sin solicitudes para este filtro.</td></tr>}
                  {filtered.map((r) => (
                    <tr key={r.id} className="cursor-pointer border-t border-border/60 transition-colors hover:bg-surface/60" onClick={() => setDetail(r.id)}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {r.locked && <LucideIcon name="Lock" className="h-3 w-3 shrink-0 text-accent-violet" />}
                          <span className="font-medium text-foreground">{r.title}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{(r.deliveries || []).length} entrega(s) · {(r.log || []).length} eventos</span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-muted-foreground">{r.type}</td>
                      <td className="px-3 py-2.5"><PriorityTag p={r.priority} /></td>
                      <td className="px-3 py-2.5 text-[12px] text-foreground">{r.designer || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2.5"><DeadlinePill deadline={r.deadline} status={r.status} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2.5 text-right"><LucideIcon name="ChevronRight" className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <footer className="mt-10 border-t border-border pt-5 text-center text-xs text-muted-foreground">
            Gestión de solicitudes de diseño · {requests.length} requerimientos · Trazabilidad completa
          </footer>
        </main>

        {form && <RequestForm initial={form.id ? form : null} onClose={() => setForm(null)} />}
        {detailReq && <DetailPanel req={detailReq} persp={persp} onClose={() => setDetail(null)} canEdit={canEdit} canReview={canReview} />}
      </div>
    );
  }

  function FilterChip({ active, onClick, label, count, dot }) {
    return (
      <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", active ? "border-foreground bg-foreground text-background" : "border-border bg-surface-elevated text-muted-foreground hover:text-foreground")}>
        {dot && <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-background" : dot)} />} {label}
        <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground/70")}>{count}</span>
      </button>
    );
  }

  function BoardCard({ r, onOpen }) {
    return (
      <button type="button" onClick={onOpen} className="w-full rounded-xl border border-border bg-surface-elevated p-2.5 text-left shadow-sm transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-[12.5px] font-semibold leading-snug text-foreground">{r.title}</p>
          {r.locked && <LucideIcon name="Lock" className="mt-0.5 h-3 w-3 shrink-0 text-accent-violet" />}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">{r.type}</p>
        <div className="mt-2 flex items-center justify-between">
          <PriorityTag p={r.priority} />
          <DeadlinePill deadline={r.deadline} status={r.status} />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <LucideIcon name="User" className="h-3 w-3" /> {r.designer || "Sin asignar"}
          </span>
          {(r.deliveries || []).length > 0 && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><LucideIcon name="Upload" className="h-3 w-3" /> {r.deliveries.length}</span>}
        </div>
      </button>
    );
  }

  window.DesignRequestsPage = DesignRequestsPage;
})();
