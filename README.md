# ASV Éxito Natural — cuestionario público + motor de cálculo + CRM

Implementación de [`ASV_build_spec.md`](ASV_build_spec.md) completa: el
cuestionario público que responde el prospecto (`app/`), el motor de cálculo
del ASV, y el panel CRM interno de uso de Alex (`app/crm/`) — las 10 pantallas
de la spec §6.

## Cómo correrlo

```bash
cd app
python3 -m http.server 8765
```

Abre `http://localhost:8765` para el cuestionario público, o
`http://localhost:8765/crm/` para el panel de Alex. No hay paso de build: es
HTML/CSS/JS plano servido tal cual.

> Nota: `python3 -m http.server` no manda cabeceras de caché, y el navegador
> de preview igual cachea agresivamente los `.js` (incluso en pestañas
> nuevas). Si editas un archivo y no ves el cambio, lo más rápido es un hard
> refresh; si eso tampoco alcanza, súbele el número de versión al query
> string del archivo que cambiaste (`./js/app.js?v=3`, etc., ver `index.html`
> y el import de `data.js` dentro de `app.js`).

## Por qué no es Next.js todavía

La spec sugiere Next.js + TypeScript + Tailwind + Supabase + Netlify. Esta
máquina no tiene Node.js, npm ni Homebrew instalados, así que este MVP se
construyó como una SPA estática sin paso de build (HTML + ES modules + CSS
plano) para poder shippear ya. La lógica está deliberadamente separada en
módulos puros (`js/engine.js`, `js/whatsapp.js`) sin dependencias del DOM,
para que migrarla a un proyecto Next.js más adelante sea casi copiar y pegar
los archivos dentro de `lib/` y reemplazar el `render()` a mano por
componentes React.

Para migrar cuando haya Node disponible:
1. `npx create-next-app@latest --typescript --tailwind`
2. Mover `js/engine.js`, `js/whatsapp.js`, `js/habits.js`, `data/*.json` a `lib/` sin tocar su lógica.
3. Convertir las funciones `screenX()` de `app.js` a componentes/páginas.
4. Reemplazar `js/storage.js` por llamadas a Supabase (ver sección siguiente).

## Estructura

```
app/
  index.html            shell del cuestionario público
  crm/index.html          shell del panel CRM (uso de Alex)
  css/
    styles.css            identidad visual Éxito Natural (tokens + cuestionario)
    crm.css                 layout de dashboard del CRM, sobre los mismos tokens
  assets/
    hero/bienvenida.png    imagen del hero de landing (generada con IA)
    pilares/*.jpeg           6 imágenes de los pilares de naturopatía (dadas por el usuario)
  data/*.json             copia de los 7 archivos fuente (6 de la spec + los
                         pilares de naturopatía) — no editar a mano
  js/
    data.js              carga los JSON (ruta resuelta con import.meta.url,
                         funciona igual desde app/ que desde app/crm/)
    engine.js             motor de cálculo (puro, sin DOM) — ver abajo
    philosophy.js           elige qué pilar de naturopatía mostrar en resultados
    whatsapp.js             plantillas y enlaces wa.me
    storage.js              persistencia (localStorage por ahora) — leído tanto
                         por app.js como por crm.js
    config.js                número de WhatsApp del asesor, aviso legal, etc.
    app.js                  controlador del cuestionario público
    crm.js                   controlador del panel CRM
```

## Motor de cálculo (`js/engine.js`)

Implementa literalmente `ASV_build_spec.md` §1–2:

- **Puntaje por sistema** = suma de los pesos de ese sistema en las preguntas
  respondidas "Sí" (`computeScores`).
- **Clasificación** (Excelente/Bueno/Regular/Bajo) usa el umbral específico de
  cada sistema en `asv_escala.json` (`classifySystem`).
- **Sistema Prioritario/Secundario** = los sistemas en estado "Bajo" con mayor
  puntaje (`getPriority`). Decisión de implementación no cubierta por la spec:
  si ningún sistema cae en "Bajo", se degrada a los "Regular" con mayor
  puntaje, para no dejar la pantalla de resultados sin recomendación. El flag
  `degraded` queda disponible para distinguir este caso en la UI.
- **Recomendación** (`getRecommendation`) busca en `asv_motor_recomendacion.json`
  por sistema. Glandular se resuelve a "Glandular Femenino"/"Glandular
  Masculino" según el sexo capturado, porque el archivo de recomendación
  separa esos dos segmentos pero `asv_preguntas.json`/`asv_escala.json` solo
  tienen un sistema "Glandular" combinado.
- **Alternativas más simples** (`getCatalogAlternatives`) filtra
  `asv_catalogo_productos.json` por sistema y muestra la distinción
  "Confirmado" vs. "Sugerido — verificar con Alex" en la interfaz, sin
  ocultarla (spec §2).

Verificado de forma independiente: el cálculo del motor se corrió en el
navegador y se contrastó contra un script Python separado que recalcula los
mismos puntajes/clasificaciones directamente desde los JSON — los resultados
coinciden exactamente.

