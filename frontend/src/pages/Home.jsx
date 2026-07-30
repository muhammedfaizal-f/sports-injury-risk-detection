import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import './Home.css';

const FEATURES = [
    { icon: '🎥', title: 'Video Upload', desc: 'Upload athlete movement clips — running, jumping, landing, sprinting.' },
    { icon: '🦴', title: 'Pose Estimation', desc: 'MediaPipe detects 33 body landmarks per frame automatically.' },
    { icon: '📐', title: 'Biomechanical Analysis', desc: 'Joint angles, range of motion, and left/right symmetry, computed frame by frame.' },
    { icon: '⚠️', title: 'Injury Risk Scoring', desc: 'Weighted risk model across biomechanics, history, load, and fatigue.' },
    { icon: '📊', title: 'Role Dashboards', desc: 'Tailored views for athletes, coaches, physiotherapists, and sports scientists.' },
    { icon: '📄', title: 'Exportable Reports', desc: 'Download full PDF or Excel reports for any analyzed session.' },
];

export default function Home() {
    const navigate = useNavigate();

    return (
        <div className="home-page">
            <header className="home-nav fade-in-up">
                <span className="home-logo"><span className="logo-dot" />SIRD</span>
                <div className="home-nav-actions">
                    <ThemeToggle />
                    <button className="btn-ghost" onClick={() => navigate('/login')}>Sign in</button>
                    <button onClick={() => navigate('/register')}>Get Started</button>
                </div>
            </header>

            <section className="home-hero section">
                <div className="hero-glow" />
                <h1 className="fade-in-up">
                    Catch injuries <span className="gradient-text">before they happen</span>
                </h1>
                <p className="hero-subtitle fade-in-up stagger" style={{ '--delay': '0.1s' }}>
                    Upload a movement video. Get AI-powered pose analysis, biomechanical
                    breakdown, and injury risk scoring — built for athletes, coaches, and
                    sports science teams.
                </p>
                <div className="hero-actions fade-in-up stagger" style={{ '--delay': '0.2s' }}>
                    <button className="btn-glow ripple-btn" onClick={() => navigate('/register')}>Start free</button>
                    <button className="btn-ghost" onClick={() => navigate('/login')}>I have an account</button>
                </div>
            </section>

            <section className="home-features section">
                <h2 className="fade-in-up">Everything the pipeline needs</h2>
                <div className="feature-grid">
                    {FEATURES.map((f, i) => (
                        <div
                            className="feature-card glass-card hover-lift fade-in-up stagger"
                            style={{ '--delay': `${i * 0.07}s` }}
                            key={f.title}
                        >
                            <span className="feature-icon">{f.icon}</span>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="home-cta section">
                <div className="glass-card cta-card fade-in-up">
                    <h2>Ready to analyze your first video?</h2>
                    <p>Create an athlete account and upload a clip in under two minutes.</p>
                    <button className="btn-glow ripple-btn" onClick={() => navigate('/register')}>Create free account</button>
                </div>
            </section>

            <footer className="home-footer">
                <span>Sports Injury Risk Detection — Infosys Springboard Internship Project</span>
            </footer>
        </div>
    );
}