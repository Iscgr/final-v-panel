import { useEffect, useRef, useState } from 'react';

/**
 * ساده ترین انیمیشن tween عددی برای درصد/آمار
 */
export function useAnimatedNumber(value: number, duration = 600, easing: (t: number) => number = easeOutCubic) {
  const [animated, setAnimated] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const toRef = useRef(value);

  useEffect(() => {
    if (value === toRef.current) return; // no change
    fromRef.current = animated;
    toRef.current = value;
    startRef.current = null;
    let raf: number;
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      const e = easing(p);
      const next = fromRef.current + (toRef.current - fromRef.current) * e;
      setAnimated(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, easing]);

  return Math.round(animated);
}

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }
