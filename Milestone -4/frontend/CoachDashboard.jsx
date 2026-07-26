import { useState, useEffect } from 'react';
import Topbar from '../components/Topbar';
import api from '../api';
import './RoleDashboards.css';

export default function CoachDashboard() {
    const [team, setTeam] = useState([]);
    const [athleteId, setAthleteId] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    const loadTeam = () => {
        api.get('/dashboard/coach/team')
            .then((res) => setTeam(res.data))
            .catch(() => setTeam([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadTeam(); }, []);

    const handleLink = async (e) => {
        e.preventDefault();
        if (!athleteId) return;
        try {
            await api.post('/dashboard/coach/link-athlete', { athlete_id: Number(athleteId) });
            setMessage('Athlete linked to your team');
            setAthleteId('');
            loadTeam();
        } catch (err) {
            setMessage(err.response?.data?.detail || 'Could not link athlete');
        }
    };

    const highRiskCount = team.filter((a) => ['high', 'critical'].includes(a.latest_risk_category)).length;

    return (
        <div className="role-dashboard-page">
            <Topbar activePage="overview" userName="Coach" />
            <main className="role-main">
                <div className="role-header fade-in-up">
                    <h1>Team Risk Overview</h1>
                    <p className="role-subtitle">Athletes linked to your team and their latest injury risk status.</p>
                </div>

                <div className="role-stat-strip fade-in-up stagger" style={{ '--delay': '0.05s' }}>
                    <div className="role-stat-item">
                        <span className="role-stat-value">{team.length}</span>
                        <span className="role-stat-label">Athletes on Team</span>
                    </div>
                    <div className="role-stat-item">
                        <span className="role-stat-value">{highRiskCount}</span>
                        <span className="role-stat-label">High/Critical Risk</span>
                    </div>
                </div>

                <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
                    <h3>Link an Athlete</h3>
                    <form className="link-form" onSubmit={handleLink}>
                        <input
                            type="number"
                            placeholder="Athlete ID"
                            value={athleteId}
                            onChange={(e) => setAthleteId(e.target.value)}
                        />
                        <button type="submit">Add to Team</button>
                    </form>
                    {message && <p className="success-text">{message}</p>}
                </div>

                <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.15s' }}>
                    <h3>Team</h3>
                    {loading ? (
                        <p className="role-empty">Loading...</p>
                    ) : team.length === 0 ? (
                        <p className="role-empty">No athletes linked yet. Add one above using their Athlete ID.</p>
                    ) : (
                        <table className="role-table">
                            <thead>
                                <tr>
                                    <th>Athlete</th>
                                    <th>Sport</th>
                                    <th>Videos Analyzed</th>
                                    <th>Latest Risk</th>
                                    <th>Injury Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {team.map((a) => (
                                    <tr key={a.athlete_id}>
                                        <td>{a.full_name}</td>
                                        <td>{a.sport_type || '—'}</td>
                                        <td>{a.videos_analyzed}</td>
                                        <td>
                                            <span className={`risk-pill ${a.latest_risk_category || 'none'}`}>
                                                {a.latest_risk_category || 'No data'}
                                            </span>
                                        </td>
                                        <td>{a.latest_injury_type || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    );
}