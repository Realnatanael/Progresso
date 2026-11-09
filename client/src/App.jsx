import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { BodyPage } from './pages/BodyPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { NinjaPage } from './pages/NinjaPage.jsx';
import { FxLabPage } from './pages/FxLabPage.jsx';

function ScreenStatus() {
  return <p className="screen-status">Abrindo…</p>;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <ScreenStatus />;
  if (!user) return <Navigate to="/entrar" replace />;
  return children;
}

function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <ScreenStatus />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Guest><LoginPage /></Guest>} />
      <Route path="/criar-conta" element={<Guest><RegisterPage /></Guest>} />
      <Route path="/" element={<Protected><HomePage /></Protected>} />
      <Route path="/corpo" element={<Protected><BodyPage /></Protected>} />
      <Route path="/ninja" element={<Protected><NinjaPage /></Protected>} />
      <Route path="/perfil" element={<Protected><ProfilePage /></Protected>} />
      {import.meta.env.DEV ? <Route path="/fx-lab" element={<FxLabPage />} /> : null}
      <Route path="/exercicios/:id" element={<Navigate to="/corpo" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
