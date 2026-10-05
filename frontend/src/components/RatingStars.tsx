import { useState } from "react";
import { Star } from "lucide-react";

export function RatingStars({
  value,
  onChange,
  size = 16,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const interactive = Boolean(onChange);
  const active = interactive ? hover || value : value;

  const stars = [1, 2, 3, 4, 5].map((n) => (
    <Star
      key={n}
      size={size}
      aria-hidden
      className={
        n <= active
          ? "fill-amber-400 text-amber-400"
          : "fill-neutral-200 text-neutral-300"
      }
    />
  ));

  // Read-only view: the stars are decorative, so expose the score as a single
  // labelled image instead of five disabled buttons a screen reader reads out
  // individually.
  if (!interactive) {
    return (
      <span
        role="img"
        aria-label={
          value > 0 ? `Rated ${value} out of 5` : "Not yet rated"
        }
        className="flex items-center gap-0.5"
      >
        {stars}
      </span>
    );
  }

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => setHover(n)}
          className="cursor-pointer"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            size={size}
            aria-hidden
            className={
              n <= active
                ? "fill-amber-400 text-amber-400"
                : "fill-neutral-200 text-neutral-300"
            }
          />
        </button>
      ))}
    </div>
  );
}