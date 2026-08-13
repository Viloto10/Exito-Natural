// Motor del ASV — cálculo de puntajes, clasificación por sistema y motor de
// recomendación. Implementa literalmente las reglas de ASV_build_spec.md
// secciones 1 y 2, sin inventar preguntas, umbrales, kits ni precios.

/**
 * Puntaje de cada sistema = suma de los pesos de ese sistema en todas las
 * preguntas donde el usuario respondió "Sí".
 * @param {object} preguntasData - contenido de asv_preguntas.json
 * @param {Record<number, boolean>} respuestas - { [n]: true=Sí, false=No }
 * @returns {Record<string, number>} puntaje por sistema
 */
export function computeScores(preguntasData, respuestas) {
  const scores = Object.fromEntries(preguntasData.sistemas.map((s) => [s, 0]));
  for (const p of preguntasData.preguntas) {
    if (respuestas[p.n] === true) {
      for (const sistema of preguntasData.sistemas) {
        scores[sistema] += p.pesos[sistema] || 0;
      }
    }
  }
  return scores;
}

/**
 * Clasifica un puntaje según los umbrales específicos de ese sistema
 * (asv_escala.json — los umbrales varían entre sistemas).
 */
export function classifySystem(escalaData, sistema, puntaje) {
  const row = escalaData.find((r) => r.sistema === sistema);
  if (!row) throw new Error(`Sistema sin escala: ${sistema}`);
  if (puntaje <= row.excelente_max) return "Excelente";
  if (puntaje <= row.bueno_max) return "Bueno";
  if (puntaje <= row.regular_max) return "Regular";
  return "Bajo";
}

export function classifyAll(escalaData, scores) {
  return Object.fromEntries(
    Object.entries(scores).map(([sistema, puntaje]) => [
      sistema,
      classifySystem(escalaData, sistema, puntaje),
    ])
  );
}

/**
 * Sistema Prioritario y Secundario = el/los sistemas en estado "Bajo" con
 * mayor puntaje (spec sección 1). Si ningún sistema cae en "Bajo" (persona
 * en buen estado general), se degrada a los sistemas "Regular" con mayor
 * puntaje para igual poder mostrar una recomendación con sentido — decisión
 * de implementación no cubierta explícitamente por la spec.
 */
export function getPriority(scores, classifications) {
  const bySeverity = (estado) =>
    Object.keys(scores)
      .filter((s) => classifications[s] === estado)
      .sort((a, b) => scores[b] - scores[a]);

  let ranked = bySeverity("Bajo");
  let degraded = false;
  if (ranked.length === 0) {
    ranked = bySeverity("Regular");
    degraded = true;
  }

  return {
    prioritario: ranked[0] ?? null,
    secundario: ranked[1] ?? null,
    degraded, // true = no hubo sistemas "Bajo", se usó el mejor disponible
  };
}

/**
 * Recomendación calculada (asv_motor_recomendacion.json). Glandular se
 * bifurca por sexo porque el archivo fuente separa "Glandular Femenino" /
 * "Glandular Masculino" y asv_preguntas.json solo tiene un sistema
 * "Glandular" combinado.
 */
export function getRecommendation(motorData, sistema, sexo) {
  const key =
    sistema === "Glandular"
      ? sexo === "M"
        ? "Glandular Masculino"
        : "Glandular Femenino"
      : sistema;
  const row = motorData.find((r) => r["Sistema / Segmento"] === key);
  if (!row) return null;
  return {
    sistema: key,
    recomendacionPrincipal: row["Recomendación Principal"],
    complemento: row["Complemento"],
    productosBase: row["Productos Base"],
    programaSugerido: row["Programa Sugerido"],
    precioProgramaUSD: row["Precio Programa USD"],
  };
}

/** Enriquece la recomendación con código/productos del catálogo de kits, si existe. */
export function enrichKit(kitsData, nombreKit) {
  return kitsData.find((k) => k.Kit === nombreKit) || null;
}

/**
 * Alternativas más simples (producto suelto) del catálogo para el sistema
 * dado. Usa coincidencia por substring porque "Sistema Principal" en el
 * catálogo mezcla nombres combinados ("Digestivo / Intestinal").
 */
export function getCatalogAlternatives(catalogoData, sistema, limit = 4) {
  const needle = sistema.toLowerCase();
  return catalogoData
    .filter((p) => (p["Sistema Principal"] || "").toLowerCase().includes(needle))
    .sort((a, b) => a["Precio Público (PVP)"] - b["Precio Público (PVP)"])
    .slice(0, limit)
    .map((p) => ({
      codigo: p["Código EBS"],
      producto: p["Producto"],
      beneficio: p["Beneficio breve"],
      precioConsultor: p["Precio Consultor"],
      precioPremium: p["Precio Premium"],
      precioPublico: p["Precio Público (PVP)"],
      vp: p["Puntos (VP)"],
      confianza: p["Confianza clasificación"],
    }));
}

/**
 * Corre el motor completo sobre un set de respuestas y devuelve todo lo que
 * necesita la pantalla de resultados.
 */
export function runAsvEngine(asvData, respuestas, sexo) {
  const scores = computeScores(asvData.preguntas, respuestas);
  const classifications = classifyAll(asvData.escala, scores);
  const { prioritario, secundario, degraded } = getPriority(scores, classifications);

  const recomendacion = prioritario
    ? getRecommendation(asvData.motor, prioritario, sexo)
    : null;
  const kitInfo = recomendacion
    ? enrichKit(asvData.kits, recomendacion.recomendacionPrincipal)
    : null;
  const alternativas = prioritario
    ? getCatalogAlternatives(asvData.catalogo, prioritario)
    : [];

  return {
    scores,
    classifications,
    prioritario,
    secundario,
    degraded,
    recomendacion,
    kitInfo,
    alternativas,
  };
}
