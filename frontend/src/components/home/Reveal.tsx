import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Stagger in milliseconds, for grids of cards. */
  delay?: number;
  className?: string;
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/**
 * Fades content up the first time it scrolls into view. Uses an
 * IntersectionObserver rather than scroll handlers, and starts out visible for
 * visitors who prefer reduced motion — so the text is never hidden behind an
 * animation that will never run.
 */
export function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(prefersReducedMotion);

  useEffect(() => {
    const node = ref.current;
    // Nothing to observe when content starts visible.
    if (!node || isVisible) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setIsVisible(true);
          // One-shot: no need to keep watching after it has appeared.
          observer.disconnect();
          break;
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div
      ref={ref}
      className={`rp-reveal ${isVisible ? "is-visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
