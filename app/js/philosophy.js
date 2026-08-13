// Selección del "pilar de naturopatía" mostrado en la pantalla de resultados.
//
// Contenido real provisto por el usuario (asv_pilares_naturopatia.json) —
// reemplaza el contenido editorial genérico que había antes en habits.js.
// Son 6 pilares filosóficos generales, no uno por cada uno de los 9 sistemas
// del ASV, así que no hay un match 1:1. Se elige un pilar de forma
// determinística a partir del sistema prioritario + secundario, para que un
// mismo resultado siempre muestre el mismo pilar (no aleatorio en cada
// render), pero distintos resultados tiendan a mostrar pilares distintos.
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getPilar(pilaresData, sistemaPrioritario, sistemaSecundario) {
  if (!pilaresData || !pilaresData.length) return null;
  const key = `${sistemaPrioritario || ""}|${sistemaSecundario || ""}`;
  const idx = hashString(key) % pilaresData.length;
  return pilaresData[idx];
}
