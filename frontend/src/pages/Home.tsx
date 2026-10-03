import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useClinicSettings } from "@/hooks/use-clinic-settings";
import { useAuthStore } from "@/store/authStore";
import { AuroraBackdrop } from "@/components/home/AuroraBackdrop";
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

  // Deep links ("/#contact") jump to the right section. Scrolling happens
  // twice — immediately, and once more after the page settles — because the
  // clinic/doctor data loads async and would otherwise leave the target
  // offset by however much content arrived in the meantime.
  useEffect(() => {
    if (!hash || hash === "#") return;

    const scrollToHash = () => {
      const target = document.getElementById(hash.slice(1));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    scrollToHash();
    const settleTimer = window.setTimeout(scrollToHash, 350);
    return () => window.clearTimeout(settleTimer);
  }, [hash]);

  return (
    <div className="relative w-full">
      <AuroraBackdrop />
      <HeroSection clinic={clinic} isLoggedIn={Boolean(user)} />
      <AboutSection clinic={clinic} />
      <DoctorsSection />
      <ContactSection clinic={clinic} />
    </div>
  );
}
