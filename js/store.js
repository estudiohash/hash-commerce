/**
 * store.js — HASH Commerce
 * JS compartido para todas las plantillas de tienda pública.
 */

const API_URL = 'https://hash-cloud-production.up.railway.app';

// ── Estado global ─────────────────────────────────────────────────────────────
let carrito        = [];
let productoActual = null;
let storeInfo      = null;
let todosLosProductos = [];

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatPrecio(n) {
  return '$' + Number(n).toLocaleString('es-AR');
}

// ── Carrito ───────────────────────────────────────────────────────────────────
function actualizarContador() {
  const el = document.getElementById('carrito-count');
  if (el) el.textContent = carrito.length;
}

function agregarAlCarrito(producto) {
  carrito.push(producto);
  actualizarContador();
}

function quitarDelCarrito(idx) {
  carrito.splice(idx, 1);
  actualizarContador();
  renderizarCarrito();
}

function vaciarCarrito() {
  carrito = [];
  actualizarContador();
  renderizarCarrito();
}

function calcularTotal() {
  return carrito.reduce((acc, item) => acc + item.precio, 0);
}

function renderizarCarrito() {
  const lista = document.getElementById('carrito-lista');
  const total = document.getElementById('carrito-total');
  if (!lista) return;

  if (!carrito.length) {
    lista.innerHTML = '<p style="color:var(--muted,var(--color-muted));font-size:.85rem;padding:1rem 0;text-align:center;letter-spacing:.08em;text-transform:uppercase;">El carrito está vacío</p>';
    if (total) total.textContent = '';
    return;
  }

  lista.innerHTML = carrito.map((item, i) => `
    <div class="carrito-item">
      <div>
        <div class="carrito-item__nombre">${escHtml(item.nombre)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:.5rem;">
        <span class="carrito-item__precio">${formatPrecio(item.precio)}</span>
        <button class="carrito-item__quitar" onclick="quitarDelCarrito(${i})">✕</button>
      </div>
    </div>
  `).join('');

  if (total) total.textContent = 'Total: ' + formatPrecio(calcularTotal());
}

// ── Carrito UI ────────────────────────────────────────────────────────────────
function initCarritoUI() {
  document.getElementById('btn-carrito')?.addEventListener('click', () => {
    renderizarCarrito();
    document.getElementById('carrito-section')?.classList.add('activo');
    document.body.classList.add('popup-abierto');
  });

  document.getElementById('btn-cerrar-carrito')?.addEventListener('click', cerrarCarrito);
  document.getElementById('btn-seguir-comprando')?.addEventListener('click', cerrarCarrito);

  document.getElementById('btn-vaciar-carrito')?.addEventListener('click', vaciarCarrito);

  document.getElementById('btn-ir-checkout')?.addEventListener('click', () => {
    if (!carrito.length) return;
    document.getElementById('carrito-section')?.classList.remove('activo');
    document.getElementById('modal-datos')?.classList.add('activo');
  });
}

function cerrarCarrito() {
  document.getElementById('carrito-section')?.classList.remove('activo');
  document.body.classList.remove('popup-abierto');
}

// ── Checkout UI ───────────────────────────────────────────────────────────────
function initCheckoutUI() {
  document.getElementById('btn-cerrar-modal-datos')?.addEventListener('click', () => {
    document.getElementById('modal-datos')?.classList.remove('activo');
    document.body.classList.remove('popup-abierto');
  });

  document.getElementById('btn-volver-carrito')?.addEventListener('click', () => {
    document.getElementById('modal-datos')?.classList.remove('activo');
    document.getElementById('carrito-section')?.classList.add('activo');
  });

  document.getElementById('btn-enviar-pedido')?.addEventListener('click', enviarPedido);
}

