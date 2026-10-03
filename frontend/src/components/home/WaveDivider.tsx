/**
 * Soft wave divider used between landing-page sections. Purely decorative.
 *
 * `fillClass` must be a text-colour utility (e.g. "text-card") because the
 * wave path is filled with `currentColor`, not painted with a background.
 */
export function WaveDivider({
  fillClass,
  flip = false,
}: {
  fillClass: string;
  flip?: boolean;
}) {
  return (
    <div aria-hidden className={`leading-[0] ${flip ? "rotate-180" : ""}`}>
      <svg
        className={`block w-full h-[52px] sm:h-[72px] ${fillClass}`}
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
      >
        <path
          fill="currentColor"
          d="M0,40 C240,88 480,0 720,32 C960,64 1200,104 1440,56 L1440,80 L0,80 Z"
        />
      </svg>
    </div>
  );
}
