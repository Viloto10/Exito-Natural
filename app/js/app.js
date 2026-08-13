import { loadAsvData } from "./data.js?v=4";
import { runAsvEngine } from "./engine.js";
import { CONFIG } from "./config.js?v=2";
import { getPilar } from "./philosophy.js";
import { saveProspecto } from "./storage.js?v=3";
import { buildWaLink, buildAsesorMessage } from "./whatsapp.js";

const root = document.getElementById("app");
const DRAFT_KEY = "asv_draft_v1";

/** @type {any} */
let asv = null; // { preguntas, escala, kits, mensajes, motor, catalogo }

/** Estado de la sesión en curso. */
let state = {
  screen: "cargando",
  identidad: { nombre: "", telefono: "", edad: "", sexo: "F", codigoReferidor: "" },
  consentimientoWhatsapp: false,
  respuestas: {}, // { [n]: true|false }
  flatIndex: 0, // próxima pregunta a mostrar, 0..47
  resultado: null,
  email: "",
  errores: {},
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// ---------- Borrador (continuidad si se recarga la página) ----------

function saveDraft() {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        identidad: state.identidad,
        consentimientoWhatsapp: state.consentimientoWhatsapp,
        respuestas: state.respuestas,
        flatIndex: state.flatIndex,
      })
    );
  } catch {
    /* almacenamiento no disponible: continuar sin borrador */
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* no-op */
  }
}

// ---------- Arranque ----------

async function init() {
  try {
    asv = await loadAsvData();
  } catch (err) {
    root.innerHTML = `<div class="screen"><div class="error-box">No se pudieron cargar los datos del ASV. Revisa que estés sirviendo la carpeta /app en un servidor local.<br><br>${escapeHtml(
      String(err.message || err)
    )}</div></div>`;
    return;
  }
  setState({ screen: "intro" });
}

// ---------- Utilidades de UI ----------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function topbar({ title, showBack = true }) {
  return `
    <div class="topbar">
      ${showBack ? `<button class="back" data-action="back">‹</button>` : ""}
      <span>${escapeHtml(title)}</span>
    </div>`;
}

function badgeClass(estado) {
  return { Excelente: "excelente", Bueno: "bueno", Regular: "regular", Bajo: "bajo" }[estado] || "regular";
}

function barColor(estado) {
  return { Excelente: "var(--verde-excelente)", Bueno: "var(--verde-bueno)", Regular: "var(--naranja-regular)", Bajo: "var(--rojo-bajo)" }[estado] || "var(--linea)";
}

// ---------- Pantallas ----------

function screenIntro() {
  const draft = loadDraft();
  const hasDraft = draft && Object.keys(draft.respuestas || {}).length > 0;
  return `
  <div class="screen">
    <div class="brand-mark"><span class="brand-dot"></span> Éxito Natural</div>
    <div class="hero-block hero-block--bienvenida"><span class="tag">Gratis · 5 minutos</span></div>
    <h1>Análisis de Estilo de Vida</h1>
    <p>48 preguntas de sí o no sobre cómo vives. Al final sabrás qué sistemas de tu cuerpo piden apoyo.</p>
    ${hasDraft ? `
      <div class="draft-banner">
        <strong>Tienes un análisis sin terminar.</strong> Puedes continuar donde quedaste (${Object.keys(draft.respuestas).length}/${CONFIG.TOTAL_PREGUNTAS}) o empezar de nuevo.
      </div>
      <button class="btn btn-primary" data-action="continue-draft">Seguir donde iba</button>
      <button class="btn btn-ghost" data-action="discard-draft">Empezar de nuevo</button>
    ` : `
      <button class="btn btn-primary" data-action="go-identificacion">Empezar mi análisis</button>
    `}
    <p class="legal-note">${CONFIG.AVISO_LEGAL}</p>
  </div>`;
}

