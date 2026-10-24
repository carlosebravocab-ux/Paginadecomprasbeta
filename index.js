const PRODUCTS = [
  {
    id: "lino-bolso",
    name: "Bolso Lino Weekend",
    category: "Accesorios",
    price: 749,
    oldPrice: 899,
    tag: "Favorito",
    description: "Un bolso ligero y espacioso, confeccionado en una mezcla de lino resistente. Ideal para escapadas, el día a día y todo lo que quieras llevar contigo.",
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=85",
    popularity: 96,
    stock: 12
  },
  {
    id: "audifonos-nube",
    name: "Audífonos Nube Pro",
    category: "Tecnología",
    price: 1299,
    oldPrice: 1499,
    tag: "Más vendido",
    description: "Sonido envolvente y cómodo diseño inalámbrico para acompañar tu música, tus llamadas y tus momentos de concentración.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85",
    popularity: 100,
    stock: 9
  },
  {
    id: "termo-bruma",
    name: "Termo Bruma 600 ml",
    category: "Hogar",
    price: 389,
    oldPrice: null,
    tag: "Nuevo",
    description: "Mantén tus bebidas a la temperatura ideal con este termo reutilizable de acero inoxidable. Un compañero práctico para casa o para llevar.",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85",
    popularity: 88,
    stock: 20
  },
  {
    id: "lampara-onda",
    name: "Lámpara Onda de mesa",
    category: "Hogar",
    price: 899,
    oldPrice: 1099,
    tag: "Edición especial",
    description: "Luz cálida y silueta orgánica para darle un toque sereno a tu escritorio o mesa de noche. Incluye foco LED de bajo consumo.",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85",
    popularity: 79,
    stock: 7
  },
  {
    id: "taza-aurora",
    name: "Set de tazas Aurora",
    category: "Cocina",
    price: 459,
    oldPrice: null,
    tag: "Hecho con cuidado",
    description: "Dos tazas de cerámica con acabado artesanal y colores suaves. Diseñadas para hacer especial tu café, té o chocolate de cada día.",
    image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85",
    popularity: 72,
    stock: 14
  },
  {
    id: "mochila-ruta",
    name: "Mochila Ruta Urbana",
    category: "Accesorios",
    price: 1050,
    oldPrice: 1190,
    tag: "Lista para salir",
    description: "Compartimentos prácticos, espalda acolchada y un perfil limpio que se adapta a tus recorridos por la ciudad y tus días de trabajo.",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85",
    popularity: 91,
    stock: 8
  },
  {
    id: "teclado-punto",
    name: "Teclado Punto compacto",
    category: "Tecnología",
    price: 969,
    oldPrice: null,
    tag: "Escritorio feliz",
    description: "Teclado compacto de perfil delgado, conexión inalámbrica y teclas cómodas para que tus ideas fluyan desde cualquier espacio.",
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85",
    popularity: 84,
    stock: 10
  },
  {
    id: "florero-calma",
    name: "Florero Calma",
    category: "Hogar",
    price: 529,
    oldPrice: null,
    tag: "Pieza decorativa",
    description: "Una pieza de líneas suaves para flores frescas o para decorar por sí sola. Su diseño sencillo encuentra lugar en cualquier rincón.",
    image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=900&q=85",
    popularity: 68,
    stock: 6
  }
];

const CATEGORIES = ["Todo", "Hogar", "Tecnología", "Accesorios", "Cocina"];
const KEYS = { cart: "luma_cart", user: "luma_user", orders: "luma_orders" };
const DEMO_CREDENTIALS_KEY = "luma_demo_credentials_session";
const app = document.getElementById("app");
let checkoutAddress = null;
const recentOrderAddresses = new Map();
let toastTimer;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`No se pudo leer el almacenamiento local (${key}).`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`No se pudo guardar en el almacenamiento local (${key}).`, error);
    showToast("No se pudieron guardar los cambios en este navegador.", true);
    return false;
  }
}

function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (error) {
    console.error("No se pudo acceder a la sesión temporal del navegador.", error);
    showToast("El navegador no permitió guardar el paso actual del proceso.", true);
    return null;
  }
}

function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {
    console.error("No se pudo guardar la sesión temporal del navegador.", error);
    showToast("El navegador no permitió guardar el paso actual del proceso.", true);
  }
}

function removeSession(key) {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {
    console.error("No se pudo limpiar la sesión temporal del navegador.", error);
  }
}

function getCart() {
  const cart = readStorage(KEYS.cart, []);
  if (!Array.isArray(cart)) return [];
  return cart.filter((item) => PRODUCTS.some((product) => product.id === item.id)
    && Number.isInteger(item.quantity) && item.quantity > 0);
}

function setCart(cart) {
  const saved = writeStorage(KEYS.cart, cart);
  updateCartCount();
  return saved;
}

function getUser() {
  const user = readStorage(KEYS.user, null);
  return user && typeof user.email === "string" && typeof user.name === "string" ? user : null;
}

function money(amount) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(amount);
}

function productById(id) {
  return PRODUCTS.find((product) => product.id === id);
}

function cartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartCount() {
  document.getElementById("cart-count").textContent = String(cartCount());
}

