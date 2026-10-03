/**
 * Decorative backdrop for the public landing page: slow sage/coral colour
 * washes, a faint lattice and a grain overlay. Purely presentational — it is
 * hidden from assistive tech and never intercepts clicks. Animations live in
 * App.css and are disabled under prefers-reduced-motion.
 */
export function AuroraBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base wash keeps the cream page from reading as flat white */}
      <div className="absolute inset-0 bg-background" />

      {/* Drifting colour blooms */}
      <div
        className="rp-drift absolute -top-40 -left-32 h-[38rem] w-[38rem] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--primary) 55%, transparent), transparent 70%)",
        }}
      />
      <div
        className="rp-drift absolute top-1/4 -right-40 h-[34rem] w-[34rem] rounded-full opacity-35 blur-3xl"
        style={{
          animationDelay: "-8s",
          background:
            "radial-gradient(circle at 60% 40%, color-mix(in oklab, var(--secondary) 65%, transparent), transparent 70%)",
        }}
      />
      <div
        className="rp-drift absolute -bottom-52 left-1/3 h-[32rem] w-[32rem] rounded-full opacity-30 blur-3xl"
        style={{
          animationDelay: "-16s",
          background:
            "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--muted) 90%, transparent), transparent 70%)",
        }}
      />

      {/* Lattice + grain for texture */}
      <div className="rp-dots absolute inset-0 opacity-40" />
      <div className="rp-grain absolute inset-0 opacity-[0.035] mix-blend-multiply" />
    </div>
  );
}
