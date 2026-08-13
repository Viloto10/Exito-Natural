import { loadAsvData } from "./data.js?v=4";
import { CONFIG } from "./config.js?v=2";
import { listProspectos, getProspecto, updateSeguimiento } from "./storage.js?v=3";
import { buildWaLink, findMensaje, fillTemplate } from "./whatsapp.js";

const root = document.getElementById("app");

/** @type {any} */
let asv = null;

let state = {
  screen: "dashboard",
  fichaId: null,
  filtros: { sistema: "", estado: "", q: "" },
  catalogo: { tab: "kits", q: "", sistema: "" },
  campanaActiva: "sin_contactar",
  mensajeTipo: "Resultado del ASV",
  mensajeTexto: "",
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

async function init() {
  try {
    asv = await loadAsvData();
  } catch (err) {
    root.innerHTML = `<div style="padding:30px">No se pudieron cargar los datos del ASV.<br>${escapeHtml(String(err.message || err))}</div>`;
    return;
  }
  render();
}

// ---------- Utilidades ----------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtMoney(n) {
  return n == null ? "—" : `$${Number(n).toFixed(2)}`;
}

function fmtFecha(iso) {
  if (!iso) return "—";
  // Fechas "YYYY-MM-DD" (sin hora, como fecha_proximo_seguimiento o el
  // historial) se interpretan como medianoche UTC si se le pasan tal cual a
  // Date — en timezones negativos (Ecuador, UTC-5) eso muestra el día
  // anterior. Se fuerzan a medianoche LOCAL en su lugar. Los timestamps
  // completos (creado_en) sí son instantes reales y no necesitan este ajuste.
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const d = soloFecha ? new Date(iso + "T00:00:00") : new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

/** Fecha de HOY en calendario local (YYYY-MM-DD), no la fecha UTC. */
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ESTADOS = [
  { value: "resultado_enviado", label: "Resultado enviado" },
  { value: "contactado", label: "Contactado" },
  { value: "en_decision", label: "En decisión" },
  { value: "cerrado", label: "Cerrado" },
  { value: "perdido", label: "Perdido" },
];

function estadoLabel(v) {
  return ESTADOS.find((e) => e.value === v)?.label || v;
}

function badgeClass(estado) {
  return { Excelente: "excelente", Bueno: "bueno", Regular: "regular", Bajo: "bajo" }[estado] || "regular";
}

function barColor(estado) {
  return { Excelente: "var(--verde-excelente)", Bueno: "var(--verde-bueno)", Regular: "var(--naranja-regular)", Bajo: "var(--rojo-bajo)" }[estado] || "var(--linea)";
}

// ---------- Layout ----------

function layout(contentHtml) {
  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "prospectos", label: "Prospectos", icon: "☰" },
    { id: "catalogo", label: "Catálogo", icon: "▤" },
    { id: "campanas", label: "Campañas", icon: "◈" },
  ];
  return `
  <div class="crm-shell">
    <aside class="crm-sidebar">
      <div class="brand-mark"><span class="brand-dot"></span> <span class="label-text">Éxito Natural</span></div>
      <nav class="crm-nav">
        ${nav.map((n) => `
          <button data-action="nav" data-screen="${n.id}" class="${state.screen === n.id || (state.screen === "ficha" && n.id === "prospectos") ? "on" : ""}">
            <span>${n.icon}</span><span class="label-text">${n.label}</span>
          </button>
        `).join("")}
      </nav>
      <div class="crm-sidebar-footer label-text">CRM interno · uso de Alex<br>Datos locales de este navegador</div>
    </aside>
    <main class="crm-main">${contentHtml}</main>
  </div>`;
}

// ---------- Dashboard ----------

