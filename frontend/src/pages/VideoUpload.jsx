import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar';
import EmptyState from '../components/EmptyState';
import api from '../api';
import { useToast } from '../components/ToastContext';
import './VideoUpload.css';

const ACTIVITIES = ['Running', 'Sprinting', 'Jumping', 'Squatting', 'Landing', 'Throwing', 'Cutting Movement'];

const STATUS_STYLES = {
  uploaded: 'status-pending',
  processing: 'status-processing',
  processed: 'status-processing',
  pose_estimated: 'status-processing',
  biomechanics_analyzed: 'status-processing',
  analyzed: 'status-done',
  risk_predicted: 'status-done',
  invalid: 'status-error',
};

export default function VideoUpload() {
  const [file, setFile] = useState(null);
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [videos, setVideos] = useState([]);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const loadVideos = () => {
    api.get('/videos/mine').then((res) => setVideos(res.data));
  };

  useEffect(() => { loadVideos(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return setMessage('Choose a video file first');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('activity_type', activity);

    setUploading(true);
    setMessage('');
    try {
      await api.post('/videos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage('Uploaded successfully');
      setFile(null);
      loadVideos();
    } catch (err) {
      setMessage(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleProcess = async (videoId) => {
    setProcessingId(videoId);
    setMessage('');
    try {
      const res = await api.post(`/videos/${videoId}/analyze-full`);
      setMessage(`Analysis complete — quality score ${res.data.quality_score}/100`);
      loadVideos();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setMessage(detail?.issues ? `Rejected: ${detail.issues.join('; ')}` : detail || 'Analysis failed');
      loadVideos();
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (videoId) => {
    setDeletingId(videoId);
    try {
      await api.delete(`/videos/${videoId}`);
      showToast('Video deleted', 'success');
      setConfirmDeleteId(null);
      loadVideos();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not delete video', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="video-page">
      <Topbar activePage="videos" userName="Athlete" />

      <main className="video-main">
        <section className="upload-panel fade-in-up">
          <h2>Upload a movement clip</h2>
          <p className="upload-hint">
            5–15 seconds, good lighting, full body in frame. Landing, jumping, and
            sprinting clips give the most useful analysis once pose estimation is live.
          </p>

          <form onSubmit={handleUpload} className="upload-form">
            <div className={`upload-dropzone ${file ? 'has-file' : ''}`}>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo"
                onChange={(e) => setFile(e.target.files[0])}
              />
              <span>{file ? `✓ ${file.name}` : 'Click or drag a video file here'}</span>
            </div>

            <div className="upload-form-row">
              <select value={activity} onChange={(e) => setActivity(e.target.value)}>
                {ACTIVITIES.map((a) => (<option key={a} value={a}>{a}</option>))}
              </select>
              <button type="submit" disabled={uploading}>
                {uploading ? (<><span className="spinner" /> Uploading...</>) : 'Upload Video'}
              </button>
            </div>
          </form>

          {message && <p className="upload-message">{message}</p>}
        </section>

        <section className="video-list-panel fade-in-up stagger" style={{ '--delay': '0.1s' }}>
          <h2>Your uploads</h2>

          {videos.length === 0 && (
            <EmptyState
              icon="🎬"
              title="No videos yet"
              description="Upload your first movement clip above to get started."
            />
          )}

          <div className="video-list">
            {videos.map((v, i) => (
              <div className="video-row stagger" style={{ '--delay': `${i * 0.05}s` }} key={v.id}>
                <div className="video-row-info">
                  <span className="video-activity">
                    Video #{i + 1} — {v.activity_type}
                  </span>
                  <span className={`video-status ${STATUS_STYLES[v.status] || ''}`}>{v.status}</span>
                </div>

                {confirmDeleteId === v.id ? (
                  <div className="video-row-confirm">
                    <span className="confirm-label">Delete this video?</span>
                    <button
                      className="confirm-yes"
                      onClick={() => handleDelete(v.id)}
                      disabled={deletingId === v.id}
                    >
                      {deletingId === v.id ? <span className="spinner" /> : 'Yes, delete'}
                    </button>
                    <button className="confirm-no" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                  </div>
                ) : (
                  <div className="video-row-actions">
                    <button
                      className="process-btn"
                      disabled={v.status === 'analyzed' || v.status === 'risk_predicted' || processingId === v.id}
                      onClick={() => handleProcess(v.id)}
                    >
                      {processingId === v.id ? <span className="spinner" /> : ['analyzed', 'risk_predicted'].includes(v.status) ? 'Done' : 'Analyze'}
                    </button>
                    {['analyzed', 'risk_predicted'].includes(v.status) && (
                      <button className="view-btn" onClick={() => navigate(`/analysis?video=${v.id}`)}>
                        View Analysis
                      </button>
                    )}
                    <button className="delete-btn" onClick={() => setConfirmDeleteId(v.id)} title="Delete video">
                      🗑
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}