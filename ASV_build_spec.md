# Especificación de Construcción — Herramienta ASV Éxito Natural

## Contexto para Claude Code

Construye una aplicación web completa (no solo un wireframe) para el **Análisis de
Estilo de Vida (ASV)** de Éxito Natural / Nature's Sunshine Products. Tiene dos
partes: (1) un cuestionario público que responde el prospecto, y (2) un panel CRM
interno donde Alex (agente de ventas) da seguimiento a los resultados.

Adjunto a esta especificación van 6 archivos JSON con toda la lógica real del
negocio (preguntas, ponderación, umbrales, kits, catálogo y mensajes). Úsalos
como fuente de datos — no inventes preguntas, precios ni productos nuevos.

## Stack sugerido

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind
- **Base de datos**: Supabase (Postgres) — reemplaza el Excel actual
- **Hosting**: Netlify, con deploy automático desde GitHub
- **Repo**: inicializa git, crea el repo en GitHub, conecta a Netlify

## 1. Lógica de cálculo (motor del ASV)

Archivo: `asv_preguntas.json`
- 48 preguntas, cada una responde Sí/No (S/N).
- Cada pregunta tiene un peso (0 o 1) para cada uno de los 9 sistemas del cuerpo:
  Digestivo, Intestinal, Circulatorio, Nervioso, Inmunológico, Respiratorio,
  Urinario, Glandular, Estructural.
- **Puntaje de un sistema** = suma de los pesos de ese sistema en todas las
  preguntas donde el usuario respondió "Sí" (S).

Archivo: `asv_escala.json`
- Umbrales de clasificación **por sistema** (varían entre sistemas, no es una
  escala única): `excelente_max`, `bueno_max`, `regular_max`, `bajo_desde`.
- Clasifica el puntaje de cada sistema en: Excelente / Bueno / Regular / Bajo,
  usando el umbral específico de ese sistema.
- El o los sistemas en estado "Bajo" con mayor puntaje son el **Sistema
  Prioritario** y **Sistema Secundario**.

## 2. Motor de recomendación

Archivos: `asv_kits.json`, `asv_motor_recomendacion.json`
- Cuando un sistema queda en estado "Bajo", el motor de recomendación devuelve:
  Kit oficial recomendado, producto complemento, y precio del programa sugerido.
- Si el prospecto prefiere una recomendación más simple (no el kit completo),
  usa `asv_catalogo_productos.json` — 51 productos individuales con su sistema,
  precio Consultor/Premium/PVP y una columna `Confianza clasificación`
  (algunos están "Confirmado", otros "Sugerido — verificar con Alex"; muestra
  esa distinción en la interfaz, no la ocultes).

## 3. Flujo de venta (aplica en la pantalla de resultado)

1. Mostrar resultado del ASV (gráfico de 9 sistemas + prioritario/secundario).
2. Mostrar recomendación (kit o producto) a **precio público** primero.
3. Botón secundario, menos protagónico: "¿Quieres el precio preferencial?
   Habla con un asesor" → abre WhatsApp con mensaje prellenado.
4. Capturar datos de contacto (nombre, WhatsApp, email, consentimiento) y
   guardar el prospecto en la base de datos con su resultado completo.

## 4. Mensajes de WhatsApp

Archivo: `asv_mensajes_whatsapp.json` — 8 plantillas con placeholder `[Nombre]`.
Genera el link `https://wa.me/593{telefono}?text={mensaje codificado}` con el
mensaje correspondiente según la etapa (invitación, resultado, recomendación,
seguimiento a 7 días, reactivación, renovación).

## 5. Modelo de datos sugerido (Supabase)

- `prospectos`: id, nombre, telefono, email, ciudad, codigo_referidor,
  nombre_referidor, estado_contacto, creado_en
- `respuestas_asv`: id, prospecto_id, respuestas (jsonb con las 48 respuestas S/N)
- `resultados_asv`: id, prospecto_id, puntajes (jsonb por sistema), sistema_prioritario,
  sistema_secundario, recomendacion, complemento, valor_programa_usd, vp_estimado
- `seguimiento_crm`: id, prospecto_id, estado_comercial, fecha_proximo_seguimiento,
  notas
- `catalogo_productos`: espejo de `asv_catalogo_productos.json`
- `kits`: espejo de `asv_kits.json`

## 6. Pantallas a construir

### Lado público (cuestionario)
1. Landing — CTA "Empezar mi análisis"
2. Cuestionario — 1 pregunta a la vez, barra de progreso, agrupado visualmente
   por sistema
3. Pantalla de procesamiento
4. Resultados — gráfico de 9 sistemas, sistema prioritario destacado, hábito
   recomendado, consejo natural, tarjeta de producto/kit con precio público,
   enlace secundario a WhatsApp para precio preferencial
5. Captura de datos — nombre, WhatsApp, email, consentimiento

### Lado interno (CRM — uso de Alex)
6. Dashboard — métricas (análisis realizados, prospectos contactados, ventas
   cerradas, valor potencial USD, VP estimado) + gráfico de casos prioritarios
   por sistema + seguimientos de hoy
7. Lista de prospectos — tabla filtrable por sistema prioritario, estado
   comercial, fecha
8. Ficha de prospecto — resultado completo del ASV, recomendación, botón de
   WhatsApp con mensaje editable, historial de seguimiento
9. Catálogo/Kits — referencia rápida agrupada por sistema
10. Campañas — vista de listas segmentadas para WhatsApp masivo (like
    `Campaña Fase 1` del Excel)

## 7. Identidad visual

Paleta de marca Éxito Natural: verde oscuro `#2A5A1A`, verde vivo `#639922`,
dorado `#C8A850`, crema `#F5F0E8`. Estilo limpio tipo dashboard de ventas
moderno (piensa HubSpot/Notion).

## 8. Aviso legal obligatorio

Incluir siempre, visible en la pantalla de resultados: *"Material con fines
informativos. No sustituye diagnóstico, tratamiento ni consulta con
profesional de salud."* — No eliminar ni reformular esta nota.

## 9. Reglas de Pieter (agente de tecnología) para este proyecto

- Ship rápido: primero un MVP funcional del cuestionario + cálculo + captura de
  datos, antes de pulir el panel CRM interno.
- Probar en un entorno de prueba (Netlify preview / branch) antes de apuntar
  el dominio de producción.
- Documentar cada decisión técnica en el README del repo.
- Gasto nuevo (plan pago de Supabase/Netlify si se excede el free tier) se
  escala a Victor antes de contratarlo.
