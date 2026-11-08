import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { AuthLayout, Field } from '../components/AuthLayout.jsx';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');

    if (!name || !email || !password) {
      setError('Preencha todos os campos.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível criar a conta.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Uma conta só sua. A senha fica criptografada no banco."
      footer={<>Já tem conta? <Link to="/entrar">Entrar</Link></>}
    >
      <form className="form" onSubmit={onSubmit} autoComplete="on">
        {error ? <p className="alert" role="alert">{error}</p> : null}
        <Field
          label="Nome"
          name="name"
          autoComplete="name"
          minLength={2}
          maxLength={40}
          required
        />
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
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        <p className="hint">Mínimo de 8 caracteres.</p>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  );
}
