import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useActiveSection } from '../hooks/use-active-section';
import { ArrowRight, LogOut, LayoutDashboard } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Home', to: '/', hash: '' },
  { label: 'About', to: '/', hash: 'about' },
  { label: 'Doctors', to: '/', hash: 'doctors' },
  { label: 'Contact', to: '/', hash: 'contact' },
] as const;

// Stable module-level array: the scroll-spy effect keys off this identity, so
// it must not be rebuilt on every render.
const SECTION_IDS = NAV_LINKS.map((link) => link.hash).filter(Boolean);

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  // The highlight follows the section actually on screen, so it tracks manual
  // scrolling as well as clicks. null means "above the first section" = Home.
  const activeSection = useActiveSection(SECTION_IDS, isHome);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Home is one page, so nav items scroll to a section. Scrolling happens
  // either way (clicking the section you're already in re-scrolls), and the
  // hash is only rewritten when we actually have to navigate.
  const goToSection = (hash: string) => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (!isHome) navigate('/');
      return;
    }

    const target = document.getElementById(hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (!isHome) {
      navigate(`/#${hash}`);
    }
  };

  const isLinkActive = (hash: string) =>
    isHome && (hash ? activeSection === hash : activeSection === null);

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
            const isActive = isLinkActive(hash);
            return (
              <button
                key={label}
                type="button"
                onClick={() => goToSection(hash)}
                aria-current={isActive ? 'true' : undefined}
                className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
                }`}
              >
                {label}
                {/* Underline bar doubles as the active indicator, so the
                    highlight stays visible even against a busy background. */}
                <span
                  aria-hidden
                  className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary transition-transform duration-300 origin-left ${
                    isActive ? 'scale-x-100' : 'scale-x-0'
                  }`}
                />
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