function screenDashboard() {
  const prospectos = listProspectos();
  const totalAnalisis = prospectos.length;
  const contactados = prospectos.filter((p) => p.seguimiento_crm.estado_comercial !== "resultado_enviado").length;
  const cerradas = prospectos.filter((p) => p.seguimiento_crm.estado_comercial === "cerrado").length;
  const valorPotencial = prospectos
    .filter((p) => !["cerrado", "perdido"].includes(p.seguimiento_crm.estado_comercial))
    .reduce((sum, p) => sum + (p.resultados_asv.valor_programa_usd || 0), 0);

  const sistemas = asv.preguntas.sistemas;
  const conteoPorSistema = Object.fromEntries(sistemas.map((s) => [s, 0]));
  prospectos.forEach((p) => {
    const s = p.resultados_asv.sistema_prioritario;
    if (s && conteoPorSistema[s] !== undefined) conteoPorSistema[s]++;
  });
  const maxConteo = Math.max(1, ...Object.values(conteoPorSistema));

  const hoy = todayISO();
  const seguimientosHoy = prospectos.filter((p) => p.seguimiento_crm.fecha_proximo_seguimiento === hoy);

  return layout(`
    <div class="crm-topbar">
      <div><h1>Hoy</h1><p class="muted">Panel de Alex · Éxito Natural</p></div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Análisis realizados</div><div class="kpi-value">${totalAnalisis}</div></div>
      <div class="kpi-card"><div class="kpi-label">Contactados</div><div class="kpi-value">${contactados}</div></div>
      <div class="kpi-card"><div class="kpi-label">Ventas cerradas</div><div class="kpi-value">${cerradas}</div></div>
      <div class="kpi-card"><div class="kpi-label">Valor potencial</div><div class="kpi-value">${fmtMoney(valorPotencial)}</div><div class="kpi-sub">prospectos abiertos</div></div>
    </div>

    <div class="crm-two-col">
      <div class="crm-panel">
        <h2>Casos prioritarios por sistema</h2>
        ${sistemas.map((s) => `
          <div class="system-bar-row">
            <span class="nombre">${escapeHtml(s)}</span>
            <div class="bar"><i style="width:${(conteoPorSistema[s] / maxConteo) * 100}%;background:var(--verde-vivo)"></i></div>
            <span class="count">${conteoPorSistema[s]}</span>
          </div>
        `).join("")}
      </div>

      <div class="crm-panel">
        <h2>Seguimientos de hoy</h2>
        ${seguimientosHoy.length === 0
          ? `<p class="muted">No tienes seguimientos programados para hoy.</p>`
          : seguimientosHoy.map((p) => `
            <div style="padding:8px 0;border-bottom:1px solid var(--linea)">
              <button class="crm-link-btn" data-action="abrir-ficha" data-id="${p.id}">${escapeHtml(p.prospecto.nombre)}</button>
              <div class="muted" style="font-size:12px">${escapeHtml(p.prospecto.telefono)} · ${escapeHtml(p.resultados_asv.sistema_prioritario || "—")}</div>
            </div>
          `).join("")}
      </div>
    </div>
  `);
}

// ---------- Lista de prospectos ----------

