export function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded; // { sub: userId, role: "coach", exp: ... }
  } catch {
    return null;
  }
}

export function getCurrentRole() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  const decoded = decodeToken(token);
  return decoded?.role || null;
}