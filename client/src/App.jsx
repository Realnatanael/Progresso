import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { ExercisePage } from './pages/ExercisePage.jsx';

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
      <Route path="/exercicios/:id" element={<Protected><ExercisePage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
