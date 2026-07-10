import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../api';
import './Dashboard.css';

export default function Dashboard() {
    const [userName, setUserName] = useState('');

    useEffect(() => {
        // Reuses the athlete profile endpoint if available, otherwise falls back.
        // Full "current user" endpoint can be added if needed beyond M1.
        api.get('/athletes/me')
            .then(() => setUserName('Athlete'))
            .catch(() => setUserName('User'));
    }, []);

    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    const stats = [
        { label: 'Active Athletes', value: '—', note: 'Live count coming in later milestones' },
        { label: 'Videos Uploaded', value: '—', note: 'Video upload arrives in Milestone 2' },
        { label: 'High Risk Detected', value: '—', note: 'Risk scoring arrives in Milestone 3' },
        { label: 'Processing Latency', value: '—', note: 'Pipeline metrics arrive in Milestone 2' },
    ];

    return (
        <div className="dashboard-layout">
            <Sidebar activePage="dashboard" userName={userName} />

            <main className="dashboard-main">
                <div className="dashboard-header">
                    <div>
                        <h1>Dashboard</h1>
                        <p className="dashboard-subtitle">
                            Upload athlete movement videos to analyze joint angles, posture, and
                            injury risk once the AI pipeline is connected.
                        </p>
                    </div>
                    <span className="dashboard-date">{today}</span>
                </div>

                <div className="dashboard-actions">
                    <button className="btn-primary" disabled title="Available from Milestone 2">
                        Upload Action Video
                    </button>
                    <button className="btn-secondary" disabled title="Available from Milestone 4">
                        Run Diagnostics
                    </button>
                </div>

                <div className="stat-grid">
                    {stats.map((s) => (
                        <div className="stat-card" key={s.label}>
                            <span className="stat-label">{s.label}</span>
                            <span className="stat-value">{s.value}</span>
                            <span className="stat-note">{s.note}</span>
                        </div>
                    ))}
                </div>

                <div className="dashboard-panels">
                    <div className="panel">
                        <div className="panel-header">
                            <h3>Recent Analyses</h3>
                        </div>
                        <p className="panel-empty">
                            No analyses yet — this table will populate once video upload and pose
                            estimation are built in Milestone 2.
                        </p>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <h3>System Status</h3>
                        </div>
                        <ul className="status-list">
                            <li>
                                <span>API Service</span>
                                <span className="status-badge online">Online</span>
                            </li>
                            <li>
                                <span>Database</span>
                                <span className="status-badge online">Connected</span>
                            </li>
                            <li>
                                <span>Computer Vision Module</span>
                                <span className="status-badge pending">Not built yet</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
}