function cartSubtotal() {
  return getCart().reduce((sum, item) => {
    const product = productById(item.id);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
}

function shippingCost(subtotal = cartSubtotal()) {
  return subtotal === 0 || subtotal >= 1500 ? 0 : 99;
}

function orderTotal() {
  const subtotal = cartSubtotal();
  return subtotal + shippingCost(subtotal);
}

function showToast(message, isError = false, notificationType = "confirmations", action = null) {
  if (!isError && window.LumaSettings && !window.LumaSettings.notifications()[notificationType]) return;
  const region = document.getElementById("toast-region");
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.setAttribute("role", isError ? "alert" : "status");
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = isError ? "!" : "✓";
  const content = document.createElement("span");
  content.className = "toast-message";
  content.textContent = message;
  toast.append(icon, content);
  if (action && action.href && action.label) {
    const link = document.createElement("a");
    link.className = "toast-action";
    link.href = action.href;
    link.textContent = action.label;
    toast.appendChild(link);
  }
  if (action && action.href === "#cart") {
    region.querySelectorAll(".toast-cart-confirmation").forEach((previous) => previous.remove());
    toast.classList.add("toast-cart-confirmation");
  }
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3800);
}

function getRoute() {
  const hash = window.location.hash.slice(1) || "home";
  const separator = hash.indexOf("?");
  const path = separator === -1 ? hash : hash.slice(0, separator);
  const query = new URLSearchParams(separator === -1 ? "" : hash.slice(separator + 1));
  return { path: path || "home", query };
}

function navigate(route) {
  if (window.location.hash === route) {
    renderApp();
  } else {
    window.location.hash = route;
  }
}

function updateHeader() {
  const user = getUser();
  const count = document.getElementById("cart-count");
  const menuContent = document.getElementById("navigation-menu-content");
  count.textContent = String(cartCount());
  const route = getRoute().path;
  const settingsCurrent = route === "settings" ? ' aria-current="page"' : "";
  const menuIcon = {
    settings: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 13.5 1.2 1-.9 1.8-1.6-.3a7 7 0 0 1-1.2 1l-.3 1.6h-2l-.7-1.5a7 7 0 0 1-1.8 0l-.8 1.5h-2l-.3-1.6a7 7 0 0 1-1.2-1l-1.6.3-.9-1.8 1.2-1a7 7 0 0 1 0-1.5l-1.2-1 .9-1.8 1.6.3a7 7 0 0 1 1.2-1l.3-1.6h2l.8 1.5a7 7 0 0 1 1.8 0l.7-1.5h2l.3 1.6a7 7 0 0 1 1.2 1l1.6-.3.9 1.8-1.2 1a7 7 0 0 1 0 1.5Z"/>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/><path d="M12 3V2"/>',
    favorites: '<path d="M20.3 8.6c0 4.6-8.3 10-8.3 10s-8.3-5.4-8.3-10a4.5 4.5 0 0 1 8.3-2.4 4.5 4.5 0 0 1 8.3 2.4Z"/>',
    account: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    support: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.4 1.6c-1.2 1.2-2 1.5-2 3M12 17.5h.01"/>',
    login: '<path d="M10 17l5-5-5-5M15 12H4"/><path d="M14 4h5v16h-5"/>',
    register: '<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>'
  };
  const menuItem = (href, label, icon, routeName) => `<a class="navigation-menu-item${icon === "notifications" ? " notification-link" : ""}" href="${href}"${route === routeName ? ' aria-current="page"' : ""}>
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${menuIcon[icon]}</svg><span>${label}</span>${icon === "notifications" ? '<span class="notification-count notification-dot" id="notification-count" aria-hidden="true" hidden></span>' : ""}
  </a>`;
  menuContent.innerHTML = `${user ? `<div class="navigation-menu-user">${window.LumaFeatures.avatarMarkup(user, "menu-avatar")}<span>Hola, ${escapeHtml(user.name.split(" ")[0])}</span></div>` : ""}
    <nav aria-label="Cuenta y herramientas">
      ${menuItem("#settings", "Ajustes", "settings", "settings")}
      ${user ? "" : `${menuItem("#login", "Iniciar sesión", "login", "login")}${menuItem("#register", "Crear cuenta", "register", "register")}`}
      ${menuItem("#notifications", "Notificaciones", "notifications", "notifications")}
      ${menuItem("#favorites", "Favoritos", "favorites", "favorites")}
      ${menuItem("#account", "Mi cuenta", "account", "account")}
      ${user ? `<button class="navigation-menu-item" type="button" data-action="logout"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${menuIcon.login}</svg><span>Cerrar sesión</span></button>` : ""}
      ${menuItem("#support", "Ayuda", "support", "support")}
    </nav>`;
  window.LumaFeatures.hydrateProfileAvatars();

  const { query } = getRoute();
  const activeCategory = query.get("category") || "Todo";
  document.getElementById("search-input").value = query.get("q") || "";
  document.getElementById("category-nav").innerHTML = CATEGORIES.map((category) => `
    <button class="category-button${category === activeCategory ? " is-active" : ""}" type="button"
      data-action="category" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
  window.LumaFeatures.updateNotificationBadge();
}

function renderProductCard(product) {
  const favorite = window.LumaFeatures.isFavorite(product.id);
  return `<article class="product-card">
    <div class="product-card-media"><a class="product-card-image" href="#product/${encodeURIComponent(product.id)}" aria-label="Ver ${escapeHtml(product.name)}">
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
      <span class="product-tag">${escapeHtml(product.tag)}</span>
    </a><button class="favorite-toggle${favorite ? " is-favorite" : ""}" type="button" data-feature-favorite="${escapeHtml(product.id)}"
      aria-label="${favorite ? "Quitar de favoritos" : "Agregar a favoritos"}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button></div>
    <div class="product-card-body">
      <span class="product-category">${escapeHtml(product.category)}</span>
      <h3><a href="#product/${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
      <div class="product-card-rating">${window.LumaFeatures.renderReviewSummary(product.id)}</div>
      <div class="product-card-bottom">
        <span class="price">${money(product.price)}${product.oldPrice ? `<span class="old-price">${money(product.oldPrice)}</span>` : ""}</span>
        <button class="quick-add" type="button" data-action="quick-add" data-id="${escapeHtml(product.id)}"
          aria-label="Agregar ${escapeHtml(product.name)} al carrito">+</button>
      </div>
    </div>
  </article>`;
}

function renderHome(query) {
  const category = query.get("category") || "Todo";
  const search = (query.get("q") || "").trim();
  const products = window.LumaFeatures.filterProducts(PRODUCTS, query);
  const heading = search ? `Resultados para “${escapeHtml(search)}”` : category === "Todo" ? "Nuestros favoritos" : category;
  const intro = search ? `${products.length} producto${products.length === 1 ? "" : "s"} encontrado${products.length === 1 ? "" : "s"}` : "Pequeños grandes hallazgos para tu día a día.";
  app.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Objetos para vivir mejor</p>
        <h1>Un día más bonito empieza aquí.</h1>
        <p>Encuentra piezas útiles, bien pensadas y listas para acompañarte todos los días.</p>
        <a class="button button-primary" href="#home?category=Todo">Explorar la colección <span aria-hidden="true">→</span></a>
      </div>
      <div class="hero-image" role="img" aria-label="Interior cálido con objetos de diseño"></div>
    </section>
    <section aria-labelledby="products-heading">
      <div class="section-heading">
        <div><h2 id="products-heading">${heading}</h2><p>${intro}</p></div>
        ${category !== "Todo" || search ? '<a class="link-arrow" href="#home">Ver todo →</a>' : '<a class="link-arrow" href="#home?category=Todo">Ver colección →</a>'}
      </div>
      ${window.LumaFeatures.filtersMarkup(query, PRODUCTS)}
      ${products.length
        ? `<div class="product-grid">${products.map(renderProductCard).join("")}</div>`
        : `<div class="empty-state"><div class="empty-icon" aria-hidden="true">⌕</div><h2>No encontramos ese producto</h2><p>Prueba con otra búsqueda o explora todas nuestras categorías.</p><a class="button button-outline" href="#home">Ver productos</a></div>`}
    </section>
    <section class="benefit-row" aria-label="Ventajas de Luma">
      <div class="benefit"><span class="benefit-icon" aria-hidden="true">↗</span><div><strong>Envío gratis desde $1,500</strong><span>En compras de demostración</span></div></div>
      <div class="benefit"><span class="benefit-icon" aria-hidden="true">♡</span><div><strong>Selección con intención</strong><span>Productos útiles para cada día</span></div></div>
      <div class="benefit"><span class="benefit-icon" aria-hidden="true">✓</span><div><strong>Compra de prueba segura</strong><span>Sin cobros ni datos bancarios</span></div></div>
    </section>`;
}

function renderAuth(isRegister) {
  const title = isRegister ? "Crea tu cuenta" : "Qué gusto verte";
  const passwordField = (id, label, autocomplete) => `<div class="field full"><label for="${id}">${label}</label>
    <div class="password-input-wrap"><input id="${id}" name="${id === "auth-password" ? "password" : "confirm"}" type="password" autocomplete="${autocomplete}" minlength="6" maxlength="128" required>
      <button class="password-visibility" type="button" data-action="toggle-password" data-target="${id}" aria-label="Mostrar ${id === "auth-password" ? "contraseña" : "confirmación"}" aria-pressed="false"><svg class="password-visibility-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path class="password-eye-shape" d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle class="password-eye-pupil" cx="12" cy="12" r="2.5"/><path class="password-eye-slash" d="M4 4l16 16"/></svg></button>
    </div>${id === "auth-password" ? `<span class="field-hint password-guidance" id="password-guidance" aria-live="polite">${isRegister ? "Usa al menos 6 caracteres. La contraseña se verifica solo durante esta demostración y no se conserva al cerrar la pestaña." : "Usa la contraseña que registraste en esta pestaña. No se almacena en el perfil."}</span>` : `<span class="field-hint">Escribe nuevamente la misma contraseña.</span>`}</div>`;
  app.innerHTML = `<section class="auth-wrap">
    <div class="auth-card">
      <a class="brand" href="#home"><span class="brand-mark" aria-hidden="true">✦</span><span>Luma<span class="brand-period">.</span><small>TIENDA PARA TODOS LOS DÍAS</small></span></a>
      <h1>${title}</h1>
      <p>${isRegister ? "Guarda tus pedidos y haz tus compras de demostración." : "Inicia sesión para continuar con tu compra."}</p>
      <form id="auth-form" novalidate>
        ${isRegister ? `<div class="field full"><label for="auth-name">Nombre de usuario</label><input id="auth-name" name="name" type="text" autocomplete="name" minlength="2" maxlength="80" required></div>` : ""}
        <div class="field full"><label for="auth-email">Correo electrónico</label><input id="auth-email" name="email" type="email" autocomplete="email" required></div>
        ${passwordField("auth-password", "Contraseña de demostración", isRegister ? "new-password" : "current-password")}
        ${isRegister ? passwordField("auth-confirm", "Confirma tu contraseña", "new-password") : ""}
        <p class="form-error" id="auth-error" role="alert"></p>
        <button class="button button-primary button-block auth-submit" type="submit">${isRegister ? "Crear cuenta" : "Iniciar sesión"}</button>
      </form>
      <p class="auth-switch">${isRegister ? '¿Ya tienes cuenta? <a href="#login">Inicia sesión</a>' : '¿Es tu primera vez? <a href="#register">Crea una cuenta</a>'}</p>
      <div class="demo-note">Autenticación solo de demostración: no existe un servidor ni una base de datos. Se verifica una credencial derivada temporal, que desaparece al cerrar esta pestaña; no es segura para producción.</div>
    </div>
  </section>`;
}

function renderProduct(id) {
  const product = productById(decodeURIComponent(id));
  if (!product) {
    app.innerHTML = `<div class="empty-state"><div class="empty-icon" aria-hidden="true">?</div><h2>Producto no disponible</h2><p>Este artículo no existe o ya no está disponible.</p><a class="button button-primary" href="#home">Volver a la tienda</a></div>`;
    return;
  }
  app.innerHTML = `<nav class="breadcrumbs" aria-label="Ruta"><a href="#home">Inicio</a><span>›</span><a href="#home?category=${encodeURIComponent(product.category)}">${escapeHtml(product.category)}</a><span>›</span><span>${escapeHtml(product.name)}</span></nav>
    <section class="product-detail">
      <div class="product-detail-image"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"></div>
      <div class="product-detail-copy">
        <span class="product-category">${escapeHtml(product.category)} · ${escapeHtml(product.tag)}</span>
        <h1 class="product-title">${escapeHtml(product.name)}</h1>
        <div class="rating" aria-label="Calificación del producto">${window.LumaFeatures.renderReviewSummary(product.id)}</div>
        <p class="price detail-price">${money(product.price)} ${product.oldPrice ? `<span class="old-price">${money(product.oldPrice)}</span>` : ""}</p>
        <p class="detail-description">${escapeHtml(product.description)}</p>
        <p class="availability">✓ Disponible para compra de demostración</p>
        <div class="field qty-field"><label for="product-quantity">Cantidad</label><select id="product-quantity" name="quantity">${Array.from({ length: Math.min(product.stock, 10) }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")}</select></div>
        <div class="detail-actions detail-actions-feature">
          <button class="button button-outline favorite-detail${window.LumaFeatures.isFavorite(product.id) ? " is-favorite" : ""}" type="button" data-feature-favorite="${escapeHtml(product.id)}" aria-pressed="${window.LumaFeatures.isFavorite(product.id)}">${window.LumaFeatures.isFavorite(product.id) ? "♥ Guardado" : "♡ Favoritos"}</button>
        </div>
        <div class="detail-actions">
          <button class="button button-accent" type="button" data-action="add-detail" data-id="${escapeHtml(product.id)}">Agregar al carrito</button>
          <button class="button button-primary" type="button" data-action="buy-now" data-id="${escapeHtml(product.id)}">Comprar ahora</button>
        </div>
        <p class="trust-note">Envío gratis en pedidos desde $1,500. Esta tienda simula el proceso de compra; no se realizan cargos ni transacciones reales.</p>
      </div>
    </section>
    ${window.LumaFeatures.renderReviewSection(product.id)}`;
}

function cartLine(item) {
  const product = productById(item.id);
  if (!product) return "";
  return `<article class="cart-item">
    <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
    <div><span class="product-category">${escapeHtml(product.category)}</span><h3><a href="#product/${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
      <span class="cart-price">${money(product.price)} c/u</span>
      <div class="cart-item-actions"><div class="qty-control" aria-label="Cantidad de ${escapeHtml(product.name)}">
        <button type="button" data-action="quantity" data-id="${escapeHtml(product.id)}" data-delta="-1" aria-label="Disminuir cantidad">−</button>
        <span>${item.quantity}</span>
        <button type="button" data-action="quantity" data-id="${escapeHtml(product.id)}" data-delta="1" aria-label="Aumentar cantidad">+</button>
      </div><button class="remove-button" type="button" data-action="remove" data-id="${escapeHtml(product.id)}">Eliminar</button></div>
    </div>
    <strong class="cart-item-total">${money(product.price * item.quantity)}</strong>
  </article>`;
}

function renderSummary(title = "Resumen de compra", includeButton = true, buttonLabel = "Continuar con la compra") {
  const subtotal = cartSubtotal();
  const shipping = shippingCost(subtotal);
  return `<aside class="summary-card">
    <h2>${title}</h2>
    <div class="summary-line"><span>Subtotal (${cartCount()} artículo${cartCount() === 1 ? "" : "s"})</span><strong>${money(subtotal)}</strong></div>
    <div class="summary-line"><span>Envío</span><strong>${shipping === 0 ? "Gratis" : money(shipping)}</strong></div>
    <div class="summary-line summary-total"><span>Total</span><strong>${money(subtotal + shipping)}</strong></div>
    ${includeButton ? '<button class="button button-primary button-block" type="button" data-action="checkout">' + buttonLabel + " →</button>" : ""}
    <p class="summary-note">${subtotal >= 1500 ? "Tu pedido tiene envío gratis." : "Envío gratis en pedidos desde $1,500."} Importe de demostración en pesos mexicanos.</p>
  </aside>`;
}

function renderCart() {
  const cart = getCart();
  if (!cart.length) {
    app.innerHTML = `<div class="empty-state"><div class="empty-icon" aria-hidden="true">▱</div><h2>Tu carrito está esperando</h2><p>Aún no agregas productos. Explora la tienda y encuentra algo para ti.</p><a class="button button-primary" href="#home">Explorar productos</a></div>`;
    return;
  }
  app.innerHTML = `<p class="eyebrow">Tu selección</p><h1 class="page-heading">Carrito de compras</h1><p class="page-intro">Revisa tus productos antes de continuar.</p>
    <div class="cart-layout"><section class="cart-list" aria-label="Productos en tu carrito">${cart.map(cartLine).join("")}</section>${renderSummary()}</div>`;
}

function readAddress() {
  return checkoutAddress;
}

function saveAddress(address) {
  checkoutAddress = address;
  return true;
}

function stepper(current) {
  const steps = ["Entrega", "Pago", "Confirmación"];
  return `<div class="stepper" aria-label="Paso ${current} de 3">${steps.map((label, index) => `
    ${index > 0 ? '<span class="step-line"></span>' : ""}
    <div class="step${index + 1 === current ? " is-current" : ""}${index + 1 < current ? " is-done" : ""}">
      <span class="step-circle">${index + 1 < current ? "✓" : index + 1}</span><span>${label}</span>
    </div>`).join("")}</div>`;
}

function renderShipping() {
  const address = readAddress() || {};
  app.innerHTML = `${stepper(1)}<h1 class="page-heading">Dirección de entrega</h1><p class="page-intro">¿A dónde enviamos tu pedido?</p>
    <div class="checkout-layout">
      <section class="panel checkout-panel"><h2>Datos de entrega</h2>
        <form id="shipping-form" novalidate>
          ${window.LumaFeatures.savedAddressPicker()}
          <div class="form-grid">
            <div class="field full"><label for="recipient">Nombre del destinatario</label><input id="recipient" name="recipient" type="text" autocomplete="name" minlength="2" value="${escapeHtml(address.recipient || "")}" required></div>
            <div class="field full"><label for="street">Dirección</label><input id="street" name="street" type="text" autocomplete="street-address" minlength="5" placeholder="Calle, número y colonia" value="${escapeHtml(address.street || "")}" required></div>
            <div class="field"><label for="city">Ciudad</label><input id="city" name="city" type="text" autocomplete="address-level2" minlength="2" value="${escapeHtml(address.city || "")}" required></div>
            <div class="field"><label for="postal">Código postal</label><input id="postal" name="postal" type="text" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{4,10}" title="Escribe un código postal de 4 a 10 dígitos" value="${escapeHtml(address.postal || "")}" required></div>
            <div class="field full"><label for="phone">Teléfono</label><input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" pattern="[0-9]{8,15}" title="Escribe un teléfono válido de 8 a 15 dígitos" value="${escapeHtml(address.phone || "")}" required></div>
          </div>
          <p class="form-error" id="shipping-error" role="alert"></p>
          <div class="checkout-actions"><a class="button button-outline" href="#cart">← Volver al carrito</a><button class="button button-primary" type="submit">Revisar y continuar →</button></div>
        </form>
      </section>
      ${renderSummary("Tu pedido", false)}
    </div>`;
}

function renderPayment() {
  const address = readAddress();
  if (!address) {
    navigate("#shipping");
    return;
  }
  app.innerHTML = `${stepper(2)}<h1 class="page-heading">Forma de pago</h1><p class="page-intro">Elige cómo quieres simular el pago de tu pedido.</p>
    <div class="checkout-layout">
      <section class="panel checkout-panel"><h2>Selecciona un método</h2>
        <form id="payment-form">
          <div class="payment-options">
            <label class="payment-option"><input type="radio" name="payment" value="card" required>
              <span><strong>Tarjeta de crédito o débito de prueba</strong><span>No ingreses números de tarjeta. Solo simularemos el resultado.</span></span></label>
            <label class="payment-option"><input type="radio" name="payment" value="transfer" required>
              <span><strong>Transferencia simulada</strong><span>No se realizará ninguna transferencia bancaria.</span></span></label>
            <label class="payment-option"><input type="radio" name="payment" value="cash" required>
              <span><strong>Pago contra entrega</strong><span>Opción demostrativa; no se genera un cobro real.</span></span></label>
          </div>
          <div class="payment-hint">Por seguridad, esta demo no pide ni almacena datos bancarios. Al confirmar solo se registra un pedido de ejemplo en tu navegador.</div>
          <p class="form-error" id="payment-error" role="alert"></p>
          <div class="checkout-actions"><a class="button button-outline" href="#shipping">← Cambiar dirección</a><button class="button button-primary" type="submit">Confirmar pedido →</button></div>
        </form>
      </section>
      <div>
        <div class="summary-card"><h2>Entrega a</h2><div class="address-preview"><strong>${escapeHtml(address.recipient)}</strong><br>${escapeHtml(address.street)}<br>${escapeHtml(address.city)}, C.P. ${escapeHtml(address.postal)}<br>Tel. ${escapeHtml(address.phone)}</div></div>
        <div style="margin-top:14px">${renderSummary("Resumen del pedido", false)}</div>
      </div>
    </div>`;
}

function getOrders() {
  const orders = readStorage(KEYS.orders, []);
  return Array.isArray(orders) ? orders : [];
}

function renderConfirmation(orderId) {
  const order = getOrders().find((item) => item.id === orderId);
  if (!order) {
    app.innerHTML = `<div class="empty-state"><h2>No encontramos ese pedido</h2><p>Revisa tus pedidos de demostración para encontrar una compra.</p><a class="button button-primary" href="#orders">Consultar pedidos</a></div>`;
    return;
  }
  const address = order.address || recentOrderAddresses.get(order.id);
  const addressContent = address
    ? `<strong>${escapeHtml(address.recipient)}</strong><br>${escapeHtml(address.street)}<br>${escapeHtml(address.city)}, C.P. ${escapeHtml(address.postal)}<br>Tel. ${escapeHtml(address.phone)}`
    : "La dirección se mostró durante esta sesión y no se conserva en el historial por privacidad.";
  app.innerHTML = `<div class="confirmation">${stepper(3)}
    <section class="success-banner"><span class="success-icon" aria-hidden="true">✓</span><h1>¡Pedido realizado!</h1><p>Tu compra de demostración se registró correctamente.</p><span class="order-number">Pedido ${escapeHtml(order.id)}</span></section>
    <div class="order-detail-grid">
      <section class="order-info"><h3>Dirección de entrega</h3><p>${addressContent}</p></section>
      <section class="order-info"><h3>Pago seleccionado</h3><p>${escapeHtml(order.paymentLabel)}<br><strong>Total: ${money(order.total)}</strong><br>Importe simulado; no se realizó ningún cargo.</p></section>
      <section class="order-info" style="grid-column:1/-1"><h3>Productos (${order.items.reduce((sum, item) => sum + item.quantity, 0)} artículos)</h3>
        <div class="order-products">${order.items.map((item) => `<div class="order-product"><span>${escapeHtml(item.name)} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong></div>`).join("")}
        <div class="order-product"><span>Envío</span><strong>${order.shipping === 0 ? "Gratis" : money(order.shipping)}</strong></div></div>
      </section>
    </div>
    <div class="confirmation-actions"><a class="button button-primary" href="#home">Volver a la tienda</a><a class="button button-outline" href="#orders">Consultar mis pedidos</a></div>
  </div>`;
}

function renderOrders() {
  const orders = getOrders().slice().reverse();
  if (!orders.length) {
    app.innerHTML = `<div class="empty-state"><div class="empty-icon" aria-hidden="true">▤</div><h2>Aún no tienes pedidos</h2><p>Cuando completes una compra de demostración, aparecerá aquí.</p><a class="button button-primary" href="#home">Explorar productos</a></div>`;
    return;
  }
  app.innerHTML = `<p class="eyebrow">Tu cuenta</p><h1 class="page-heading">Mis pedidos</h1><p class="page-intro">Historial de compras de demostración guardadas en este navegador.</p>
    <section class="orders-list">${orders.map((order) => `<article class="order-card">
      <div class="order-card-head"><strong>Pedido ${escapeHtml(order.id)}</strong><span>${escapeHtml(order.date)}</span></div>
      <div class="order-card-body"><span>${order.items.reduce((sum, item) => sum + item.quantity, 0)} artículo(s) · ${escapeHtml(order.paymentLabel)}</span><strong>${money(order.total)}</strong></div>
      <div class="order-card-body"><span>Detalle y entrega disponibles durante esta sesión</span><a class="link-arrow" href="#confirmation?order=${encodeURIComponent(order.id)}">Ver detalle →</a></div>
    </article>`).join("")}</section>`;
}

function renderApp() {
  updateHeader();
  const { path, query } = getRoute();
  if (path === "home") renderHome(query);
  else if (path === "login") renderAuth(false);
  else if (path === "register") renderAuth(true);
  else if (path.startsWith("product/")) renderProduct(path.slice("product/".length));
  else if (path === "cart") renderCart();
  else if (["shipping", "payment", "orders", "account", "notifications"].includes(path) && !getUser()) {
    writeSession("luma-return-to", `#${path}`);
    navigate("#login");
  } else if (["shipping", "payment"].includes(path) && getCart().length === 0) {
    showToast("Agrega al menos un producto antes de continuar.", true);
    navigate("#cart");
  } else if (path === "shipping") renderShipping();
  else if (path === "payment") renderPayment();
  else if (path === "confirmation") renderConfirmation(query.get("order") || "");
  else if (["orders", "account", "favorites", "notifications", "support"].includes(path)) app.innerHTML = window.LumaFeatures.page(path, PRODUCTS);
  else if (path === "settings") app.innerHTML = window.LumaSettings.render(getUser());
  else renderHome(new URLSearchParams());
  if (path === "account" && getUser()) window.LumaFeatures.hydrateProfileAvatars();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function addToCart(id, quantity = 1) {
  const product = productById(id);
  if (!product) {
    showToast("No se pudo encontrar este producto.", true);
    return false;
  }
  const cart = getCart();
  const existing = cart.find((item) => item.id === id);
  const nextQuantity = (existing ? existing.quantity : 0) + quantity;
  if (nextQuantity > product.stock) {
    showToast(`Solo hay ${product.stock} unidades disponibles de ${product.name}.`, true);
    return false;
  }
  if (existing) existing.quantity = nextQuantity;
  else cart.push({ id, quantity });
  if (!setCart(cart)) return false;
  window.LumaFeatures.makeNotification("confirmation", "Producto agregado al carrito", `${product.name} se agregó al carrito.`);
  showToast(`¡${product.name}${quantity > 1 ? ` (×${quantity})` : ""} se agregó al carrito!`, false, "confirmations", {
    href: "#cart",
    label: "Ir al carrito"
  });
  return true;
}

function requireSignIn(returnTo) {
  if (getUser()) return true;
  writeSession("luma-return-to", returnTo);
  showToast("Inicia sesión o crea una cuenta para continuar.");
  navigate("#login");
  return false;
}

function finishAuthentication(name, email) {
  writeStorage(KEYS.user, { name, email });
  const destination = readSession("luma-return-to") || "#home";
  removeSession("luma-return-to");
  showToast(`¡Bienvenido${name ? `, ${name.split(" ")[0]}` : ""}!`);
  navigate(destination);
}

function updateQuantity(id, delta) {
  const cart = getCart();
  const item = cart.find((entry) => entry.id === id);
  const product = productById(id);
  if (!item || !product) return;
  const next = item.quantity + delta;
  if (next < 1) {
    setCart(cart.filter((entry) => entry.id !== id));
  } else if (next > product.stock) {
    showToast(`Solo hay ${product.stock} unidades disponibles.`, true);
    return;
  } else {
    item.quantity = next;
    setCart(cart);
  }
  renderApp();
}

function readDemoCredentials() {
  const saved = sessionStorage.getItem(DEMO_CREDENTIALS_KEY);
  if (!saved) return {};
  const credentials = JSON.parse(saved);
  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
    throw new Error("El registro temporal de demostración no tiene un formato válido.");
  }
  return credentials;
}

function saveDemoCredentials(credentials) {
  try {
    sessionStorage.setItem(DEMO_CREDENTIALS_KEY, JSON.stringify(credentials));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar las credenciales temporales de demostración.", error);
    return false;
  }
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deriveCredential(password, saltHex) {
  if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) {
    throw new Error("Este navegador no ofrece las funciones criptográficas necesarias.");
  }
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((byte) => Number.parseInt(byte, 16)));
  const key = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await window.crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function credentialsMatch(first, second) {
  if (typeof first !== "string" || first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  return difference === 0;
}

async function submitAuthentication(form) {
  const isRegister = getRoute().path === "register";
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "").trim().toLowerCase();
  const password = String(data.get("password") || "");
  const error = document.getElementById("auth-error");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  error.textContent = "";
  if (isRegister && name.length < 2) error.textContent = "Escribe tu nombre de usuario (al menos 2 caracteres).";
  else if (!emailPattern.test(email)) error.textContent = "Escribe un correo electrónico válido.";
  else if (password.length < 6) error.textContent = "La contraseña de demostración debe tener al menos 6 caracteres.";
  else if (isRegister && password !== data.get("confirm")) error.textContent = "Las contraseñas no coinciden.";
  else {
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      const credentials = readDemoCredentials();
      if (isRegister) {
        if (Object.prototype.hasOwnProperty.call(credentials, email)) {
          error.textContent = "Ya existe una cuenta de demostración con ese correo en esta pestaña. Inicia sesión.";
          return;
        }
        const salt = randomSalt();
        credentials[email] = { name, salt, verifier: await deriveCredential(password, salt) };
        if (!saveDemoCredentials(credentials)) {
          error.textContent = "No se pudieron guardar los datos temporales. Revisa la configuración de almacenamiento del navegador.";
          return;
        }
        const profiles = readStorage("luma_profiles", {});
        profiles[email] = name;
        writeStorage("luma_profiles", profiles);
        finishAuthentication(name, email);
      } else {
        const account = credentials[email];
        if (!account || typeof account.salt !== "string" || typeof account.verifier !== "string") {
          error.textContent = "No encontramos una cuenta registrada en esta pestaña. Crea una cuenta para continuar.";
          return;
        }
        const verifier = await deriveCredential(password, account.salt);
        if (!credentialsMatch(account.verifier, verifier)) {
          error.textContent = "El correo o la contraseña no son correctos.";
          return;
        }
        const profiles = readStorage("luma_profiles", {});
        finishAuthentication(profiles[email] || account.name || email.split("@")[0], email);
      }
    } catch (exception) {
      console.error("No se pudo completar la autenticación de demostración.", exception);
      error.textContent = "No se pudo verificar la cuenta en este navegador. Abre la tienda con Live Server e inténtalo de nuevo.";
    } finally {
      submitButton.disabled = false;
    }
  }
}

function submitShipping(form) {
  const error = document.getElementById("shipping-error");
  if (!form.reportValidity()) {
    error.textContent = "Revisa los campos marcados. Todos los datos son obligatorios.";
    return;
  }
  const data = new FormData(form);
  const address = Object.fromEntries(["recipient", "street", "city", "postal", "phone"].map((key) => [key, String(data.get(key)).trim()]));
  if (!saveAddress(address)) return;
  navigate("#payment");
}

function submitPayment(form) {
  const error = document.getElementById("payment-error");
  if (!form.reportValidity()) {
    error.textContent = "Selecciona una forma de pago para continuar.";
    return;
  }
  const address = readAddress();
  const cart = getCart();
  if (!address || !cart.length) {
    error.textContent = "Falta la dirección o el carrito está vacío. Revisa los pasos anteriores.";
    return;
  }
  const payment = new FormData(form).get("payment");
  const paymentLabels = { card: "Tarjeta de prueba", transfer: "Transferencia simulada", cash: "Pago contra entrega" };
  const subtotal = cartSubtotal();
  const order = {
    id: `LUM-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    date: new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date()),
    customerEmail: getUser().email.toLowerCase(),
    customerName: getUser().name,
    demoStatus: "Pedido confirmado",
    items: cart.map((item) => {
      const product = productById(item.id);
      return { id: product.id, name: product.name, price: product.price, quantity: item.quantity, image: product.image };
    }),
    paymentLabel: paymentLabels[payment],
    shipping: shippingCost(subtotal),
    total: subtotal + shippingCost(subtotal)
  };
  if (!order.paymentLabel) {
    error.textContent = "El método seleccionado no es válido. Vuelve a elegir uno.";
    return;
  }
  const orders = getOrders();
  orders.push(order);
  if (!writeStorage(KEYS.orders, orders)) return;
  recentOrderAddresses.set(order.id, address);
  window.LumaFeatures.recordOrder(order, getUser());
  checkoutAddress = null;
  setCart([]);
  navigate(`#confirmation?order=${encodeURIComponent(order.id)}`);
  showToast(`Pedido ${order.id} registrado como demostración.`, false, "orders");
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "toggle-password") {
    const input = document.getElementById(button.dataset.target);
    if (!input) return;
    const showPassword = input.type === "password";
    input.type = showPassword ? "text" : "password";
    button.setAttribute("aria-pressed", String(showPassword));
    button.setAttribute("aria-label", `${showPassword ? "Ocultar" : "Mostrar"} ${input.name === "confirm" ? "confirmación" : "contraseña"}`);
    button.title = `${showPassword ? "Ocultar" : "Mostrar"} ${input.name === "confirm" ? "confirmación" : "contraseña"}`;
  } else if (action === "logout") {
    localStorage.removeItem(KEYS.user);
    removeSession("luma-return-to");
    showToast("Sesión cerrada. Puedes seguir explorando como visitante.");
    navigate("#home");
  } else if (action === "category") {
    const category = button.dataset.category;
    const params = new URLSearchParams(getRoute().query);
    if (category === "Todo") params.delete("category");
    else params.set("category", category);
    navigate(`#home${params.toString() ? `?${params}` : ""}`);
  } else if (action === "quick-add") {
    addToCart(id);
  } else if (action === "add-detail") {
    const quantity = Number(document.getElementById("product-quantity").value);
    addToCart(id, quantity);
  } else if (action === "buy-now") {
    const quantity = Number(document.getElementById("product-quantity").value);
    if (addToCart(id, quantity)) {
      if (!requireSignIn("#shipping")) return;
      navigate("#shipping");
    }
  } else if (action === "quantity") {
    updateQuantity(id, Number(button.dataset.delta));
  } else if (action === "remove") {
    setCart(getCart().filter((item) => item.id !== id));
    showToast("Producto eliminado del carrito.");
    renderApp();
  } else if (action === "checkout") {
    if (getCart().length === 0) {
      showToast("Agrega al menos un producto antes de continuar.", true);
      navigate("#home");
    } else if (requireSignIn("#shipping")) {
      navigate("#shipping");
    }
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.id === "search-form") {
    event.preventDefault();
    const query = new FormData(form).get("q").trim();
    const params = new URLSearchParams(getRoute().query);
    if (query) params.set("q", query);
    else params.delete("q");
    navigate(`#home${params.toString() ? `?${params}` : ""}`);
  } else if (form.id === "auth-form") {
    event.preventDefault();
    submitAuthentication(form);
  } else if (form.id === "shipping-form") {
    event.preventDefault();
    submitShipping(form);
  } else if (form.id === "payment-form") {
    event.preventDefault();
    submitPayment(form);
  }
});