function screenProspectos() {
  const all = listProspectos();
  const sistemas = asv.preguntas.sistemas;
  const { sistema, estado, q } = state.filtros;

  const filtrados = all.filter((p) => {
    if (sistema && p.resultados_asv.sistema_prioritario !== sistema) return false;
    if (estado && p.seguimiento_crm.estado_comercial !== estado) return false;
    if (q) {
      const needle = q.toLowerCase();
      const hay = `${p.prospecto.nombre} ${p.prospecto.telefono}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return layout(`
    <div class="crm-topbar">
      <div><h1>Prospectos</h1><p class="muted">${all.length} en total · ${filtrados.length} con estos filtros</p></div>
    </div>

    <div class="crm-panel">
      <div class="filter-row">
        <input type="text" id="f-q" placeholder="Buscar por nombre o teléfono…" value="${escapeHtml(q)}" />
        <select id="f-sistema">
          <option value="">Todos los sistemas</option>
          ${sistemas.map((s) => `<option value="${escapeHtml(s)}" ${s === sistema ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
        </select>
        <select id="f-estado">
          <option value="">Todos los estados</option>
          ${ESTADOS.map((e) => `<option value="${e.value}" ${e.value === estado ? "selected" : ""}>${e.label}</option>`).join("")}
        </select>
      </div>

      <table class="crm-table">
        <thead><tr>
          <th>Nombre</th><th>Teléfono</th><th>Sistema prioritario</th><th>Estado</th><th>Creado</th><th>Valor</th>
        </tr></thead>
        <tbody>
          ${filtrados.length === 0
            ? `<tr class="empty-row"><td colspan="6">Ningún prospecto coincide con estos filtros.</td></tr>`
            : filtrados
                .slice()
                .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
                .map((p) => `
              <tr data-action="abrir-ficha" data-id="${p.id}">
                <td class="nombre-cell">${escapeHtml(p.prospecto.nombre)}</td>
                <td>${escapeHtml(p.prospecto.telefono)}</td>
                <td>${escapeHtml(p.resultados_asv.sistema_prioritario || "—")}</td>
                <td><span class="estado-badge ${p.seguimiento_crm.estado_comercial}">${estadoLabel(p.seguimiento_crm.estado_comercial)}</span></td>
                <td>${fmtFecha(p.creado_en)}</td>
                <td>${fmtMoney(p.resultados_asv.valor_programa_usd)}</td>
              </tr>
            `).join("")}
        </tbody>
      </table>
    </div>
  `);
}

// ---------- Ficha de prospecto ----------

function screenFicha() {
  const p = getProspecto(state.fichaId);
  if (!p) return layout(`<p class="muted">Prospecto no encontrado. <button class="crm-link-btn" data-action="nav" data-screen="prospectos">Volver a la lista</button></p>`);

  const sistemas = asv.preguntas.sistemas;
  const r = p.resultados_asv;
  const kitInfo = r.recomendacion ? asv.kits.find((k) => k.Kit === r.recomendacion.recomendacionPrincipal) : null;

  const mensajesPendientes = ["Renovación Urgente", "Renovación + Interés"];
  const mensajeActual = findMensaje(asv.mensajes, state.mensajeTipo);
  const valoresPlantilla = {
    Nombre: p.prospecto.nombre,
    "Sistema Prioritario": r.sistema_prioritario,
    "Sistema Secundario": r.sistema_secundario,
    "Kit Recomendado": r.recomendacion?.programaSugerido,
    Valor: r.recomendacion?.precioProgramaUSD?.toFixed(2),
  };
  const textoBase = mensajeActual ? fillTemplate(mensajeActual["Texto Base"], valoresPlantilla) : "";
  const mensajeTexto = state.mensajeTexto || textoBase;
  const waLink = buildWaLink(p.prospecto.telefono, mensajeTexto);

  const historial = (p.seguimiento_crm.historial || []).slice().reverse();

  return layout(`
    <div class="crm-topbar">
      <div>
        <button class="crm-link-btn" data-action="nav" data-screen="prospectos" style="margin-bottom:6px">‹ Prospectos</button>
        <h1>${escapeHtml(p.prospecto.nombre)}</h1>
        <p class="muted">${escapeHtml(p.prospecto.telefono)} · ${p.prospecto.edad ? escapeHtml(p.prospecto.edad) + " años · " : ""}${p.prospecto.sexo === "M" ? "Masculino" : "Femenino"} · ASV ${fmtFecha(p.creado_en)}${p.prospecto.codigo_referidor ? " · ref. " + escapeHtml(p.prospecto.codigo_referidor) : ""}</p>
      </div>
      <span class="estado-badge ${p.seguimiento_crm.estado_comercial}" style="font-size:13px;padding:6px 14px">${estadoLabel(p.seguimiento_crm.estado_comercial)}</span>
    </div>

    <div class="crm-two-col">
      <div>
        <div class="crm-panel">
          <h2>Resultado del ASV</h2>
          <div class="priority-card" style="margin-bottom:14px">
            <p class="eyebrow">Prioritario</p>
            <h2 style="color:var(--blanco)">${escapeHtml(r.sistema_prioritario || "—")}${r.sistema_prioritario ? " · " + r.clasificaciones[r.sistema_prioritario] : ""}</h2>
            ${r.sistema_secundario ? `<p class="secundario">Secundario · ${escapeHtml(r.sistema_secundario)} · ${r.clasificaciones[r.sistema_secundario]}</p>` : ""}
          </div>
          ${sistemas.map((s) => `
            <div class="system-bar-row">
              <span class="nombre">${escapeHtml(s)}</span>
              <div class="bar"><i style="width:${Math.min(100, (r.puntajes[s] / 12) * 100)}%;background:${barColor(r.clasificaciones[s])}"></i></div>
              <span class="badge ${badgeClass(r.clasificaciones[s])}">${r.clasificaciones[s]}</span>
            </div>
          `).join("")}
        </div>

        <div class="crm-panel">
          <h2>Recomendación calculada</h2>
          ${r.recomendacion ? `
            <p style="margin:0 0 4px"><strong>${escapeHtml(r.recomendacion.programaSugerido)}</strong></p>
            <p class="muted" style="margin:0 0 8px">${escapeHtml(kitInfo ? kitInfo["Productos Incluidos"] : r.recomendacion.productosBase)}</p>
            <p style="margin:0"><span class="price-tag">${fmtMoney(r.recomendacion.precioProgramaUSD)}</span> <span class="muted">precio público${kitInfo ? " · código " + escapeHtml(kitInfo["Código"]) : ""}</span></p>
          ` : `<p class="muted">Sin recomendación calculada.</p>`}
        </div>
      </div>

      <div>
        <div class="crm-panel">
          <h2>Seguimiento comercial</h2>
          <div class="field-inline">
            <label>Estado</label>
            <select id="f-estado-crm">
              ${ESTADOS.map((e) => `<option value="${e.value}" ${e.value === p.seguimiento_crm.estado_comercial ? "selected" : ""}>${e.label}</option>`).join("")}
            </select>
          </div>
          <div class="field-inline">
            <label>Próximo seguimiento</label>
            <input type="date" id="f-fecha-seg" value="${p.seguimiento_crm.fecha_proximo_seguimiento || ""}" />
          </div>
          <div class="field-inline">
            <label>Nueva nota</label>
            <textarea id="f-nota" placeholder="Ej. Prefiere llamadas después de las 7pm."></textarea>
          </div>
          <button class="btn btn-primary" style="margin:0" data-action="guardar-seguimiento" data-id="${p.id}">Guardar</button>

          ${historial.length ? `
            <div style="margin-top:16px">
              <p class="eyebrow" style="margin-bottom:8px">Historial</p>
              ${historial.map((h) => `<div class="historial-item"><span class="fecha">${fmtFecha(h.fecha)}</span>${escapeHtml(h.nota)}</div>`).join("")}
            </div>
          ` : ""}
        </div>

        <div class="crm-panel">
          <h2>Mensaje de WhatsApp</h2>
          <div class="template-pill-row">
            ${asv.mensajes.map((m) => `
              <button class="template-pill ${m["Tipo Mensaje"] === state.mensajeTipo ? "on" : ""} ${mensajesPendientes.includes(m["Tipo Mensaje"]) ? "pendiente" : ""}"
                data-action="elegir-plantilla" data-tipo="${escapeHtml(m["Tipo Mensaje"])}">${escapeHtml(m["Tipo Mensaje"])}</button>
            `).join("")}
          </div>
          <div class="field-inline">
            <textarea id="f-mensaje" rows="5">${escapeHtml(mensajeTexto)}</textarea>
          </div>
          <a class="btn btn-whatsapp" style="text-decoration:none;display:inline-block;width:auto;padding:11px 20px" id="lnk-whatsapp" href="${waLink}" target="_blank" rel="noopener">Abrir en WhatsApp</a>
          ${mensajesPendientes.includes(state.mensajeTipo) ? `<p class="muted" style="margin-top:8px">Esta plantilla está pendiente de aprobación — revísala antes de enviarla.</p>` : ""}
        </div>
      </div>
    </div>
  `);
}

// ---------- Catálogo / Kits ----------

function screenCatalogo() {
  const sistemas = asv.preguntas.sistemas;
  const { tab, q, sistema } = state.catalogo;

  const kitsHtml = () => `
    <div class="catalogo-grid">
      ${asv.kits.map((k) => `
        <div class="catalogo-card">
          <div class="nombre">${escapeHtml(k.Kit)}</div>
          <div class="meta">${escapeHtml(k.Sistema)} · ${escapeHtml(k["Código"] || "sin código")}</div>
          <p class="muted" style="font-size:12.5px;margin:0 0 8px">${escapeHtml(k["Productos Incluidos"] || "")}</p>
          <div class="precio-row"><span class="muted">Precio</span><b>${fmtMoney(k["Precio USD"])}</b></div>
          ${k.Observaciones ? `<p class="muted" style="font-size:11px;margin-top:6px">${escapeHtml(k.Observaciones)}</p>` : ""}
        </div>
      `).join("")}
    </div>`;

  const productosHtml = () => {
    const needle = q.toLowerCase();
    const productos = asv.catalogo.filter((p) => {
      if (sistema && !(p["Sistema Principal"] || "").includes(sistema)) return false;
      if (needle && !`${p.Producto} ${p["Beneficio breve"]}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    return `
      <div class="filter-row">
        <input type="text" id="f-cat-q" placeholder="Buscar producto o beneficio…" value="${escapeHtml(q)}" />
        <select id="f-cat-sistema">
          <option value="">Todos los sistemas</option>
          ${sistemas.map((s) => `<option value="${escapeHtml(s)}" ${s === sistema ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
        </select>
      </div>
      <div class="catalogo-grid">
        ${productos.length === 0 ? `<p class="muted">Sin resultados.</p>` : productos.map((p) => `
          <div class="catalogo-card">
            <div class="nombre">${escapeHtml(p.Producto)} <span class="badge ${p["Confianza clasificación"].startsWith("Confirmado") ? "confirmado" : "sugerido"}" style="margin-left:4px">${p["Confianza clasificación"].startsWith("Confirmado") ? "Confirmado" : "Sugerido"}</span></div>
            <div class="meta">${escapeHtml(p["Sistema Principal"])} · ${escapeHtml(p["Código EBS"])}</div>
            <p class="muted" style="font-size:12.5px;margin:0 0 8px">${escapeHtml(p["Beneficio breve"])}</p>
            <div class="precio-row"><span class="muted">Consultor</span><span>${fmtMoney(p["Precio Consultor"])}</span></div>
            <div class="precio-row"><span class="muted">Premium</span><span>${fmtMoney(p["Precio Premium"])}</span></div>
            <div class="precio-row"><span class="muted">PVP</span><b>${fmtMoney(p["Precio Público (PVP)"])}</b></div>
          </div>
        `).join("")}
      </div>`;
  };

  return layout(`
    <div class="crm-topbar"><div><h1>Catálogo</h1><p class="muted">${asv.kits.length} kits · ${asv.catalogo.length} productos</p></div></div>
    <div class="crm-panel">
      <div class="section-tabs">
        <button class="${tab === "kits" ? "on" : ""}" data-action="cat-tab" data-tab="kits">Kits</button>
        <button class="${tab === "productos" ? "on" : ""}" data-action="cat-tab" data-tab="productos">Productos</button>
      </div>
      ${tab === "kits" ? kitsHtml() : productosHtml()}
    </div>
  `);
}

// ---------- Campañas ----------

function segmentosCampana(prospectos) {
  const hoy = todayISO();
  return {
    sin_contactar: {
      titulo: "Sin contactar",
      desc: "Resultado enviado, sin avance de estado",
      items: prospectos.filter((p) => p.seguimiento_crm.estado_comercial === "resultado_enviado"),
    },
    seguimiento_pendiente: {
      titulo: "Seguimiento pendiente",
      desc: "Fecha de seguimiento hoy o vencida",
      items: prospectos.filter((p) => p.seguimiento_crm.fecha_proximo_seguimiento && p.seguimiento_crm.fecha_proximo_seguimiento <= hoy),
    },
    en_decision: {
      titulo: "En decisión",
      desc: "Mostraron interés, sin cerrar",
      items: prospectos.filter((p) => p.seguimiento_crm.estado_comercial === "en_decision"),
    },
  };
}

function screenCampanas() {
  const prospectos = listProspectos();
  const segmentos = segmentosCampana(prospectos);
  const activa = segmentos[state.campanaActiva] || segmentos.sin_contactar;

  return layout(`
    <div class="crm-topbar"><div><h1>Campañas</h1><p class="muted">Listas segmentadas para seguimiento por WhatsApp</p></div></div>

    <div class="crm-panel" style="background:transparent;border-style:dashed;box-shadow:none">
      <p class="muted" style="margin:0">Estos segmentos se calculan a partir de los prospectos del ASV que sí tenemos en esta app. La campaña del Excel original ("Fase 1": vencimiento de membresía, TOV) usa datos de afiliados NSP que no vinieron en los JSON de esta especificación — cuando esa fuente esté disponible, se agrega como segmento adicional.</p>
    </div>

    <div class="campana-grid">
      ${Object.entries(segmentos).map(([key, seg]) => `
        <div class="campana-card ${key === state.campanaActiva ? "on" : ""}" data-action="campana-tab" data-key="${key}">
          <div class="count">${seg.items.length}</div>
          <div class="titulo">${seg.titulo}</div>
          <div class="desc">${seg.desc}</div>
        </div>
      `).join("")}
    </div>

    <div class="crm-panel">
      <h2>${activa.titulo} · ${activa.items.length}</h2>
      ${activa.items.length === 0 ? `<p class="muted">Nadie en este segmento por ahora.</p>` : `
        <table class="crm-table">
          <thead><tr><th>Nombre</th><th>Teléfono</th><th>Sistema</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${activa.items.map((p) => {
              const link = buildWaLink(p.prospecto.telefono, fillTemplate(findMensaje(asv.mensajes, "Invitación al ASV")?.["Texto Base"] || "Hola [Nombre]", { Nombre: p.prospecto.nombre }));
              return `
              <tr>
                <td class="nombre-cell">${escapeHtml(p.prospecto.nombre)}</td>
                <td>${escapeHtml(p.prospecto.telefono)}</td>
                <td>${escapeHtml(p.resultados_asv.sistema_prioritario || "—")}</td>
                <td><span class="estado-badge ${p.seguimiento_crm.estado_comercial}">${estadoLabel(p.seguimiento_crm.estado_comercial)}</span></td>
                <td><a class="crm-link-btn" href="${link}" target="_blank" rel="noopener">WhatsApp ›</a></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
        <p class="muted" style="margin-top:10px">WhatsApp no permite enviar a varios contactos desde un solo link — abre una conversación a la vez.</p>
      `}
    </div>
  `);
}

// ---------- Render ----------

function render() {
  const screens = {
    dashboard: screenDashboard,
    prospectos: screenProspectos,
    ficha: screenFicha,
    catalogo: screenCatalogo,
    campanas: screenCampanas,
  };
  root.innerHTML = (screens[state.screen] || screenDashboard)();
}

// ---------- Handlers ----------

root.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.getAttribute("data-action");

  if (action === "nav") {
    setState({ screen: el.getAttribute("data-screen") });
  } else if (action === "abrir-ficha") {
    setState({ screen: "ficha", fichaId: el.getAttribute("data-id"), mensajeTexto: "", mensajeTipo: "Resultado del ASV" });
  } else if (action === "guardar-seguimiento") {
    const id = el.getAttribute("data-id");
    const estado_comercial = document.getElementById("f-estado-crm").value;
    const fecha_proximo_seguimiento = document.getElementById("f-fecha-seg").value || null;
    const notaNueva = document.getElementById("f-nota").value.trim();
    updateSeguimiento(id, { estado_comercial, fecha_proximo_seguimiento, notaNueva: notaNueva || undefined });
    render();
  } else if (action === "elegir-plantilla") {
    setState({ mensajeTipo: el.getAttribute("data-tipo"), mensajeTexto: "" });
  } else if (action === "cat-tab") {
    setState({ catalogo: { ...state.catalogo, tab: el.getAttribute("data-tab") } });
  } else if (action === "campana-tab") {
    setState({ campanaActiva: el.getAttribute("data-key") });
  }
});

// Los <select> no pierden nada al perder foco, pero un <input type="text">
// sí: setState() reconstruye todo el innerHTML, así que el nodo enfocado se
// reemplaza por uno nuevo. Para los campos de texto con filtrado en vivo,
// guardamos el cursor y reenfocamos el nodo nuevo después de renderizar.
function setStatePreservingFocus(patch) {
  const active = document.activeElement;
  const id = active && active.id;
  const selStart = active && "selectionStart" in active ? active.selectionStart : null;
  const selEnd = active && "selectionEnd" in active ? active.selectionEnd : null;
  setState(patch);
  if (id) {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      if (selStart !== null && "setSelectionRange" in el) el.setSelectionRange(selStart, selEnd);
    }
  }
}

root.addEventListener("input", (e) => {
  const id = e.target.id;
  if (id === "f-q") setStatePreservingFocus({ filtros: { ...state.filtros, q: e.target.value } });
  else if (id === "f-sistema") setState({ filtros: { ...state.filtros, sistema: e.target.value } });
  else if (id === "f-estado") setState({ filtros: { ...state.filtros, estado: e.target.value } });
  else if (id === "f-cat-q") setStatePreservingFocus({ catalogo: { ...state.catalogo, q: e.target.value } });
  else if (id === "f-cat-sistema") setState({ catalogo: { ...state.catalogo, sistema: e.target.value } });
  else if (id === "f-mensaje") state.mensajeTexto = e.target.value; // no re-render: evita perder el foco
});

init();
