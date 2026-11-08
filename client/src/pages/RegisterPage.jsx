import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { AuthLayout, Field } from '../components/AuthLayout.jsx';
import { GENDERS } from '../format.js';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const data = new FormData(event.currentTarget);
    const firstName = String(data.get('firstName') || '').trim();
    const lastName = String(data.get('lastName') || '').trim();
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const age = String(data.get('age') || '').trim();
    const heightCm = String(data.get('heightCm') || '').trim();
    const gender = String(data.get('gender') || '');

    if (!firstName || !lastName || !email || !password || !age || !heightCm || !gender) {
      setError('Preencha todos os campos essenciais.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await register({
        firstName,
        lastName,
        email,
        password,
        age: Number(age),
        heightCm,
        gender,
      });
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
      subtitle="Dados essenciais para o Progresso e para o seu clã ninja (sobrenome)."
      footer={<>Já tem conta? <Link to="/entrar">Entrar</Link></>}
    >
      <form className="form" onSubmit={onSubmit} autoComplete="on">
        {error ? <p className="alert" role="alert">{error}</p> : null}
        <div className="form-row">
          <Field
            label="Nome"
            name="firstName"
            autoComplete="given-name"
            minLength={2}
            maxLength={40}
            required
          />
          <Field
            label="Sobrenome"
            name="lastName"
            autoComplete="family-name"
            minLength={2}
            maxLength={40}
            required
          />
        </div>
        <p className="hint">O sobrenome vira o nome do seu clã ninja.</p>
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
        <div className="form-row">
          <Field
            label="Idade"
            name="age"
            type="number"
            inputMode="numeric"
            min={10}
            max={120}
            required
          />
          <Field
            label="Altura (cm)"
            name="heightCm"
            type="number"
            inputMode="decimal"
            min={120}
            max={230}
            step={1}
            required
          />
        </div>
        <label className="field" htmlFor="gender">
          <span>Gênero</span>
          <select id="gender" name="gender" required defaultValue="">
            <option value="" disabled>Escolha</option>
            {GENDERS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </label>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Criando…' : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  );
}
