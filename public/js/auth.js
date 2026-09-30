/**
 * TETEL Admin Authentication Service
 * Credenciales por defecto: admin@tetel.com / tetel@$2026
 */
class AdminAuth {
  constructor() {
    this.tokenKey = 'tetel_admin_token';
    this.userKey = 'tetel_admin_user';
  }

  isAuthenticated() {
    const token = localStorage.getItem(this.tokenKey);
    return Boolean(token);
  }

  getUser() {
    try {
      return JSON.parse(localStorage.getItem(this.userKey) || '{"email":"admin@tetel.com"}');
    } catch {
      return { email: 'admin@tetel.com' };
    }
  }

  showLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) {
      modal.style.display = 'flex';
      const emailInput = document.getElementById('login-admin-email');
      const passInput = document.getElementById('login-admin-password');
      if (emailInput && !emailInput.value) emailInput.value = 'admin@tetel.com';
      if (passInput && !passInput.value) passInput.value = 'tetel@$2026';
      const errEl = document.getElementById('admin-login-error');
      if (errEl) errEl.style.display = 'none';
    }
  }

  hideLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) modal.style.display = 'none';
  }

  cancelLogin() {
    this.hideLoginModal();
    window.location.hash = '';
  }

  async handleLogin(event) {
    if (event) event.preventDefault();
    const emailEl = document.getElementById('login-admin-email');
    const passEl = document.getElementById('login-admin-password');
    const errorEl = document.getElementById('admin-login-error');

    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value : '';

    if (errorEl) errorEl.style.display = 'none';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem(this.tokenKey, data.token);
        localStorage.setItem(this.userKey, JSON.stringify(data.admin));
        this.hideLoginModal();

        const userDisplay = document.getElementById('admin-user-display');
        if (userDisplay) userDisplay.textContent = data.admin.email;

        if (window.adminManager) {
          window.adminManager.open();
        }
      } else {
        if (errorEl) {
          errorEl.textContent = data.error || 'Credenciales incorrectas. Verifica correo y contraseña.';
          errorEl.style.display = 'block';
        }
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Error de conexión con el servidor.';
        errorEl.style.display = 'block';
      }
    }
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    if (window.adminManager) {
      window.adminManager.close();
    }
    window.location.hash = '';
    alert('Has cerrado sesión correctamente del panel de administración.');
  }
}

export const adminAuth = new AdminAuth();
window.adminAuth = adminAuth;
