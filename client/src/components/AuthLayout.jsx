export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="auth">
      <header className="brand">
        <p className="mark">Progresso</p>
        <h1>{title}</h1>
        <p className="lede">{subtitle}</p>
      </header>
      {children}
      <p className="switch">{footer}</p>
    </main>
  );
}

export function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
