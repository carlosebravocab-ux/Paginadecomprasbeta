(function () {
  "use strict";

  const FAVORITES_KEY = "luma_features_favorites";
  const REVIEWS_KEY = "luma_features_reviews";
  const ADDRESSES_KEY = "luma_features_addresses";
  const NOTIFICATIONS_KEY = "luma_features_notifications";
  const PROFILE_PHOTO_DB = "luma_profile_photos";
  const PROFILE_PHOTO_STORE = "photos";
  const PROFILE_PHOTO_MAX_SIZE = 5 * 1024 * 1024;
  const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const ORDER_STAGES = ["Pedido confirmado", "Preparando pedido", "Enviado", "Entregado"];
  let profilePhotoDatabase;
  let pendingProfilePhoto = null;
  let pendingProfilePhotoUrl = null;
  const profilePhotoUrls = new Map();
  const profileAvatarTokens = new WeakMap();
  const FAQ = [
    { category: "Compras", question: "¿Cómo agrego productos a mi carrito?", answer: "Abre un producto y selecciona «Agregar al carrito». También puedes usar el botón + en la tarjeta. El carrito conserva su contenido en este navegador." },
    { category: "Pagos", question: "¿Se realizan cobros reales?", answer: "No. Las formas de pago son simuladas para demostración. No ingreses ni compartas datos bancarios." },
    { category: "Envíos", question: "¿Puedo seguir un envío real?", answer: "No hay conexión con una empresa de paquetería. Los estados que aparecen en Mis pedidos son etapas de demostración y no representan un envío real." },
    { category: "Devoluciones", question: "¿Cómo devuelvo un producto?", answer: "Esta versión no procesa compras ni devoluciones reales. Para una tienda en producción sería necesario conectar atención al cliente y un sistema de pedidos." },
    { category: "Cuenta", question: "¿Dónde actualizo mis datos o direcciones?", answer: "Inicia sesión y abre Mi cuenta desde la navegación. Ahí puedes editar tu nombre, correo y administrar direcciones de demostración." },
    { category: "Cuenta", question: "¿Cómo recupero o cambio mi contraseña?", answer: "La autenticación actual es simulada y no almacena contraseñas ni ofrece recuperación. No hay una contraseña real que recuperar." }
  ];

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error(`No se pudo leer ${key}.`, error);
      return fallback;
    }

  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`No se pudo guardar ${key}.`, error);
      if (typeof window.showToast === "function") window.showToast("No se pudo guardar la información en este navegador.", true);
      return false;
    }
  }

  function openProfilePhotoDatabase() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("Este navegador no admite almacenamiento local de fotos."));
    if (profilePhotoDatabase) return profilePhotoDatabase;
    profilePhotoDatabase = new Promise((resolve, reject) => {
      const request = indexedDB.open(PROFILE_PHOTO_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(PROFILE_PHOTO_STORE)) {
          request.result.createObjectStore(PROFILE_PHOTO_STORE, { keyPath: "ownerId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        profilePhotoDatabase = null;
        reject(request.error || new Error("No se pudo abrir el almacenamiento de fotos."));
      };
      request.onblocked = () => {
        profilePhotoDatabase = null;
        reject(new Error("El almacenamiento de fotos está ocupado por otra pestaña. Cierra otras pestañas de la tienda e inténtalo de nuevo."));
      };
    });
    return profilePhotoDatabase;
  }

  async function readProfilePhoto(email) {
    const database = await openProfilePhotoDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PROFILE_PHOTO_STORE, "readonly");
      const request = transaction.objectStore(PROFILE_PHOTO_STORE).get(email.trim().toLowerCase());
      let record = null;
      request.onsuccess = () => { record = request.result || null; };
      transaction.oncomplete = () => resolve(record);
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo leer la foto de perfil."));
      transaction.onabort = () => reject(transaction.error || new Error("No se pudo leer la foto de perfil."));
    });
  }

  async function writeProfilePhoto(email, blob) {
    const database = await openProfilePhotoDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PROFILE_PHOTO_STORE, "readwrite");
      transaction.objectStore(PROFILE_PHOTO_STORE).put({
        ownerId: email.trim().toLowerCase(),
        image: blob,
        updatedAt: Date.now()
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar la foto de perfil."));
      transaction.onabort = () => reject(transaction.error || new Error("No se pudo guardar la foto de perfil."));
    });
  }

  async function deleteProfilePhoto(email) {
    const database = await openProfilePhotoDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PROFILE_PHOTO_STORE, "readwrite");
      transaction.objectStore(PROFILE_PHOTO_STORE).delete(email.trim().toLowerCase());
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo eliminar la foto de perfil."));
      transaction.onabort = () => reject(transaction.error || new Error("No se pudo eliminar la foto de perfil."));
    });
  }

  async function moveProfilePhoto(oldEmail, newEmail) {
    const database = await openProfilePhotoDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PROFILE_PHOTO_STORE, "readwrite");
      const store = transaction.objectStore(PROFILE_PHOTO_STORE);
      const oldRequest = store.get(oldEmail);
      const newRequest = store.get(newEmail);
      let oldRecord = null;
      let newRecord = null;
      let hasBothResults = 0;
      let collision = false;
      const migrateIfReady = () => {
        hasBothResults += 1;
        if (hasBothResults !== 2) return;
        if (newRecord) {
          collision = true;
          transaction.abort();
        } else if (oldRecord) {
          store.put({ ...oldRecord, ownerId: newEmail });
          store.delete(oldEmail);
        }
      };
      oldRequest.onsuccess = () => {
        oldRecord = oldRequest.result || null;
        migrateIfReady();
      };
      newRequest.onsuccess = () => {
        newRecord = newRequest.result || null;
        migrateIfReady();
      };
      oldRequest.onerror = () => transaction.abort();
      newRequest.onerror = () => transaction.abort();
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => {
        if (!collision) reject(transaction.error || new Error("No se pudo actualizar la foto de perfil."));
      };
      transaction.onabort = () => collision
        ? resolve(false)
        : reject(transaction.error || new Error("No se pudo actualizar la foto de perfil."));
    });
  }

  function avatarInitials(name) {
    const initials = String(name || "").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("");
    return escapeHtml(initials.toLocaleUpperCase("es") || "L");
  }

  function avatarMarkup(user, className) {
    const email = escapeHtml(user.email);
    return `<span class="profile-avatar ${className}" data-avatar-email="${email}">
      <span class="profile-avatar-fallback" aria-hidden="true">${avatarInitials(user.name)}</span>
      <img class="profile-avatar-image" alt="" aria-hidden="true" hidden>
    </span>`;
  }

  async function hydrateProfileAvatars() {
    for (const [image, url] of profilePhotoUrls) {
      if (!image.isConnected) {
        URL.revokeObjectURL(url);
        profilePhotoUrls.delete(image);
      }
    }
    const images = document.querySelectorAll(".profile-avatar-image");
    await Promise.all(Array.from(images, async (image) => {
      const avatar = image.closest("[data-avatar-email]");
      const fallback = avatar?.querySelector(".profile-avatar-fallback");
      const email = avatar?.dataset.avatarEmail;
      if (!avatar || !fallback || !email) return;
      const token = (profileAvatarTokens.get(image) || 0) + 1;
      profileAvatarTokens.set(image, token);
      const previousUrl = profilePhotoUrls.get(image);
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
        profilePhotoUrls.delete(image);
      }
      image.hidden = true;
      fallback.hidden = false;
      try {
        const record = await readProfilePhoto(email);
        if (!image.isConnected || avatar.dataset.avatarEmail !== email || profileAvatarTokens.get(image) !== token) return;
        const removeButton = document.querySelector("#remove-profile-photo");
        if (removeButton && email === ownerId()) removeButton.hidden = !record;
        if (record?.image instanceof Blob) {
          const url = URL.createObjectURL(record.image);
          profilePhotoUrls.set(image, url);
          image.onload = () => {
            if (image.isConnected && profileAvatarTokens.get(image) === token) {
              image.hidden = false;
              fallback.hidden = true;
            }
          };
          image.onerror = () => {
            if (profileAvatarTokens.get(image) !== token) return;
            URL.revokeObjectURL(url);
            profilePhotoUrls.delete(image);
            image.hidden = true;
            fallback.hidden = false;
          };
          image.src = url;
        }
      } catch (error) {
        console.error("No se pudo cargar la foto de perfil local.", error);
        const photoError = document.getElementById("profile-photo-error");
        if (photoError && email === ownerId()) photoError.textContent = "No se pudo cargar la foto guardada. Puedes elegir otra imagen.";
      }
    }));
  }

  function moveOwnerData(oldEmail, newEmail) {
    try {
      const credentialKey = "luma_demo_credentials_session";
      const savedCredentials = sessionStorage.getItem(credentialKey);
      if (savedCredentials) {
        const credentials = JSON.parse(savedCredentials);
        if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
          throw new Error("El registro temporal de demostración no tiene un formato válido.");
        }
        if (credentials[oldEmail] && credentials[newEmail]) return false;
        if (credentials[oldEmail]) {
          credentials[newEmail] = credentials[oldEmail];
          delete credentials[oldEmail];
          sessionStorage.setItem(credentialKey, JSON.stringify(credentials));
        }
      }
    } catch (error) {
      console.error("No se pudieron actualizar las credenciales temporales de demostración.", error);
      return false;
    }
    const keys = [FAVORITES_KEY, ADDRESSES_KEY, NOTIFICATIONS_KEY];
    for (const key of keys) {
      const map = read(key, {});
      if (map[oldEmail] !== undefined && map[newEmail] === undefined) {
        map[newEmail] = map[oldEmail];
        delete map[oldEmail];
        if (!write(key, map)) return false;
      }
    }
    const orders = read("luma_orders", []);
    if (Array.isArray(orders)) {
      let changed = false;
      orders.forEach((order) => {
        if (order.customerEmail && order.customerEmail.toLowerCase() === oldEmail) {
          order.customerEmail = newEmail;
          changed = true;
        }
      });
      if (changed && !write("luma_orders", orders)) return false;
    }
    const profiles = read("luma_profiles", {});
    if (profiles[oldEmail] && !profiles[newEmail]) {
      profiles[newEmail] = profiles[oldEmail];
      delete profiles[oldEmail];
      if (!write("luma_profiles", profiles)) return false;
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function currentUser() {
    return read("luma_user", null);
  }

  function ownerId() {
    const user = currentUser();
    return user && typeof user.email === "string" ? user.email.trim().toLowerCase() : "guest";
  }

  function currentPreferences() {
    return window.LumaSettings ? window.LumaSettings.notifications() : { confirmations: true, orders: true, promotions: false };
  }

  function favoriteMap() {
    const data = read(FAVORITES_KEY, {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  function favorites() {
    const map = favoriteMap();
    const list = map[ownerId()];
    return Array.isArray(list) ? list : [];
  }

  function isFavorite(id) {
    return favorites().includes(id);
  }

  function toggleFavorite(id) {
    const map = favoriteMap();
    const list = Array.isArray(map[ownerId()]) ? map[ownerId()] : [];
    map[ownerId()] = list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
    if (write(FAVORITES_KEY, map)) {
      if (typeof window.showToast === "function" && currentPreferences().confirmations) {
        window.showToast(map[ownerId()].includes(id) ? "Producto guardado en Mis favoritos." : "Producto eliminado de Mis favoritos.");
      }
      return true;
    }
    return false;
  }

  function allReviews() {
    const list = read(REVIEWS_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function productReviews(productId) {
    return allReviews().filter((review) => review.productId === productId);
  }

  function ratingSummary(productId) {
    const reviews = productReviews(productId);
    return {
      count: reviews.length,
      average: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0
    };
  }

  function starText(rating) {
    const rounded = Math.round(rating);
    return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
  }

  function renderReviewSummary(productId) {
    const summary = ratingSummary(productId);
    return summary.count
      ? `<span class="feature-rating-stars" aria-label="${summary.average.toFixed(1)} de 5">${starText(summary.average)}</span><span>${summary.average.toFixed(1)} · ${summary.count} reseña${summary.count === 1 ? "" : "s"}</span>`
      : `<span class="feature-rating-empty">Aún sin reseñas</span>`;
  }

  function renderReviewSection(productId) {
    const user = currentUser();
    const reviews = productReviews(productId).slice().reverse();
    return `<section class="feature-panel review-section" aria-labelledby="reviews-heading">
      <div class="feature-section-heading"><div><p class="eyebrow">Opiniones</p><h2 id="reviews-heading">Reseñas y calificaciones</h2>
        <p class="feature-muted">${renderReviewSummary(productId)}</p></div></div>
      <div class="review-list">${reviews.length ? reviews.map((review) => `<article class="review-item">
        <div class="review-item-head"><strong>${escapeHtml(review.name)}</strong><span class="feature-rating-stars" aria-label="${review.rating} de 5">${starText(review.rating)}</span></div>
        <p>${escapeHtml(review.comment)}</p><small>${escapeHtml(review.date)} · Reseña de demostración</small>
      </article>`).join("") : `<div class="feature-empty compact"><p>Aún no hay reseñas para este producto.</p><small>Las opiniones publicadas aquí son demostrativas y se guardan en este navegador.</small></div>`}</div>
      ${user ? `<form class="feature-form review-form" data-feature-form="review" data-product-id="${escapeHtml(productId)}" novalidate>
        <h3>Comparte tu opinión</h3>
        <fieldset class="review-stars"><legend>Tu calificación</legend>
          ${[5, 4, 3, 2, 1].map((rating) => `<label><input type="radio" name="rating" value="${rating}" required><span aria-hidden="true">★</span><span class="sr-only">${rating} estrellas</span></label>`).join("")}
        </fieldset>
        <label class="feature-field"><span>Comentario</span><textarea name="comment" rows="3" minlength="5" maxlength="600" required placeholder="¿Qué te pareció este producto?"></textarea></label>
        <p class="feature-form-error" role="alert"></p>
        <button class="button button-primary" type="submit">Publicar reseña de demostración</button>
      </form>` : `<p class="feature-muted">Inicia sesión para publicar una reseña. <a href="#login">Iniciar sesión</a></p>`}
    </section>`;
  }

  function filtersMarkup(query, products) {
    const categories = [...new Set(products.map((product) => product.category))];
    const category = query.get("category") || "Todo";
    const sort = query.get("sort") || "featured";
    return `<form class="catalog-filters" id="catalog-filters" aria-label="Filtrar y ordenar productos">
      <label class="filter-control"><span>Categoría</span><select name="category">
        <option value="Todo" ${category === "Todo" ? "selected" : ""}>Todas</option>
        ${categories.map((item) => `<option value="${escapeHtml(item)}" ${category === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
      </select></label>
      <label class="filter-control"><span>Precio mínimo</span><input name="min" type="number" min="0" step="1" inputmode="numeric" placeholder="$0" value="${escapeHtml(query.get("min") || "")}"></label>
      <label class="filter-control"><span>Precio máximo</span><input name="max" type="number" min="0" step="1" inputmode="numeric" placeholder="Sin límite" value="${escapeHtml(query.get("max") || "")}"></label>
      <label class="filter-control filter-sort"><span>Ordenar por</span><select name="sort">
        <option value="featured" ${sort === "featured" ? "selected" : ""}>Recomendados</option>
        <option value="popular" ${sort === "popular" ? "selected" : ""}>Popularidad (demo)</option>
        <option value="price-asc" ${sort === "price-asc" ? "selected" : ""}>Precio: menor a mayor</option>
        <option value="price-desc" ${sort === "price-desc" ? "selected" : ""}>Precio: mayor a menor</option>
        <option value="name" ${sort === "name" ? "selected" : ""}>Nombre: A a Z</option>
      </select></label>
      <button class="button button-outline filter-clear" type="button" data-feature-action="clear-filters">Limpiar filtros</button>
    </form>`;
  }

  function filterProducts(products, query) {
    let result = products.slice();
    const category = query.get("category") || "Todo";
    const search = (query.get("q") || "").trim().toLocaleLowerCase("es");
    const minimum = query.get("min") === null || query.get("min") === "" ? null : Number(query.get("min"));
    const maximum = query.get("max") === null || query.get("max") === "" ? null : Number(query.get("max"));
    if (category !== "Todo") result = result.filter((product) => product.category === category);
    if (search) result = result.filter((product) => `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase("es").includes(search));
    if (minimum !== null && Number.isFinite(minimum)) result = result.filter((product) => product.price >= minimum);
    if (maximum !== null && Number.isFinite(maximum)) result = result.filter((product) => product.price <= maximum);
    const sort = query.get("sort") || "featured";
    if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    else if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name, "es"));
    else result.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return result;
  }

  function renderFavorites(products) {
    const ids = new Set(favorites());
    const list = products.filter((product) => ids.has(product.id));
    return `<p class="eyebrow">Tu colección</p><h1 class="page-heading">Mis favoritos</h1>
      <p class="page-intro">Productos que guardaste para volver a ellos. La lista se conserva en este navegador y es independiente para cada cuenta.</p>
      ${list.length ? `<div class="product-grid">${list.map((product) => window.renderProductCard(product)).join("")}</div>`
        : `<div class="feature-empty"><span aria-hidden="true">♡</span><h2>Tu lista está vacía</h2><p>Guarda productos tocando el corazón para encontrarlos aquí.</p><a class="button button-primary" href="#home">Explorar productos</a></div>`}`;
  }

  function ownedOrders() {
    const user = currentUser();
    if (!user) return [];
    const all = read("luma_orders", []);
    if (!Array.isArray(all)) return [];
    return all.filter((order) => typeof order.customerEmail === "string"
      && order.customerEmail.trim().toLowerCase() === user.email.trim().toLowerCase());
  }

  function statusFor(order) {
    const stored = order.demoStatus;
    const index = ORDER_STAGES.indexOf(stored);
    return index < 0 ? 0 : index;
  }

  function renderOrderCard(order) {
    const stage = statusFor(order);
    const items = Array.isArray(order.items) ? order.items : [];
    return `<article class="feature-panel tracking-card">
      <div class="tracking-head"><div><span class="feature-muted">Pedido de demostración</span><h2>${escapeHtml(order.id)}</h2></div>
        <span class="tracking-status">${escapeHtml(ORDER_STAGES[stage])}</span></div>
      <p class="tracking-date">Fecha: ${escapeHtml(order.date || "Sin fecha")}</p>
      <ol class="tracking-steps" aria-label="Seguimiento de pedido de demostración">${ORDER_STAGES.map((label, index) => `<li class="${index <= stage ? "is-complete" : ""}${index === stage ? " is-current" : ""}">
        <span class="tracking-step-dot">${index < stage ? "✓" : index + 1}</span><span>${label}</span>
      </li>`).join("")}</ol>
      <div class="tracking-items">${items.map((item) => `<div><span>${escapeHtml(item.name)} × ${item.quantity}</span><strong>${window.formatMoney(item.price * item.quantity)}</strong></div>`).join("")}
        <div><span>Total</span><strong>${window.formatMoney(order.total)}</strong></div></div>
      <p class="tracking-disclaimer">Etapas simuladas; no hay conexión con transportistas ni confirmación de entrega real.</p>
      <div class="tracking-actions"><a class="button button-outline" href="#confirmation?order=${encodeURIComponent(order.id)}">Ver detalles</a>
        ${stage < ORDER_STAGES.length - 1 ? `<button class="button button-outline" type="button" data-feature-action="advance-order" data-order-id="${escapeHtml(order.id)}">Avanzar estado (demo)</button>` : ""}
      </div>
    </article>`;
  }

  function renderOrders() {
    const orders = ownedOrders().slice().reverse();
    return `<p class="eyebrow">Tu actividad</p><h1 class="page-heading">Mis pedidos</h1>
      <p class="page-intro">Consulta compras de demostración y su estado simulado.</p>
      ${orders.length ? `<div class="feature-list">${orders.map(renderOrderCard).join("")}</div>`
        : `<div class="feature-empty"><span aria-hidden="true">▤</span><h2>Aún no tienes pedidos</h2><p>Cuando confirmes una compra de demostración, aparecerá aquí.</p><a class="button button-primary" href="#home">Explorar productos</a></div>`}`;
  }

  function addressMap() {
    const data = read(ADDRESSES_KEY, {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  function addresses() {
    const map = addressMap();
    return Array.isArray(map[ownerId()]) ? map[ownerId()] : [];
  }

  function savedAddressPicker() {
    const list = addresses();
    if (!currentUser() || !list.length) return "";
    return `<div class="field full saved-address-picker"><label for="saved-shipping-address">Usar una dirección guardada</label>
      <select id="saved-shipping-address"><option value="">Escribir una dirección nueva</option>
        ${list.map((address, index) => `<option value="${index}">${escapeHtml(address.recipient)} · ${escapeHtml(address.city)}</option>`).join("")}
      </select></div>`;
  }

  function renderAddress(address, index) {
    return `<article class="saved-address"><div><strong>${escapeHtml(address.recipient)}</strong><p>${escapeHtml(address.street)}<br>${escapeHtml(address.city)}, C.P. ${escapeHtml(address.postal)}<br>Tel. ${escapeHtml(address.phone)}</p></div>
      <div class="saved-address-actions"><button class="button button-outline" type="button" data-feature-action="edit-address" data-address-index="${index}">Editar</button>
        <button class="button button-danger" type="button" data-feature-action="delete-address" data-address-index="${index}">Eliminar</button></div>
    </article>`;
  }

  function accountShortcutIcon(name) {
    const paths = {
      orders: '<path d="M6 3.75h8l4 4v12.5H6z"/><path d="M14 3.75v4h4M9 12h6M9 15.5h6"/>',
      favorites: '<path d="M20.3 8.6c0 4.6-8.3 10-8.3 10s-8.3-5.4-8.3-10a4.5 4.5 0 0 1 8.3-2.4 4.5 4.5 0 0 1 8.3 2.4Z"/>',
      notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
      support: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.4 1.6c-1.2 1.2-2 1.5-2 3M12 17.5h.01"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${paths[name] || ""}</svg>`;
  }

  function accountPage() {
    const user = currentUser();
    if (!user) return `<div class="feature-empty"><span aria-hidden="true">♙</span><h2>Inicia sesión para ver tu cuenta</h2><p>Tu información, direcciones y pedidos están disponibles al entrar.</p>
      <div class="feature-inline-actions"><a class="button button-primary" href="#login">Iniciar sesión</a><a class="button button-outline" href="#register">Crear cuenta</a></div></div>`;
    const list = addresses();
    const orders = ownedOrders().slice().reverse().slice(0, 2);
    return `<p class="eyebrow account-eyebrow">Tu espacio personal</p>
      <section class="account-hero">
        ${avatarMarkup(user, "account-avatar")}
        <div class="account-identity"><p class="eyebrow">Mi perfil</p><h1>${escapeHtml(user.name)}</h1><p class="account-email">${escapeHtml(user.email)}</p>
          <span class="account-demo-label">Cuenta de demostración</span></div>
        <button class="button button-outline account-edit-trigger" type="button" data-feature-action="edit-profile">Editar perfil</button>
      </section>
      <div class="account-grid">
        <section class="feature-panel account-profile-panel"><div class="feature-section-heading"><div><h2>Información personal</h2><p>Administra los datos básicos de tu perfil.</p></div></div>
          <div class="profile-photo-editor">
            ${avatarMarkup(user, "profile-edit-avatar")}
            <div class="profile-photo-controls">
              <strong>Foto de perfil</strong><span>JPG, PNG o WebP · hasta 5 MB</span>
              <div class="feature-inline-actions">
                <input class="visually-hidden-input" id="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp">
                <label class="button button-outline profile-photo-select" for="profile-photo-input">Cambiar foto de perfil</label>
                <button class="button button-outline" id="remove-profile-photo" type="button" data-feature-action="remove-profile-photo" hidden>Eliminar foto</button>
              </div>
            </div>
          </div>
          <p class="profile-photo-hint">La imagen se guarda en este navegador y solo se muestra en esta cuenta.</p>
          <p class="feature-form-error" id="profile-photo-error" role="alert"></p>
          <div class="feature-inline-actions profile-photo-confirm" id="profile-photo-confirm" hidden>
            <button class="button button-primary" type="button" data-feature-action="save-profile-photo">Guardar foto</button>
            <button class="button button-outline" type="button" data-feature-action="cancel-profile-photo">Cancelar</button>
          </div>
          <form class="feature-form account-profile-form" data-feature-form="profile" data-editing="false" novalidate>
            <label class="feature-field"><span>Nombre</span><input name="name" value="${escapeHtml(user.name)}" minlength="2" required readonly></label>
            <label class="feature-field"><span>Correo electrónico</span><input name="email" type="email" value="${escapeHtml(user.email)}" required readonly></label>
            <p class="feature-form-error" role="alert"></p>
            <div class="feature-inline-actions profile-form-actions" hidden>
              <button class="button button-primary" type="submit">Guardar cambios</button>
              <button class="button button-outline" type="button" data-feature-action="cancel-profile-edit">Cancelar</button>
            </div>
          </form>
          <p class="feature-disclaimer">Perfil local de demostración; los cambios no actualizan credenciales en un servidor.</p>
        </section>
        <section class="feature-panel account-shortcuts"><div class="feature-section-heading"><div><h2>Accesos rápidos</h2><p>Continúa en las secciones de tu cuenta.</p></div></div>
          <a href="#orders">${accountShortcutIcon("orders")}<span>Mis pedidos</span><span class="account-shortcut-arrow" aria-hidden="true">→</span></a>
          <a href="#favorites">${accountShortcutIcon("favorites")}<span>Mis favoritos</span><span class="account-shortcut-arrow" aria-hidden="true">→</span></a>
          <a href="#notifications">${accountShortcutIcon("notifications")}<span>Notificaciones</span><span class="account-shortcut-arrow" aria-hidden="true">→</span></a>
          <a href="#settings"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 13.5 1.2 1-.9 1.8-1.6-.3a7 7 0 0 1-1.2 1l-.3 1.6h-2l-.7-1.5a7 7 0 0 1-1.8 0l-.8 1.5h-2l-.3-1.6a7 7 0 0 1-1.2-1l-1.6.3-.9-1.8 1.2-1a7 7 0 0 1 0-1.5l-1.2-1 .9-1.8 1.6.3a7 7 0 0 1 1.2-1l.3-1.6h2l.8 1.5a7 7 0 0 1 1.8 0l.7-1.5h2l.3 1.6a7 7 0 0 1 1.2 1l1.6-.3.9 1.8-1.2 1a7 7 0 0 1 0 1.5Z"/></svg><span>Ajustes</span><span class="account-shortcut-arrow" aria-hidden="true">→</span></a>
          <a href="#support">${accountShortcutIcon("support")}<span>Ayuda y soporte</span><span class="account-shortcut-arrow" aria-hidden="true">→</span></a>
          <button class="button button-danger account-logout" type="button" data-action="logout">Cerrar sesión</button>
        </section>
      </div>
      <section class="feature-panel account-orders-panel"><div class="feature-section-heading"><div><h2>Pedidos recientes</h2><p>Compras de demostración asociadas a tu cuenta.</p></div><a class="account-view-all" href="#orders">Ver todos</a></div>
        ${orders.length ? `<div class="account-recent-orders">${orders.map((order) => `<a class="account-recent-order" href="#confirmation?order=${encodeURIComponent(order.id)}"><span><strong>${escapeHtml(order.id)}</strong><small>${escapeHtml(order.date || "Fecha no disponible")} · ${escapeHtml(order.demoStatus || "Pedido confirmado")}</small></span><strong>${window.formatMoney(order.total)}</strong></a>`).join("")}</div>`
          : `<p class="account-no-orders">Aún no tienes compras de demostración. Cuando confirmes un pedido, aparecerá aquí.</p>`}
      </section>
      <section class="feature-panel address-panel" id="account-addresses"><div class="feature-section-heading"><div><h2>Direcciones guardadas</h2><p>Direcciones de entrega guardadas en este navegador, por cuenta.</p></div></div>
        ${list.length ? `<div class="saved-address-list">${list.map(renderAddress).join("")}</div>` : `<p class="feature-muted">Todavía no tienes direcciones guardadas.</p>`}
        <form class="feature-form address-form" data-feature-form="address" novalidate>
          <h3 id="address-form-title">Agregar dirección</h3><input type="hidden" name="editIndex" value="">
          <div class="address-form-grid">
            <label class="feature-field"><span>Nombre del destinatario</span><input name="recipient" minlength="2" required></label>
            <label class="feature-field"><span>Dirección</span><input name="street" minlength="5" required></label>
            <label class="feature-field"><span>Ciudad</span><input name="city" minlength="2" required></label>
            <label class="feature-field"><span>Código postal</span><input name="postal" inputmode="numeric" pattern="[0-9]{4,10}" required></label>
            <label class="feature-field"><span>Teléfono</span><input name="phone" inputmode="tel" pattern="[0-9]{8,15}" required></label>
          </div>
          <p class="feature-form-error" role="alert"></p>
          <div class="feature-inline-actions"><button class="button button-primary" type="submit">Guardar dirección</button><button class="button button-outline" type="button" data-feature-action="cancel-address" hidden>Cancelar edición</button></div>
        </form>
      </section>`;
  }

  function notificationMap() {
    const data = read(NOTIFICATIONS_KEY, {});
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  }

  function userNotifications() {
    const map = notificationMap();
    const list = map[ownerId()];
    return Array.isArray(list) ? list : [];
  }

  function saveNotifications(list) {
    const map = notificationMap();
    map[ownerId()] = list;
    return write(NOTIFICATIONS_KEY, map);
  }

  function unreadCount() {
    return userNotifications().filter((notification) => !notification.read).length;
  }

  function updateNotificationBadge() {
    const badge = document.getElementById("notification-count");
    const count = unreadCount();
    if (badge) {
      badge.textContent = "";
      badge.hidden = count === 0;
      badge.setAttribute("aria-label", `${count} notificaciones sin leer`);
      const link = badge.closest(".notification-link");
      if (link) link.setAttribute("aria-label", count
        ? `Centro de notificaciones, ${count} ${count === 1 ? "aviso sin leer" : "avisos sin leer"}`
        : "Centro de notificaciones, no hay avisos sin leer");
    }
    const menuIndicator = document.getElementById("menu-notification-indicator");
    if (menuIndicator) menuIndicator.hidden = count === 0;
    const menuToggle = document.getElementById("menu-toggle");
    if (menuToggle) {
      const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
      const state = count ? ", hay notificaciones sin leer" : "";
      menuToggle.setAttribute("aria-label", `${isOpen ? "Cerrar" : "Abrir"} menú${state}`);
    }
  }

  function renderNotifications() {
    const list = userNotifications().slice().reverse();
    const unread = unreadCount();
    return `<p class="eyebrow">Centro de actividad</p><h1 class="page-heading">Notificaciones</h1>
      <p class="page-intro">Avisos locales de esta tienda de demostración. No se envían mensajes externos.</p>
      <div class="notification-toolbar"><span>${unread ? `${unread} ${unread === 1 ? "aviso sin leer" : "avisos sin leer"}` : "No tienes notificaciones pendientes"}</span><button class="button button-outline" type="button" data-feature-action="read-all" ${unread ? "" : "disabled"}>Marcar todas como leídas</button></div>
      ${list.length ? `<div class="feature-list">${list.map((notification) => `<article class="feature-panel notification-item${notification.read ? " is-read" : ""}">
        <span class="notification-type-icon notification-icon-${escapeHtml(notification.type)}" aria-hidden="true">${notification.type === "order" ? "▤" : notification.type === "promotion" ? "✦" : "✓"}</span>
        <div class="notification-copy"><div class="notification-item-head"><strong>${escapeHtml(notification.title)}</strong><time>${escapeHtml(notification.date)}</time></div>
          <p>${escapeHtml(notification.message)}</p><small>${notification.read ? "Leída" : "Sin leer"} · Demostración</small></div>
        <div class="notification-actions">${!notification.read ? `<button class="button button-outline" type="button" data-feature-action="read-notification" data-notification-id="${escapeHtml(notification.id)}">Marcar leída</button>` : ""}
          <button class="remove-button" type="button" data-feature-action="delete-notification" data-notification-id="${escapeHtml(notification.id)}">Eliminar</button></div>
      </article>`).join("")}</div>`
        : `<div class="feature-empty"><span class="notification-empty-icon" aria-hidden="true"><svg class="notification-bell-icon" viewBox="0 0 24 24" fill="none" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /><path d="M12 3V2" /></svg></span><h2>No tienes notificaciones</h2><p>Los avisos de demostración aparecerán aquí.</p></div>`}
      ${currentPreferences().promotions ? `<button class="button button-outline" type="button" data-feature-action="demo-promotion">Crear aviso promocional de ejemplo</button>` : `<p class="feature-muted">Los avisos promocionales están desactivados en Ajustes.</p>`}`;
  }

  function makeNotification(type, title, message) {
    const preferences = currentPreferences();
    if (type === "promotion" && !preferences.promotions) return;
    if (type === "order" && !preferences.orders) return;
    if (type === "confirmation" && !preferences.confirmations) return;
    const list = userNotifications();
    list.push({
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      message,
      date: new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date()),
      read: false
    });
    if (saveNotifications(list)) {
      updateNotificationBadge();
      if (typeof window.showToast === "function" && window.location.hash === "#notifications") window.dispatchEvent(new CustomEvent("luma:features-updated"));
    }
  }

  function supportPage() {
    return `<p class="eyebrow">Estamos para orientarte</p><h1 class="page-heading">Ayuda y soporte</h1>
      <p class="page-intro">Respuestas a preguntas frecuentes y contacto de demostración.</p>
      <section class="feature-panel faq-panel"><div class="feature-section-heading"><div><h2>Preguntas frecuentes</h2><p>Selecciona una pregunta para desplegar la respuesta.</p></div></div>
        ${["Compras", "Pagos", "Envíos", "Devoluciones", "Cuenta"].map((category) => `<div class="faq-category"><h3>${category}</h3>
          ${FAQ.filter((item) => item.category === category).map((item, index) => `<details class="faq-item"><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`).join("")}
        </div>`).join("")}
      </section>
      <section class="feature-panel support-contact"><div class="feature-section-heading"><div><h2>Formulario de contacto</h2><p>Escribe tu consulta. El formulario solo confirma el envío en esta página.</p></div></div>
        <form class="feature-form" data-feature-form="support" novalidate>
          <div class="address-form-grid">
            <label class="feature-field"><span>Nombre</span><input name="name" value="${escapeHtml(currentUser()?.name || "")}" minlength="2" required></label>
            <label class="feature-field"><span>Correo electrónico</span><input name="email" type="email" value="${escapeHtml(currentUser()?.email || "")}" required></label>
            <label class="feature-field full"><span>Asunto</span><input name="subject" minlength="3" required></label>
            <label class="feature-field full"><span>Descripción del problema</span><textarea name="description" rows="5" minlength="10" maxlength="1500" required></textarea></label>
          </div>
          <p class="feature-form-error" role="alert"></p><button class="button button-primary" type="submit">Enviar consulta de demostración</button>
          <p class="feature-disclaimer">No hay servidor conectado: la consulta no se envía ni se guarda fuera de esta página.</p>
        </form>
      </section>`;
  }

  function page(route, products) {
    if (route === "favorites") return renderFavorites(products);
    if (route === "orders") return renderOrders();
    if (route === "account") return accountPage();
    if (route === "notifications") return renderNotifications();
    if (route === "support") return supportPage();
    return `<div class="feature-empty"><h2>No encontramos esta sección</h2><a class="button button-primary" href="#home">Volver a la tienda</a></div>`;
  }

  function clearFilters() {
    const params = new URLSearchParams();
    const query = new URLSearchParams(window.location.hash.split("?")[1] || "");
    if (query.get("q")) params.set("q", query.get("q"));
    window.location.hash = `#home${params.toString() ? `?${params}` : ""}`;
  }

  function updateFilters(form) {
    const current = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const data = new FormData(form);
    for (const key of ["category", "min", "max", "sort"]) {
      const value = String(data.get(key) || "");
      if (key === "category" && value === "Todo") current.delete(key);
      else if (key === "sort" && value === "featured") current.delete(key);
      else if (value) current.set(key, value);
      else current.delete(key);
    }
    window.location.hash = `#home${current.toString() ? `?${current}` : ""}`;
  }

  function saveAddressList(list) {
    const map = addressMap();
    map[ownerId()] = list;
    return write(ADDRESSES_KEY, map);
  }

  function updateOrderStage(id) {
    const orders = read("luma_orders", []);
    if (!Array.isArray(orders)) return;
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    order.demoStatus = ORDER_STAGES[Math.min(statusFor(order) + 1, ORDER_STAGES.length - 1)];
    if (write("luma_orders", orders)) {
      makeNotification("order", "Estado de pedido actualizado (demo)", `El estado simulado de ${id} ahora es: ${order.demoStatus}.`);
      renderCurrentPage();
      if (typeof window.showToast === "function") window.showToast("Estado de demostración actualizado.");
    }
  }

  function showProfilePhotoPreview(file) {
    if (pendingProfilePhotoUrl) URL.revokeObjectURL(pendingProfilePhotoUrl);
    pendingProfilePhoto = file;
    pendingProfilePhotoUrl = URL.createObjectURL(file);
    const email = ownerId();
    document.querySelectorAll(".profile-avatar[data-avatar-email]").forEach((avatar) => {
      if (avatar.dataset.avatarEmail !== email) return;
      const image = avatar.querySelector(".profile-avatar-image");
      const fallback = avatar.querySelector(".profile-avatar-fallback");
      if (!image || !fallback) return;
      image.onload = () => {
        image.hidden = false;
        fallback.hidden = true;
      };
      image.onerror = () => {
        image.hidden = true;
        fallback.hidden = false;
      };
      image.src = pendingProfilePhotoUrl;
    });
    document.getElementById("profile-photo-confirm").hidden = false;
    document.getElementById("profile-photo-error").textContent = "";
  }

  function clearProfilePhotoPreview() {
    pendingProfilePhoto = null;
    if (pendingProfilePhotoUrl) URL.revokeObjectURL(pendingProfilePhotoUrl);
    pendingProfilePhotoUrl = null;
    hydrateProfileAvatars();
    const confirmActions = document.getElementById("profile-photo-confirm");
    if (confirmActions) confirmActions.hidden = true;
  }

  async function saveProfilePhoto() {
    const error = document.getElementById("profile-photo-error");
    const saveButton = document.querySelector('[data-feature-action="save-profile-photo"]');
    if (!pendingProfilePhoto || !error || !saveButton) return;
    saveButton.disabled = true;
    error.textContent = "";
    try {
      await writeProfilePhoto(ownerId(), pendingProfilePhoto);
      clearProfilePhotoPreview();
      await hydrateProfileAvatars();
      if (typeof window.showToast === "function") window.showToast("Foto de perfil guardada en este navegador.");
    } catch (cause) {
      console.error("No se pudo guardar la foto de perfil.", cause);
      error.textContent = `No se pudo guardar la foto de perfil. ${cause.message || "Inténtalo de nuevo."}`;
    } finally {
      saveButton.disabled = false;
    }
  }

  async function removeProfilePhoto() {
    const error = document.getElementById("profile-photo-error");
    const button = document.getElementById("remove-profile-photo");
    if (!error || !button) return;
    if (!window.confirm("¿Eliminar la foto de perfil de esta cuenta?")) return;
    button.disabled = true;
    error.textContent = "";
    try {
      await deleteProfilePhoto(ownerId());
      clearProfilePhotoPreview();
      await hydrateProfileAvatars();
      if (typeof window.showToast === "function") window.showToast("Foto de perfil eliminada.");
    } catch (cause) {
      console.error("No se pudo eliminar la foto de perfil.", cause);
      error.textContent = `No se pudo eliminar la foto. ${cause.message || "Inténtalo de nuevo."}`;
    } finally {
      button.disabled = false;
    }
  }

  async function saveProfileForm(form, error, data) {
    const user = currentUser();
    if (!user) {
      error.textContent = "Inicia sesión de nuevo para editar tu perfil.";
      return;
    }
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim().toLowerCase();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error.textContent = "Escribe un nombre y un correo electrónico válidos.";
      return;
    }
    const oldEmail = user.email.toLowerCase();
    const profiles = read("luma_profiles", {});
    if (email !== oldEmail && profiles[email]) {
      error.textContent = "Ese correo ya está asociado a otra cuenta de demostración.";
      return;
    }
    let photoMoved = false;
    try {
      if (email !== oldEmail) {
        photoMoved = await moveProfilePhoto(oldEmail, email);
        if (!photoMoved) {
          error.textContent = "Ya existe una foto guardada para el nuevo correo. No se cambió el perfil para evitar mezclar cuentas.";
          return;
        }
        if (!moveOwnerData(oldEmail, email)) {
          if (photoMoved) await moveProfilePhoto(email, oldEmail);
          error.textContent = "No se pudieron actualizar todos los datos locales. Inténtalo de nuevo.";
          return;
        }
      }
      if (!write("luma_user", { ...user, name, email })) {
        if (photoMoved) await moveProfilePhoto(email, oldEmail);
        error.textContent = "No se pudo guardar el perfil en este navegador.";
        return;
      }
      if (profiles[oldEmail]) {
        profiles[email] = name;
        delete profiles[oldEmail];
        write("luma_profiles", profiles);
      }
    } catch (cause) {
      console.error("No se pudo guardar el perfil local.", cause);
      error.textContent = `No se pudo actualizar el perfil. ${cause.message || "Inténtalo de nuevo."}`;
      return;
    }
    if (typeof window.updateShopHeader === "function") window.updateShopHeader();
    renderCurrentPage();
    if (typeof window.showToast === "function") window.showToast("Perfil actualizado.");
  }

  function renderCurrentPage() {
    const route = window.location.hash.slice(1).split("?")[0];
    const host = document.getElementById("app");
    if (host && ["favorites", "orders", "account", "notifications", "support"].includes(route)) {
      host.innerHTML = page(route, window.PRODUCTS || []);
      updateNotificationBadge();
      if (route === "account") hydrateProfileAvatars();
    }
  }

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.closest("#catalog-filters")) updateFilters(target.form);
    if (target.id === "profile-photo-input") {
      const file = target.files?.[0];
      if (!file) return;
      const error = document.getElementById("profile-photo-error");
      if (!PROFILE_PHOTO_TYPES.includes(file.type)) {
        error.textContent = "Elige una imagen JPG, PNG o WebP.";
        target.value = "";
        return;
      }
      if (file.size > PROFILE_PHOTO_MAX_SIZE) {
        error.textContent = "La imagen supera el límite de 5 MB. Elige un archivo más pequeño.";
        target.value = "";
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const validationImage = new Image();
      validationImage.onload = () => {
        URL.revokeObjectURL(previewUrl);
        showProfilePhotoPreview(file);
        target.value = "";
      };
      validationImage.onerror = () => {
        URL.revokeObjectURL(previewUrl);
        error.textContent = "No se pudo leer esta imagen. Prueba con otro archivo.";
        target.value = "";
      };
      validationImage.src = previewUrl;
    }
    if (target.id === "saved-shipping-address") {
      const index = Number(target.value);
      const address = addresses()[index];
      const form = document.getElementById("shipping-form");
      if (!address || !form) return;
      for (const key of ["recipient", "street", "city", "postal", "phone"]) form.elements[key].value = address[key] || "";
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (form.id === "catalog-filters") {
      event.preventDefault();
      updateFilters(form);
      return;
    }
    const formType = form.dataset.featureForm;
    if (!formType) return;
    event.preventDefault();
    const error = form.querySelector(".feature-form-error");
    error.textContent = "";
    error.classList.remove("is-success");
    if (!form.reportValidity()) {
      error.textContent = "Revisa los campos obligatorios antes de continuar.";
      return;
    }
    const data = new FormData(form);
    if (formType === "review") {
      const rating = Number(data.get("rating"));
      const comment = String(data.get("comment") || "").trim();
      if (!rating || rating < 1 || rating > 5 || comment.length < 5) {
        error.textContent = "Selecciona de 1 a 5 estrellas y escribe un comentario de al menos 5 caracteres.";
        return;
      }
      const user = currentUser();
      const reviews = allReviews();
      reviews.push({
        id: `REV-${Date.now()}`, productId: form.dataset.productId, name: user.name,
        email: user.email, rating, comment,
        date: new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date())
      });
      if (write(REVIEWS_KEY, reviews)) {
        renderProductPage(form.dataset.productId);
        if (typeof window.showToast === "function") window.showToast("Reseña de demostración publicada.");
      }
    } else if (formType === "profile") {
      if (form.dataset.editing !== "true") return;
      saveProfileForm(form, error, data);
    } else if (formType === "address") {
      const list = addresses();
      const address = Object.fromEntries(["recipient", "street", "city", "postal", "phone"].map((key) => [key, String(data.get(key) || "").trim()]));
      const editIndex = data.get("editIndex");
      if (editIndex !== "" && Number.isInteger(Number(editIndex)) && Number(editIndex) >= 0 && Number(editIndex) < list.length) list[Number(editIndex)] = address;
      else list.push(address);
      if (saveAddressList(list)) {
        renderCurrentPage();
        if (typeof window.showToast === "function") window.showToast(editIndex === "" ? "Dirección guardada." : "Dirección actualizada.");
      }
    } else if (formType === "support") {
      const email = String(data.get("email") || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        error.textContent = "Escribe un correo electrónico válido.";
        return;
      }
      form.reset();
      error.textContent = "Consulta recibida en la demostración. No se envió a ningún servidor.";
      error.classList.add("is-success");
    }
  });

  document.addEventListener("click", (event) => {
    const favorite = event.target.closest("[data-feature-favorite]");
    if (favorite) {
      const id = favorite.dataset.featureFavorite;
      if (toggleFavorite(id)) {
        const selected = isFavorite(id);
        favorite.classList.toggle("is-favorite", selected);
        favorite.setAttribute("aria-pressed", String(selected));
        favorite.setAttribute("aria-label", selected ? "Quitar de favoritos" : "Agregar a favoritos");
        favorite.textContent = selected ? "♥" : "♡";
        if (window.location.hash === "#favorites") renderCurrentPage();
      }
      return;
    }
    const button = event.target.closest("[data-feature-action]");
    if (!button) return;
    const action = button.dataset.featureAction;
    if (action === "clear-filters") clearFilters();
    else if (action === "edit-profile") {
      const form = document.querySelector('[data-feature-form="profile"]');
      if (!form) return;
      form.dataset.editing = "true";
      form.elements.name.readOnly = false;
      form.elements.email.readOnly = false;
      form.querySelector(".profile-form-actions").hidden = false;
      button.hidden = true;
      form.elements.name.focus();
    } else if (action === "cancel-profile-edit") {
      renderCurrentPage();
    } else if (action === "save-profile-photo") {
      saveProfilePhoto();
    } else if (action === "cancel-profile-photo") {
      clearProfilePhotoPreview();
      const input = document.getElementById("profile-photo-input");
      if (input) input.value = "";
    } else if (action === "remove-profile-photo") {
      removeProfilePhoto();
    } else if (action === "advance-order") updateOrderStage(button.dataset.orderId);
    else if (action === "read-all") {
      const list = userNotifications().map((item) => ({ ...item, read: true }));
      if (saveNotifications(list)) renderCurrentPage();
    } else if (action === "read-notification" || action === "delete-notification") {
      const id = button.dataset.notificationId;
      const list = userNotifications();
      const updated = action === "read-notification"
        ? list.map((item) => item.id === id ? { ...item, read: true } : item)
        : list.filter((item) => item.id !== id);
      if (saveNotifications(updated)) renderCurrentPage();
    } else if (action === "demo-promotion") {
      makeNotification("promotion", "Novedad de Luma (demo)", "Este aviso es promocional y solo aparece dentro de la tienda de demostración.");
      renderCurrentPage();
    } else if (action === "edit-address") {
      const index = Number(button.dataset.addressIndex);
      const address = addresses()[index];
      const form = document.querySelector('[data-feature-form="address"]');
      if (!address || !form) return;
      for (const key of ["recipient", "street", "city", "postal", "phone"]) form.elements[key].value = address[key] || "";
      form.elements.editIndex.value = String(index);
      document.getElementById("address-form-title").textContent = "Editar dirección";
      form.querySelector('[data-feature-action="cancel-address"]').hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (action === "cancel-address") {
      renderCurrentPage();
    } else if (action === "delete-address") {
      if (!window.confirm("¿Eliminar esta dirección guardada?")) return;
      const list = addresses();
      list.splice(Number(button.dataset.addressIndex), 1);
      if (saveAddressList(list)) renderCurrentPage();
    }
  });

  function renderProductPage(id) {
    const product = (window.PRODUCTS || []).find((item) => item.id === id);
    const app = document.getElementById("app");
    if (!product || !app) return;
    const existing = app.querySelector(".review-section");
    if (existing) existing.outerHTML = renderReviewSection(id);
    else app.insertAdjacentHTML("beforeend", renderReviewSection(id));
    const rating = app.querySelector(".product-detail-copy .rating");
    if (rating) rating.innerHTML = renderReviewSummary(id);
  }

  function notificationCenterLink() {
    return `<a class="feature-nav-link" href="#notifications" aria-label="Notificaciones"><svg class="notification-bell-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /><path d="M12 3V2" /></svg><span>Notificaciones</span></a>
      <a class="feature-nav-link" href="#favorites" aria-label="Mis favoritos">♡ <span>Favoritos</span></a>
      <a class="feature-nav-link" href="#account" aria-label="Mi cuenta">♙ <span>Mi cuenta</span></a>
      <a class="feature-nav-link" href="#support" aria-label="Ayuda y soporte">? <span>Ayuda</span></a>`;
  }

  window.addEventListener("storage", (event) => {
    if ([FAVORITES_KEY, REVIEWS_KEY, ADDRESSES_KEY, NOTIFICATIONS_KEY, "luma_orders", "luma_user"].includes(event.key)) {
      updateNotificationBadge();
      renderCurrentPage();
    }
  });

  window.addEventListener("luma:features-updated", renderCurrentPage);
  window.addEventListener("hashchange", updateNotificationBadge);
  window.LumaFeatures = {
    favorites,
    isFavorite,
    toggleFavorite,
    filtersMarkup,
    filterProducts,
    renderReviewSummary,
    renderReviewSection,
    page,
    notificationCenterLink,
    makeNotification,
    recordOrder(order, user) {
      const label = order.id;
      if (currentPreferences().orders) makeNotification("order", "Compra de demostración confirmada", `El pedido ${label} se registró en esta tienda de demostración.`);
    },
    updateNotificationBadge,
    getOwner: ownerId,
    savedAddressPicker,
    avatarMarkup,
    hydrateProfileAvatars
  };
  updateNotificationBadge();
})();
