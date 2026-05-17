// src/layouts/DashboardLayout.tsx
import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "../components/AppSidebar";
import { Activity } from "lucide-react";
const DashboardLayout = () => {
  const { user, accessToken } = useAuthStore();

  // Route Guard Gate: Kick out to login if unauthorized
  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-screen overflow-hidden bg-neutral-50/50">
        
        {/* Our custom dynamic Sidebar (now housing the profile card footer) */}
        <AppSidebar />

        {/* Core Content Layout Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          
          {/* Action Control Header Strip */}
          <header className="h-16 flex items-center justify-between px-6 border-b border-neutral-100 bg-white shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-neutral-500 hover:text-primary transition-colors" />
              <div className="h-4 w-px bg-neutral-200" />
              <div className="flex items-center justify-center rounded-xl gap-2 bg-primary/10 p-2.5 text-primary transition-all duration-200 hover:scale-105">
                <span className="text-sm font-semibold text-neutral-500 capitalize">
                  {user.role} Workspace
                </span>
                <Activity size={24} className="animate-pulse" />
              </div>
            </div>
            
            {/* Right side of top bar is now clear, perfect for global notifications or date badges later */}
            <div className="text-xs font-medium text-neutral-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </header>

          {/* Dynamic Nested Content Area */}
          <main className="flex-1 overflow-y-auto p-8 min-w-0">
            <Outlet />
          </main>

        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;