function screenIdentificacion() {
  const d = state.identidad;
  const err = state.errores;
  return `
  <div class="screen">
    ${topbar({ title: "Tus datos" })}
    <h1>Antes de empezar</h1>
    <p class="muted">Con esto personalizamos tu resultado y tu consultor puede darte seguimiento.</p>
    <div class="field">
      <label>Nombre y apellido</label>
      <input type="text" id="f-nombre" value="${escapeHtml(d.nombre)}" placeholder="Ej. María Pérez" />
      ${err.nombre ? `<p class="muted" style="color:var(--rojo-bajo)">${err.nombre}</p>` : ""}
    </div>
    <div class="field">
      <label>WhatsApp</label>
      <input type="tel" id="f-telefono" value="${escapeHtml(d.telefono)}" placeholder="Ej. 0991234567" />
      ${err.telefono ? `<p class="muted" style="color:var(--rojo-bajo)">${err.telefono}</p>` : ""}
    </div>
    <div class="row-2">
      <div class="field">
        <label>Edad</label>
        <input type="number" min="1" max="120" id="f-edad" value="${escapeHtml(d.edad)}" placeholder="Ej. 34" />
      </div>
      <div class="field">
        <label>Sexo</label>
        <select id="f-sexo">
          <option value="F" ${d.sexo === "F" ? "selected" : ""}>Femenino</option>
          <option value="M" ${d.sexo === "M" ? "selected" : ""}>Masculino</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>Código o nombre de quien te invitó (opcional)</label>
      <input type="text" id="f-referidor" value="${escapeHtml(d.codigoReferidor)}" placeholder="Opcional" />
    </div>
    <div class="spacer"></div>
    <button class="btn btn-primary" data-action="submit-identificacion">Continuar</button>
  </div>`;
}

function screenConsentimiento() {
  return `
  <div class="screen">
    ${topbar({ title: "Antes de empezar" })}
    <div class="hero-block"><span class="tag">Confianza · Datos seguros</span></div>
    <h1>Cómo se evalúan tus respuestas</h1>
    <div class="card"><p>Tus resultados serán evaluados por nuestro sistema y validados por tu consultor asignado.</p></div>
    <div class="card"><p>Al final recibes un consejo natural saludable para que lo realices los próximos 7 días. Si lo complementas con el producto recomendado, tu proceso será más beneficioso.</p></div>
    <label class="checkbox-row card" style="cursor:pointer">
      <input type="checkbox" id="f-consent" ${state.consentimientoWhatsapp ? "checked" : ""} />
      <span>Puedo recibir mensajes de seguimiento por WhatsApp.</span>
    </label>
    <div class="card dashed"><p class="eyebrow" style="color:var(--tinta-suave)">No pedimos</p><p>Diagnósticos, medicamentos ni datos médicos.</p></div>
    <div class="spacer"></div>
    <button class="btn btn-primary" data-action="submit-consentimiento">Acepto y empiezo</button>
    <p class="legal-note">${CONFIG.AVISO_LEGAL}</p>
  </div>`;
}

