import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

const RootLayout = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="grow flex items-center justify-center bg-background">
        <Outlet /> 
      </main>
      <footer className="py-6 text-center text-muted-foreground text-sm border-t border-border bg-card/60">
        © 2026 Reperto Clinic Management. All rights reserved.
      </footer>
    </div>
  );
};

export default RootLayout;