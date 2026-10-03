/**
 * Decorative botanical/clinical motif for the hero — an inline SVG so it
 * always renders, needs no network, and scales cleanly. Hidden from
 * assistive tech.
 */
export function ClinicIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="rp-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5D6D53" />
          <stop offset="100%" stopColor="#A1B099" />
        </linearGradient>
        <linearGradient id="rp-coral" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#E8AC91" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#E8AC91" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* Concentric soft rings */}
      <circle cx="200" cy="200" r="188" stroke="#5D6D53" strokeOpacity="0.10" />
      <circle cx="200" cy="200" r="150" stroke="#5D6D53" strokeOpacity="0.14" />
      <circle cx="200" cy="200" r="112" stroke="#E8AC91" strokeOpacity="0.22" />

      {/* Leaves sprouting from the base */}
      <g stroke="url(#rp-leaf)" strokeWidth="6" strokeLinecap="round" fill="none">
        <path d="M200 330 C200 268 200 226 200 186" />
        <path d="M200 258 C164 246 146 218 148 186 C182 192 200 220 200 258 Z" fill="url(#rp-leaf)" fillOpacity="0.18" />
        <path d="M200 226 C236 214 254 186 252 154 C218 160 200 188 200 226 Z" fill="url(#rp-leaf)" fillOpacity="0.12" />
      </g>

      {/* Heartbeat line across the middle */}
      <path
        d="M40 200 H120 L136 176 L156 232 L178 150 L200 214 L214 200 H360"
        stroke="url(#rp-coral)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Clinical dot accents */}
      <circle cx="92" cy="112" r="7" fill="#5D6D53" fillOpacity="0.35" />
      <circle cx="318" cy="128" r="5" fill="#E8AC91" fillOpacity="0.6" />
      <circle cx="300" cy="292" r="6" fill="#5D6D53" fillOpacity="0.25" />
      <circle cx="110" cy="286" r="4" fill="#E8AC91" fillOpacity="0.5" />
    </svg>
  );
}
