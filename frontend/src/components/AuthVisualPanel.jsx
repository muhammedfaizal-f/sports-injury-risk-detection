import { useState, useEffect } from 'react';
import './AuthVisualPanel.css';

const SLIDES = [
{
src:"/image/auth1.jpg",
caption:"Detect injury risk before it happens."
},
{
src:"/image/auth2.jpg",
caption:"AI-powered pose estimation for every movement."
},
{
src:"/image/auth3.jpg",
caption:"Built for athletes, coaches and sports scientists."
},
{
src:"/image/auth4.jpg",
caption:"Train smarter. Reduce injuries. Improve performance."
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