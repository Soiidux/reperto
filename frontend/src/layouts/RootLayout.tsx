import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

const RootLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow flex items-center justify-center bg-neutral-50">
        {/* The Outlet is where individual pages like /doctor/dashboard will load */}
        <Outlet /> 
      </main>
      <footer className="py-6 text-center text-neutral-400 text-sm border-t border-neutral-100 bg-white">
        © 2026 Reperto Clinic Management. All rights reserved.
      </footer>
    </div>
  );
};

export default RootLayout;