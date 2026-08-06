/**
 * app.js — HASH Commerce
 * Dashboard de gestión de tienda online.
 * Auth: mismo patrón que HASH AI (Google OAuth → Bearer token)
 */

const API_URL = 'https://hash-cloud-production.up.railway.app';

// ── Sesión ─────────────────────────────────────────────────────────────────

const TOKEN_KEY        = 'hcommerce_token';
const TOKEN_EXPIRY_KEY = 'hcommerce_token_expiry';
const TOKEN_TTL_MS     = 7 * 24 * 60 * 60 * 1000; // 7 días

function getToken() {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
  if (!token || Date.now() > expiry) { clearToken(); return null; }
  return token;
}

function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// Verificación periódica: token expirado → logout
setInterval(() => { if (!getToken()) showScreen('login'); }, 5 * 60 * 1000);

async function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;
  window.history.replaceState({}, '', window.location.pathname);
  try {
    const res = await fetch(API_URL + '/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error('Código inválido');
    const data = await res.json();
    if (data.token) setToken(data.token);
  } catch (err) {
    console.error('Auth callback error:', err);
  }
}

async function fetchIdentity() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(API_URL + '/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function loginWithGoogle() {
  window.location.href = API_URL + '/auth/login?next=commerce';
}

function logout() {
  clearToken();
  showScreen('login');
}

// ── Fetch helper ────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(API_URL + path, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + token,
      ...(opts.body && !(opts.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { clearToken(); showScreen('login'); throw new Error('No autorizado'); }
  if (res.status === 403) { showUpgradeModal(); throw new Error('Plan insuficiente'); }
  if (!res.ok) throw new Error('Error ' + res.status);
  const ct = res.headers.get('Content-Type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

// ── API: Tienda ─────────────────────────────────────────────────────────────

async function apiGetStore()           { return apiFetch('/commerce/store'); }
async function apiSaveStore(data)      { return apiFetch('/commerce/store', { method: 'PUT', body: JSON.stringify(data) }); }

// ── API: Productos ──────────────────────────────────────────────────────────

async function apiListProducts()       { return apiFetch('/commerce/products'); }
async function apiGetProduct(id)       { return apiFetch('/commerce/products/' + id); }
async function apiCreateProduct(data)  { return apiFetch('/commerce/products', { method: 'POST', body: JSON.stringify(data) }); }
async function apiUpdateProduct(id, d) { return apiFetch('/commerce/products/' + id, { method: 'PUT', body: JSON.stringify(d) }); }
async function apiDeleteProduct(id)    { return apiFetch('/commerce/products/' + id, { method: 'DELETE' }); }

async function apiUploadProductImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  return apiFetch('/commerce/products/upload-image', { method: 'POST', body: fd });
}

// ── API: Pedidos ────────────────────────────────────────────────────────────

async function apiListOrders()                  { return apiFetch('/commerce/orders'); }
async function apiUpdateOrderStatus(id, status) {
  return apiFetch('/commerce/orders/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
}

// ── API: Clientes ───────────────────────────────────────────────────────────

async function apiListCustomers()      { return apiFetch('/commerce/customers'); }

// ── API: Conectores ─────────────────────────────────────────────────────────

async function apiSaveConnector(name, credentials) {
  return apiFetch('/commerce/connectors/' + name, { method: 'PUT', body: JSON.stringify(credentials) });
}

async function apiGetConnectors()      { return apiFetch('/commerce/connectors'); }

async function apiCreateMpLink(amount, description) {
  return apiFetch('/payments/mercadopago/create', {
    method: 'POST',
    body: JSON.stringify({ amount, description }),
  });
}

// ── API: Métricas ───────────────────────────────────────────────────────────

async function apiGetMetrics()         { return apiFetch('/commerce/metrics'); }

// ── Estado global ───────────────────────────────────────────────────────────

let activeSection = 'dashboard';
let products      = [];
let orders        = [];
let customers     = [];
let connectors    = {};
let storeData     = {};
let editingProduct = null; // null = nuevo, object = edición

// ── Pantallas ───────────────────────────────────────────────────────────────

function showScreen(name) {
  const ids = ['login-screen', 'setup-screen', 'app'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const show = (
      (name === 'login' && id === 'login-screen') ||
      (name === 'setup' && id === 'setup-screen') ||
      (name === 'app'   && id === 'app')
    );
    if (show) el.removeAttribute('hidden');
    else       el.setAttribute('hidden', '');
  });
}

// ── Sidebar / nav ───────────────────────────────────────────────────────────

function initSidebar() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (!section) return;
      navigateTo(section);
      closeSidebar();
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', logout);

  const hamburger = document.getElementById('hamburger');
  const overlay   = document.getElementById('sidebar-overlay');
  hamburger?.addEventListener('click', openSidebar);
  overlay?.addEventListener('click', closeSidebar);
}

function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('visible');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('visible');
}

