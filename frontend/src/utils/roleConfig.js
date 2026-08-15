export const ROLE_CONFIG = {
 athlete: {
  label: 'Athlete',
  homePath: '/dashboard',
  navLinks: [
    { key: 'overview', label: 'Overview', path: '/dashboard' },
    { key: 'videos', label: 'Videos', path: '/videos' },
    { key: 'progress', label: 'Progress', path: '/progress' },
    { key: 'training', label: 'Training Guidance', path: '/training-guidance' },
    { key: 'recovery', label: 'Recovery Guidance', path: '/recovery-guidance' },
    { key: 'analytics', label: 'Analytics', path: '/analytics' },
    { key: 'profile', label: 'My Profile', path: '/profile' },
    { key: 'settings', label: 'Settings', path: '/settings' },
  ],
},
  coach: {
    label: 'Coach',
    homePath: '/coach-dashboard',
    navLinks: [
      { key: 'overview', label: 'Team Overview', path: '/coach-dashboard' },
      { key: 'settings', label: 'Settings', path: '/settings' },
    ],
  },
  physiotherapist: {
    label: 'Physiotherapist',
    homePath: '/physio-dashboard',
    navLinks: [
      { key: 'overview', label: 'Athlete Lookup', path: '/physio-dashboard' },
      { key: 'settings', label: 'Settings', path: '/settings' },
    ],
  },
  sports_scientist: {
    label: 'Sports Scientist',
    homePath: '/scientist-dashboard',
    navLinks: [
      { key: 'overview', label: 'Research Overview', path: '/scientist-dashboard' },
      { key: 'settings', label: 'Settings', path: '/settings' },
    ],
  },
  admin: {
    label: 'Admin',
    homePath: '/admin-dashboard',
    navLinks: [
      { key: 'overview', label: 'System Overview', path: '/admin-dashboard' },
      { key: 'settings', label: 'Settings', path: '/settings' },
    ],
  },
};

export function getRoleConfig(role) {
  return ROLE_CONFIG[role] || ROLE_CONFIG.athlete;
}