function setNavigationMenuOpen(open, restoreFocus = false) {
  const menu = document.getElementById("navigation-menu");
  const backdrop = document.getElementById("menu-backdrop");
  const toggle = document.getElementById("menu-toggle");
  const close = document.getElementById("menu-close");
  if (!menu || !backdrop || !toggle || !close) return;
  menu.classList.toggle("is-open", open);
  menu.setAttribute("aria-hidden", String(!open));
  menu.inert = !open;
  toggle.setAttribute("aria-expanded", String(open));
  backdrop.hidden = !open;
  window.LumaFeatures.updateNotificationBadge();
  if (open) close.focus();
  else if (restoreFocus) toggle.focus();
}

document.getElementById("menu-toggle").addEventListener("click", () => {
  const isOpen = document.getElementById("menu-toggle").getAttribute("aria-expanded") === "true";
  setNavigationMenuOpen(!isOpen);
});
document.getElementById("menu-close").addEventListener("click", () => setNavigationMenuOpen(false, true));
document.getElementById("menu-backdrop").addEventListener("click", () => setNavigationMenuOpen(false));
document.getElementById("navigation-menu").addEventListener("click", (event) => {
  if (event.target.closest("a, [data-action]")) setNavigationMenuOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.getElementById("menu-toggle").getAttribute("aria-expanded") === "true") {
    setNavigationMenuOpen(false, true);
  }
});

window.addEventListener("hashchange", () => setNavigationMenuOpen(false));
window.addEventListener("hashchange", renderApp);
window.addEventListener("luma:settings-updated", () => {
  if (getRoute().path === "settings") renderApp();
});

if (!window.location.hash) window.location.hash = "#home";
window.PRODUCTS = PRODUCTS;
window.formatMoney = money;
window.renderProductCard = renderProductCard;
window.updateShopHeader = updateHeader;
renderApp();