function navigateTo(section) {
  activeSection = section;

  // Actualizar nav activo
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  // Mostrar/ocultar secciones
  document.querySelectorAll('.section').forEach(el => {
    el.setAttribute('hidden', '');
  });
  const target = document.getElementById('section-' + section);
  if (target) target.removeAttribute('hidden');

  // Título del header
  const titles = {
    dashboard:  'Dashboard',
    products:   'Productos',
    orders:     'Pedidos',
    customers:  'Clientes',
    connectors: 'Conectores',
    settings:   'Ajustes',
  };
  const el = document.getElementById('section-title');
  if (el) el.textContent = titles[section] || section;

  // Cargar datos de la sección
  loadSection(section);
}

async function loadSection(section) {
  switch (section) {
    case 'dashboard':  await loadDashboard();   break;
    case 'products':   await loadProducts();    break;
    case 'orders':     await loadOrders();      break;
    case 'customers':  await loadCustomers();   break;
    case 'connectors': await loadConnectors();  break;
    case 'settings':   renderSettings();        break;
  }
}

// ── Dashboard ───────────────────────────────────────────────────────────────

async function loadDashboard() {
  try {
    const metrics = await apiGetMetrics();
    renderMetrics(metrics);
  } catch {
    // Fallback con datos locales si ya los tenemos
    renderMetrics({
      products:  products.length,
      orders:    orders.length,
      customers: customers.length,
      revenue:   0,
    });
  }
}

function renderMetrics(m) {
  const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
  const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 });

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set('metric-products',  fmt(m.products));
  set('metric-orders',    fmt(m.orders));
  set('metric-customers', fmt(m.customers));
  set('metric-revenue',   fmtMoney(m.revenue));
}

// ── Productos ───────────────────────────────────────────────────────────────

async function loadProducts() {
  try {
    products = await apiListProducts();
  } catch {
    products = [];
  }
  renderProductTable();
}

