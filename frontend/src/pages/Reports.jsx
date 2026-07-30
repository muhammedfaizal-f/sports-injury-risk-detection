import { useState } from 'react';
import Topbar from '../components/Topbar';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './RoleDashboards.css';

export default function Reports() {
  const [videoId, setVideoId] = useState('');
  const [downloading, setDownloading] = useState('');
  const [message, setMessage] = useState('');
  const { showToast } = useToast();
 

 const handleDownload = async (format) => {
  if (!videoId) {
    setMessage('Enter a video ID first');
    showToast('Enter a video ID first', 'error');
    return;
  }

  setDownloading(format);
  setMessage('');

  try {
    const res = await api.get(`/reports/${videoId}/${format}`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `report_video_${videoId}.${format === 'excel' ? 'xlsx' : 'pdf'}`
    );

    document.body.appendChild(link);
    link.click();
    link.remove();

    showToast(`${format.toUpperCase()} report downloaded successfully!`, 'success');

  } catch (err) {
    const errorMessage =
      err.response?.data?.detail ||
      'Could not generate report — check the video ID and that analysis has been run';

    setMessage(errorMessage);
    showToast(errorMessage, 'error');

  } finally {
    setDownloading('');
  }
};

  return (
    <div className="role-dashboard-page">
      <Topbar activePage="analysis" userName="Athlete" />
      <main className="role-main">
        <div className="role-header fade-in-up">
          <h1>Export Reports</h1>
          <p className="role-subtitle">Download a PDF or Excel report for any analyzed video.</p>
        </div>

        <div className="role-panel fade-in-up stagger" style={{ '--delay': '0.05s' }}>
          <div className="link-form">
            <input
              type="number"
              placeholder="Video ID"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
            />
            <button onClick={() => handleDownload('pdf')} disabled={downloading === 'pdf'}>
              {downloading === 'pdf' ? <span className="spinner" /> : 'Download PDF'}
            </button>
            <button onClick={() => handleDownload('excel')} disabled={downloading === 'excel'}>
              {downloading === 'excel' ? <span className="spinner" /> : 'Download Excel'}
            </button>
          </div>
          {message && <p className="error-text">{message}</p>}
        </div>
      </main>
    </div>
  );
}