// Configuración del MVP. Ajusta estos valores antes de publicar en producción.

export const CONFIG = {
  // Número de WhatsApp del asesor/consultora al que llega el botón
  // "Habla con un asesor" en la pantalla de resultados.
  ADVISOR_WHATSAPP: "+593998699940",

  // Texto legal obligatorio (spec sección 8). No editar ni quitar.
  AVISO_LEGAL:
    "Material con fines informativos. No sustituye diagnóstico, tratamiento ni consulta con profesional de salud.",

  // Clave de localStorage donde se guardan los prospectos mientras no hay
  // backend/Supabase conectado.
  STORAGE_KEY: "asv_prospectos_v1",

  TOTAL_PREGUNTAS: 48,
  PREGUNTAS_POR_BLOQUE: 8,
};
