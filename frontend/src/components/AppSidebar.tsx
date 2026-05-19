import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/authStore";
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarDays,
  History,
  UserSquare2,
  SlidersHorizontal,
  Users,
  CalendarOff,
  Stethoscope,
  Pill,
} from "lucide-react";
import { Link } from "react-router-dom";
const menuConfigs = {
  patient: [
    {
      title: "Overview Portal",
      url: "/patient/dashboard",
      icon: LayoutDashboard,
    },
    { title: "Book Appointment", url: "/patient/book-appointment", icon: CalendarPlus },
    {
      title: "Upcoming Bookings",
      url: "/patient/appointments",
      icon: CalendarDays,
    },
    { title: "Consultation History", url: "/patient/history", icon: History },
    { title: "Find Doctors", url: "/patient/doctors", icon: SlidersHorizontal },
    {
      title: "My Profile Settings",
      url: "/patient/profile",
      icon: UserSquare2,
    },
  ],
  doctor: [
    {
      title: "Doctor Slate Overview",
      url: "/doctor/dashboard",
      icon: LayoutDashboard,
    },
    { title: "Active Consultation", url: "/doctor/consult", icon: Stethoscope },
    { title: "Patient Directory", url: "/doctor/patients", icon: Users },
    { title: "Past Appointments", url: "/doctor/history", icon: History },
    {
      title: "Schedule Adjustments",
      url: "/doctor/schedule",
      icon: CalendarOff,
    },
    { title: "Remedy Inventory", url: "/doctor/inventory", icon: Pill },
  ],
};

export default function AppSidebar() {
  const { user } = useAuthStore();
  const menu = menuConfigs[user?.role];

  if (!user?.role || !menu) {
    return null;
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-neutral-100 bg-white">
        <div className="flex items-center justify-center transition-all duration-200 hover:scale-105">
            <Link to="/">
              <img src="/logo.svg" alt="logo" className="w-15 h-12 object-contain" />
            </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu>
            {menu?.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <a href={item.url}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
