/* =====================================================================
   Perfil de usuario
   - Onboarding de primera entrada: nombres, apodo, edad y foto.
   - Pantalla de bienvenida con frase filosófica motivacional.
   - Modal de edición reutilizable (propio usuario y admin desde Equipo).
   - <Avatar/>: foto del miembro (o inicial) — se usa en navbar y pendientes.
   Los datos viven dentro del objeto miembro (members:v1), así que se
   sincronizan con el backend igual que todo lo demás.
   ===================================================================== */
(function () {
  const React = window.React;
  const { useState, useRef } = React;
  const cn = window.cn;

  /* ---------- Frases filosóficas (clásicos, dominio público) ---------- */
  const QUOTES = [
    { text: "La felicidad de tu vida depende de la calidad de tus pensamientos.", author: "Marco Aurelio" },
    { text: "Muy poco se necesita para una vida feliz; todo está dentro de ti.", author: "Marco Aurelio" },
    { text: "No son las cosas las que nos perturban, sino la opinión que tenemos de ellas.", author: "Epicteto" },
    { text: "Ningún viento es favorable para quien no sabe a qué puerto se dirige.", author: "Séneca" },
    { text: "La suerte es lo que sucede cuando la preparación se encuentra con la oportunidad.", author: "Séneca" },
    { text: "Una vida sin examen no merece ser vivida.", author: "Sócrates" },
    { text: "El comienzo es la parte más importante de la obra.", author: "Platón" },
    { text: "El hombre que mueve montañas comienza cargando pequeñas piedras.", author: "Confucio" },
    { text: "Un viaje de mil millas comienza con un solo paso.", author: "Lao-Tse" },
    { text: "No eches a perder lo que tienes deseando lo que no tienes.", author: "Epicuro" },
    { text: "Ningún hombre se baña dos veces en el mismo río.", author: "Heráclito" },
    { text: "La disciplina es el puente entre las metas y los logros.", author: "Proverbio estoico" },
  ];
  const randomQuote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];

  /* ---------- Avatar reutilizable ---------- */
  function Avatar({ name, photo, className, alt }) {
    const S = window.Store;
    const members = S.useMembers();
    const m = !photo && name ? members.find((x) => (x.name || "").trim().toLowerCase() === (name || "").trim().toLowerCase()) : null;
    const src = photo || (m && m.photo) || "";
    if (src) {
      return <img src={src} alt={alt || name || "Avatar"} className={cn("shrink-0 rounded-full object-cover", className)} />;
    }
    return (
      <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-brand/10 font-semibold text-brand", className)}>
        {(name || "?").trim().slice(0, 1).toUpperCase()}
      </span>
    );
  }
  window.Avatar = Avatar;

  /* ---------- Foto: recorte centrado + reducción (144px, JPEG) ----------
     Mantiene el peso por foto en ~10-20 KB para que la lista de miembros
     siga siendo liviana en localStorage y en la base. */
  function fileToAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith("image/")) return reject(new Error("Elige una imagen."));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Imagen no válida."));
        img.onload = () => {
          const SIZE = 144;
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
          const c = document.createElement("canvas");
          c.width = SIZE; c.height = SIZE;
          c.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
          resolve(c.toDataURL("image/jpeg", 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Formulario compartido ---------- */
  function ProfileFields({ value, onChange }) {
    const { Input, LucideIcon } = window;
    const fileRef = useRef(null);
    const set = (k, v) => onChange({ ...value, [k]: v });
    const pick = async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f) return;
      try { set("photo", await fileToAvatar(f)); } catch (err) { alert(err.message); }
    };
    return (
      <div className="space-y-4">
        {/* Foto */}
        <div className="flex items-center gap-3">
          <Avatar name={value.nombres || value.name} photo={value.photo} className="h-16 w-16 text-xl" />
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => fileRef.current && fileRef.current.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted">
              <LucideIcon name="Camera" className="h-3.5 w-3.5" /> {value.photo ? "Cambiar foto" : "Subir foto"}
            </button>
            {value.photo && (
              <button type="button" onClick={() => set("photo", "")}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-destructive">
                <LucideIcon name="Trash2" className="h-3 w-3" /> Quitar
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
          </div>
        </div>
        {/* Datos */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nombres *</label>
          <Input value={value.nombres || ""} onChange={(e) => set("nombres", e.target.value)} placeholder="Ej. Ana María Torres" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Apodo</label>
            <Input value={value.apodo || ""} onChange={(e) => set("apodo", e.target.value)} placeholder="¿Cómo te dicen?" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Edad</label>
            <Input type="number" min="14" max="99" value={value.edad || ""} onChange={(e) => set("edad", e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="—" />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Modal de edición (propio o por el admin) ---------- */
  function ProfileModal({ memberId, onClose, onSaved, title }) {
    const S = window.Store;
    const { LucideIcon, Button } = window;
    const members = S.useMembers();
    const m = members.find((x) => x.id === memberId);
    const [form, setForm] = useState(() => m ? {
      name: m.name, nombres: m.nombres || m.name || "", apodo: m.apodo || "", edad: m.edad || "", photo: m.photo || "",
    } : null);
    if (!m || !form) return null;
    const session = S.readSession();
    const isSelf = !!(session && session.memberId === m.id);
    const valid = (form.nombres || "").trim().length >= 2;
    const save = () => {
      if (!valid) return;
      S.updateMember(m.id, {
        /* El nombre visible (name) se sincroniza con el nombre del perfil: es lo
           que ve el navbar y a lo que se asignan tareas (BUG-C652/950F). El
           store reasigna en cascada lo que estaba a nombre del anterior. */
        name: form.nombres.trim(),
        nombres: form.nombres.trim(), apodo: (form.apodo || "").trim(),
        edad: form.edad || "", photo: form.photo || "",
        /* Solo editarte a TI mismo completa tu onboarding. Que un admin
           retoque el perfil de otra persona no le quita su bienvenida. */
        profileCompleted: isSelf ? true : !!m.profileCompleted,
      });
      if (onSaved) onSaved();
      onClose();
    };
    const resetOnboarding = () => {
      S.updateMember(m.id, { profileCompleted: false });
      if (window.toast) window.toast("Bienvenida reiniciada: completará su perfil al entrar");
      onClose();
    };
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated">
          <div className="mb-4 flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-foreground">{title || "Editar perfil"}</h3>
              {!isSelf && (
                <button type="button" onClick={resetOnboarding}
                  className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-brand hover:underline"
                  title="La persona verá el formulario de bienvenida (foto, nombres, apodo) en su próximo ingreso">
                  <LucideIcon name="RotateCcw" className="h-2.5 w-2.5" /> Pedirle que complete su perfil al entrar
                </button>
              )}
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted">
              <LucideIcon name="X" className="h-4 w-4" />
            </button>
          </div>
          <ProfileFields value={form} onChange={setForm} />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={save} disabled={!valid}>Guardar</Button>
          </div>
        </div>
      </div>
    );
  }
  window.ProfileModal = ProfileModal;

  /* ---------- Onboarding de primera entrada + bienvenida ---------- */
  const SKIP_FLAG = "profile-onboarding-later"; // sessionStorage: solo esta visita

  function ProfileGate() {
    const S = window.Store;
    const { LucideIcon, Button } = window;
    const session = S.useSession();
    const members = S.useMembers();
    const me = session ? members.find((x) => x.id === session.memberId) : null;
    const [step, setStep] = useState("form");
    const [quote] = useState(randomQuote);
    const [form, setForm] = useState(null);

    let skipped = false;
    try { skipped = sessionStorage.getItem(SKIP_FLAG) === "1"; } catch {}
    if (!me) return null;
    if (me.profileCompleted && step !== "welcome") return null;
    if (skipped && step !== "welcome") return null;

    const f = form || { name: me.name, nombres: me.nombres || me.name || "", apodo: me.apodo || "", edad: me.edad || "", photo: me.photo || "" };
    const valid = (f.nombres || "").trim().length >= 2;
    const displayName = (f.apodo || "").trim() || (f.nombres || "").trim().split(/\s+/)[0] || me.name;

    const save = () => {
      if (!valid) return;
      S.updateMember(me.id, {
        nombres: f.nombres.trim(), apodo: (f.apodo || "").trim(),
        edad: f.edad || "", photo: f.photo || "", profileCompleted: true,
      });
      setStep("welcome");
    };
    const later = () => { try { sessionStorage.setItem(SKIP_FLAG, "1"); } catch {} setStep("hidden"); };
    if (step === "hidden") return null;

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background px-4">
        <div aria-hidden className="hero-radial pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] opacity-60" />
        {step === "form" ? (
          <div className="w-full max-w-sm">
            <div className="mb-5 text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-background">
                <LucideIcon name="UserRound" className="h-6 w-6" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-foreground">¡Hola! Completa tu perfil</h1>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">Es tu primera vez aquí. Cuéntanos un poco de ti para personalizar tu espacio.</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-elevated">
              <ProfileFields value={f} onChange={setForm} />
              <Button className="mt-5 w-full" onClick={save} disabled={!valid}>Continuar</Button>
              <button type="button" onClick={later} className="mt-2 w-full text-center text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                Completar más tarde
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md text-center">
            <Avatar name={f.nombres || me.name} photo={f.photo} className="mx-auto h-20 w-20 text-2xl ring-4 ring-brand/15" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">¡Bienvenido(a), {displayName}!</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Tu perfil quedó listo. Este es tu espacio de trabajo del equipo.</p>
            <div className="mt-6 rounded-2xl border border-border bg-surface-elevated p-5 text-left shadow-elevated">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand"><LucideIcon name="Quote" className="h-4 w-4" /></span>
              <p className="mt-3 font-display text-[16px] font-medium leading-relaxed text-foreground">"{quote.text}"</p>
              <p className="mt-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">— {quote.author}</p>
            </div>
            <Button className="mt-6 w-full sm:w-auto sm:px-10" onClick={() => setStep("hidden")}>Comenzar</Button>
          </div>
        )}
      </div>
    );
  }
  window.ProfileGate = ProfileGate;
})();
