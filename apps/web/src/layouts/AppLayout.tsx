import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Boxes,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { useAuth } from '../features/auth/AuthProvider';
const nav = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/activity', label: 'Activity', icon: ClipboardList },
  { to: '/locations', label: 'Locations', icon: MapPin },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/scan', label: 'Scan QR / Barcode', icon: Search },
];
export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const heading =
    location.pathname === '/dashboard'
      ? 'Overview'
      : location.pathname.slice(1).split('/')[0]?.replace(/-/g, ' ') || 'Overview';
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-head">
          <Logo />{' '}
          <button
            className="icon-button mobile-only"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <Button
          className="add-button"
          onClick={() => {
            navigate('/add-item');
            setOpen(false);
          }}
        >
          <Plus size={17} />
          Add item
        </Button>
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
          <div className="nav-separator" />
          <NavLink to="/warranties" onClick={() => setOpen(false)} className="nav-link">
            <Shield size={18} strokeWidth={1.8} />
            <span>Warranties</span>
          </NavLink>
          <NavLink to="/reports" onClick={() => setOpen(false)} className="nav-link">
            <FileText size={18} strokeWidth={1.8} />
            <span>Reports</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/settings" onClick={() => setOpen(false)} className="nav-link">
            <Settings size={18} strokeWidth={1.8} />
            <span>Settings</span>
          </NavLink>
          <div className="profile-mini">
            <div className="avatar">{user?.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
            <button className="more-button" onClick={() => void logout()} aria-label="Sign out">
              ↗
            </button>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div className="page-heading">
            <span className="eyebrow">YOUR SPACE</span>
            <h1>{heading}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => navigate('/search')} aria-label="Search">
              <Search size={19} />
            </button>
            <button
              className="icon-button"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
            >
              <Bell size={19} />
            </button>
            <div className="topbar-avatar">{user?.name.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