function screenQuiz() {
  const idx = state.flatIndex;
  const pregunta = asv.preguntas.preguntas[idx];
  const pct = Math.round((idx / CONFIG.TOTAL_PREGUNTAS) * 100);

  // Interstitial al cerrar un bloque (cada 8 preguntas), salvo al inicio o al final.
  if (idx > 0 && idx < CONFIG.TOTAL_PREGUNTAS && idx % CONFIG.PREGUNTAS_POR_BLOQUE === 0 && state.mostrarInterstitial) {
    const bloque = idx / CONFIG.PREGUNTAS_POR_BLOQUE;
    const totalBloques = CONFIG.TOTAL_PREGUNTAS / CONFIG.PREGUNTAS_POR_BLOQUE;
    return `
    <div class="screen">
      ${topbar({ title: `Bloque ${bloque} de ${totalBloques} completado`, showBack: false })}
      <div class="center-block">
        <h1>${idx === 24 ? "Mitad del camino" : "Vas muy bien"}</h1>
        <div class="progress-row" style="width:100%"><div class="progress-bar"><i style="width:${pct}%"></i></div><span class="progress-count">${idx}/${CONFIG.TOTAL_PREGUNTAS}</span></div>
        <p class="muted">Quedan ${CONFIG.TOTAL_PREGUNTAS - idx} preguntas.</p>
        <button class="btn btn-primary" data-action="dismiss-interstitial">Continuar</button>
      </div>
    </div>`;
  }

  const bloqueActual = Math.floor(idx / CONFIG.PREGUNTAS_POR_BLOQUE) + 1;
  const totalBloques = CONFIG.TOTAL_PREGUNTAS / CONFIG.PREGUNTAS_POR_BLOQUE;

  return `
  <div class="screen">
    ${topbar({ title: `Bloque ${bloqueActual} de ${totalBloques}` })}
    <div class="progress-row">
      <div class="progress-bar"><i style="width:${pct}%"></i></div>
      <span class="progress-count">${idx}/${CONFIG.TOTAL_PREGUNTAS}</span>
    </div>
    <div class="question-card">
      <p class="n">PREGUNTA ${pregunta.n} DE ${CONFIG.TOTAL_PREGUNTAS}</p>
      <p class="texto">${escapeHtml(pregunta.pregunta)}</p>
    </div>
    <div class="pill-choice">
      <button class="si" data-action="answer" data-value="true">Sí</button>
      <button class="no" data-action="answer" data-value="false">No</button>
    </div>
    <p class="muted" style="text-align:center">No puedes dejarla en blanco. Puedes volver atrás si te equivocas.</p>
  </div>`;
}

function screenProcesando() {
  return `
  <div class="screen">
    <div class="center-block">
      <div class="spinner"></div>
      <h1>Calculando tu resultado</h1>
      <p class="muted">Estamos revisando tus 48 respuestas contra los 9 sistemas del cuerpo.</p>
    </div>
  </div>`;
}

