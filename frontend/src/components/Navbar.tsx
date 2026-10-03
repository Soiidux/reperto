import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ArrowRight, LogOut, LayoutDashboard } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Home', to: '/', hash: '' },
  { label: 'About', to: '/', hash: 'about' },
  { label: 'Doctors', to: '/', hash: 'doctors' },
  { label: 'Contact', to: '/', hash: 'contact' },
] as const;

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname, hash: currentHash } = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Home is one page, so nav items scroll to a section. Already on the home
  // page means scrolling directly (a same-hash link wouldn't re-render);
  // otherwise navigate to "/#section" and let Home scroll on arrival.
  const goToSection = (hash: string) => {
    if (!hash) {
      if (pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
      else navigate('/');
      return;
    }
    const target = document.getElementById(hash);
    if (pathname === '/' && target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    navigate(`/#${hash}`);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto max-w-7xl px-4 md:px-8 h-16 flex justify-between items-center">
        
        {/* Logo */}
        <div className="flex items-center">
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/logo.svg" alt="Reperto" className="h-11 w-auto object-contain" />
          </Link>
        </div>

        {/* Dynamic Navigation Links — single-page sections on Home */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, hash }) => {
            const isActive =
              pathname === '/' && currentHash === (hash ? `#${hash}` : '');
            return (
              <button
                key={label}
                type="button"
                onClick={() => goToSection(hash)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Auth / Action Button CTA */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              {/* Contextual Link to direct them straight to their specific role view */}
              <Link 
                to={`/${user.role}/dashboard`} 
                className="flex items-center gap-2 text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              >
                <LayoutDashboard size={16} />
                <span>Dashboard</span>
              </Link>
              
              <button 
                onClick={handleLogout} 
                className="text-muted-foreground hover:text-destructive p-2 hover:bg-destructive/5 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <Link 
              to="/login" 
              className="text-primary-foreground bg-primary px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 hover:opacity-90 shadow-sm"
            >
              <span>Book Now</span>
              <ArrowRight size={18} />
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
};

export default Navbar;