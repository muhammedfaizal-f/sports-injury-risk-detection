import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle dark/light mode"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className={`theme-toggle-track ${theme}`}>
        <span className="theme-toggle-thumb">{theme === 'dark' ? '🌙' : '☀️'}</span>
      </span>
    </button>
  );
}