function screenResultados() {
  const r = state.resultado;
  const sistemas = asv.preguntas.sistemas;
  const pilar = getPilar(asv.pilares, r.prioritario, r.secundario);

  const filas = sistemas
    .map((s) => {
      const estado = r.classifications[s];
      const escalaRow = asv.escala.find((e) => e.sistema === s);
      const maxRef = escalaRow ? escalaRow.bajo_desde + 3 : 12;
      const pct = Math.min(100, Math.round((r.scores[s] / maxRef) * 100));
      return `
      <div class="system-row">
        <span class="nombre">${escapeHtml(s)}</span>
        <div class="bar"><i style="width:${pct}%;background:${barColor(estado)}"></i></div>
        <span class="badge ${badgeClass(estado)}">${estado}</span>
      </div>`;
    })
    .join("");

  const recomendacionBlock = r.recomendacion
    ? `
    <div class="card">
      <p class="eyebrow">Para tu sistema ${escapeHtml(r.prioritario).toLowerCase()}</p>
      <h2>${escapeHtml(r.recomendacion.programaSugerido)}</h2>
      ${r.kitInfo ? `<p class="muted">${escapeHtml(r.kitInfo["Productos Incluidos"])}</p>` : `<p class="muted">${escapeHtml(r.recomendacion.productosBase)}</p>`}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <span class="muted">PROGRAMA COMPLETO · PRECIO PÚBLICO</span>
        <span class="price-tag">$${r.recomendacion.precioProgramaUSD.toFixed(2)}</span>
      </div>
    </div>`
    : `<div class="card"><p>No se encontró una recomendación calculada para este resultado.</p></div>`;

  const alternativas = r.alternativas.length
    ? `
    <div class="card">
      <p class="eyebrow">O si prefieres algo más simple</p>
      ${r.alternativas
        .map(
          (p) => `
        <div class="alt-product">
          <div class="info">
            <div class="nombre">${escapeHtml(p.producto)} <span class="badge ${p.confianza.startsWith("Confirmado") ? "confirmado" : "sugerido"}">${p.confianza.startsWith("Confirmado") ? "Confirmado" : "Sugerido · verificar con Alex"}</span></div>
            <div class="muted">${escapeHtml(p.beneficio)}</div>
          </div>
          <div class="precio">$${p.precioPublico.toFixed(2)}</div>
        </div>`
        )
        .join("")}
    </div>`
    : "";

  const waMessage = r.recomendacion
    ? buildAsesorMessage({
        nombre: state.identidad.nombre,
        sistemaPrioritario: r.prioritario,
        programa: r.recomendacion.programaSugerido,
        precio: r.recomendacion.precioProgramaUSD.toFixed(2),
      })
    : `Hola, completé mi Análisis de Estilo de Vida (ASV) y quisiera conocer más sobre mi resultado.`;
  const waLink = buildWaLink(CONFIG.ADVISOR_WHATSAPP, waMessage);

  return `
  <div class="screen">
    ${topbar({ title: "Tu resultado", showBack: false })}
    <h1>Tus 9 sistemas</h1>

    <div class="priority-card">
      <p class="eyebrow">Prioritario</p>
      <h2>${escapeHtml(r.prioritario || "—")}${r.prioritario ? ` · ${r.classifications[r.prioritario]}` : ""}</h2>
      ${r.secundario ? `<p class="secundario">Secundario · ${escapeHtml(r.secundario)} · ${r.classifications[r.secundario]}</p>` : ""}
      ${r.degraded ? `<p class="secundario">Ningún sistema salió "Bajo" — este es el que más se acerca.</p>` : ""}
    </div>

    <div class="card">${filas}</div>

    ${pilar ? `
    <div class="ai-box pilar-box">
      ${pilar.imagen
        ? `<img class="pilar-img" src="${escapeHtml(pilar.imagen)}" alt="${escapeHtml(pilar.pilar)}" />`
        : `<div class="pilar-img pilar-img--placeholder">${escapeHtml(pilar.pilar.charAt(0))}</div>`
      }
      <p class="eyebrow">${escapeHtml(pilar.pilar)}</p>
      <p class="muted" style="font-style:italic;margin-bottom:8px">${escapeHtml(pilar.principio)}</p>
      <p>${escapeHtml(pilar.descripcion)}</p>
      <p class="muted"><strong>Hábito recomendado:</strong> ${escapeHtml(pilar.habito)}</p>
      <p class="muted" style="margin-top:8px;margin-bottom:0">${escapeHtml(pilar.complemento_nsp)}</p>
    </div>` : ""}

    ${recomendacionBlock}
    ${alternativas}

    <button class="btn btn-primary" data-action="go-captura">Quiero mi kit</button>
    <a class="btn btn-secondary" href="${waLink}" target="_blank" rel="noopener" style="text-decoration:none">¿Quieres el precio preferencial? Habla con un asesor</a>

    <p class="legal-note">${CONFIG.AVISO_LEGAL}</p>
  </div>`;
}

function screenCaptura() {
  const d = state.identidad;
  const err = state.errores;
  return `
  <div class="screen">
    ${topbar({ title: "Últimos datos" })}
    <h1>Guarda tu resultado</h1>
    <p class="muted">Confirma tus datos para que tu consultor pueda darte seguimiento con tu recomendación.</p>
    <div class="field">
      <label>Nombre y apellido</label>
      <input type="text" id="f-nombre2" value="${escapeHtml(d.nombre)}" />
    </div>
    <div class="field">
      <label>WhatsApp</label>
      <input type="tel" id="f-telefono2" value="${escapeHtml(d.telefono)}" />
    </div>
    <div class="field">
      <label>Email (opcional)</label>
      <input type="email" id="f-email" value="${escapeHtml(state.email)}" placeholder="tucorreo@ejemplo.com" />
    </div>
    <label class="checkbox-row card" style="cursor:pointer">
      <input type="checkbox" id="f-consent2" ${state.consentimientoWhatsapp ? "checked" : ""} />
      <span>Puedo recibir mensajes de seguimiento por WhatsApp.</span>
    </label>
    ${err.captura ? `<div class="error-box">${err.captura}</div>` : ""}
    <div class="spacer"></div>
    <button class="btn btn-primary" data-action="guardar-prospecto">Guardar mis resultados</button>
    <p class="legal-note">${CONFIG.AVISO_LEGAL}</p>
  </div>`;
}

