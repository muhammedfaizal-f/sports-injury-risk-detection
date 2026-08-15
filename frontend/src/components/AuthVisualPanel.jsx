import { useState, useEffect } from 'react';
import './AuthVisualPanel.css';

const SLIDES = [
  {
    src: "/image/auth1.jpg",
    caption: "Detect injury risk before it becomes a setback."
  },
  {
    src: "/image/auth5.jpg",
    caption: "Turn every movement into meaningful insights."
  },
  {
    src: "/image/auth3.jpg",
    caption: "Advanced movement analysis for better athletic performance."
  },
  {
    src: "/image/auth6.jpg",
    caption: "Understand movement. Identify risk. Perform better."
  },
  {
    src: "/image/auth2.jpg",
    caption: "AI-driven analysis designed for smarter training."
  },
  {
    src: "/image/auth7.jpg",
    caption: "Track biomechanics and uncover movement patterns."
  },
  {
    src: "/image/auth4.jpg",
    caption: "One platform for athletes, coaches and medical teams."
  },
  {
    src: "/image/auth8.jpg",
    caption: "Train with confidence. Perform with precision."
  }
];

export default function AuthVisualPanel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="auth-bg-layer">
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          className={`auth-bg-slide ${i === index ? 'active' : ''}`}
          style={{ backgroundImage: `url(${slide.src})` }}
        />
      ))}
      <div className="auth-bg-overlay" />

      <div className="auth-bg-brand">
        <span className="logo-dot" /> SIRD
      </div>

      <p key={index} className="auth-bg-caption fade-in-up">
        {SLIDES[index].caption}
      </p>

      <div className="auth-bg-dots">
        {SLIDES.map((_, i) => (
          <span key={i} className={`auth-bg-dot ${i === index ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}