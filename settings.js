(function () {
  "use strict";

  const UI_KEY = "luma_settings_ui";
  const NOTIFICATIONS_KEY = "luma_settings_notifications";
  const DEFAULT_UI = { theme: "light", language: "es", animations: true, textSize: "normal" };
  const DEFAULT_NOTIFICATIONS = { confirmations: true, orders: true, promotions: false };
  const darkPreference = window.matchMedia("(prefers-color-scheme: dark)");

  function readObject(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? { ...fallback, ...JSON.parse(value) } : { ...fallback };
    } catch (error) {
      console.error(`No se pudieron leer las preferencias (${key}).`, error);
      return { ...fallback };
    }
  }

  function uiPreferences() {
    const value = readObject(UI_KEY, DEFAULT_UI);
    if (!["light", "dark", "auto"].includes(value.theme)) value.theme = DEFAULT_UI.theme;
    if (!["small", "normal", "large"].includes(value.textSize)) value.textSize = DEFAULT_UI.textSize;
    value.language = "es";
    value.animations = value.animations !== false;
    return value;
  }

  function notifications() {
    const value = readObject(NOTIFICATIONS_KEY, DEFAULT_NOTIFICATIONS);
    for (const key of Object.keys(DEFAULT_NOTIFICATIONS)) value[key] = value[key] !== false;
    return value;
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`No se pudieron guardar las preferencias (${key}).`, error);
      if (typeof window.showToast === "function") window.showToast("No se pudieron guardar tus ajustes en este navegador.", true);
      return false;
    }
  }

  function applyPreferences() {
    const prefs = uiPreferences();
    const root = document.documentElement;
    const dark = prefs.theme === "dark" || (prefs.theme === "auto" && darkPreference.matches);
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.textSize = prefs.textSize;
    root.lang = prefs.language;
    root.classList.toggle("settings-no-motion", !prefs.animations);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = dark ? "#111c27" : "#102a43";
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function storageSummary() {
    const knownKeys = ["luma_user", "luma_profiles", "luma_cart", "luma_orders", UI_KEY, NOTIFICATIONS_KEY];
    let present = [];
    try {
      present = knownKeys.filter((key) => localStorage.getItem(key) !== null);
    } catch (error) {
      console.error("No se pudo consultar el almacenamiento del navegador.", error);
      return "El navegador no permitió consultar el almacenamiento local.";
    }
    return present.length
      ? `Hay ${present.length} tipo(s) de dato de la tienda guardado(s) en este navegador: ${present.map(escapeHtml).join(", ")}.`
      : "No hay datos de la tienda guardados en este navegador.";
  }

  function render(user) {
    const prefs = uiPreferences();
    const notices = notifications();
    const userCard = user
      ? `<div class="settings-account-user"><span class="settings-avatar" aria-hidden="true">${escapeHtml(user.name.trim().charAt(0).toLocaleUpperCase("es"))}</span>
          <div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email)}</span></div></div>
        <div class="settings-button-row"><a class="button button-outline" href="#orders">Ver mis pedidos</a>
          <button class="button button-danger" type="button" data-action="logout" data-confirm-logout="true">Cerrar sesión</button></div>`
      : `<p class="settings-guest">Estás explorando como visitante. Inicia sesión para consultar tu cuenta y tus pedidos.</p>
        <div class="settings-button-row"><a class="button button-primary" href="#login">Iniciar sesión</a><a class="button button-outline" href="#register">Crear cuenta</a></div>`;

    return `<div class="settings-page">
      <div class="settings-page-heading">
        <div><p class="eyebrow">Tu espacio Luma</p><h1 class="page-heading">Ajustes</h1>
          <p class="page-intro">Personaliza la tienda a tu manera. Tus cambios se guardan en este navegador.</p></div>
        <a class="button button-outline settings-back" href="#home">← Volver a la tienda</a>
      </div>
      <div class="settings-layout">
        <nav class="settings-index" aria-label="Secciones de ajustes">
          <a href="#settings" data-settings-scroll="settings-appearance">◐ <span>Apariencia</span></a>
          <a href="#settings" data-settings-scroll="settings-general">☷ <span>Preferencias</span></a>
          <a href="#settings" data-settings-scroll="settings-notifications">♧ <span>Notificaciones</span></a>
          <a href="#settings" data-settings-scroll="settings-privacy">◇ <span>Privacidad</span></a>
          <a href="#settings" data-settings-scroll="settings-account">♙ <span>Cuenta y sesión</span></a>
        </nav>
        <div class="settings-sections">
          <section class="settings-card" id="settings-appearance" aria-labelledby="settings-appearance-title">
            <div class="settings-section-heading"><span class="settings-icon" aria-hidden="true">◐</span><div>
              <h2 id="settings-appearance-title">Apariencia</h2><p>Elige cómo quieres ver la tienda en todos tus dispositivos.</p>
            </div></div>
            <fieldset class="theme-picker"><legend class="sr-only">Tema de la tienda</legend>
              ${[
                ["light", "☀", "Claro", "La apariencia original de Luma."],
                ["dark", "☾", "Oscuro", "Una paleta cómoda para poca luz."],
                ["auto", "◐", "Automático", "Sigue la preferencia de tu dispositivo."]
              ].map(([value, icon, label, help]) => `<label class="theme-choice${prefs.theme === value ? " is-selected" : ""}">
                <input type="radio" name="settings-theme" value="${value}" ${prefs.theme === value ? "checked" : ""}>
                <span class="theme-choice-icon" aria-hidden="true">${icon}</span><span class="theme-choice-copy"><strong>${label}</strong><small>${help}</small></span>
                <span class="theme-choice-check" aria-hidden="true">✓</span>
              </label>`).join("")}
            </fieldset>
            <p class="settings-inline-status" id="theme-status" aria-live="polite">Tema actual: ${prefs.theme === "auto" ? "automático" : prefs.theme === "dark" ? "oscuro" : "claro"}.</p>
          </section>

          <section class="settings-card" id="settings-general" aria-labelledby="settings-general-title">
            <div class="settings-section-heading"><span class="settings-icon" aria-hidden="true">☷</span><div>
              <h2 id="settings-general-title">Preferencias generales</h2><p>Ajusta la lectura y el movimiento de la interfaz.</p>
            </div></div>
            <div class="settings-option-row"><div><strong>Idioma</strong><p>Idioma disponible actualmente para la interfaz.</p></div>
              <label class="settings-select-label"><span class="sr-only">Idioma de la interfaz</span><select id="settings-language" aria-describedby="language-note"><option value="es" selected>Español</option></select></label></div>
            <p class="settings-subnote" id="language-note">La tienda está disponible en español en esta versión.</p>
            <div class="settings-option-row"><div><strong>Tamaño del texto</strong><p>Elige el tamaño de lectura de la tienda.</p></div>
              <label class="settings-select-label"><span class="sr-only">Tamaño del texto</span><select id="settings-text-size">
                <option value="small" ${prefs.textSize === "small" ? "selected" : ""}>Pequeño</option>
                <option value="normal" ${prefs.textSize === "normal" ? "selected" : ""}>Normal</option>
                <option value="large" ${prefs.textSize === "large" ? "selected" : ""}>Grande</option>
              </select></label></div>
            <div class="settings-option-row"><div><strong>Animaciones y transiciones</strong><p>Reduce el movimiento decorativo de la tienda.</p></div>
              <label class="settings-switch"><input type="checkbox" data-setting="animations" ${prefs.animations ? "checked" : ""}><span class="settings-switch-track"></span><span class="sr-only">Activar animaciones y transiciones</span></label></div>
            <div class="settings-option-row settings-sound-row"><div><strong>Sonidos de interfaz</strong><p>No hay sonidos implementados en esta demo.</p></div><span class="settings-unavailable">No disponible</span></div>
          </section>

          <section class="settings-card" id="settings-notifications" aria-labelledby="settings-notifications-title">
            <div class="settings-section-heading"><span class="settings-icon" aria-hidden="true">♧</span><div>
              <h2 id="settings-notifications-title">Notificaciones de demostración</h2><p>Controla los avisos que aparecen dentro de esta tienda.</p>
            </div></div>
            ${[
              ["confirmations", "Confirmaciones de acciones", "Mensajes al agregar productos o guardar cambios."],
              ["orders", "Avisos sobre pedidos", "Avisos en pantalla sobre compras de demostración."],
              ["promotions", "Novedades y promociones", "Preferencia local para contenido promocional de ejemplo."]
            ].map(([key, label, help]) => `<div class="settings-option-row"><div><strong>${label}</strong><p>${help}</p></div>
              <label class="settings-switch"><input type="checkbox" data-notification="${key}" ${notices[key] ? "checked" : ""}><span class="settings-switch-track"></span><span class="sr-only">${label}</span></label></div>`).join("")}
            <p class="settings-subnote">Estas preferencias solo se guardan localmente. La tienda no envía correos, mensajes ni notificaciones reales.</p>
          </section>

          <section class="settings-card" id="settings-privacy" aria-labelledby="settings-privacy-title">
            <div class="settings-section-heading"><span class="settings-icon" aria-hidden="true">◇</span><div>
              <h2 id="settings-privacy-title">Privacidad y almacenamiento</h2><p>Consulta qué guarda esta demostración y administra tus preferencias.</p>
            </div></div>
            <div class="settings-storage-info"><strong>Almacenamiento de esta tienda</strong><p>${storageSummary()}</p>
              <small>Carrito, cuenta de demostración e historial de pedidos se conservan por separado en el navegador.</small></div>
            <div class="settings-privacy-actions">
              <div><strong>Borrar preferencias visuales</strong><p>Restablece tema, idioma, texto y animaciones; conserva notificaciones, cuenta, carrito y pedidos.</p></div>
              <button class="button button-outline" type="button" data-settings-action="clear-visual">Borrar preferencias</button>
            </div>
            <div class="settings-privacy-actions">
              <div><strong>Restablecer todos los ajustes</strong><p>Restaura apariencia y notificaciones predeterminadas. No elimina cuenta, carrito ni pedidos.</p></div>
              <button class="button button-outline" type="button" data-settings-action="restore">Restablecer ajustes</button>
            </div>
            <div class="settings-demo-warning"><strong>Seguridad de demostración</strong><p>El inicio de sesión de Luma es simulado y no ofrece autenticación ni protección de cuenta reales. No guardes información confidencial en esta tienda.</p></div>
          </section>

          <section class="settings-card" id="settings-account" aria-labelledby="settings-account-title">
            <div class="settings-section-heading"><span class="settings-icon" aria-hidden="true">♙</span><div>
              <h2 id="settings-account-title">Cuenta y sesión</h2><p>Información de la sesión actual en este navegador.</p>
            </div></div>
            ${userCard}
            <p class="settings-subnote">La sesión es de demostración y se almacena localmente; no es un mecanismo de seguridad real.</p>
          </section>
        </div>
      </div>
      <div class="settings-bottom"><a class="button button-outline" href="#home">← Regresar a la página principal</a></div>
    </div>`;
  }

  function feedback(message, isError = false) {
    if (typeof window.showToast === "function") window.showToast(message, isError);
  }

  function updateUiPreference(key, value, message) {
    const prefs = uiPreferences();
    prefs[key] = value;
    if (save(UI_KEY, prefs)) {
      applyPreferences();
      feedback(message);
    }
  }

  function updateNotification(key, value) {
    const prefs = notifications();
    prefs[key] = value;
    if (save(NOTIFICATIONS_KEY, prefs)) feedback("Preferencias de notificación guardadas.");
  }

  function clearVisualPreferences() {
    if (!window.confirm("Se restablecerán solo tema, idioma, tamaño del texto y animaciones. Se conservarán las notificaciones, la cuenta, el carrito y los pedidos. ¿Continuar?")) return;
    try {
      localStorage.removeItem(UI_KEY);
    } catch (error) {
      console.error("No se pudieron borrar las preferencias visuales.", error);
      feedback("No se pudieron borrar las preferencias visuales.", true);
      return;
    }
    applyPreferences();
    window.dispatchEvent(new CustomEvent("luma:settings-updated"));
    feedback("Preferencias visuales restablecidas. Tus otros datos siguen intactos.");
  }

  function restoreAllSettings() {
    if (!window.confirm("Se restablecerán tema, idioma, texto, animaciones y notificaciones. La cuenta, el carrito y los pedidos NO se eliminarán. ¿Continuar?")) return;
    try {
      localStorage.removeItem(UI_KEY);
      localStorage.removeItem(NOTIFICATIONS_KEY);
    } catch (error) {
      console.error("No se pudieron restablecer los ajustes.", error);
      feedback("No se pudieron restablecer los ajustes.", true);
      return;
    }
    applyPreferences();
    window.dispatchEvent(new CustomEvent("luma:settings-updated"));
    feedback("Ajustes restaurados. La cuenta, el carrito y los pedidos siguen intactos.");
  }

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.matches('input[name="settings-theme"]')) {
      updateUiPreference("theme", target.value, "Tema actualizado.");
      document.querySelectorAll(".theme-choice").forEach((choice) => {
        choice.classList.toggle("is-selected", choice.querySelector('input[name="settings-theme"]').checked);
      });
      const status = document.getElementById("theme-status");
      if (status) status.textContent = `Tema actual: ${target.value === "auto" ? "automático" : target.value === "dark" ? "oscuro" : "claro"}.`;
    } else if (target.id === "settings-text-size") {
      updateUiPreference("textSize", target.value, "Tamaño del texto actualizado.");
    } else if (target.id === "settings-language") {
      updateUiPreference("language", "es", "El idioma español está seleccionado.");
    } else if (target.matches('[data-setting="animations"]')) {
      updateUiPreference("animations", target.checked, target.checked ? "Animaciones activadas." : "Animaciones desactivadas.");
    } else if (target.matches("[data-notification]")) {
      updateNotification(target.dataset.notification, target.checked);
    }
  });

  document.addEventListener("click", (event) => {
    const sectionLink = event.target.closest("[data-settings-scroll]");
    if (sectionLink) {
      event.preventDefault();
      document.getElementById(sectionLink.dataset.settingsScroll)?.scrollIntoView({ behavior: uiPreferences().animations ? "smooth" : "auto", block: "start" });
      return;
    }
    const action = event.target.closest("[data-settings-action]");
    if (action?.dataset.settingsAction === "clear-visual") clearVisualPreferences();
    if (action?.dataset.settingsAction === "restore") restoreAllSettings();

    const logout = event.target.closest("[data-confirm-logout]");
    if (logout && !window.confirm("¿Quieres cerrar la sesión de demostración?")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  function handleSystemThemeChange() {
    if (uiPreferences().theme === "auto") applyPreferences();
  }
  if (typeof darkPreference.addEventListener === "function") {
    darkPreference.addEventListener("change", handleSystemThemeChange);
  } else {
    darkPreference.addListener(handleSystemThemeChange);
  }

  window.addEventListener("storage", (event) => {
    if (event.key === UI_KEY || event.key === NOTIFICATIONS_KEY) {
      applyPreferences();
      window.dispatchEvent(new CustomEvent("luma:settings-updated"));
    }
  });

  applyPreferences();
  window.LumaSettings = { render, notifications, applyPreferences };
})();