## Decisiones de flujo que no estaban 100% explícitas en la spec

- **Dónde se captura qué dato.** La spec pide "Nombre, WhatsApp, Edad, Sexo"
  en la landing (pantalla 1 del wireframe) pero también una pantalla de
  "Captura de datos" separada después del resultado (pantalla 5 de la spec).
  Aquí: nombre/WhatsApp/edad/sexo se piden **antes** del cuestionario (el
  motor los necesita — sexo para Glandular, y sin nombre/teléfono no hay a
  quién darle seguimiento); email + consentimiento explícito + confirmación
  final se piden **después** de ver el resultado, que es el punto donde se
  guarda el prospecto completo en `storage.js`. Es decir: primero dejamos que
  la persona vea valor (su resultado), y recién ahí se persiste el registro.
- **Bloques de preguntas.** Se agruparon en 6 bloques de 8 (48 preguntas),
  1 a la vez dentro de cada bloque, con una pantalla corta de "bloque
  completado" entre bloques — igual que el wireframe (`Wireframes ASV
  Prospecto.dc.html`, pantallas A2/A3/B2/B3). Las preguntas no pertenecen a
  un único sistema (cada una pesa sobre varios sistemas a la vez), así que el
  agrupamiento es solo de UI/ritmo, no una segmentación real por sistema.
- **Continuar un análisis a medias.** El progreso se guarda en `localStorage`
  (borrador) después de cada respuesta. Si la persona recarga la página, la
  landing le ofrece "Seguir donde iba" — no se construyó la pantalla completa
  de "retomar por WhatsApp en dos tandas" del wireframe (`3a` / P2), queda
  para la siguiente iteración.
- **Mensaje de WhatsApp al asesor.** El botón "¿Quieres el precio
  preferencial? Habla con un asesor" arma un mensaje nuevo (prospecto → 
  asesor) con el sistema prioritario y el programa recomendado. Las 8
  plantillas de `asv_mensajes_whatsapp.json` son mensajes salientes del
  negocio hacia el prospecto (para el panel CRM del consultor, fase 2), así
  que no se reutilizan aquí tal cual — sí se reutiliza el motor
  Nombre/Sistema/Kit/Valor que calculan.
- **"Hábito recomendado / consejo natural"** en la pantalla de resultados
  (`js/philosophy.js` + `data/asv_pilares_naturopatia.json`): contenido real
  provisto por el usuario — 6 pilares filosóficos de naturopatía (no uno por
  cada uno de los 9 sistemas del ASV). Como no hay un match 1:1 sistema↔pilar,
  se elige un pilar de forma determinística según sistema prioritario +
  secundario (mismo resultado → mismo pilar siempre, ver `getPilar()`). Cada
  6 ilustraciones (`app/assets/pilares/1-fuerza-vital.jpeg` ... `6-vision-integral.jpeg`)
  ya están conectadas vía el campo `imagen` de cada objeto en
  `asv_pilares_naturopatia.json`; si no hay `imagen` (o el archivo no carga),
  cae a un placeholder con la inicial del pilar.
- **Número de WhatsApp del asesor** (`js/config.js` → `ADVISOR_WHATSAPP`):
  `+593998699940`.
- **Imagen de bienvenida** (landing, `.hero-block--bienvenida` en
  `css/styles.css`): generada con IA en el mismo estilo plano/ilustrado y
  paleta de marca que las 6 imágenes de pilares
  (`app/assets/hero/bienvenida.png`), sin texto para no chocar con el tag
  "Gratis · 5 minutos" que superpone la app.

## Panel CRM (`app/crm/`, uso de Alex)

Las 5 pantallas de la spec §6 (6–10), sobre los mismos prospectos que guarda
el cuestionario público:

- **Dashboard** — análisis realizados, contactados, ventas cerradas, valor
  potencial USD (suma de `valor_programa_usd` de prospectos no cerrados/no
  perdidos), casos prioritarios por sistema (barra por cada uno de los 9
  sistemas) y seguimientos programados para hoy.
- **Prospectos** — tabla filtrable por sistema prioritario, estado comercial
  y búsqueda por nombre/teléfono. Clic en una fila → ficha.
- **Ficha de prospecto** — resultado completo del ASV (mismo render que la
  pantalla pública de resultados: 9 sistemas, prioritario/secundario,
  recomendación con código/productos del kit), cambio de estado comercial +
  fecha de próximo seguimiento + notas con historial, y generador de mensaje
  de WhatsApp usando las 8 plantillas reales de `asv_mensajes_whatsapp.json`
  (las 2 marcadas "pendiente de aprobación" en el JSON se muestran con esa
  etiqueta en vez de ocultarlas).
- **Catálogo/Kits** — los 8 kits y 51 productos, filtrables por sistema, con
  la misma distinción "Confirmado"/"Sugerido" del cuestionario público.
- **Campañas** — listas segmentadas para WhatsApp masivo.

**Decisión importante:** la campaña "Fase 1" del Excel original (segmentos
por vencimiento de membresía NSP y TOV: 🔴 Urgente / 🟠 Esta semana / 🟢
Reactivar) usa datos de afiliados que **no vinieron en los 6 JSON de la
spec** — no existe un `asv_membresias.json` ni nada equivalente. Inventar esos
datos habría violado la instrucción explícita de "no inventes... datos
nuevos", así que en su lugar los 3 segmentos de Campañas se calculan con lo
que sí tenemos (prospectos del ASV): **Sin contactar** (estado por defecto,
sin avance), **Seguimiento pendiente** (fecha de seguimiento hoy o vencida) y
**En decisión**. Cuando la fuente de datos de membresías esté disponible, se
agrega como segmento adicional sin tocar el resto.

**Limitación real, no cosmética:** como todavía no hay Supabase, el CRM lee
los prospectos de la misma `localStorage` del navegador — solo ve lo que se
guardó *en ese mismo navegador*. En producción, un prospecto llena el ASV en
su celular y Alex necesita verlo en el suyo: eso **requiere el backend**. El
CRM está construido para ese día (misma capa `storage.js`, mismo shape de
datos), pero hoy es una demo funcional de un solo dispositivo, no una
herramienta multi-usuario real. Tampoco tiene autenticación — cualquiera con
la URL `/crm/` ve los datos de ese navegador.

Para sembrar prospectos de prueba y ver el CRM con datos reales:
```js
// en la consola del navegador, en http://localhost:8765
const { loadAsvData } = await import('./js/data.js?v=4');
const { runAsvEngine } = await import('./js/engine.js');
const { saveProspecto } = await import('./js/storage.js?v=3');
const asv = await loadAsvData();
const respuestas = Object.fromEntries(asv.preguntas.preguntas.map(p => [p.n, Math.random() > 0.4]));
const resultado = runAsvEngine(asv, respuestas, 'F');
saveProspecto({ nombre: 'Prueba', telefono: '0991234567', email: '', edad: '30', sexo: 'F', codigoReferidor: '', respuestas, resultado, consentimientoWhatsapp: true });
```

## Bug de fechas corregido (timezone)

`fmtFecha()` en `crm.js` y `todayISO()` originalmente usaban
`Date.toISOString()`, que trabaja en UTC. Para fechas guardadas como
`YYYY-MM-DD` (sin hora) — `fecha_proximo_seguimiento`, el historial de
seguimiento — eso corre la fecha mostrada **un día hacia atrás** en
timezones negativos como Ecuador (UTC-5, el mercado real de esta app): una
nota guardada el 13 de agosto se mostraba como "12 ago". Se corrigió
tratando esas fechas como calendario local, no como instante UTC (`js/crm.js`,
`js/storage.js`). Verificado con el navegador de pruebas en `America/Guayaquil`.

## Modelo de datos / próximo paso: Supabase

`js/storage.js` guarda cada prospecto en `localStorage` con el mismo shape
que las tablas sugeridas en la spec §5 (`prospectos`, `respuestas_asv`,
`resultados_asv`, `seguimiento_crm`), para que conectar Supabase más adelante
sea sustituir esa función por inserts reales, no rediseñar el modelo. No se
creó el proyecto de Supabase ni se corrió ninguna migración — esta sesión no
tenía credenciales para eso ni Node/npm instalados. Falta, cuando el usuario
lo autorice:

1. Crear proyecto Supabase y las tablas de §5 — sumar `historial` (jsonb) a
   `seguimiento_crm`, es lo único que este build agregó al modelo sugerido
   (lista de `{fecha, nota}`, para el historial de seguimiento de la ficha).
2. Reemplazar `saveProspecto()` / `listProspectos()` / `getProspecto()` /
   `updateSeguimiento()` en `storage.js` por llamadas a la API de Supabase —
   `crm.js` y `app.js` ya solo hablan con esas 4 funciones, no con
   `localStorage` directamente, así que el cambio queda contenido ahí.
3. Añadir el gasto (plan pago si se excede el free tier) escalado a Victor
   antes de contratarlo, por la regla de Pieter en la spec §9.

## Pendiente (fuera de este MVP)

- Conexión real a Supabase (ver arriba) — hoy el CRM solo ve prospectos
  guardados en el mismo navegador (ver "Panel CRM" arriba).
- Autenticación del panel CRM — hoy `/crm/` es de acceso libre para quien
  tenga la URL.
- Migración del static MVP a Next.js + TypeScript + Tailwind.
- Git init, repo en GitHub y deploy a Netlify (spec §9: probar primero en
  preview/branch antes de apuntar el dominio de producción) — no se hizo en
  esta sesión, pendiente de confirmación.

## Aviso legal

El texto obligatorio de la spec §8 está en `js/config.js` (`AVISO_LEGAL`) y
se muestra sin alterar en landing, consentimiento, resultados y captura.
