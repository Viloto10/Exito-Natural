// Generación de enlaces de WhatsApp (spec sección 4).
// https://wa.me/593{telefono}?text={mensaje codificado}

/** Reemplaza placeholders [Nombre], [Sistema Prioritario], etc. en una plantilla. */
export function fillTemplate(template, values) {
  return template.replace(/\[([^\]]+)\]/g, (match, key) => {
    const v = values[key];
    return v === undefined || v === null || v === "" ? match : String(v);
  });
}

export function findMensaje(mensajesData, tipo) {
  return mensajesData.find((m) => m["Tipo Mensaje"] === tipo) || null;
}

/** Normaliza un WhatsApp de Ecuador a dígitos con prefijo 593, sin '+' ni espacios. */
export function normalizePhoneEC(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1); // 0987654321 -> 987654321
  if (!digits.startsWith("593")) digits = "593" + digits;
  return digits;
}

export function buildWaLink(telefono, mensaje) {
  const phone = normalizePhoneEC(telefono);
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Mensaje que el PROSPECTO envía al asesor pidiendo precio preferencial
 * (spec sección 3, paso 3). No es una de las 8 plantillas de
 * asv_mensajes_whatsapp.json — esas son mensajes salientes del negocio hacia
 * el prospecto (usadas por el CRM del consultor). Este texto sí reutiliza
 * el nombre del programa y el precio calculados por el motor, sin inventar
 * productos ni precios.
 */
export function buildAsesorMessage({ nombre, sistemaPrioritario, programa, precio }) {
  const saludo = nombre ? `Hola, soy ${nombre}.` : "Hola.";
  return (
    `${saludo} Acabo de completar mi Análisis de Estilo de Vida (ASV). ` +
    `Mi sistema prioritario es ${sistemaPrioritario} y me recomendaron: ${programa} ` +
    `($${precio} precio público). Me gustaría conocer el precio preferencial.`
  );
}
