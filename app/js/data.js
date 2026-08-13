// Carga de los 6 archivos JSON fuente (asv_*.json). No se inventan datos aquí:
// todo lo que consume el motor viene literalmente de estos archivos.

// Resuelto contra la ubicación de este módulo (no la página que lo importa),
// para que funcione igual desde app/index.html como desde app/crm/index.html.
const DATA_BASE = new URL("../data/", import.meta.url).href;

async function loadJSON(name) {
  const res = await fetch(DATA_BASE + name, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${name}: ${res.status}`);
  return res.json();
}

export async function loadAsvData() {
  const [preguntas, escala, kits, mensajes, motor, catalogo, pilares] = await Promise.all([
    loadJSON("asv_preguntas.json"),
    loadJSON("asv_escala.json"),
    loadJSON("asv_kits.json"),
    loadJSON("asv_mensajes_whatsapp.json"),
    loadJSON("asv_motor_recomendacion.json"),
    loadJSON("asv_catalogo_productos.json"),
    loadJSON("asv_pilares_naturopatia.json"),
  ]);
  return { preguntas, escala, kits, mensajes, motor, catalogo, pilares };
}
