// src/layouts/DashboardLayout.tsx
import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "../components/AppSidebar";
import NotificationBell from "../components/NotificationBell";
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
          
          {/* Action Control Header Strip. min-w-0 on both groups: without it a
              long role name ("admin") plus the bell and date forces the row
              wider than a phone viewport. */}
          <header className="h-16 flex items-center justify-between gap-3 px-3 md:px-6 border-b border-neutral-100 bg-white shrink-0">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <SidebarTrigger
                aria-label="Toggle navigation sidebar"
                className="text-neutral-500 hover:text-primary transition-colors shrink-0"
              />
              <div className="hidden sm:block h-4 w-px bg-neutral-200" />
              <div className="flex min-w-0 items-center justify-center rounded-xl gap-2 bg-primary/10 px-2.5 py-2 text-primary transition-all duration-200 hover:scale-105">
                {/* Was text-neutral-500, overriding the brand colour its own
                    wrapper was styled for. */}
                <span className="truncate text-sm font-semibold capitalize">
                  {user.role} Workspace
                </span>
                <Activity size={24} className="animate-pulse shrink-0" />
              </div>
            </div>
            
            {/* Right side: global notifications bell + today's date */}
            <div className="flex items-center gap-3 md:gap-4 shrink-0">
              <NotificationBell />
              {/* The date is the first thing to go when space is tight; it is
                  decorative, and the bell carries real state. */}
              <div className="hidden md:block text-xs font-medium text-neutral-400">
                {/* en-IN to match every other date in the app. */}
                {new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </header>

          {/* Dynamic Nested Content Area */}
          {/* Padding steps down on phones: a fixed p-8 would eat 17% of a
              375px viewport before any content is drawn. */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 min-w-0">
            <Outlet />
          </main>

        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;