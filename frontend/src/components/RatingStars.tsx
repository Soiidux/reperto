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

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => interactive && setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => interactive && setHover(n)}
          className={interactive ? "cursor-pointer" : "cursor-default"}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            size={size}
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