function screenConfirmacion() {
  const r = state.resultado;
  const waMessage = r?.recomendacion
    ? buildAsesorMessage({
        nombre: state.identidad.nombre,
        sistemaPrioritario: r.prioritario,
        programa: r.recomendacion.programaSugerido,
        precio: r.recomendacion.precioProgramaUSD.toFixed(2),
      })
    : "Hola, completé mi Análisis de Estilo de Vida (ASV).";
  const waLink = buildWaLink(CONFIG.ADVISOR_WHATSAPP, waMessage);

  return `
  <div class="screen">
    <div class="center-block">
      <h1>Tu asesor te acompaña</h1>
      <p>Recibimos tu solicitud. Un consultor de Éxito Natural te escribirá por WhatsApp hoy mismo con los siguientes pasos.</p>
      ${r?.recomendacion ? `
      <div class="card" style="width:100%;text-align:left">
        <p class="eyebrow">Lo que pediste</p>
        <p style="margin:0">${escapeHtml(r.recomendacion.programaSugerido)}</p>
        <p class="muted" style="margin:0">$${r.recomendacion.precioProgramaUSD.toFixed(2)} · referencial</p>
      </div>` : ""}
      <a class="btn btn-whatsapp" style="width:100%;text-decoration:none" href="${waLink}" target="_blank" rel="noopener">Escribirle a mi asesor</a>
      <button class="btn btn-ghost" style="width:100%" data-action="reiniciar">Volver al inicio</button>
      <p class="legal-note">${CONFIG.AVISO_LEGAL}</p>
    </div>
  </div>`;
}

// ---------- Render principal ----------

function render() {
  const screens = {
    cargando: () => `<div class="loading-splash">Cargando…</div>`,
    intro: screenIntro,
    identificacion: screenIdentificacion,
    consentimiento: screenConsentimiento,
    quiz: screenQuiz,
    procesando: screenProcesando,
    resultados: screenResultados,
    captura: screenCaptura,
    confirmacion: screenConfirmacion,
  };
  root.innerHTML = screens[state.screen] ? screens[state.screen]() : `<div class="screen">Pantalla desconocida.</div>`;
}

// ---------- Lógica de negocio / handlers ----------

function goIdentificacion() {
  setState({ screen: "identificacion" });
}

function submitIdentificacion() {
  const nombre = document.getElementById("f-nombre").value.trim();
  const telefono = document.getElementById("f-telefono").value.trim();
  const edad = document.getElementById("f-edad").value.trim();
  const sexo = document.getElementById("f-sexo").value;
  const codigoReferidor = document.getElementById("f-referidor").value.trim();

  const errores = {};
  if (!nombre) errores.nombre = "Ingresa tu nombre.";
  if (!telefono || telefono.replace(/\D/g, "").length < 7) errores.telefono = "Ingresa un WhatsApp válido.";

  if (Object.keys(errores).length) {
    setState({ errores, identidad: { nombre, telefono, edad, sexo, codigoReferidor } });
    return;
  }

  setState({
    identidad: { nombre, telefono, edad, sexo, codigoReferidor },
    errores: {},
    screen: "consentimiento",
  });
}

function submitConsentimiento() {
  const checked = document.getElementById("f-consent").checked;
  setState({ consentimientoWhatsapp: checked, screen: "quiz", flatIndex: 0, mostrarInterstitial: false });
}

