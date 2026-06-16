/* Home screen — campaign grid, period selector. Ported from index.tsx + CampaignGrid.tsx */
(function () {
  const React = window.React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Popover, toast } = window;
  const cn = window.cn;

  const ACCENT = {
    brand: { base: "bg-brand/10 text-brand", hover: "group-hover:bg-brand/15" },
    violet: { base: "bg-accent-violet/10 text-accent-violet", hover: "group-hover:bg-accent-violet/15" },
    pink: { base: "bg-accent-pink/10 text-accent-pink", hover: "group-hover:bg-accent-pink/15" },
    amber: { base: "bg-accent-amber/15 text-accent-amber", hover: "group-hover:bg-accent-amber/20" },
    green: { base: "bg-accent-green/10 text-accent-green", hover: "group-hover:bg-accent-green/15" }
  };
  const ACCENT_TEXT = { brand: "text-brand", violet: "text-accent-violet", pink: "text-accent-pink", amber: "text-accent-amber", green: "text-accent-green" };

  function CampaignCard({ campaign, period }) {
    const { slug, title, description, icon, accent } = campaign;
    const a = ACCENT[accent] || ACCENT.brand;
    const aText = ACCENT_TEXT[accent] || "text-brand";
    const links = S.useCampaignLinks(slug, period);
    const progress = S.useOperativeProgress(slug, period);
    const configured = S.useConfigured(slug, period);
    const meta = S.useConfigMeta(slug, period);
    const st = S.useCampaignStatus(slug, period);
    const prevPeriod = configured ? null : S.getPreviousConfiguredPeriod(slug, period);
    const [setup, setSetup] = React.useState(null); // null | "duplicate" | "scratch"
    const [editing, setEditing] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const canEditCampaign = S.useCan("editCampaigns");
    const canDeleteCampaign = S.useCan("deleteCampaigns");
    const showMenu = canEditCampaign || canDeleteCampaign;

    return (
      <div className={cn("group relative flex min-h-[268px] flex-col rounded-2xl border border-border/60 bg-surface-elevated p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-300 ease-glide hover:-translate-y-0.5 hover:border-border hover:shadow-md", !configured && "bg-surface/40")}>
        {/* Cabecera: ícono · (estado + periodo + menú) */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <LucideIcon name={icon} className={cn("h-7 w-7 shrink-0", aText, !configured && "opacity-50")} strokeWidth={1.75} />
          <div className="flex shrink-0 items-center gap-1.5">
            {configured && (
              <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium", st.soft)} title={st.label}>
                <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} /> {st.label}
              </span>
            )}
            <span className="whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {S.formatPeriodShort(period)}
            </span>
            <Popover align="end" width="w-40" trigger={
            <button type="button" aria-label="Opciones de campaña"
            className={cn("h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color,color] hover:bg-surface hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100", showMenu ? "flex" : "hidden")}>
                <LucideIcon name="MoreHorizontal" className="h-4 w-4" />
              </button>
            }>
              {(setOpen) =>
              <div className="space-y-0.5">
                  {canEditCampaign &&
                <button type="button" onClick={() => {setOpen(false);setEditing(true);}}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent">
                      <LucideIcon name="Pencil" className="h-3.5 w-3.5 text-muted-foreground" /> Editar
                    </button>
                }
                  {canDeleteCampaign &&
                <button type="button" onClick={() => {setOpen(false);setDeleting(true);}}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10">
                      <LucideIcon name="Trash2" className="h-3.5 w-3.5" /> Eliminar
                    </button>
                }
                </div>
              }
            </Popover>
          </div>
        </div>

        {/* Título destacado + descripción discreta y acotada (no descuadra las cards) */}
        <h3 className={cn("text-[17px] font-semibold leading-snug tracking-tight", configured ? aText : "text-muted-foreground")}>{title}</h3>
        {description && (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground" title={description}>{description}</p>
        )}

        <div className="mt-3 flex-grow">
          {configured ?
          <div className="mb-4 space-y-2.5">
              {progress.total > 0 &&
            <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="whitespace-nowrap">Avance · {progress.done}/{progress.total}</span>
                    <span className="tabular-nums font-medium text-foreground">{progress.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <div className="h-full w-full origin-left rounded-full bg-foreground/25 transition-transform duration-300 ease-glide" style={{ transform: `scaleX(${(progress.percent || 0) / 100})` }} />
                  </div>
                </div>
            }
              {/* Responsable + supervisor: en su propia fila, debajo (BUG estética) */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                {meta.responsable ?
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[8px] font-semibold text-muted-foreground">{meta.responsable.slice(0, 1).toUpperCase()}</span>
                    <span className="font-medium text-foreground">{meta.responsable}</span>
                  </span> :
              <span className="text-muted-foreground/70">Sin responsable</span>
              }
                {meta.supervisor &&
              <span className="inline-flex items-center gap-1.5 text-muted-foreground" title="Supervisor / aprobador">
                    <LucideIcon name="ShieldCheck" className="h-3 w-3" />
                    <span className="font-medium text-foreground">{meta.supervisor}</span>
                  </span>
              }
              </div>
              {meta.updatedAt &&
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                  <LucideIcon name="Clock" className="h-3 w-3" /> Última modificación · {window.fmtDateShort(meta.updatedAt)}
                </p>
            }
            </div> :

          <div className="mb-4 rounded-xl border border-dashed border-border bg-surface/70 p-3.5">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <LucideIcon name="Power" className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground/80">Sin habilitar</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">Configura esta campaña para {S.formatPeriodShort(period)}.</p>
                </div>
              </div>
              <button type="button" onClick={() => setSetup(prevPeriod ? "duplicate" : "scratch")} disabled={!canEditCampaign}
            className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-foreground px-3 py-2 text-xs font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40">
                <LucideIcon name={canEditCampaign ? "Settings2" : "Lock"} className="h-3.5 w-3.5" />
                {canEditCampaign ? "Habilitar campaña" : "Sin permisos para habilitar"}
              </button>
              {prevPeriod && canEditCampaign &&
            <button type="button" onClick={() => setSetup("duplicate")}
            className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <LucideIcon name="Copy" className="h-3 w-3" />
                  Duplicar desde {S.formatPeriodShort(prevPeriod)}
                </button>
            }
            </div>
          }
        </div>

        {configured &&
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-border/60 pt-4">
            <div className="flex shrink-0 items-center gap-1">
              {links.canva &&
            <a href={links.canva} target="_blank" rel="noopener noreferrer" title="Abrir Canva"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">
                  <LucideIcon name="Puzzle" className="h-4 w-4" />
                </a>
            }
              {links.dropbox &&
            <a href={links.dropbox} target="_blank" rel="noopener noreferrer" title="Abrir Dropbox"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">
                  <LucideIcon name="ExternalLink" className="h-4 w-4" />
                </a>
            }
              {!links.canva && !links.dropbox &&
            <span className="text-[12px] font-medium text-muted-foreground">Ingresar a la campaña</span>
            }
            </div>
            <a href={`#/brief/${slug}?p=${period}`} aria-label="Ingresar a la campaña" title="Ingresar a la campaña"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform duration-200 group-hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
              <LucideIcon name="ArrowRight" className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
          </div>
        }

        {setup &&
        <window.SetupModal slug={slug} period={period} prevPeriod={prevPeriod} defaultMode={setup} onClose={() => setSetup(null)} />
        }
        {editing && <window.EditCampaignModal campaign={campaign} onClose={() => setEditing(false)} />}
        {deleting && <window.DeleteCampaignModal campaign={campaign} onClose={() => setDeleting(false)} />}
      </div>);

  }

  function CampaignGrid({ query }) {
    const sel = S.useSelectedPeriods("all");
    const selPeriods = sel.periods;
    const campaigns = S.useCampaigns();
    const nq = (query || "").trim().toLowerCase();
    const visible = nq ? campaigns.filter((c) => `${c.title} ${c.description || ""}`.toLowerCase().includes(nq)) : campaigns;
    if (nq && visible.length === 0) {
      return <p className="rounded-2xl border border-dashed border-border bg-surface/50 px-4 py-12 text-center text-sm text-muted-foreground">Ninguna campaña coincide con “{query.trim()}”.</p>;
    }
    if (selPeriods.length === 1) {
      const period = selPeriods[0];
      return (
        <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {visible.map((c) => <CampaignCard key={`${c.slug}-${period}`} campaign={c} period={period} />)}
        </div>
      );
    }
    /* Varios periodos: agrupa por periodo (más reciente primero). Cada grupo
       muestra TODAS las campañas: primero las habilitadas y luego, en gris,
       las que aún no se configuran en ese periodo (con su botón de habilitar
       o duplicar). Así siempre se ve el estado real de cada campaña en cada
       periodo seleccionado. */
    const groups = [...selPeriods].reverse().map((p) => {
      const on = visible.filter((c) => S.isCampaignConfigured(c.slug, p));
      const off = visible.filter((c) => !S.isCampaignConfigured(c.slug, p));
      return { p, items: [...on, ...off], on: on.length };
    });
    return (
      <div className="space-y-10">
        {groups.map((g) => (
          <section key={g.p} aria-label={`Periodo ${S.formatPeriodLabel(g.p)}`}>
            <div className="mb-4 flex items-center gap-2.5">
              <h2 className="text-[15px] font-bold tracking-tight text-foreground tabular-nums">{S.formatPeriodLabel(g.p)}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground" title={`${g.on} de ${g.items.length} campañas habilitadas en este periodo`}>
                {g.on}/{g.items.length} habilitadas
              </span>
              <span className="h-px flex-1 bg-border/70"></span>
            </div>
            <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {g.items.map((c) => <CampaignCard key={`${c.slug}-${g.p}`} campaign={c} period={g.p} />)}
            </div>
          </section>
        ))}
      </div>
    );
  }

  function HomePage() {
    const [modal, setModal] = React.useState(null); // null | "period" | "campaign"
    const [query, setQuery] = React.useState("");
    const canCreateCampaign = S.useCan("createCampaigns");
    const canManagePeriods = S.useCan("managePeriods");
    const fileRef = React.useRef(null);
    const onImportFile = (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const res = S.importCampaignData(JSON.parse(reader.result));
          if (res.ok) toast(`Campaña ${res.existed ? "actualizada" : "importada"}: ${res.title} · ${res.period}`);else
          toast(res.error);
        } catch {toast("No se pudo leer el archivo: no es un .json válido.");}
      };
      reader.readAsText(f);
    };
    return (
      <div className="min-h-screen bg-background" data-screen-label="Inicio · Campañas">
        <window.SectionWash accent="brand" />
        <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-0 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12">
          <window.PageToolbar back="#/" left={
            <div className="relative w-52">
              <LucideIcon name="Search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Buscar campaña…" aria-label="Buscar campaña" className="!h-9 !rounded-full pl-8 text-sm" />
            </div>
          }>
            <window.PeriodFilter />
            {canCreateCampaign &&
            <button type="button" onClick={() => fileRef.current && fileRef.current.click()} title="Importar campaña desde un archivo .json exportado"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-medium shadow-soft transition-colors hover:border-foreground/30 hover:bg-surface">
                <LucideIcon name="Upload" className="h-4 w-4 text-muted-foreground" />
                Importar
              </button>
            }
            {canCreateCampaign && <input ref={fileRef} type="file" accept=".json,application/json" onChange={onImportFile} className="hidden" />}
            {canCreateCampaign &&
            <button type="button" onClick={() => setModal("manage")} title="Agregar o quitar campañas del periodo o por completo"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-medium shadow-soft transition-colors hover:border-foreground/30 hover:bg-surface">
                <LucideIcon name="Settings2" className="h-4 w-4 text-muted-foreground" />
                Gestionar
              </button>
            }
            {canCreateCampaign &&
            <button type="button" onClick={() => setModal("campaign")}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground shadow-elevated transition-colors hover:bg-brand/90">
                <LucideIcon name="Plus" className="h-4 w-4" />
                Nueva campaña
              </button>
            }
          </window.PageToolbar>
          <window.SectionHeader accent="brand" icon="Megaphone" size="lg" className="mb-8 sm:mb-10" title="Campañas" subtitle="Selecciona una campaña para abrir su brief." />

          <CampaignGrid query={query} />

          <footer className="mt-16 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            Workspace de Campañas · {new Date().getFullYear()}
          </footer>
        </main>

        {modal === "campaign" && <window.NewCampaignModal onClose={() => setModal(null)} />}
        {modal === "manage" && <ManageCampaignsModal onClose={() => setModal(null)} />}
      </div>);

  }

  /* ===== Gestor de campañas (BUG-A26A) =====
     Permite quitar una campaña SOLO del periodo activo (unmarkCampaignConfigured,
     conserva el catálogo y otros periodos) o eliminarla por completo del catálogo
     (removeCampaign). Ambas acciones piden confirmación. */
  function ManageCampaignsModal({ onClose }) {
    const ReactDOM = window.ReactDOM;
    const campaigns = S.useCampaigns();
    const [period] = S.useCurrentPeriod();
    S.useConfigured();
    const canDelete = S.useCan("deleteCampaigns") || S.useCan("editCampaigns");
    const [confirm, setConfirm] = React.useState(null); // { campaign, scope: "period"|"all" }

    const list = campaigns.slice().sort((a, b) => (a.title || "").localeCompare(b.title || ""));

    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface-elevated shadow-elevated">
          <div className="flex items-start justify-between gap-3 border-b border-border/60 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand"><LucideIcon name="Settings2" className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="mb-0.5 text-[10px] font-medium uppercase leading-none tracking-wider text-muted-foreground">Periodo {S.formatPeriodLabel(period)}</p>
                <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">Gestionar campañas</h2>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface"><LucideIcon name="X" className="h-4 w-4" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p className="px-2 pb-2 pt-1 text-[11.5px] text-muted-foreground">
              <span className="font-medium text-foreground">Quitar del periodo</span> deja la campaña en el catálogo y otros periodos.
              <span className="font-medium text-foreground"> Eliminar</span> la borra por completo.
            </p>
            <ul className="space-y-1">
              {list.map((c) => {
                const inPeriod = S.isCampaignConfigured(c.slug, period);
                const periodsCount = S.getConfiguredPeriods(c.slug).length;
                return (
                  <li key={c.slug} className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface/40 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{c.title}</p>
                      <p className="text-[10.5px] text-muted-foreground">
                        {inPeriod ? "Activa en este periodo" : "No está en este periodo"}
                        {periodsCount > 0 && ` · en ${periodsCount} periodo${periodsCount === 1 ? "" : "s"}`}
                        {c.custom && " · personalizada"}
                      </p>
                    </div>
                    {canDelete && (
                      <div className="flex shrink-0 items-center gap-1">
                        {inPeriod && (
                          <button type="button" onClick={() => setConfirm({ campaign: c, scope: "period" })}
                            className="rounded-full border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-accent-amber/50 hover:text-accent-amber">
                            Quitar del periodo
                          </button>
                        )}
                        <button type="button" onClick={() => setConfirm({ campaign: c, scope: "all" })}
                          title="Eliminar la campaña por completo"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                          <LucideIcon name="Trash2" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
              {list.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">No hay campañas en el catálogo.</li>}
            </ul>
          </div>
        </div>

        {confirm && window.ConfirmDelete && (
          <window.ConfirmDelete
            title={confirm.scope === "period" ? "Quitar campaña del periodo" : "Eliminar campaña por completo"}
            itemLabel={confirm.campaign.title}
            message={confirm.scope === "period"
              ? `Se quitará «${confirm.campaign.title}» del periodo ${S.formatPeriodLabel(period)}. Sus datos en otros periodos y el catálogo se conservan. Podrás volver a habilitarla cuando quieras.`
              : `Se eliminará «${confirm.campaign.title}» por completo del catálogo y de todos los periodos. Esta acción no se puede deshacer.`}
            confirmLabel={confirm.scope === "period" ? "Quitar del periodo" : "Eliminar definitivamente"}
            onConfirm={() => {
              if (confirm.scope === "period") { S.unmarkCampaignConfigured(confirm.campaign.slug, period); window.toast && window.toast("Campaña quitada del periodo"); }
              else { S.removeCampaign(confirm.campaign.slug); window.toast && window.toast("Campaña eliminada"); }
              setConfirm(null);
            }}
            onClose={() => setConfirm(null)} />
        )}
      </div>,
      document.body
    );
  }

  Object.assign(window, { HomePage });
})();