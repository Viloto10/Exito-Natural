// Capa de persistencia del MVP.
//
// No hay backend/Supabase conectado todavía (ver README → "Siguiente paso:
// Supabase"). Mientras tanto, cada prospecto completo (datos + respuestas +
// resultado) se guarda en localStorage con el mismo shape que tendrían las
// tablas sugeridas en ASV_build_spec.md sección 5, para que migrar a
// Supabase más adelante sea sustituir esta función por un insert real y no
// un rediseño del modelo de datos.
//
// Migración futura (cuando haya credenciales de Supabase):
//   async function saveProspecto(record) {
//     const { data, error } = await supabase.from('prospectos').insert(...)
//     ...
//   }

import { CONFIG } from "./config.js";

function readAll() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(records) {
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(records));
}

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Guarda un prospecto completo. Shape espejado de:
 *   prospectos + respuestas_asv + resultados_asv (ASV_build_spec.md §5)
 */
export function saveProspecto({
  nombre,
  telefono,
  email,
  edad,
  sexo,
  codigoReferidor,
  respuestas,
  resultado,
  consentimientoWhatsapp,
}) {
  const record = {
    id: uuid(),
    creado_en: new Date().toISOString(),
    prospecto: { nombre, telefono, email, edad, sexo, codigo_referidor: codigoReferidor || null },
    respuestas_asv: respuestas,
    resultados_asv: {
      puntajes: resultado.scores,
      clasificaciones: resultado.classifications,
      sistema_prioritario: resultado.prioritario,
      sistema_secundario: resultado.secundario,
      recomendacion: resultado.recomendacion,
      valor_programa_usd: resultado.recomendacion?.precioProgramaUSD ?? null,
    },
    seguimiento_crm: {
      estado_comercial: "resultado_enviado",
      fecha_proximo_seguimiento: null,
      notas: "",
    },
    consentimiento_whatsapp: !!consentimientoWhatsapp,
  };
  const all = readAll();
  all.push(record);
  writeAll(all);
  return record;
}

export function listProspectos() {
  return readAll();
}

export function getProspecto(id) {
  return readAll().find((r) => r.id === id) || null;
}

/**
 * Actualiza campos de seguimiento_crm (estado_comercial, notas,
 * fecha_proximo_seguimiento) desde el panel CRM. `notaNueva`, si viene, se
 * agrega al historial en vez de reemplazar las notas anteriores.
 */
export function updateSeguimiento(id, { estado_comercial, fecha_proximo_seguimiento, notaNueva } = {}) {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const record = all[idx];
  if (estado_comercial !== undefined) record.seguimiento_crm.estado_comercial = estado_comercial;
  if (fecha_proximo_seguimiento !== undefined) record.seguimiento_crm.fecha_proximo_seguimiento = fecha_proximo_seguimiento;
  if (notaNueva) {
    // Fecha de calendario LOCAL, no UTC — toISOString().slice(0,10) corre un
    // día hacia atrás en timezones negativos como Ecuador (UTC-5).
    const now = new Date();
    const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const historial = record.seguimiento_crm.historial || [];
    historial.push({ fecha, nota: notaNueva });
    record.seguimiento_crm.historial = historial;
    record.seguimiento_crm.notas = notaNueva;
  }
  all[idx] = record;
  writeAll(all);
  return record;
}
