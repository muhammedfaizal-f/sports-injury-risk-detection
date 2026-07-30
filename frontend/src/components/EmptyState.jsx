import './EmptyState.css';

export default function EmptyState({ icon = '📭', title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state fade-in">
      <div className="empty-state-icon">{icon}</div>
      <h4 className="empty-state-title">{title}</h4>
      {description && <p className="empty-state-desc">{description}</p>}
      {actionLabel && onAction && (
        <button className="empty-state-action" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}