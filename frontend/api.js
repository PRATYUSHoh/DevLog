const API = 'https://devlog-production-a576.up.railway.app';

function getToken() { return localStorage.getItem('devlog_token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('devlog_user')); } catch { return null; }
}
function setAuth(token, user) {
  localStorage.setItem('devlog_token', token);
  localStorage.setItem('devlog_user', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('devlog_token');
  localStorage.removeItem('devlog_user');
}
function isLoggedIn() { return !!getToken(); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, message: data.error || data.message || 'Request failed' };
  return data;
}

async function apiUpload(path, formData) {
  const token = getToken();
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, message: data.error || 'Upload failed' };
  return data;
}

function renderNav() {
  const user = getUser();
  const navUser = document.getElementById('nav-user');
  const navAuth = document.getElementById('nav-auth');
  if (navUser && user) {
    navUser.textContent = user.username;
    if (user.isAdmin) navUser.textContent += ' [admin]';
    else if (user.isMember) navUser.textContent += ' [member]';
  }
  if (navAuth) {
    if (isLoggedIn()) {
      navAuth.innerHTML = `<a href="#" onclick="logout()">logout</a>`;
    } else {
      navAuth.innerHTML = `<a href="index.html">login</a>`;
    }
  }
}

function logout() {
  clearAuth();
  window.location.href = 'index.html';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(str) {
  return new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}
