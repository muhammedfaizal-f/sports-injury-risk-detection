import { useState, useEffect } from 'react';
import './AuthVisualPanel.css';

const SLIDES = [
  {
    src: "/image/auth1.jpg",
    caption: "Catch risk before it becomes an injury.",
  },
  {
    src: "/image/auth2.jpg",
    caption: "Every landing tells a biomechanical story.",
  },
  {
    src: "/image/auth3.jpg",
    caption: "Built for athletes, coaches, and sports science teams.",
  },
  {
    src: "/image/auth4.jpg",
    caption: "Pose estimation meets injury prevention.",
  },
];

export default function AuthVisualPanel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="auth-visual-panel">
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className={`auth-visual-slide ${i === index ? 'active' : ''}`}
          style={{ backgroundImage: `url(${slide.src})` }}
        />
      ))}
      <div className="auth-visual-overlay" />
      <div className="auth-visual-content">
        <span className="auth-visual-logo"><span className="logo-dot" />SIRD</span>
        <p key={index} className="auth-visual-caption fade-in-up">{SLIDES[index].caption}</p>
        <div className="auth-visual-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`auth-visual-dot ${i === index ? 'active' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}