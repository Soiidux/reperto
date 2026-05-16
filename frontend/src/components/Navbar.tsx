import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ArrowRight, LogOut, LayoutDashboard } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-neutral-100 sticky top-0 z-50 shadow-sm backdrop-blur-md">
      <div className="mx-auto px-32 h-16 flex justify-between items-center">
        
        {/* Logo */}
        <div className="flex items-center">
          <Link to="/">
            <img src="/logo.svg" alt="logo" className="w-15 h-12 object-contain" />
          </Link>
        </div>

        {/* Dynamic Navigation Links */}
        <div className="hidden md:flex items-center space-x-10">
          <Link to="/" className="text-neutral-600 hover:bg-primary hover:text-white px-4 py-2 rounded-lg font-semibold transition-all">
            Home
          </Link>
          <Link to="/about" className="text-neutral-600 hover:bg-primary hover:text-white px-4 py-2 rounded-lg font-semibold transition-all">
            About
          </Link>
          <Link to="/contact" className="text-neutral-600 hover:bg-primary hover:text-white px-4 py-2 rounded-lg font-semibold transition-all">
            Contact
          </Link> 
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
                className="text-neutral-500 hover:text-danger p-2 hover:bg-danger/5 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <Link 
              to="/login" 
              className="text-white bg-primary px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 hover:opacity-90 shadow-sm"
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