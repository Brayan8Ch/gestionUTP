/* ConfirmDelete — popup de confirmación para acciones destructivas.
   Pide la clave del usuario con sesión activa antes de ejecutar.
   Si el usuario no tiene clave configurada (o no hay sesión), degrada a
   confirmación explícita simple, dejando claro qué se va a eliminar. */
(function () {
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useState, useRef, useEffect } = React;
  const { LucideIcon } = window;
  const cn = window.cn;

  function ConfirmDelete({ title = "¿Eliminar?", message, itemLabel, confirmLabel = "Eliminar", onConfirm, onClose, requireClave = true }) {
    const S = window.Store;
    const remote = !!(window.RemoteSync && window.RemoteSync.enabled);
    const info = S.sessionClaveInfo();
    /* Producción: SIEMPRE se confirma con la contraseña de la cuenta
       (Supabase). Modo local: clave interna si existe; si no, confirmación simple. */
    const needsClave = requireClave && (remote || (info.logged && info.hasClave));
    const [clave, setClave] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const inputRef = useRef(null);
    useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

    const submit = async (e) => {
      if (e) e.preventDefault();
      if (busy) return;
      if (needsClave) {
        let res;
        if (remote) {
          setBusy(true);
          res = await window.RemoteSync.verifyPassword(clave);
          setBusy(false);
        } else {
          res = S.verifySessionClave(clave);
        }
        if (!res.ok) { setError(res.error || "Contraseña incorrecta."); setClave(""); if (inputRef.current) inputRef.current.focus(); return; }
      }
      try { onConfirm(); }
      catch (err) { console.error("[ConfirmDelete] la acción falló", err); setError("La acción falló: " + (err && err.message ? err.message : "error desconocido")); return; }
      onClose();
    };

    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-label={title}>
        <button type="button" aria-label="Cancelar" onClick={onClose} className="fade-in absolute inset-0 w-full bg-foreground/30 backdrop-blur-[2px]"></button>
        <form onSubmit={submit} className="sheet-up relative w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <LucideIcon name="Trash2" className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-snug text-foreground">{title}</h3>
              {itemLabel && <p className="mt-0.5 truncate text-[12.5px] font-medium text-destructive">{itemLabel}</p>}
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{message || "Esta acción no se puede deshacer."}</p>
            </div>
          </div>

          {needsClave ? (
            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {remote ? "Confirma con tu contraseña" : `Confirma con tu clave${info.name ? ` · ${info.name}` : ""}`}
              </label>
              <div className={cn("mt-1.5 flex h-10 items-center gap-2 rounded-xl border bg-surface px-3", error ? "border-destructive/60 ring-1 ring-destructive/30" : "border-border")}>
                <LucideIcon name="KeyRound" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input ref={inputRef} type="password" value={clave} autoComplete="current-password"
                  onChange={(e) => { setClave(e.target.value); setError(""); }}
                  placeholder={remote ? "Tu contraseña de la cuenta" : "Tu clave de acceso"}
                  className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none" />
              </div>
              {error && <p className="mt-1.5 flex items-center gap-1 text-[11.5px] font-medium text-destructive"><LucideIcon name="CircleAlert" className="h-3.5 w-3.5" /> {error}</p>}
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-[11.5px] text-muted-foreground">
              <LucideIcon name="Info" className="h-3.5 w-3.5 shrink-0" />
              {info.logged ? "Tu usuario no tiene clave configurada — confirma la eliminación." : "Sin sesión activa — confirma la eliminación."}
            </p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose}
              className="h-9 rounded-full border border-border bg-surface-elevated px-4 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface">
              Cancelar
            </button>
            <button type="submit" disabled={(needsClave && !clave) || busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive px-4 text-[12.5px] font-semibold text-white shadow-soft transition-colors hover:bg-destructive/90 disabled:opacity-40">
              <LucideIcon name={busy ? "Loader2" : "Trash2"} className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> {busy ? "Verificando…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>,
      document.body
    );
  }

  window.ConfirmDelete = ConfirmDelete;
})();
