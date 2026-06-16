/* Miembros y permisos — member directory + RBAC roles & permission editor. */
(function () {
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useState } = React;
  const S = window.Store;
  const { LucideIcon, Button, Input, Label, toast, Checkbox } = window;
  const cn = window.cn;

  const ROLE_TONE = {
    admin: "bg-brand/10 text-brand",
    editor: "bg-accent-violet/10 text-accent-violet",
    viewer: "bg-muted text-muted-foreground",
  };
  /* Paleta de colores asignables a cada rol (campo tone del rol). */
  const ROLE_TONES = {
    brand: ["bg-brand/10 text-brand", "bg-brand"],
    violet: ["bg-accent-violet/10 text-accent-violet", "bg-accent-violet"],
    pink: ["bg-accent-pink/10 text-accent-pink", "bg-accent-pink"],
    amber: ["bg-accent-amber/15 text-accent-amber", "bg-accent-amber"],
    green: ["bg-accent-green/10 text-accent-green", "bg-accent-green"],
    slate: ["bg-muted text-muted-foreground", "bg-muted-foreground/60"],
  };
  const roleTone = (k) => {
    try { const r = S.readRoles()[k]; if (r && r.tone && ROLE_TONES[r.tone]) return ROLE_TONES[r.tone][0]; } catch {}
    return ROLE_TONE[k] || "bg-accent-green/10 text-accent-green";
  };

  /* ---------------- Switch ---------------- */
  function Switch({ checked, onChange, disabled }) {
    return (
      <button type="button" role="switch" aria-checked={!!checked} disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40",
          checked ? "bg-foreground" : "bg-border"
        )}>
        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-surface-elevated shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    );
  }

  /* ---------------- Acting-as role switcher (session-aware) ---------------- */
  function ActingAs() {
    const roles = S.useRoles();
    const [current, setCurrent] = S.useCurrentRole();
    const session = S.useSession();
    if (session) {
      const roleLabel = ((roles.find((r) => r.key === session.role) || {}).label) || session.role;
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated py-1 pl-1 pr-1 text-xs shadow-soft">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-[10px] font-semibold text-brand">{(session.name || "?").trim().slice(0, 1).toUpperCase()}</span>
          <span className="font-medium text-foreground">{session.name}</span>
          <span className="text-muted-foreground">· {roleLabel}</span>
          <button type="button" onClick={() => S.logout()} title="Cerrar sesión"
            className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
            <LucideIcon name="LogOut" className="h-3 w-3" />
          </button>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs shadow-soft">
        <LucideIcon name="Eye" className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="whitespace-nowrap text-muted-foreground">Viendo como</span>
        <select value={current} onChange={(e) => setCurrent(e.target.value)}
          className="cursor-pointer rounded-md border-0 bg-transparent px-1 text-xs font-medium text-foreground focus-visible:outline-none">
          {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </div>
    );
  }
  window.ActingAs = ActingAs;

  /* ================= Members tab ================= */
  function MembersTab() {
    const members = S.useMembers();
    const roles = S.useRoles();
    const canManage = S.useCan("manageMembers");
    const [profileId, setProfileId] = React.useState(null);
    const roleLabel = (k) => (roles.find((r) => r.key === k) || {}).label || k;

    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {members.length} miembro{members.length === 1 ? "" : "s"} · alimenta los desplegables de “Responsable” en tareas y pendientes.
          </p>
          {canManage && (
            <Button size="sm" onClick={() => { S.addMember({ name: "", accessRole: "" }); }} className="h-8 gap-1.5" title="El nuevo miembro entra sin rol; asígnale uno cuando esté listo">
              <LucideIcon name="UserPlus" className="h-3.5 w-3.5" /> Agregar miembro
            </Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Miembro</th>
                <th className="px-3 py-2 text-left font-medium">Cargo</th>
                <th className="px-3 py-2 text-left font-medium">Correo (login)</th>
                <th className="px-3 py-2 text-left font-medium">Rol de acceso</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                {canManage && <th className="w-10 px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  Sin miembros todavía. {canManage ? "Agrega el primero." : ""}
                </td></tr>
              )}
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border/60">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2.5">
                      {window.Avatar
                        ? <window.Avatar name={m.name} photo={m.photo} className="h-7 w-7 text-[11px]" />
                        : <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", roleTone(m.accessRole))}>
                            {(m.name || "?").trim().slice(0, 1).toUpperCase()}
                          </span>}
                      {canManage ? (
                        <Input value={m.name} onChange={(e) => S.updateMember(m.id, { name: e.target.value })} placeholder="Nombre completo"
                          className="h-8 w-44 border-0 bg-transparent px-1 text-sm font-medium shadow-none focus-visible:bg-surface focus-visible:ring-0" />
                      ) : (
                        <span className="font-medium text-foreground">{m.name || "—"}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    {canManage ? (
                      <Input value={m.cargo} onChange={(e) => S.updateMember(m.id, { cargo: e.target.value })} placeholder="Puesto (ej. Analista de retención)" title="Cargo o puesto en el equipo — no es el apodo del perfil"
                        className="h-8 w-48 border-0 bg-transparent px-1 text-xs text-muted-foreground shadow-none focus-visible:bg-surface focus-visible:ring-0" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{m.cargo || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {canManage ? (
                      <Input type="email" value={m.email || ""} onChange={(e) => S.updateMember(m.id, { email: e.target.value.trim().toLowerCase() })} placeholder="correo@equipo.com"
                        title="Correo de la cuenta (Supabase) de esta persona. Al iniciar sesión con ese correo, entra directo como este miembro."
                        className="h-8 w-52 border-0 bg-transparent px-1 text-xs text-muted-foreground shadow-none focus-visible:bg-surface focus-visible:ring-0" />
                    ) : (
                      <span className="text-xs text-muted-foreground">{m.email || "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {canManage ? (
                      <select value={m.accessRole || ""} onChange={(e) => S.updateMember(m.id, { accessRole: e.target.value })}
                        className={cn("h-6 cursor-pointer rounded-full border-0 px-2 text-[11px] font-medium focus-visible:outline-none", m.accessRole ? roleTone(m.accessRole) : "bg-muted text-muted-foreground")}>
                        <option value="">Sin rol</option>
                        {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                      </select>
                    ) : (
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", m.accessRole ? roleTone(m.accessRole) : "bg-muted text-muted-foreground")}>{m.accessRole ? roleLabel(m.accessRole) : "Sin rol"}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {canManage ? (
                      <button type="button" onClick={() => S.updateMember(m.id, { status: m.status === "active" ? "inactive" : "active" })}
                        className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                          m.status === "active" ? "bg-accent-green/10 text-accent-green" : "bg-muted text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", m.status === "active" ? "bg-accent-green" : "bg-muted-foreground/50")} />
                        {m.status === "active" ? "Activo" : "Inactivo"}
                      </button>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", m.status === "active" ? "bg-accent-green/10 text-accent-green" : "bg-muted text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", m.status === "active" ? "bg-accent-green" : "bg-muted-foreground/50")} />
                        {m.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <button type="button" onClick={() => setProfileId(m.id)} aria-label="Editar perfil" title="Editar perfil (nombres, apodo, edad, foto)"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand">
                          <LucideIcon name="UserRound" className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => S.removeMember(m.id)} aria-label="Eliminar miembro"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                          <LucideIcon name="Trash2" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!canManage && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <LucideIcon name="Lock" className="h-3 w-3" /> Tu rol actual no puede gestionar miembros.
          </p>
        )}
        {profileId && window.ProfileModal && (
          <window.ProfileModal memberId={profileId} title={`Perfil de ${(members.find((x) => x.id === profileId) || {}).name || "miembro"}`} onClose={() => setProfileId(null)} />
        )}
        {canManage && <BackupSection />}
      </div>
    );
  }

  /* ============ Modal de creación de rol (nombre, base, permisos, guardar) ============ */
  function NewRoleModal({ roles, groups, onClose }) {
    const [label, setLabel] = useState("");
    const [desc, setDesc] = useState("");
    const [basedOn, setBasedOn] = useState("viewer");
    const base = roles.find((r) => r.key === basedOn) || roles.find((r) => r.key === "viewer") || roles[0] || { permissions: {} };
    const [perms, setPerms] = useState(() => ({ ...(base.permissions || {}) }));
    const changeBase = (k) => {
      setBasedOn(k);
      const b = roles.find((r) => r.key === k);
      setPerms({ ...((b && b.permissions) || {}) });
    };
    const toggle = (pk) => setPerms((p) => ({ ...p, [pk]: !p[pk] }));
    const valid = label.trim().length >= 2;
    const save = () => {
      if (!valid) return;
      const key = S.addRole({ label: label.trim(), desc: desc.trim(), basedOn });
      S.PERMISSION_KEYS.forEach((pk) => S.setRolePermission(key, pk, !!perms[pk]));
      toast(`Rol “${label.trim()}” creado`);
      onClose();
    };
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[2px]" role="dialog" aria-label="Crear nuevo rol">
        <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-3xl border border-border bg-surface-elevated shadow-elevated">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand"><LucideIcon name="ShieldPlus" className="h-5 w-5" /></span>
              <h3 className="text-[15px] font-semibold text-foreground">Crear nuevo rol</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface"><LucideIcon name="X" className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nombre del rol *</label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Coordinador" autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Basado en</label>
                <select value={basedOn} onChange={(e) => changeBase(e.target.value)}
                  className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none">
                  {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descripción</label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="¿Para qué sirve este rol? (opcional)" />
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Permisos del rol</p>
              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={g.name} className="rounded-xl border border-border/60 bg-surface/40 p-3">
                    <p className="mb-1.5 text-[11px] font-semibold text-foreground">{g.name}</p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {g.items.map((p) => (
                        <label key={p.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-[12.5px] text-foreground hover:bg-surface">
                          <Checkbox checked={!!perms[p.key]} onCheckedChange={() => toggle(p.key)} /> {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border/60 px-5 py-3.5">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={!valid} className="gap-1.5"><LucideIcon name="Check" className="h-3.5 w-3.5" /> Guardar rol</Button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  /* ============ Respaldo de datos: exportar / restaurar todo el espacio ============ */
  const BACKUP_SKIP = (k) => !k || k.startsWith("sb-") || ["session:v1", "current-role:v1", "current-period:v1", "sidebar-collapsed:v1", "brief-reader-mode:v1", "exec-timer:v1", "module-usage:v1", "notif-read:v1", "backup-last:v1"].includes(k);
  function BackupSection() {
    const fileRef = React.useRef(null);
    const [busy, setBusy] = useState(false);
    const [lastTs, setLastTs] = useState(() => { try { return Number(localStorage.getItem("backup-last:v1")) || 0; } catch { return 0; } });
    const days = lastTs ? Math.floor((Date.now() - lastTs) / 86400000) : null;
    const overdue = days === null || days >= 7;
    const exportBackup = () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!BACKUP_SKIP(k)) data[k] = localStorage.getItem(k);
      }
      const payload = { app: "campanas-workspace", version: 1, exportedAt: new Date().toISOString(), keys: Object.keys(data).length, data };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `respaldo-campanas-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      try { localStorage.setItem("backup-last:v1", String(Date.now())); } catch {}
      setLastTs(Date.now());
      toast(`Respaldo exportado · ${payload.keys} claves`);
    };
    const importBackup = (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(reader.result);
          if (!payload || payload.app !== "campanas-workspace" || !payload.data) { toast("El archivo no es un respaldo válido de este workspace."); return; }
          const n = Object.keys(payload.data).length;
          if (!confirm(`Vas a restaurar un respaldo del ${new Date(payload.exportedAt).toLocaleString("es-PE")} con ${n} claves.\n\nEsto SOBRESCRIBE los datos actuales del equipo (y se sincroniza a la nube). ¿Continuar?`)) return;
          setBusy(true);
          Object.entries(payload.data).forEach(([k, v]) => { if (!BACKUP_SKIP(k)) try { localStorage.setItem(k, v); } catch {} });
          setBusy(false);
          toast(`Respaldo restaurado · ${n} claves. Recarga para ver todo actualizado.`);
        } catch { toast("No se pudo leer el archivo de respaldo."); }
      };
      reader.readAsText(f);
    };
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface-elevated p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-green/10 text-accent-green"><LucideIcon name="DatabaseBackup" className="h-5 w-5" strokeWidth={1.8} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-foreground">Datos y respaldo</p>
            <p className="text-[11.5px] leading-snug text-muted-foreground">Exporta una copia completa del espacio (campañas, briefs, tareas, equipo). Recomendado: una vez por semana durante el piloto. La restauración sobrescribe y se sincroniza a todos.</p>
            <p className={cn("mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", overdue ? "bg-accent-amber/15 text-accent-amber" : "bg-accent-green/10 text-accent-green")}>
              <LucideIcon name={overdue ? "AlarmClock" : "CheckCircle2"} className="h-3 w-3" />
              {days === null ? "Aún no exportas ningún respaldo en este equipo" : days === 0 ? "Último respaldo: hoy" : `Último respaldo: hace ${days} día${days === 1 ? "" : "s"}${overdue ? " — toca exportar" : ""}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportBackup} className="h-8 gap-1.5"><LucideIcon name="Download" className="h-3.5 w-3.5" /> Exportar respaldo</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()} className="h-8 gap-1.5"><LucideIcon name="Upload" className="h-3.5 w-3.5" /> Restaurar</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importBackup} />
          </div>
        </div>
      </div>
    );
  }

  /* ============ Modal de edición de rol: nombre, descripción, color, eliminar ============ */
  function EditRoleModal({ roleKey, onClose }) {
    const roles = S.useRoles();
    const r = roles.find((x) => x.key === roleKey);
    const [label, setLabel] = useState(r ? r.label : "");
    const [desc, setDesc] = useState(r ? (r.desc || "") : "");
    const [tone, setTone] = useState(r ? (r.tone || "") : "");
    const [confirmDel, setConfirmDel] = useState(false);
    if (!r) return null;
    const valid = label.trim().length >= 2;
    const save = () => {
      if (!valid) return;
      S.updateRoleMeta(roleKey, { label: label.trim(), desc: desc.trim(), tone: tone || undefined });
      toast("Rol actualizado");
      onClose();
    };
    return ReactDOM.createPortal(
      <>
        <div className={cn("fixed inset-0 z-[120] flex items-center justify-center bg-foreground/35 px-4 backdrop-blur-[2px] transition-opacity", confirmDel && "pointer-events-none opacity-0")} role="dialog" aria-label="Editar rol"
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="w-full max-w-sm rounded-3xl border border-border bg-surface-elevated p-5 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", roleTone(roleKey))}><LucideIcon name="ShieldCheck" className="h-4 w-4" /></span>
                <h3 className="text-[15px] font-semibold text-foreground">Editar rol</h3>
              </div>
              <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface"><LucideIcon name="X" className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3.5">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nombre del rol *</label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descripción</label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="¿Para qué sirve este rol? (opcional)" />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Color del rol</label>
                <div className="flex items-center gap-1.5">
                  {Object.entries(ROLE_TONES).map(([key, pair]) => (
                    <button key={key} type="button" onClick={() => setTone(key)} aria-label={`Color ${key}`}
                      className={cn("flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110", tone === key && "ring-2 ring-foreground/30 ring-offset-2 ring-offset-surface-elevated")}>
                      <span className={cn("h-5 w-5 rounded-full", pair[1])} />
                    </button>
                  ))}
                </div>
                <p className="mt-1.5"><span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", tone && ROLE_TONES[tone] ? ROLE_TONES[tone][0] : roleTone(roleKey))}>{label.trim() || r.label}</span></p>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3.5">
                {!r.system ? (
                  <button type="button" onClick={() => setConfirmDel(true)}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/10">
                    <LucideIcon name="Trash2" className="h-3.5 w-3.5" /> Eliminar rol
                  </button>
                ) : <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground"><LucideIcon name="Lock" className="h-3 w-3" /> Rol base: no se elimina</span>}
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
                  <Button size="sm" onClick={save} disabled={!valid} className="gap-1.5"><LucideIcon name="Check" className="h-3.5 w-3.5" /> Guardar</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {confirmDel && (
          <window.ConfirmDelete
            title="¿Eliminar este rol?"
            itemLabel={r.label}
            message="Los miembros que tengan este rol pasarán automáticamente al rol Visualizador (solo lectura). Esta acción no se puede deshacer."
            confirmLabel="Eliminar rol"
            onConfirm={() => { S.removeRole(roleKey); toast(`Rol “${r.label}” eliminado`); onClose(); }}
            onClose={() => setConfirmDel(false)} />
        )}
      </>,
      document.body
    );
  }

  /* ================= Roles & permissions tab ================= */
  function RolesTab() {
    const roles = S.useRoles();
    const [current] = S.useCurrentRole();
    const canEdit = S.useCan("editRoles");
    const [sub, setSub] = useState("perms"); // perms | modules
    const [creating, setCreating] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const PERMS = S.PERMISSIONS;
    const groups = [];
    PERMS.forEach((p) => { let g = groups.find((x) => x.name === p.group); if (!g) { g = { name: p.group, items: [] }; groups.push(g); } g.items.push(p); });
    const MOD_GROUPS = [];
    (S.MODULE_DEFS || []).forEach((m) => { let g = MOD_GROUPS.find((x) => x.name === m.group); if (!g) { g = { name: m.group, items: [] }; MOD_GROUPS.push(g); } g.items.push(m); });

    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-border bg-surface-elevated p-0.5">
            {[["perms", "ShieldCheck", "Permisos"], ["modules", "LayoutGrid", "Módulos"]].map(([k, ic, lb]) => (
              <button key={k} type="button" onClick={() => setSub(k)}
                className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors", sub === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                <LucideIcon name={ic} className="h-3.5 w-3.5" /> {lb}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{sub === "perms" ? "Matriz de permisos por rol (RBAC)." : "Qué módulos puede ver y usar cada rol."}</p>
          <div className="flex items-center gap-2">
            {canEdit && <Button variant="outline" size="sm" onClick={() => { if (confirm("¿Restablecer los roles a los valores por defecto?")) { S.resetRoles(); toast("Roles restablecidos"); } }} className="h-8 gap-1.5"><LucideIcon name="RotateCcw" className="h-3.5 w-3.5" /> Restablecer</Button>}
            {canEdit && <Button size="sm" onClick={() => setCreating(true)} className="h-8 gap-1.5"><LucideIcon name="Plus" className="h-3.5 w-3.5" /> Nuevo rol</Button>}
          </div>
          {creating && <NewRoleModal roles={roles} groups={groups} onClose={() => setCreating(false)} />}
          {editingRole && <EditRoleModal roleKey={editingRole} onClose={() => setEditingRole(null)} />}
        </div>

        {sub === "perms" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Permiso</th>
                {roles.map((r) => (
                  <th key={r.key} className="border-l border-border/60 bg-surface px-3 py-2.5 text-center align-top">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", roleTone(r.key))}>
                        {r.label}{current === r.key && <span className="h-1.5 w-1.5 rounded-full bg-current" title="Rol actual" />}
                      </span>
                      {canEdit && (
                        <button type="button" onClick={() => setEditingRole(r.key)}
                          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground">
                          <LucideIcon name="Pencil" className="h-2.5 w-2.5" /> Editar
                        </button>
                      )}
                      {r.system && <span className="text-[9px] uppercase tracking-wide text-muted-foreground/60">Base</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.name}>
                  <tr>
                    <td colSpan={roles.length + 1} className="bg-surface/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">{g.name}</td>
                  </tr>
                  {g.items.map((p) => (
                    <tr key={p.key} className="border-t border-border/60">
                      <td className="sticky left-0 z-10 bg-surface-elevated px-3 py-1.5 text-[13px] text-foreground">{p.label}</td>
                      {roles.map((r) => (
                        <td key={r.key} className="border-l border-border/40 px-3 py-1.5 text-center">
                          <div className="flex justify-center">
                            <Switch checked={!!r.permissions[p.key]} disabled={!canEdit} onChange={(v) => S.setRolePermission(r.key, p.key, v)} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {sub === "modules" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-surface px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Módulo</th>
                {roles.map((r) => (
                  <th key={r.key} className="border-l border-border/60 bg-surface px-3 py-2.5 text-center">
                    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", roleTone(r.key))}>
                      {r.label}{current === r.key && <span className="h-1.5 w-1.5 rounded-full bg-current" title="Rol actual" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOD_GROUPS.map((g) => (
                <React.Fragment key={g.name}>
                  <tr>
                    <td colSpan={roles.length + 1} className="bg-surface/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">{g.name}</td>
                  </tr>
                  {g.items.map((m) => (
                    <tr key={m.key} className="border-t border-border/60">
                      <td className="sticky left-0 z-10 bg-surface-elevated px-3 py-1.5">
                        <span className="flex items-center gap-2 text-[13px] text-foreground"><LucideIcon name={m.icon} className="h-3.5 w-3.5 text-muted-foreground" /> {m.label}</span>
                      </td>
                      {roles.map((r) => {
                        const enabled = r.key === "admin" ? true : (!r.modules || r.modules[m.key] !== false);
                        return (
                          <td key={r.key} className="border-l border-border/40 px-3 py-1.5 text-center">
                            <div className="flex justify-center">
                              <Switch checked={enabled} disabled={!canEdit || r.key === "admin"} onChange={(v) => S.setRoleModule(r.key, m.key, v)} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <p className="flex items-center gap-1.5 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
            <LucideIcon name="Info" className="h-3 w-3" /> Un módulo deshabilitado desaparece de la navegación y su ruta queda bloqueada para ese rol. El Administrador siempre tiene acceso total.
          </p>
        </div>
        )}

        {!canEdit && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <LucideIcon name="Lock" className="h-3 w-3" /> Tu rol actual no puede editar roles ni permisos.
          </p>
        )}
      </div>
    );
  }

  /* ================= Acceso (login) tab ================= */
  function AccessTab() {
    const members = S.useMembers();
    const cfg = S.useLoginSettings();
    const session = S.useSession();
    const canManage = S.useCan("manageMembers");
    const canConfig = S.useCan("accessConfig") || canManage;
    const [reveal, setReveal] = useState(null); // member id with visible clave

    return (
      <div className="grid gap-3 lg:grid-cols-[340px_1fr]">
        {/* Settings card */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface-elevated p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-foreground">Requerir inicio de sesión</p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Al activarlo, la web pide elegir usuario (y clave si tiene) antes de entrar.</p>
              </div>
              <Switch checked={!!cfg.enabled} disabled={!canConfig} onChange={(v) => {
                if (v && !session) { S.writeLoginSettings({ enabled: true }); toast("Login activado — elige tu usuario"); }
                else { S.writeLoginSettings({ enabled: v }); toast(v ? "Login activado" : "Login desactivado"); }
              }} />
            </div>
            {cfg.enabled && !session && <p className="flex items-center gap-1.5 rounded-lg bg-accent-amber/10 px-2.5 py-1.5 text-[11px] font-medium text-accent-amber"><LucideIcon name="AlertTriangle" className="h-3.5 w-3.5" /> Sin sesión activa: verás la pantalla de login al recargar.</p>}
            {session && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><LucideIcon name="UserCheck" className="h-3.5 w-3.5 text-accent-green" /> Sesión activa: <span className="font-medium text-foreground">{session.name}</span></p>}
          </div>

          <div className="rounded-xl border border-border bg-surface-elevated p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Personalizar pantalla</p>
            <div className="space-y-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Título</Label>
                <Input value={cfg.title} disabled={!canConfig} onChange={(e) => S.writeLoginSettings({ title: e.target.value })} className="mt-0.5 h-8 bg-surface text-sm" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Subtítulo</Label>
                <Input value={cfg.subtitle} disabled={!canConfig} onChange={(e) => S.writeLoginSettings({ subtitle: e.target.value })} className="mt-0.5 h-8 bg-surface text-xs" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Texto del botón</Label>
                <Input value={cfg.buttonLabel} disabled={!canConfig} onChange={(e) => S.writeLoginSettings({ buttonLabel: e.target.value })} className="mt-0.5 h-8 w-32 bg-surface text-sm" />
              </div>
              <label className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[12px] text-foreground">Mostrar cargo en la lista</span>
                <Switch checked={!!cfg.showCargo} disabled={!canConfig} onChange={(v) => S.writeLoginSettings({ showCargo: v })} />
              </label>
            </div>
          </div>
        </div>

        {/* Claves per member */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Miembro</th>
                <th className="px-3 py-2 text-left font-medium">Clave de acceso</th>
                <th className="px-3 py-2 text-left font-medium">Protección</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-border/60">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", roleTone(m.accessRole))}>{(m.name || "?").trim().slice(0, 1).toUpperCase()}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{m.name || "—"}</span>
                        {m.status !== "active" && <span className="text-[10px] text-muted-foreground">Inactivo · no puede entrar</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    {canManage ? (
                      <div className="flex items-center gap-1">
                        <Input type={reveal === m.id ? "text" : "password"} value={m.clave || ""} placeholder="Sin clave"
                          onChange={(e) => S.updateMember(m.id, { clave: e.target.value })}
                          className="h-8 w-36 bg-surface text-sm tabular-nums" />
                        <button type="button" onClick={() => setReveal(reveal === m.id ? null : m.id)} aria-label="Mostrar clave"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground">
                          <LucideIcon name={reveal === m.id ? "EyeOff" : "Eye"} className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{(m.clave || "") !== "" ? "••••" : "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {(m.clave || "") !== "" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-green/10 px-2 py-0.5 text-[11px] font-medium text-accent-green"><LucideIcon name="Lock" className="h-3 w-3" /> Con clave</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"><LucideIcon name="Unlock" className="h-3 w-3" /> Entra sin clave</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!canManage && (
            <p className="flex items-center gap-1.5 border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground"><LucideIcon name="Lock" className="h-3 w-3" /> Tu rol actual no puede gestionar claves.</p>
          )}
        </div>
      </div>
    );
  }

  /* ================= Page ================= */
  function MembersPage() {
    const [tab, setTab] = useState("members");
    /* En producción el inicio de sesión es ÚNICAMENTE la cuenta de Supabase
       (correo + contraseña gestionados allá); la pestaña de claves internas
       solo existe en el modo local/prototipo. */
    const remoteAuth = !!(window.RemoteSync && window.RemoteSync.enabled);
    const TABS = [
      { key: "members", label: "Miembros", icon: "Users" },
      { key: "roles", label: "Roles y permisos", icon: "ShieldCheck" },
      ...(remoteAuth ? [] : [{ key: "access", label: "Inicio de sesión", icon: "KeyRound" }]),
    ];
    return (
      <div className="min-h-screen bg-background" data-screen-label="Miembros y permisos">
        <window.SectionWash accent="slate" />
        <main className="mx-auto w-full max-w-5xl px-4 pb-6 pt-0 sm:px-6 sm:pb-8 lg:px-8">
          <window.PageToolbar back="#/">
            <ActingAs />
          </window.PageToolbar>

          <window.SectionHeader accent="slate" icon="Users" title="Miembros y permisos" subtitle="Directorio del equipo y control de acceso por roles." />

          <div className="mb-4 inline-flex rounded-full border border-border bg-surface-elevated p-0.5 shadow-soft">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors", tab === t.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                <LucideIcon name={t.icon} className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {tab === "members" ? <MembersTab /> : tab === "roles" ? <RolesTab /> : <AccessTab />}

          <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            Control de acceso basado en roles (RBAC) · Workspace de Campañas
          </footer>
        </main>
      </div>
    );
  }

  Object.assign(window, { MembersPage });
})();
