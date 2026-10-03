import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useClinicSettings } from "@/hooks/use-clinic-settings";
import { useAuthStore } from "@/store/authStore";
import { HeroSection } from "@/components/home/HeroSection";
import { AboutSection } from "@/components/home/AboutSection";
import { DoctorsSection } from "@/components/home/DoctorsSection";
import { ContactSection } from "@/components/home/ContactSection";

/**
 * The public landing page: about, doctors and contact on a single scrollable
 * page instead of separate routes. Navbar links land here as "/#about" etc.,
 * so a fresh load (or a shared link) still jumps to the right section.
 */
export default function Home() {
  const { clinic } = useClinicSettings();
  const user = useAuthStore((state) => state.user);
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash || hash === "#") return;
    const id = hash.slice(1);
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div className="w-full">
      <HeroSection clinic={clinic} isLoggedIn={Boolean(user)} />
      <AboutSection clinic={clinic} />
      <DoctorsSection />
      <ContactSection clinic={clinic} />
    </div>
  );
}
