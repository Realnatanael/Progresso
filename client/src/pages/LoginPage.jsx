import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { AuthLayout, Field } from '../components/AuthLayout.jsx';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    // Lê o DOM (FormData) — autofill do Chrome muitas vezes não atualiza o state do React.
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');

    if (!email || !password) {
      setError('Preencha email e senha.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Seus hábitos ficam aqui, um dia de cada vez."
      footer={<>Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link></>}
    >
      <form className="form" onSubmit={onSubmit} autoComplete="on">
        {error ? <p className="alert" role="alert">{error}</p> : null}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
        <Field
          label="Senha"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  );
}