function answerQuestion(value) {
  const pregunta = asv.preguntas.preguntas[state.flatIndex];
  const respuestas = { ...state.respuestas, [pregunta.n]: value === "true" };
  const nextIndex = state.flatIndex + 1;

  saveDraft();

  if (nextIndex >= CONFIG.TOTAL_PREGUNTAS) {
    setState({ respuestas, flatIndex: nextIndex, screen: "procesando" });
    setTimeout(computeAndShowResults, 900);
    return;
  }

  const showInterstitial = nextIndex % CONFIG.PREGUNTAS_POR_BLOQUE === 0;
  setState({ respuestas, flatIndex: nextIndex, mostrarInterstitial: showInterstitial });
}

function dismissInterstitial() {
  setState({ mostrarInterstitial: false });
}

function goBack() {
  if (state.screen === "identificacion") {
    setState({ screen: "intro" });
  } else if (state.screen === "consentimiento") {
    setState({ screen: "identificacion" });
  } else if (state.screen === "quiz") {
    if (state.flatIndex === 0) {
      setState({ screen: "consentimiento" });
    } else {
      setState({ flatIndex: state.flatIndex - 1, mostrarInterstitial: false });
    }
  } else if (state.screen === "captura") {
    setState({ screen: "resultados" });
  }
}

function computeAndShowResults() {
  const resultado = runAsvEngine(asv, state.respuestas, state.identidad.sexo);
  setState({ resultado, screen: "resultados" });
}

function goCaptura() {
  setState({ screen: "captura", errores: {} });
}

function guardarProspecto() {
  const nombre = document.getElementById("f-nombre2").value.trim();
  const telefono = document.getElementById("f-telefono2").value.trim();
  const email = document.getElementById("f-email").value.trim();
  const consentimientoWhatsapp = document.getElementById("f-consent2").checked;

  if (!nombre || !telefono) {
    setState({ errores: { captura: "Nombre y WhatsApp son obligatorios para guardar tu resultado." } });
    return;
  }

  const identidad = { ...state.identidad, nombre, telefono };
  saveProspecto({
    nombre,
    telefono,
    email,
    edad: identidad.edad,
    sexo: identidad.sexo,
    codigoReferidor: identidad.codigoReferidor,
    respuestas: state.respuestas,
    resultado: state.resultado,
    consentimientoWhatsapp,
  });
  clearDraft();
  setState({ identidad, email, consentimientoWhatsapp, screen: "confirmacion", errores: {} });
}

function continueDraft() {
  const draft = loadDraft();
  if (!draft) return goIdentificacion();
  setState({
    identidad: draft.identidad,
    consentimientoWhatsapp: draft.consentimientoWhatsapp,
    respuestas: draft.respuestas,
    flatIndex: draft.flatIndex,
    screen: "quiz",
    mostrarInterstitial: false,
  });
}

function discardDraft() {
  clearDraft();
  setState({
    identidad: { nombre: "", telefono: "", edad: "", sexo: "F", codigoReferidor: "" },
    respuestas: {},
    flatIndex: 0,
    screen: "identificacion",
  });
}

function reiniciar() {
  clearDraft();
  state = {
    screen: "intro",
    identidad: { nombre: "", telefono: "", edad: "", sexo: "F", codigoReferidor: "" },
    consentimientoWhatsapp: false,
    respuestas: {},
    flatIndex: 0,
    resultado: null,
    email: "",
    errores: {},
  };
  render();
}

// ---------- Delegación de eventos ----------

root.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  switch (action) {
    case "go-identificacion": return goIdentificacion();
    case "submit-identificacion": return submitIdentificacion();
    case "submit-consentimiento": return submitConsentimiento();
    case "answer": return answerQuestion(btn.getAttribute("data-value"));
    case "dismiss-interstitial": return dismissInterstitial();
    case "back": return goBack();
    case "go-captura": return goCaptura();
    case "guardar-prospecto": return guardarProspecto();
    case "continue-draft": return continueDraft();
    case "discard-draft": return discardDraft();
    case "reiniciar": return reiniciar();
    default: return;
  }
});

init();
