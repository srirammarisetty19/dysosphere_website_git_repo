/* ═══════════════════════════════════════════════════════════════════════════
   SphereX Gateway — Unified Service Entry Point
   Flow: Connect Server → Select Service → Authenticate → Launch

   Architecture (Google pattern):
     accounts.google.com authenticates you → redirects to Gmail/Drive/etc.
     DysoSphere static site authenticates you → redirects to SphereX AI/NAS.

   The static site acts as the centralized identity portal (like accounts.google.com).
   It calls the SphereX server's API cross-origin with CORS enabled on Nginx.
   After auth, it stores the JWT and redirects to the SphereX web app.

   API paths through Nginx:
     POST /api/ai/users/login    → AI server /users/login → proxies to NAS auth
     POST /api/ai/users/register → AI server /users/register → proxies to NAS auth
     GET  /api/ai/health         → AI server /health
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────
  const state = {
    currentStep: 1,       // 1=connect, 2=select, 3=auth
    serverUrl: '',
    authMode: 'login',    // 'login' | 'register'
    selectedService: null, // 'ai' | 'nas'
    isConnecting: false,
    // Populated after successful auth — used to pass to Next.js app
    authToken: null,
    authUsername: null,
    authEmail: null,
    authUserId: null,
  };

  // ── DOM Creation ─────────────────────────────────────────────────────
  function createGateway() {
    // Toast container
    const toastContainer = document.createElement('div');
    toastContainer.className = 'gw-toast-container';
    toastContainer.id = 'gwToastContainer';
    document.body.appendChild(toastContainer);

    // Main overlay
    const overlay = document.createElement('div');
    overlay.className = 'gateway-overlay';
    overlay.id = 'gatewayOverlay';
    overlay.innerHTML = `
      <button class="gateway-close" id="gatewayClose" aria-label="Close">&times;</button>
      <div class="gateway-container" id="gatewayContainer">

        <!-- ═══ STEP 1: SERVER CONNECTION ═══ -->
        <div class="gateway-step active" id="gwStep1">
          <div class="gw-steps-indicator">
            <div class="gw-step-dot active"></div>
            <div class="gw-step-line"></div>
            <div class="gw-step-dot"></div>
            <div class="gw-step-line"></div>
            <div class="gw-step-dot"></div>
          </div>
          <div class="gateway-brand">
            <div class="gateway-logo">⬡</div>
            <h2>Connect to SphereX</h2>
            <p>Enter your SphereX server address to access AI and NAS services</p>
          </div>
          <div class="gw-card">
            <div id="gwConnStatus" style="display:none"></div>
            <div class="gw-server-input-wrap">
              <span class="gw-input-icon">🌐</span>
              <input
                type="text"
                class="gw-input"
                id="gwServerInput"
                placeholder="e.g. dysosphere.ai or 192.168.1.100"
                autocomplete="url"
                spellcheck="false"
              />
            </div>
            <div class="gw-input-hint">Your SphereX appliance IP or domain address</div>
            <button class="gw-btn gw-btn-primary" id="gwConnectBtn">
              <span id="gwConnectBtnText">Connect</span>
            </button>
          </div>
        </div>

        <!-- ═══ STEP 2: SERVICE SELECTOR ═══ -->
        <div class="gateway-step" id="gwStep2">
          <div class="gw-steps-indicator">
            <div class="gw-step-dot completed"></div>
            <div class="gw-step-line completed"></div>
            <div class="gw-step-dot active"></div>
            <div class="gw-step-line"></div>
            <div class="gw-step-dot"></div>
          </div>
          <div class="gateway-brand">
            <div class="gateway-logo">⬡</div>
            <h2>Choose a Service</h2>
            <p>Select the SphereX service you'd like to access</p>
          </div>
          <div class="gw-connected-label" id="gwConnectedLabel">
            <span class="gw-conn-dot"></span>
            Connected to <strong id="gwConnectedUrl"></strong>
          </div>
          <div class="gw-services-grid">
            <div class="gw-service-card" id="gwServiceAI" tabindex="0" role="button" aria-label="Access SphereX AI">
              <div class="gw-service-icon">🧠</div>
              <div>
                <h3>SphereX AI</h3>
                <p>Private AI assistant & document intelligence</p>
                <div class="gw-badge-active">● Active</div>
              </div>
            </div>
            <div class="gw-service-card disabled" id="gwServiceNAS" tabindex="0" role="button" aria-label="SphereX NAS — Coming Soon">
              <div class="gw-service-icon">💾</div>
              <div>
                <h3>SphereX NAS</h3>
                <p>AI-powered intelligent storage</p>
                <div class="gw-badge-soon">🚧 Coming Soon</div>
              </div>
            </div>
          </div>
          <button class="gw-btn-back" id="gwBackToConnect">
            ← Change Server
          </button>
        </div>

        <!-- ═══ STEP 3: AUTH VIEW ═══ -->
        <div class="gateway-step" id="gwStep3">
          <div class="gw-steps-indicator">
            <div class="gw-step-dot completed"></div>
            <div class="gw-step-line completed"></div>
            <div class="gw-step-dot completed"></div>
            <div class="gw-step-line completed"></div>
            <div class="gw-step-dot active"></div>
          </div>
          <div class="gateway-brand">
            <div class="gateway-logo">🧠</div>
            <h2 id="gwAuthTitle">Sign in to SphereX AI</h2>
            <p id="gwAuthSubtitle">Access your private AI assistant</p>
          </div>
          <div class="gw-card">
            <div class="gw-auth-tabs">
              <button class="gw-auth-tab active" id="gwTabLogin">Sign In</button>
              <button class="gw-auth-tab" id="gwTabRegister">Create Account</button>
            </div>

            <div id="gwAuthError" class="gw-error-msg" style="display:none">
              <span class="gw-err-icon">⚠️</span>
              <span id="gwAuthErrorText"></span>
            </div>

            <!-- Login Form -->
            <form class="gw-form" id="gwLoginForm">
              <div class="gw-input-group">
                <span class="gw-input-icon">👤</span>
                <input type="text" class="gw-input" id="gwLoginUsername" placeholder="Username" autocomplete="username" />
              </div>
              <div class="gw-input-group">
                <span class="gw-input-icon">🔒</span>
                <input type="password" class="gw-input" id="gwLoginPassword" placeholder="Password" autocomplete="current-password" />
                <button type="button" class="gw-toggle-pw" id="gwTogglePwLogin" aria-label="Toggle password visibility">👁️</button>
              </div>
              <button type="submit" class="gw-btn gw-btn-primary" id="gwLoginSubmit">
                <span id="gwLoginBtnText">Sign In</span>
              </button>
            </form>

            <!-- Register Form -->
            <form class="gw-form" id="gwRegisterForm" style="display:none">
              <div class="gw-input-group">
                <span class="gw-input-icon">👤</span>
                <input type="text" class="gw-input" id="gwRegUsername" placeholder="Username" autocomplete="username" />
              </div>
              <div class="gw-input-group">
                <span class="gw-input-icon">✉️</span>
                <input type="email" class="gw-input" id="gwRegEmail" placeholder="Email" autocomplete="email" />
              </div>
              <div class="gw-input-group">
                <span class="gw-input-icon">🔒</span>
                <input type="password" class="gw-input" id="gwRegPassword" placeholder="Password" autocomplete="new-password" />
              </div>
              <div class="gw-input-group">
                <span class="gw-input-icon">🔒</span>
                <input type="password" class="gw-input" id="gwRegConfirmPassword" placeholder="Confirm Password" autocomplete="new-password" />
              </div>
              <button type="submit" class="gw-btn gw-btn-primary" id="gwRegisterSubmit">
                <span id="gwRegisterBtnText">Create Account</span>
              </button>
            </form>
          </div>

          <button class="gw-btn-back" id="gwBackToServices" style="margin-top:16px">
            ← Back to Services
          </button>
        </div>

        <!-- ═══ STEP 4: AUTHENTICATED SUCCESS ═══ -->
        <div class="gateway-step" id="gwStep4">
          <div class="gw-steps-indicator">
            <div class="gw-step-dot completed"></div>
            <div class="gw-step-line completed"></div>
            <div class="gw-step-dot completed"></div>
            <div class="gw-step-line completed"></div>
            <div class="gw-step-dot completed"></div>
          </div>
          <div class="gateway-brand">
            <div class="gateway-logo gw-success-logo">✓</div>
            <h2 id="gwSuccessTitle">You're In</h2>
            <p id="gwSuccessSubtitle">Authenticated as <strong id="gwSuccessUser"></strong></p>
          </div>
          <div class="gw-card" style="text-align:center">
            <div class="gw-success-session">
              <div class="gw-session-row">
                <span class="gw-session-label">Server</span>
                <span class="gw-session-value" id="gwSessionServer"></span>
              </div>
              <div class="gw-session-row">
                <span class="gw-session-label">Service</span>
                <span class="gw-session-value">SphereX AI</span>
              </div>
              <div class="gw-session-row">
                <span class="gw-session-label">Status</span>
                <span class="gw-session-value" style="color:#34d399">● Authenticated</span>
              </div>
            </div>
            <div class="gw-success-apps">
              <p class="gw-success-apps-label">Access SphereX AI via:</p>
              <div class="gw-app-buttons">
                <a href="#" class="gw-app-btn" id="gwOpenWebApp" onclick="return false">
                  <span>🌐</span> Web App
                </a>
                <a href="#" class="gw-app-btn" style="border-color:rgba(52,118,252,0.25);background:rgba(52,118,252,0.06)">
                  <span>📱</span> Mobile App
                </a>
              </div>
            </div>
            <button class="gw-btn gw-btn-primary" id="gwDoneBtn" style="margin-top:20px">
              Done
            </button>
          </div>
          <button class="gw-btn-back" id="gwSignOut" style="margin-top:12px">
            🚪 Sign Out
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);
  }

  // ── Toast System ─────────────────────────────────────────────────────
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('gwToastContainer');
    const toast = document.createElement('div');
    const iconMap = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    toast.className = `gw-toast gw-toast-${type}`;
    toast.innerHTML = `<span class="gw-toast-icon">${iconMap[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 350);
    }, duration);
  }

  // ── Step Navigation ──────────────────────────────────────────────────
  function goToStep(step) {
    const steps = document.querySelectorAll('.gateway-step');
    steps.forEach(s => {
      s.classList.remove('active');
      s.style.animation = '';
    });

    const target = document.getElementById(`gwStep${step}`);
    if (target) {
      target.style.animation = 'gw-fadeIn .4s ease forwards';
      target.classList.add('active');
    }

    state.currentStep = step;

    // Focus first input after transition
    setTimeout(() => {
      const input = target?.querySelector('input');
      if (input) input.focus();
    }, 400);
  }

  // ── Server Connection ────────────────────────────────────────────────
  function handleConnect() {
    const input = document.getElementById('gwServerInput');
    const url = input.value.trim();

    if (!url) {
      input.classList.add('error');
      showToast('Please enter your SphereX server address', 'warning');
      setTimeout(() => input.classList.remove('error'), 2000);
      return;
    }

    // Normalize URL — always use HTTPS for SphereX servers
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = `https://${url}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/+$/, '');
    state.serverUrl = normalizedUrl;

    // Show connecting state
    const statusEl = document.getElementById('gwConnStatus');
    statusEl.style.display = 'flex';
    statusEl.className = 'gw-status connecting';
    statusEl.innerHTML = '<span class="gw-status-dot"></span> Verifying server...';

    const btn = document.getElementById('gwConnectBtn');
    const btnText = document.getElementById('gwConnectBtnText');
    btn.disabled = true;
    btnText.innerHTML = '<span class="gw-spinner"></span>';
    state.isConnecting = true;

    // Health check: GET /api/ai/health (goes through Nginx → AI server)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    fetch(`${normalizedUrl}/api/ai/health`, {
      method: 'GET',
      signal: controller.signal,
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('Server returned an error');
        return res.json().catch(() => ({}));
      })
      .then(() => {
        onConnectionSuccess(url, 'connected');
      })
      .catch(err => {
        clearTimeout(timeoutId);
        state.isConnecting = false;
        btn.disabled = false;
        btnText.textContent = 'Connect';

        if (err.name === 'AbortError') {
          statusEl.className = 'gw-status error';
          statusEl.innerHTML = '<span class="gw-status-dot"></span> Connection timed out';
          showToast('Server did not respond. Check the address and ensure it is running.', 'error');
        } else {
          // "Failed to fetch" can mean CORS blocked OR truly unreachable.
          statusEl.className = 'gw-status error';
          statusEl.innerHTML = '<span class="gw-status-dot"></span> Could not reach server';
          showToast(
            'Cannot connect. Check the address and ensure the server is running.',
            'warning',
            6000
          );
        }
      });
  }

  function onConnectionSuccess(displayUrl, statusMsg) {
    state.isConnecting = false;
    const btn = document.getElementById('gwConnectBtn');
    const btnText = document.getElementById('gwConnectBtnText');
    const statusEl = document.getElementById('gwConnStatus');

    btn.disabled = false;
    statusEl.className = 'gw-status connected';
    statusEl.innerHTML = `<span class="gw-status-dot"></span> Connected successfully`;
    btnText.textContent = 'Connect';

    document.getElementById('gwConnectedUrl').textContent = displayUrl;

    try {
      localStorage.setItem('spherex_server', state.serverUrl);
    } catch(e) { /* ok */ }

    showToast(`Connected to ${displayUrl}`, 'success');

    setTimeout(() => {
      statusEl.style.display = 'none';
      goToStep(2);
    }, 600);
  }

  // ── Auth Handling ────────────────────────────────────────────────────
  // Correct Nginx path: POST /api/ai/users/login
  // Nginx strips /api/ai/ → forwards /users/login to AI FastAPI
  // AI server proxies to NAS for actual auth

  function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('gwLoginUsername').value.trim();
    const password = document.getElementById('gwLoginPassword').value.trim();
    const errEl = document.getElementById('gwAuthError');
    const errText = document.getElementById('gwAuthErrorText');

    errEl.style.display = 'none';

    if (!username || !password) {
      errEl.style.display = 'flex';
      errText.textContent = 'Please fill in all fields';
      return;
    }

    const btn = document.getElementById('gwLoginSubmit');
    const btnText = document.getElementById('gwLoginBtnText');
    btn.disabled = true;
    btnText.innerHTML = '<span class="gw-spinner"></span>';

    const serverBase = state.serverUrl;

    fetch(`${serverBase}/api/ai/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(async (res) => {
        if (!res.ok) {
          let msg = 'Incorrect username or password';
          try {
            const data = await res.json();
            msg = data.detail || data.message || msg;
          } catch { /* use default */ }
          throw new Error(msg);
        }
        return res.json();
      })
      .then((data) => {
        // Persist auth state (same format the Next.js auth-store expects)
        persistAuth(data, serverBase, username);

        btn.disabled = false;
        btnText.textContent = 'Sign In';
        showToast('Signed in successfully!', 'success');

        // Show authenticated success screen
        setTimeout(() => {
          showAuthSuccess(data, serverBase, username);
        }, 600);
      })
      .catch((err) => {
        btn.disabled = false;
        btnText.textContent = 'Sign In';
        errEl.style.display = 'flex';
        errText.textContent = err.message;
      });
  }

  function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('gwRegUsername').value.trim();
    const email = document.getElementById('gwRegEmail').value.trim();
    const password = document.getElementById('gwRegPassword').value.trim();
    const confirmPw = document.getElementById('gwRegConfirmPassword').value.trim();
    const errEl = document.getElementById('gwAuthError');
    const errText = document.getElementById('gwAuthErrorText');

    errEl.style.display = 'none';

    if (!username || !email || !password || !confirmPw) {
      errEl.style.display = 'flex';
      errText.textContent = 'Please fill in all fields';
      return;
    }

    if (password !== confirmPw) {
      errEl.style.display = 'flex';
      errText.textContent = 'Passwords do not match';
      return;
    }

    if (password.length < 6) {
      errEl.style.display = 'flex';
      errText.textContent = 'Password must be at least 6 characters';
      return;
    }

    const btn = document.getElementById('gwRegisterSubmit');
    const btnText = document.getElementById('gwRegisterBtnText');
    btn.disabled = true;
    btnText.innerHTML = '<span class="gw-spinner"></span>';

    const serverBase = state.serverUrl;

    fetch(`${serverBase}/api/ai/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
      .then(async (res) => {
        if (!res.ok) {
          let msg = 'Registration failed';
          try {
            const data = await res.json();
            msg = data.detail || data.message || msg;
          } catch { /* use default */ }
          throw new Error(msg);
        }
        return res.json();
      })
      .then((data) => {
        persistAuth(data, serverBase, username, email);

        btn.disabled = false;
        btnText.textContent = 'Create Account';
        showToast('Account created successfully!', 'success');

        setTimeout(() => {
          showAuthSuccess(data, serverBase, username);
        }, 600);
      })
      .catch((err) => {
        btn.disabled = false;
        btnText.textContent = 'Create Account';
        errEl.style.display = 'flex';
        errText.textContent = err.message;
      });
  }

  // ── Persist auth state (hydrate the Next.js Zustand store) ──────────
  function persistAuth(data, serverBase, username, email) {
    const user = data.user || {};

    // Store on state for the "Open Web App" button
    state.authToken = data.access_token;
    state.authUsername = user.username || username;
    state.authEmail = user.email || email || '';
    state.authUserId = user.id || '';

    try {
      // Also store in gateway's localStorage (same-origin use)
      const accountData = {
        state: {
          accounts: [{
            id: `${state.authUsername}@${serverBase}`,
            username: state.authUsername,
            email: state.authEmail,
            serverUrl: serverBase,
            token: data.access_token,
            refreshToken: data.refresh_token || '',
          }],
          activeAccount: {
            id: `${state.authUsername}@${serverBase}`,
            username: state.authUsername,
            email: state.authEmail,
            serverUrl: serverBase,
            token: data.access_token,
            refreshToken: data.refresh_token || '',
          },
          user: {
            id: state.authUserId,
            username: state.authUsername,
            email: state.authEmail,
          },
        },
        version: 0,
      };
      localStorage.setItem('sphere-auth', JSON.stringify(accountData));
      localStorage.setItem('spherex_server', serverBase);
      localStorage.setItem('spherex_service', 'ai');
    } catch(e) { /* localStorage may not be available */ }
  }

  // ── Auto-redirect to web app after successful auth ───────────────────
  function showAuthSuccess(data, serverBase, username) {
    // Build the URL with auth params (OAuth redirect pattern)
    const params = new URLSearchParams({
      token: state.authToken || '',
      server: state.serverUrl || serverBase || '',
      username: state.authUsername || username || '',
      email: state.authEmail || '',
      uid: state.authUserId || '',
    });
    // Redirect to the web app on the same origin (Cloudflare Tunnel serves both)
    // If running on localhost during dev, use relative path.
    const chatPath = `/chat?${params.toString()}`;
    window.location.href = chatPath;
  }

  // ── Toggle Auth Tabs ─────────────────────────────────────────────────
  function switchAuthTab(mode) {
    state.authMode = mode;
    const loginTab = document.getElementById('gwTabLogin');
    const regTab = document.getElementById('gwTabRegister');
    const loginForm = document.getElementById('gwLoginForm');
    const regForm = document.getElementById('gwRegisterForm');
    const errEl = document.getElementById('gwAuthError');
    const title = document.getElementById('gwAuthTitle');
    const subtitle = document.getElementById('gwAuthSubtitle');

    errEl.style.display = 'none';

    if (mode === 'login') {
      loginTab.classList.add('active');
      regTab.classList.remove('active');
      loginForm.style.display = 'flex';
      regForm.style.display = 'none';
      title.textContent = 'Sign in to SphereX AI';
      subtitle.textContent = 'Access your private AI assistant';
    } else {
      loginTab.classList.remove('active');
      regTab.classList.add('active');
      loginForm.style.display = 'none';
      regForm.style.display = 'flex';
      title.textContent = 'Create your Account';
      subtitle.textContent = 'Join SphereX AI on your server';
    }
  }

  // ── Toggle Password Visibility ───────────────────────────────────────
  function setupPasswordToggle(toggleId, inputId) {
    const toggle = document.getElementById(toggleId);
    const input = document.getElementById(inputId);
    if (toggle && input) {
      toggle.addEventListener('click', () => {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        toggle.textContent = isPassword ? '🙈' : '👁️';
      });
    }
  }

  // ── Open / Close ─────────────────────────────────────────────────────
  function openGateway() {
    const overlay = document.getElementById('gatewayOverlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Reset to step 1 if no server connected
    if (!state.serverUrl) {
      goToStep(1);
    }

    // Focus first input
    setTimeout(() => {
      const step = document.querySelector('.gateway-step.active');
      const input = step?.querySelector('input');
      if (input) input.focus();
    }, 400);
  }

  function closeGateway() {
    const overlay = document.getElementById('gatewayOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ── Event Binding ────────────────────────────────────────────────────
  function bindEvents() {
    // Close
    document.getElementById('gatewayClose').addEventListener('click', closeGateway);
    document.getElementById('gatewayOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeGateway();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeGateway();
    });

    // Step 1: Connect
    document.getElementById('gwConnectBtn').addEventListener('click', handleConnect);
    document.getElementById('gwServerInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleConnect();
    });

    // Step 2: Service Selection
    document.getElementById('gwServiceAI').addEventListener('click', () => {
      state.selectedService = 'ai';
      goToStep(3);
    });
    document.getElementById('gwServiceAI').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        state.selectedService = 'ai';
        goToStep(3);
      }
    });

    document.getElementById('gwServiceNAS').addEventListener('click', () => {
      showToast('SphereX NAS is currently in development. Stay tuned!', 'info', 4000);
    });
    document.getElementById('gwServiceNAS').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showToast('SphereX NAS is currently in development. Stay tuned!', 'info', 4000);
      }
    });

    // Back buttons
    document.getElementById('gwBackToConnect').addEventListener('click', () => goToStep(1));
    document.getElementById('gwBackToServices').addEventListener('click', () => goToStep(2));

    // Auth tabs
    document.getElementById('gwTabLogin').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('gwTabRegister').addEventListener('click', () => switchAuthTab('register'));

    // Auth forms
    document.getElementById('gwLoginForm').addEventListener('submit', handleLogin);
    document.getElementById('gwRegisterForm').addEventListener('submit', handleRegister);

    // Password toggles
    setupPasswordToggle('gwTogglePwLogin', 'gwLoginPassword');

    // Step 4: Success screen
    document.getElementById('gwDoneBtn').addEventListener('click', closeGateway);
    document.getElementById('gwOpenWebApp').addEventListener('click', (e) => {
      e.preventDefault();
      // Pass auth data via URL params (OAuth redirect pattern).
      // The Next.js app reads these, stores in its own localStorage, and cleans the URL.
      // This bridges the cross-origin localStorage gap between the static site and the app.
      const params = new URLSearchParams({
        token: state.authToken || '',
        server: state.serverUrl || '',
        username: state.authUsername || '',
        email: state.authEmail || '',
        uid: state.authUserId || '',
      });
      window.open(`/chat?${params.toString()}`, '_blank');
    });
    document.getElementById('gwSignOut').addEventListener('click', () => {
      try {
        localStorage.removeItem('sphere-auth');
        localStorage.removeItem('spherex_server');
        localStorage.removeItem('spherex_service');
      } catch(e) { /* ok */ }
      state.serverUrl = '';
      state.selectedService = null;
      document.getElementById('gwServerInput').value = '';
      showToast('Signed out', 'info');
      goToStep(1);
    });

    // Trigger buttons
    document.querySelectorAll('[data-gateway-trigger]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openGateway();
      });
    });

    // Restore last used server
    try {
      const savedServer = localStorage.getItem('spherex_server');
      if (savedServer) {
        document.getElementById('gwServerInput').value = savedServer.replace(/^https?:\/\//, '');
      }
    } catch(e) { /* ok */ }
  }

  // ── Initialize ───────────────────────────────────────────────────────
  function init() {
    createGateway();
    bindEvents();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external use
  window.SphereXGateway = { open: openGateway, close: closeGateway };
})();