function enviarPedido() {
  const nombre    = document.getElementById('f-nombre')?.value.trim();
  const telefono  = document.getElementById('f-telefono')?.value.trim();
  const email     = document.getElementById('f-email')?.value.trim();
  const direccion = document.getElementById('f-direccion')?.value.trim();
  const localidad = document.getElementById('f-localidad')?.value.trim();
  const provincia = document.getElementById('f-provincia')?.value.trim();
  const msg       = document.getElementById('checkout-mensaje');

  if (!nombre || !telefono || !email || !direccion || !localidad || !provincia) {
    if (msg) { msg.textContent = 'Completá todos los campos.'; msg.removeAttribute('hidden'); }
    return;
  }

  const resumen = carrito.map(i => `• ${i.nombre} — ${formatPrecio(i.precio)}`).join('\n');
  const total   = formatPrecio(calcularTotal());
  const texto   = `*Nuevo pedido*\n\n*Nombre:* ${nombre}\n*Tel:* ${telefono}\n*Email:* ${email}\n*Dirección:* ${direccion}, ${localidad}, ${provincia}\n\n*Productos:*\n${resumen}\n\n*Total: ${total}*`;

  if (storeInfo?.whatsapp) {
    const waNum = storeInfo.whatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(texto)}`, '_blank');
  } else {
    if (msg) { msg.textContent = '¡Pedido recibido! El dueño de la tienda te contactará pronto.'; msg.removeAttribute('hidden'); }
  }

  vaciarCarrito();
}

// ── Theme toggle ──────────────────────────────────────────────────────────────
function initTheme() {
  let dark = false;
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    dark = !dark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  });
}

// ── Popup producto ────────────────────────────────────────────────────────────
function abrirPopup(producto) {
  productoActual = producto;

  const imgBox = document.getElementById('popup-imagen');
  const images = [producto.image_url, producto.image_url_2, producto.image_url_3].filter(Boolean);

  if (images.length > 1) {
    imgBox.innerHTML = `
      <div class="popup__carrusel">
        ${images.map((src, i) => `<img src="${escHtml(src)}" class="popup__carrusel-img${i===0?' activa':''}" alt="">`).join('')}
        <div class="popup__carrusel-dots">
          ${images.map((_, i) => `<button class="popup__carrusel-dot${i===0?' activo':''}" data-idx="${i}"></button>`).join('')}
        </div>
      </div>`;
    imgBox.querySelectorAll('.popup__carrusel-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.idx);
        imgBox.querySelectorAll('.popup__carrusel-img').forEach((img, i) => img.classList.toggle('activa', i === idx));
        imgBox.querySelectorAll('.popup__carrusel-dot').forEach((d, i) => d.classList.toggle('activo', i === idx));
      });
    });
  } else if (images.length === 1) {
    imgBox.innerHTML = `<img src="${escHtml(images[0])}" alt="${escHtml(producto.name)}">`;
  } else {
    imgBox.innerHTML = `<div class="producto__sin-imagen">◻</div>`;
  }

  document.getElementById('popup-nombre').textContent = producto.name;
  document.getElementById('popup-precio').textContent = formatPrecio(producto.price);
  document.getElementById('popup-desc').textContent   = producto.description || '';

  const stockEl = document.getElementById('popup-stock');
  if (stockEl) {
    stockEl.textContent = producto.stock != null
      ? (producto.stock > 0 ? producto.stock + ' disponibles' : 'Sin stock')
      : '';
  }

  const btnAgregar = document.getElementById('popup-agregar');
  if (btnAgregar) {
    btnAgregar.disabled    = producto.stock === 0;
    btnAgregar.textContent = producto.stock === 0 ? 'Sin stock' : '+ Agregar al carrito';
    btnAgregar.onclick = () => {
      agregarAlCarrito({ nombre: producto.name, precio: Number(producto.price) });
      cerrarPopup();
      renderizarCarrito();
      document.getElementById('carrito-section')?.classList.add('activo');
      document.body.classList.add('popup-abierto');
    };
  }

  document.getElementById('popup-overlay')?.classList.add('activo');
  document.body.classList.add('popup-abierto');
}

function cerrarPopup() {
  document.getElementById('popup-overlay')?.classList.remove('activo');
  document.body.classList.remove('popup-abierto');
  productoActual = null;
}

function initPopupUI() {
  document.getElementById('popup-cerrar')?.addEventListener('click', cerrarPopup);
  document.getElementById('popup-volver')?.addEventListener('click', cerrarPopup);
  document.getElementById('popup-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('popup-overlay')) cerrarPopup();
  });
}

// ── Tarjeta producto ──────────────────────────────────────────────────────────
function crearTarjeta(p) {
  const img = p.image_url
    ? `<img src="${escHtml(p.image_url)}" alt="${escHtml(p.name)}" loading="lazy">`
    : `<div class="producto__sin-imagen">◻</div>`;

  return `
    <div class="producto" data-id="${escHtml(String(p.id))}">
      <div class="producto__imagen">${img}</div>
      <div class="producto__info">
        <span class="producto__nombre">${escHtml(p.name)}</span>
        <span class="producto__precio">${formatPrecio(p.price)}</span>
        ${p.stock != null ? `<span class="producto__sub">${p.stock > 0 ? p.stock + ' disp.' : 'Sin stock'}</span>` : ''}
      </div>
      <button class="producto__agregar" data-action="carrito" ${p.stock === 0 ? 'disabled' : ''}>
        ${p.stock === 0 ? 'Sin stock' : '+ Agregar'}
      </button>
    </div>`;
}

// ── Render: plantilla CATÁLOGO (grid + tabs) ──────────────────────────────────
function renderCatalogo(productos) {
  const grid   = document.getElementById('catalogo-grid');
  const catsNav = document.getElementById('cats-nav');
  const tabsWrap = catsNav?.querySelector('.cats-nav__inner');
  if (!grid) return;

  // Agrupar categorías
  const cats = [...new Set(productos.map(p => p.category_name).filter(Boolean))];

  // Tabs
  if (cats.length && tabsWrap) {
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className  = 'cat-tab';
      btn.dataset.cat = cat;
      btn.textContent = cat;
      tabsWrap.appendChild(btn);
    });
    catsNav.removeAttribute('hidden');

    tabsWrap.addEventListener('click', e => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      tabsWrap.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('activo'));
      tab.classList.add('activo');
      filtrarGrid(tab.dataset.cat, productos);
    });
  }

  // Render inicial: todos
  grid.innerHTML = productos.map(p => crearTarjeta(p)).join('');
  grid.removeAttribute('hidden');

  // Click en tarjeta
  grid.addEventListener('click', e => {
    const card = e.target.closest('.producto');
    if (!card) return;
    const id      = card.dataset.id;
    const product = todosLosProductos.find(p => String(p.id) === id);
    if (!product) return;
    if (e.target.dataset.action === 'carrito') {
      if (product.stock === 0) return;
      agregarAlCarrito({ nombre: product.name, precio: Number(product.price) });
      renderizarCarrito();
      document.getElementById('carrito-section')?.classList.add('activo');
      document.body.classList.add('popup-abierto');
    } else {
      abrirPopup(product);
    }
  });
}

function filtrarGrid(cat, productos) {
  const grid = document.getElementById('catalogo-grid');
  if (!grid) return;
  const filtrados = cat === 'todos' ? productos : productos.filter(p => p.category_name === cat);
  grid.innerHTML = filtrados.map(p => crearTarjeta(p)).join('');
}

// ── Render: plantilla BOLD (carruseles por categoría) ─────────────────────────
function renderBold(productos) {
  const container = document.getElementById('categorias-container');
  if (!container) return;
  container.innerHTML = '';

  const grupos = {};
  const sinCat = [];
  productos.forEach(p => {
    if (p.category_name) {
      if (!grupos[p.category_name]) grupos[p.category_name] = [];
      grupos[p.category_name].push(p);
    } else {
      sinCat.push(p);
    }
  });

  let idx = 0;
  function agregarSeccion(nombre, prods) {
    const seccion = renderCarruselBold(nombre, prods, idx++);
    const imgSrc  = prods.find(p => p.image_url)?.image_url || null;
    if (imgSrc) {
      const wrapper = document.createElement('div');
      wrapper.className = 'divisor-con-carrusel';
      const divImg = document.createElement('div');
      divImg.className = 'divisor-imagen';
      divImg.innerHTML = `<img src="${escHtml(imgSrc)}" alt="${escHtml(nombre)}" class="divisor-imagen__img">`;
      wrapper.appendChild(divImg);
      wrapper.appendChild(seccion);
      container.appendChild(wrapper);
    } else {
      container.appendChild(seccion);
    }
  }

  Object.entries(grupos).forEach(([nombre, prods]) => agregarSeccion(nombre, prods));
  if (sinCat.length) agregarSeccion('Productos', sinCat);
}

function renderCarruselBold(nombre, productos, index) {
  const color   = index % 2 === 0 ? 'blanco' : 'negro';
  const seccion = document.createElement('section');
  seccion.className = `seccion-categoria seccion-categoria--${color}`;
  const total = productos.length;

  seccion.innerHTML = `
    <div class="seccion__inner">
      <p class="seccion__label">Colección</p>
      <div class="seccion__header">
        <h2 class="catalogo-pagina__titulo">${escHtml(nombre)}</h2>
        <div class="carrusel__controles">
          <button class="carrusel__flecha" data-dir="-1">&#8592;</button>
          <button class="carrusel__flecha" data-dir="1">&#8594;</button>
          <button class="carrusel__ver-todos">Ver todos (${total})</button>
        </div>
      </div>
      <div class="carrusel__track-wrap">
        <div class="carrusel__track">
          ${productos.map(p => crearTarjeta(p)).join('')}
        </div>
      </div>
    </div>`;

  let pos = 0;
  const track   = seccion.querySelector('.carrusel__track');
  const wrap    = seccion.querySelector('.carrusel__track-wrap');
  const VISIBLE = window.innerWidth < 500 ? 1 : window.innerWidth < 900 ? 2 : 4;
  const MAX     = Math.max(0, total - VISIBLE);

  seccion.querySelectorAll('.carrusel__flecha').forEach(btn => {
    btn.addEventListener('click', () => {
      pos = Math.min(MAX, Math.max(0, pos + parseInt(btn.dataset.dir)));
      const cardW = (track.querySelector('.producto')?.offsetWidth || 0) + 16;
      track.style.transform = `translateX(-${pos * cardW}px)`;
    });
  });

  seccion.querySelector('.carrusel__ver-todos')?.addEventListener('click', () => {
    track.style.flexWrap  = 'wrap';
    track.style.transform = 'none';
    wrap.style.overflow   = 'visible';
  });

  seccion.addEventListener('click', e => {
    const card = e.target.closest('.producto');
    if (!card) return;
    const id      = card.dataset.id;
    const product = todosLosProductos.find(p => String(p.id) === id);
    if (!product) return;
    if (e.target.dataset.action === 'carrito') {
      if (product.stock === 0) return;
      agregarAlCarrito({ nombre: product.name, precio: Number(product.price) });
      renderizarCarrito();
      document.getElementById('carrito-section')?.classList.add('activo');
      document.body.classList.add('popup-abierto');
    } else {
      abrirPopup(product);
    }
  });

  return seccion;
}

// ── Detectar plantilla activa ──────────────────────────────────────────────────
function getTemplate() {
  return document.body.dataset.template || 'bold';
}

function renderProductos(productos) {
  const template = getTemplate();
  if (template === 'catalogo') {
    renderCatalogo(productos);
  } else {
    renderBold(productos);
  }
}

// ── Cargar tienda ─────────────────────────────────────────────────────────────
async function loadStore() {
  const host  = window.location.hostname;
  const parts = host.split('.');
  let slug = parts.length >= 3 ? parts[0] : null;
  if (!slug || slug === 'www') {
    slug = new URLSearchParams(window.location.search).get('slug');
  }
  if (!slug) { showError(); return; }

  try {
    const res = await fetch(`${API_URL}/commerce/public/${slug}`);
    if (!res.ok) { showError(); return; }
    const data = await res.json();
    storeInfo = data;
    todosLosProductos = data.products || [];
    renderStore(data);
  } catch {
    showError();
  }
}

function renderStore(data) {
  document.title = data.store_name || 'Tienda';

  // Banner
  const bannerEl  = document.getElementById('store-banner');
  const bannerImg = document.getElementById('store-banner-img');
  if (data.banner_url && bannerEl && bannerImg) {
    bannerImg.src = data.banner_url;
    bannerEl.removeAttribute('hidden');
  }

  // Logo
  const logoText = document.getElementById('store-logo-text');
  const logoImg  = document.getElementById('store-logo-img');
  if (data.logo_url && logoImg) {
    logoImg.src = data.logo_url;
    logoImg.removeAttribute('hidden');
    if (logoText) logoText.style.display = 'none';
  } else if (logoText) {
    logoText.textContent = data.store_name || 'Tienda';
  }

  // Ticker (solo plantilla bold)
  const ticker = document.getElementById('store-ticker');
  if (ticker) {
    const nombre = (data.store_name || 'Tienda').toUpperCase();
    const line   = (nombre + ' ♦ ').repeat(8) + ' ';
    const t1 = document.getElementById('ticker-text-1');
    const t2 = document.getElementById('ticker-text-2');
    if (t1) t1.textContent = line;
    if (t2) t2.textContent = line;
    ticker.removeAttribute('hidden');
  }

  // Footer
  const footerName = document.getElementById('footer-store-name');
  if (footerName) footerName.textContent = data.store_name || '';
  document.getElementById('store-footer')?.removeAttribute('hidden');

  // WhatsApp
  if (data.whatsapp) {
    const wa = document.getElementById('whatsapp-flotante');
    if (wa) {
      wa.href = `https://wa.me/${data.whatsapp.replace(/\D/g, '')}`;
      wa.removeAttribute('hidden');
    }
  }

  document.getElementById('store-loading')?.setAttribute('hidden', '');

  if (!data.products?.length) {
    document.getElementById('store-empty')?.removeAttribute('hidden');
    return;
  }

  renderProductos(data.products);
}

function showError() {
  document.getElementById('store-loading')?.setAttribute('hidden', '');
  document.getElementById('store-error')?.removeAttribute('hidden');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initCarritoUI();
  initCheckoutUI();
  initPopupUI();
  initTheme();
  loadStore();
});
