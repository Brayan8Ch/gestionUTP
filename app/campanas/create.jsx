/* Create modals — new period and new campaign master. */
(function () {
  const React = window.React;
  const { useState } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Textarea, Label, toast } = window;
  const cn = window.cn;

  function ModalShell({ title, eyebrow, icon, accent = "brand", onClose, children, footer }) {
    const tone = { brand: "bg-brand/10 text-brand", violet: "bg-accent-violet/10 text-accent-violet", green: "bg-accent-green/10 text-accent-green" }[accent];
    /* Portal al body: si el modal queda dentro de un ancestro con transform (p.ej. una
       card con hover:-translate-y), el position:fixed se re-ancla a la card y parpadea. */
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tone)}><LucideIcon name={icon} className="h-4 w-4" /></div>
              <div className="min-w-0">
                {eyebrow && <p className="mb-0.5 text-[10px] font-medium uppercase leading-none tracking-wider text-muted-foreground">{eyebrow}</p>}
                <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">{title}</h2>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar" title="Cerrar" className="h-8 w-8 text-muted-foreground"><LucideIcon name="X" className="h-4 w-4" /></Button>
          </div>
          {children}
          <div className="mt-5 flex justify-end gap-2">{footer}</div>
        </div>
      </div>,
      document.body
    );
  }

  /* ---------------- New period ---------------- */
  function NewPeriodModal({ onClose }) {
    const periods = S.listAvailablePeriods();
    const years = periods.map((p) => Number(p.split("-")[0])).filter(Boolean);
    const defYear = years.length ? Math.max(...years) : new Date().getFullYear();
    const [year, setYear] = useState(String(defYear));
    const [num, setNum] = useState("");
    const period = `${year}-${num}`;
    const valid = /^\d{4}$/.test(year) && /^[1-9]\d?$/.test(num);
    const exists = periods.includes(period);

    const create = () => {
      if (!valid || exists) return;
      S.addPeriod(period);
      S.writeCurrentPeriod(period);
      toast(`Periodo ${S.formatPeriodLabel(period)} creado`);
      onClose();
    };

    return (
      <ModalShell title="Nuevo periodo" eyebrow="Crear" icon="CalendarRange" accent="brand" onClose={onClose}
        footer={<>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={create} disabled={!valid || exists} className="gap-1.5"><LucideIcon name="Check" className="h-4 w-4" /> Crear periodo</Button>
        </>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Año</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="h-9 bg-surface tabular-nums" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Periodo Nº</Label>
              <Input type="number" min="1" value={num} onChange={(e) => setNum(e.target.value)} placeholder="Ej. 4" className="h-9 bg-surface tabular-nums" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3 text-xs">
            <span className="text-muted-foreground">Identificador: </span>
            <span className="font-medium text-foreground">{valid ? period : "—"}</span>
            {exists && <span className="ml-2 text-destructive">Ya existe</span>}
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Periodos existentes</p>
            <div className="flex flex-wrap gap-1.5">
              {periods.map((p) => <span key={p} className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{p}</span>)}
            </div>
          </div>
        </div>
      </ModalShell>
    );
  }

  /* ---------------- New campaign ---------------- */
  const ICONS = ["Megaphone", "Target", "Rocket", "Wallet", "Users", "BookOpen", "GraduationCap", "Bell", "Mail", "CalendarRange", "Flag", "Star", "Briefcase", "HeartHandshake", "LifeBuoy", "Compass"];
  const ACCENTS = [
    ["brand", "bg-brand/10 text-brand", "bg-brand"],
    ["violet", "bg-accent-violet/10 text-accent-violet", "bg-accent-violet"],
    ["pink", "bg-accent-pink/10 text-accent-pink", "bg-accent-pink"],
    ["amber", "bg-accent-amber/15 text-accent-amber", "bg-accent-amber"],
    ["green", "bg-accent-green/10 text-accent-green", "bg-accent-green"],
  ];

  function CampaignFormModal({ campaign, onClose }) {
    const editing = !!campaign;
    const [title, setTitle] = useState(editing ? campaign.title : "");
    const [description, setDescription] = useState(editing ? (campaign.description || "") : "");
    const [icon, setIcon] = useState(editing ? (campaign.icon || "Megaphone") : "Megaphone");
    const [accent, setAccent] = useState(editing ? (campaign.accent || "brand") : "brand");
    const accentTone = (ACCENTS.find((a) => a[0] === accent) || ACCENTS[0])[1];
    const valid = title.trim().length > 1;

    const submit = () => {
      if (!valid) return;
      if (editing) {
        S.updateCampaign(campaign.slug, { title, description, icon, accent });
        toast(`Campaña “${title.trim()}” actualizada`);
      } else {
        S.createCampaign({ title, description, icon, accent });
        toast(`Campaña “${title.trim()}” creada`);
      }
      onClose();
    };

    return (
      <ModalShell
        title={editing ? "Editar campaña" : "Nueva campaña"}
        eyebrow="Módulo maestro"
        icon={editing ? "Pencil" : "Plus"} accent="violet" onClose={onClose}
        footer={<>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={!valid} className="gap-1.5"><LucideIcon name="Check" className="h-4 w-4" /> {editing ? "Guardar cambios" : "Crear campaña"}</Button>
        </>}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", accentTone)}>
              <LucideIcon name={icon} className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Nombre de la campaña</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Cobranzas" className="h-9 bg-surface" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="¿De qué trata esta campaña?" className="min-h-[56px] resize-none bg-surface text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Color</Label>
            <div className="flex gap-2">
              {ACCENTS.map(([key, , dot]) => (
                <button key={key} type="button" onClick={() => setAccent(key)}
                  className={cn("flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110", accent === key && "ring-2 ring-foreground/30 ring-offset-2 ring-offset-surface-elevated")}>
                  <span className={cn("h-5 w-5 rounded-full", dot)} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Icono</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICONS.map((n) => (
                <button key={n} type="button" onClick={() => setIcon(n)}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-lg border transition-colors", icon === n ? "border-brand bg-brand/5 text-brand" : "border-border bg-surface text-muted-foreground hover:text-foreground")}>
                  <LucideIcon name={n} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
          {!editing && <p className="text-[10px] text-muted-foreground">Quedará como módulo permanente. Configúrala por periodo desde su tarjeta.</p>}
        </div>
      </ModalShell>
    );
  }

  function NewCampaignModal({ onClose }) { return <CampaignFormModal onClose={onClose} />; }
  function EditCampaignModal({ campaign, onClose }) { return <CampaignFormModal campaign={campaign} onClose={onClose} />; }

  /* ---------------- Delete campaign confirmation ---------------- */
  function DeleteCampaignModal({ campaign, onClose }) {
    const remove = () => {
      S.removeCampaign(campaign.slug);
      toast(`Campaña “${campaign.title}” eliminada`);
      onClose();
    };
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><LucideIcon name="Trash2" className="h-4 w-4" /></div>
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase leading-none tracking-wider text-muted-foreground">Eliminar campaña</p>
              <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">{campaign.title}</h2>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Se quitará “{campaign.title}” del listado de campañas. Sus configuraciones por periodo dejarán de mostrarse.
            {campaign.custom ? " Esta acción no se puede deshacer." : " Es una campaña base; podrás restaurarla creándola de nuevo."}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={remove} className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <LucideIcon name="Trash2" className="h-4 w-4" /> Eliminar
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  Object.assign(window, { NewPeriodModal, NewCampaignModal, EditCampaignModal, DeleteCampaignModal });
})();
