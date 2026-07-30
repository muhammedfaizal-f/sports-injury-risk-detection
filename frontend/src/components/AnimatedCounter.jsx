import { useState, useEffect, useRef } from 'react';

export default function AnimatedCounter({ value, duration = 800, decimals = 0, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef();

  useEffect(() => {
    const numericValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numericValue)) {
      setDisplay(value); // non-numeric (e.g. "—"), show as-is
      return;
    }

    const start = performance.now();
    const from = 0;

    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(from + (numericValue - from) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  const formatted = typeof display === 'number' ? display.toFixed(decimals) : display;

  return <span className="counter-pop">{formatted}{suffix}</span>;
}