function renderProductTable() {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="list-empty">No hay productos todavía.</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${escapeHtml(p.name)}</td>
      <td>$${Number(p.price || 0).toLocaleString('es-AR')}</td>
      <td>${p.stock ?? '—'}</td>
      <td>${escapeHtml(p.category || '—')}</td>
      <td>
        <button class="btn-secondary" style="font-size:.78rem;padding:5px 12px;"
          onclick="openProductModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">Editar</button>
        <button class="btn-secondary" style="font-size:.78rem;padding:5px 12px;margin-left:6px;color:var(--red);border-color:var(--red);"
          onclick="confirmDeleteProduct('${escapeHtml(p.id)}', '${escapeHtml(p.name)}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

function openProductModal(product = null) {
  editingProduct = product;
  const modal    = document.getElementById('product-modal');
  const title    = document.getElementById('product-modal-title');
  const status   = document.getElementById('product-modal-status');

  title.textContent  = product ? 'Editar producto' : 'Nuevo producto';
  status.textContent = '';
  status.className   = '';

  // Rellenar campos
  document.getElementById('product-name').value        = product?.name        || '';
  document.getElementById('product-price').value       = product?.price       || '';
  document.getElementById('product-stock').value       = product?.stock       ?? '';
  document.getElementById('product-category').value    = product?.category    || '';
  document.getElementById('product-description').value = product?.description || '';

  // Preview de imagen
  const preview = document.getElementById('product-img-preview');
  preview.src     = product?.image_url || '';
  preview.style.display = product?.image_url ? 'block' : 'none';

  modal.removeAttribute('hidden');
  document.getElementById('product-name').focus();
}

function closeProductModal() {
  document.getElementById('product-modal').setAttribute('hidden', '');
  editingProduct = null;
}

async function saveProduct() {
  const name        = document.getElementById('product-name').value.trim();
  const price       = parseFloat(document.getElementById('product-price').value);
  const stock       = document.getElementById('product-stock').value !== ''
                        ? parseInt(document.getElementById('product-stock').value, 10)
                        : null;
  const category    = document.getElementById('product-category').value.trim();
  const description = document.getElementById('product-description').value.trim();
  const status      = document.getElementById('product-modal-status');

  if (!name) {
    setStatus(status, 'El nombre es obligatorio.', 'error');
    document.getElementById('product-name').focus();
    return;
  }
  if (isNaN(price) || price < 0) {
    setStatus(status, 'Ingresá un precio válido.', 'error');
    return;
  }

  const submitBtn = document.getElementById('product-save-btn');
  submitBtn.disabled = true;
  setStatus(status, 'Guardando...', '');

  // Subir imagen si hay una seleccionada
  const imgInput = document.getElementById('product-img-input');
  let imageUrl = editingProduct?.image_url || null;
  if (imgInput.files[0]) {
    try {
      const uploaded = await apiUploadProductImage(imgInput.files[0]);
      imageUrl = uploaded.url;
    } catch {
      setStatus(status, 'No se pudo subir la imagen.', 'error');
      submitBtn.disabled = false;
      return;
    }
  }

  const payload = { name, price, stock, category, description, image_url: imageUrl };

  try {
    if (editingProduct) {
      const updated = await apiUpdateProduct(editingProduct.id, payload);
      products = products.map(p => p.id === editingProduct.id ? { ...p, ...updated } : p);
    } else {
      const created = await apiCreateProduct(payload);
      products = [created, ...products];
    }
    renderProductTable();
    closeProductModal();
  } catch (err) {
    setStatus(status, 'No se pudo guardar. Intentá de nuevo.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function confirmDeleteProduct(id, name) {
  if (!confirm('¿Eliminar el producto "' + name + '"?')) return;
  deleteProduct(id);
}

async function deleteProduct(id) {
  try {
    await apiDeleteProduct(id);
    products = products.filter(p => p.id !== id);
    renderProductTable();
  } catch {
    alert('No se pudo eliminar el producto.');
  }
}

// ── Pedidos ─────────────────────────────────────────────────────────────────

const ORDER_STATUS_LABELS = {
  pending:  'Pendiente',
  paid:     'Pagado',
  shipped:  'Enviado',
  done:     'Entregado',
  canceled: 'Cancelado',
};

async function loadOrders() {
  try {
    orders = await apiListOrders();
  } catch {
    orders = [];
  }
  renderOrderTable();
}

function renderOrderTable() {
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;

  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="list-empty">No hay pedidos todavía.</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>#${escapeHtml(String(o.id))}</td>
      <td>${escapeHtml(o.customer_name || o.customer_email || '—')}</td>
      <td>$${Number(o.total || 0).toLocaleString('es-AR')}</td>
      <td><span class="badge badge--${escapeHtml(o.status || 'pending')}">${ORDER_STATUS_LABELS[o.status] || o.status}</span></td>
      <td>
        <select class="order-status-select" data-order-id="${escapeHtml(String(o.id))}">
          ${Object.entries(ORDER_STATUS_LABELS).map(([val, label]) =>
            `<option value="${val}"${o.status === val ? ' selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </td>
    </tr>
  `).join('');
}

async function handleOrderStatusChange(orderId, newStatus) {
  try {
    await apiUpdateOrderStatus(orderId, newStatus);
    const order = orders.find(o => String(o.id) === String(orderId));
    if (order) {
      order.status = newStatus;
      renderOrderTable();
    }
  } catch {
    alert('No se pudo actualizar el estado del pedido.');
  }
}

// ── Clientes ────────────────────────────────────────────────────────────────

async function loadCustomers() {
  try {
    customers = await apiListCustomers();
  } catch {
    customers = [];
  }
  renderCustomerTable();
}

function renderCustomerTable() {
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;

  if (!customers.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="list-empty">No hay clientes todavía.</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map(c => `
    <tr>
      <td>${escapeHtml(c.name || '—')}</td>
      <td>${escapeHtml(c.email || '—')}</td>
      <td>${c.orders_count ?? 0}</td>
    </tr>
  `).join('');
}

// ── Conectores ──────────────────────────────────────────────────────────────

async function loadConnectors() {
  try {
    connectors = await apiGetConnectors();
  } catch {
    connectors = {};
  }
  renderConnectors();
}

function renderConnectors() {
  const mpStatus  = document.getElementById('mp-status');
  const pplStatus = document.getElementById('paypal-status');
  if (mpStatus)  mpStatus.textContent  = connectors.mercadopago ? 'Conectado' : 'No conectado';
  if (pplStatus) pplStatus.textContent = connectors.paypal      ? 'Conectado' : 'No conectado';
  if (mpStatus)  mpStatus.className    = 'connector-status' + (connectors.mercadopago ? ' connected' : '');
  if (pplStatus) pplStatus.className   = 'connector-status' + (connectors.paypal      ? ' connected' : '');
}

async function saveMpCredentials() {
  const accessToken = document.getElementById('mp-access-token').value.trim();
  const status      = document.getElementById('mp-save-status');
  if (!accessToken) { setStatus(status, 'Ingresá el Access Token.', 'error'); return; }

  const btn = document.getElementById('mp-save-btn');
  btn.disabled = true;
  setStatus(status, 'Guardando...', '');
  try {
    await apiSaveConnector('mercadopago', { access_token: accessToken });
    connectors.mercadopago = true;
    renderConnectors();
    setStatus(status, 'Conectado correctamente.', 'ok');
    document.getElementById('mp-access-token').value = '';
  } catch {
    setStatus(status, 'No se pudo conectar.', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function savePaypalCredentials() {
  const clientId = document.getElementById('paypal-client-id').value.trim();
  const status   = document.getElementById('paypal-save-status');
  if (!clientId) { setStatus(status, 'Ingresá el Client ID.', 'error'); return; }

  const btn = document.getElementById('paypal-save-btn');
  btn.disabled = true;
  setStatus(status, 'Guardando...', '');
  try {
    await apiSaveConnector('paypal', { client_id: clientId });
    connectors.paypal = true;
    renderConnectors();
    setStatus(status, 'Conectado correctamente.', 'ok');
    document.getElementById('paypal-client-id').value = '';
  } catch {
    setStatus(status, 'No se pudo conectar.', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ── Ajustes ─────────────────────────────────────────────────────────────────

function renderSettings() {
  document.getElementById('settings-store-name').value  = storeData.store_name  || '';
  document.getElementById('settings-company-name').value = storeData.company_name || '';
}

async function saveSettings() {
  const storeName   = document.getElementById('settings-store-name').value.trim();
  const companyName = document.getElementById('settings-company-name').value.trim();
  const status      = document.getElementById('settings-status');

  const btn = document.getElementById('settings-save-btn');
  btn.disabled = true;
  setStatus(status, 'Guardando...', '');

  try {
    const updated = await apiSaveStore({ store_name: storeName, company_name: companyName });
    storeData = { ...storeData, ...updated };
    const sn = document.getElementById('sidebar-store-name');
    if (sn) sn.textContent = storeName || storeData.store_name || 'Mi Tienda';
    setStatus(status, 'Guardado correctamente.', 'ok');
  } catch {
    setStatus(status, 'No se pudo guardar.', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

function initSetup() {
  // Logo preview
  const logoInput = document.getElementById('setup-logo-input');
  const logoArea  = document.getElementById('setup-logo-area');
  const logoImg   = document.getElementById('setup-logo-preview');

  logoArea?.addEventListener('click', () => logoInput?.click());
  logoInput?.addEventListener('change', () => {
    const file = logoInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    logoImg.src = url;
    logoImg.style.display = 'block';
    logoArea.querySelector('span')?.remove();
  });

  // Banner preview
  const bannerInput = document.getElementById('setup-banner-input');
  const bannerArea  = document.getElementById('setup-banner-area');
  const bannerImg   = document.getElementById('setup-banner-preview');

  bannerArea?.addEventListener('click', () => bannerInput?.click());
  bannerInput?.addEventListener('change', () => {
    const file = bannerInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    bannerImg.src = url;
    bannerImg.style.display = 'block';
    bannerArea.querySelector('span')?.remove();
  });

  // Submit
  document.getElementById('setup-submit')?.addEventListener('click', submitSetup);
}

async function submitSetup() {
  const storeName = document.getElementById("setup-store-name").value.trim();
  const status    = document.getElementById("setup-status");

  if (!storeName) {
    setStatus(status, "Ingresá el nombre de tu tienda.", "error");
    document.getElementById("setup-store-name").focus();
    return;
  }

  const btn = document.getElementById("setup-submit");
  btn.disabled = true;
  setStatus(status, "Creando tienda...", "");

  try {
    storeData = await apiFetch("/commerce/setup", {
      method: "POST",
      body: JSON.stringify({ store_name: storeName }),
    });
    const sn = document.getElementById("sidebar-store-name");
    if (sn) sn.textContent = storeName;
    showScreen("app");
    navigateTo("dashboard");
  } catch {
    setStatus(status, "No se pudo crear la tienda. Intentá de nuevo.", "error");
  } finally {
    btn.disabled = false;
  }
}

// ── Upgrade / Paywall ───────────────────────────────────────────────────────

function showUpgradeModal() {
  let modal = document.getElementById('upgrade-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'upgrade-modal';
    modal.style.cssText = `
      position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.85);z-index:200;padding:24px;
    `;
    modal.innerHTML = `
      <div id="upgrade-box" style="
        background:var(--graphite);border:1px solid var(--border-soft);border-radius:var(--radius-md);
        padding:32px 28px;max-width:400px;width:100%;display:flex;flex-direction:column;gap:14px;
        position:relative;
      ">
        <button id="upgrade-close" style="
          position:absolute;top:14px;right:14px;background:none;border:none;
          color:var(--text-dim);font-size:1.1rem;cursor:pointer;line-height:1;
        ">✕</button>

        <h3 style="font-size:1rem;font-weight:700;color:var(--lime);text-transform:uppercase;letter-spacing:.04em;">
          Actualizá tu plan
        </h3>
        <p style="font-size:.85rem;color:var(--text-dim);line-height:1.5;">
          Alcanzaste el límite de tu plan actual. Pasate a <strong style="color:var(--text);">Commerce Pro</strong>
          y gestioná tu tienda sin restricciones.
        </p>

        <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;">
          <li style="font-size:.84rem;color:var(--text);">✓ Productos ilimitados</li>
          <li style="font-size:.84rem;color:var(--text);">✓ Conectores de pago activos</li>
          <li style="font-size:.84rem;color:var(--text);">✓ Clientes y pedidos sin límite</li>
        </ul>

        <p style="font-size:1.5rem;font-weight:700;color:var(--lime);letter-spacing:-.02em;">
          $15 USD / mes
        </p>

        <div style="display:flex;flex-direction:column;gap:8px;">

          <div style="display:flex;gap:8px;">
            <a class="upgrade-pay-btn" href="https://www.paypal.com/ncp/payment/COMMERCE_ID" target="_blank" rel="noopener"
              style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;
                     padding:11px 0;border:1px solid var(--border-soft);border-radius:var(--radius-pill);
                     background:transparent;color:var(--text);font-size:.84rem;font-weight:600;cursor:pointer;
                     text-decoration:none;transition:border-color 150ms;">
              PayPal
            </a>
            <button id="upgrade-mp-btn"
              style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;
                     padding:11px 0;border:1px solid var(--border-soft);border-radius:var(--radius-pill);
                     background:transparent;color:var(--text);font-size:.84rem;font-weight:600;cursor:pointer;
                     transition:border-color 150ms;">
              Mercado Pago
            </button>
          </div>

          <button id="upgrade-usdt-toggle"
            style="width:100%;padding:11px 0;border:1px solid var(--border-soft);border-radius:var(--radius-pill);
                   background:transparent;color:var(--text-dim);font-size:.84rem;font-weight:600;cursor:pointer;">
            Pagar con USDT (Crypto)
          </button>

          <div id="upgrade-usdt-panel" hidden style="
            background:var(--graphite-soft);border:1px solid var(--border);border-radius:var(--radius-sm);
            padding:14px 16px;display:flex;flex-direction:column;gap:8px;
          ">
            <p style="font-size:.8rem;color:var(--text-dim);">
              Enviá exactamente <strong style="color:var(--text);">15 USDT</strong> por red Tron (TRC20):
            </p>
            <div style="display:flex;align-items:center;gap:8px;">
              <span id="upgrade-wallet-addr" style="
                font-size:.78rem;color:var(--lime);font-family:monospace;
                flex:1;word-break:break-all;
              ">TDPfrfpipHtENAANT2zkgLZNFmZE6MaJRw</span>
              <button id="upgrade-usdt-copy" style="
                flex-shrink:0;padding:5px 12px;border:1px solid var(--border-soft);border-radius:var(--radius-pill);
                background:transparent;color:var(--text-dim);font-size:.75rem;cursor:pointer;
              ">Copiar</button>
            </div>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Cerrar
    modal.addEventListener('click', e => { if (e.target === modal) modal.setAttribute('hidden', ''); });
    document.getElementById('upgrade-close').addEventListener('click', () => modal.setAttribute('hidden', ''));

    // Mercado Pago
    document.getElementById('upgrade-mp-btn').addEventListener('click', async () => {
      const btn = document.getElementById('upgrade-mp-btn');
      btn.disabled = true;
      btn.textContent = '...';
      try {
        const data = await apiCreateMpLink(15, 'Commerce Pro');
        if (data.init_point) window.open(data.init_point, '_blank');
      } catch {}
      btn.disabled = false;
      btn.textContent = 'Mercado Pago';
    });

    // Toggle USDT panel
    document.getElementById('upgrade-usdt-toggle').addEventListener('click', () => {
      const panel = document.getElementById('upgrade-usdt-panel');
      panel.hasAttribute('hidden') ? panel.removeAttribute('hidden') : panel.setAttribute('hidden', '');
    });

    // Copiar wallet
    document.getElementById('upgrade-usdt-copy').addEventListener('click', () => {
      const addr = document.getElementById('upgrade-wallet-addr').textContent;
      const btn  = document.getElementById('upgrade-usdt-copy');
      try {
        navigator.clipboard.writeText(addr).catch(() => fallbackCopy(addr));
      } catch { fallbackCopy(addr); }
      btn.textContent = '✓ Copiado';
      setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
    });
  }

  modal.removeAttribute('hidden');
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
}

// ── Modal de producto ───────────────────────────────────────────────────────

function initProductModal() {
  // Botón guardar
  document.getElementById('product-save-btn')?.addEventListener('click', saveProduct);

  // Cancelar / cerrar
  document.getElementById('product-cancel-btn')?.addEventListener('click', closeProductModal);
  document.getElementById('product-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('product-modal')) closeProductModal();
  });

  // Enter en nombre
  document.getElementById('product-name')?.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeProductModal();
  });

  // Preview de imagen al seleccionar archivo
  const imgInput   = document.getElementById('product-img-input');
  const imgArea    = document.getElementById('product-img-area');
  const imgPreview = document.getElementById('product-img-preview');

  imgArea?.addEventListener('click', () => imgInput?.click());
  imgInput?.addEventListener('change', () => {
    const file = imgInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    imgPreview.src = url;
    imgPreview.style.display = 'block';
    imgArea.querySelector('span').textContent = file.name;
  });
}

// ── Órdenes: delegación de eventos ─────────────────────────────────────────

function initOrdersSection() {
  document.getElementById('orders-tbody')?.addEventListener('change', e => {
    const select = e.target.closest('.order-status-select');
    if (!select) return;
    const orderId   = select.dataset.orderId;
    const newStatus = select.value;
    handleOrderStatusChange(orderId, newStatus);
  });
}

// ── Utilidades ──────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className = type === 'error' ? 'status--error'
               : type === 'ok'    ? 'status--ok'
               : '';
}

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Callback OAuth (si venimos del redirect de Google)
  await handleAuthCallback();

  const token = getToken();

  if (!token) {
    showScreen('login');
    document.getElementById('login-btn')?.addEventListener('click', loginWithGoogle);
    return;
  }

  // 2. Verificar identidad
  const identity = await fetchIdentity();
  if (!identity) {
    clearToken();
    showScreen('login');
    document.getElementById('login-btn')?.addEventListener('click', loginWithGoogle);
    return;
  }

  // 3. Ver si la tienda ya fue configurada
  try {
    storeData = await apiGetStore();
    const sn  = document.getElementById('sidebar-store-name');
    if (sn) sn.textContent = storeData.store_name || 'Mi Tienda';

    // Inicializar app
    initSidebar();
    initProductModal();
    initOrdersSection();
    initSetup(); // por si el usuario va a ajustes a cambiar logo
    showScreen('app');
    navigateTo('dashboard');

    // Botón "Nuevo producto"
    document.getElementById('new-product-btn')?.addEventListener('click', () => openProductModal(null));

    // Botones de conectores
    document.getElementById('mp-save-btn')?.addEventListener('click', saveMpCredentials);
    document.getElementById('paypal-save-btn')?.addEventListener('click', savePaypalCredentials);

    // Ajustes
    document.getElementById('settings-save-btn')?.addEventListener('click', saveSettings);

  } catch (err) {
    // La tienda no existe todavía → pantalla de setup
    if (err.message.includes('404') || err.message.includes('Error 404')) {
      initSetup();
      showScreen('setup');
    } else {
      // Otro error (red, etc.)
      clearToken();
      showScreen('login');
      document.getElementById('login-btn')?.addEventListener('click', loginWithGoogle);
    }
  }
});
