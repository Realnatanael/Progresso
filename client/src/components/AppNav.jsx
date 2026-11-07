import { NavLink } from 'react-router-dom';

export function AppNav() {
  return (
    <nav className="app-nav" aria-label="Áreas">
      <NavLink to="/" end>Hoje</NavLink>
      <NavLink to="/corpo">Corpo</NavLink>
      <NavLink to="/perfil">Perfil</NavLink>
    </nav>
  );
}
