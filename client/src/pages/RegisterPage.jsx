import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { AuthLayout, Field } from '../components/AuthLayout.jsx';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
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
      <form className="form" onSubmit={onSubmit}>
        {error ? <p className="alert" role="alert">{error}</p> : null}
        <Field
          label="Nome"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={40}
          required
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <Field
          label="Senha"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
