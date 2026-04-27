/* ══════════════════════════════════════
   MAP — INITIALISATION
══════════════════════════════════════ */
async function loadPoiTypes() {
  try {
    state.map.poiTypes = await api('GET', '/poi-types');
  } catch (e) { console.error('Failed to load POI types', e); }
}

async function loadMapData(worldId) {
  try {
    const pois = await api('GET', `/worlds/${worldId}/map/pois`);
    if (state.ui.activeWorldId !== worldId) return; // stale — world changed while loading
    state.map.pois = pois;
  } catch (e) { console.error('Failed to load map POIs', e); }

  if (state.ui.activeWorldId !== worldId) return;
  if (state.map.bgUrl) { URL.revokeObjectURL(state.map.bgUrl); state.map.bgUrl = null; }
  state.map.bgScale = 1.0;
  try {
    const res = await fetch(`/api/worlds/${worldId}/map/background`);
    if (state.ui.activeWorldId !== worldId) return; // stale
    if (res.ok) {
      state.map.bgScale = parseFloat(res.headers.get('X-Bg-Scale') || '1.0');
      const blob = await res.blob();
      state.map.bgUrl = URL.createObjectURL(blob);
    }
  } catch (e) { /* no background set */ }
}

async function initMapPage() {
  const worldId = state.ui.activeWorldId;
  if (!worldId) return;

  // Clean up resize handler from any previous map page visit
  if (window._mapResizeHandler) {
    window.removeEventListener('resize', window._mapResizeHandler);
    window._mapResizeHandler = null;
  }

  // Reset ruler, tool, and viewport on page load; bgScale is loaded from server inside loadMapData
  state.map.activeTool = 'interact';
  state.map.ruler      = null;
  state.map.rulerStep  = 0;
  state.map.rulerStart = null;
  state.map.zoom       = 1.0;
  state.map.panX       = 0;
  state.map.panY       = 0;

  await Promise.all([loadPoiTypes(), loadMapData(worldId)]);

  // Sync slider with the scale loaded from the server
  const scaleSlider = document.getElementById('map-bg-scale');
  const scaleVal    = document.getElementById('map-bg-scale-val');
  if (scaleSlider) scaleSlider.value = state.map.bgScale;
  if (scaleVal)    scaleVal.textContent = Math.round(state.map.bgScale * 100) + '%';
  // Set initial zoom so the full bgScale-extended image fits in the canvas
  state.map.zoom = Math.max(0.25, Math.min(4.0, 1.0 / state.map.bgScale));
  const zoomSlider = document.getElementById('map-zoom-slider');
  const zoomVal    = document.getElementById('map-zoom-val');
  if (zoomSlider) zoomSlider.value = Math.round(state.map.zoom * 100);
  if (zoomVal)    zoomVal.textContent = Math.round(state.map.zoom * 100) + '%';
  renderPoiTypeSidebar();
  renderMap();
  renderRuler();
  bindMapCanvasEvents();
  applyAuthUI();

  // Re-render POIs on window resize so image-relative coordinates stay accurate
  // as the container dimensions (and thus letterbox bounds) change.
  let _mapResizeTimer = null;
  window._mapResizeHandler = () => {
    clearTimeout(_mapResizeTimer);
    _mapResizeTimer = setTimeout(renderMapPois, 100);
  };
  window.addEventListener('resize', window._mapResizeHandler);
  const scaleLbl = document.getElementById('map-scale-label');
  if (scaleLbl) {
    const mpc = getMapMilesPerCell();
    scaleLbl.textContent = `1 Feld = ${mpc} Meilen`;
    scaleLbl.dataset.tooltip =
      `zu Fuß               ≈ 3 Meilen/Stunde\n` +
      `zu Pferd             ≈ 5 Meilen/Stunde\n` +
      `mit Kutsche (Straße) ≈ 6 Meilen/Stunde`;
  }
}

function renderPoiTypeSidebar() {
  const el = document.getElementById('map-poi-type-list');
  if (!el) return;
  const canPlace = canEditActiveWorld();
  el.innerHTML = state.map.poiTypes.map(t => `
    <button class="map-tool poi-type-btn" data-type-id="${t.id}"
            onclick="setMapTool('place-${t.id}')"
            ${!canPlace ? 'disabled title="Keine Berechtigung"' : ''}>
      <span class="map-tool-sym">${poiShapeHtml(t.shape, t.icon)}</span> ${escHtml(t.name)}
      ${state.auth.isAdmin ? `<span class="poi-type-edit-link" onclick="event.stopPropagation();openPoiTypeManager(${t.id})" title="Bearbeiten">✎</span>` : ''}
    </button>
  `).join('');
}

function setMapTool(tool) {
  state.map.activeTool = tool;
  if (tool !== 'ruler') {
    state.map.rulerStep  = 0;
    state.map.rulerStart = null;
    state.map.ruler      = null;
    renderRuler();
  }
  document.querySelectorAll('.map-tool').forEach(btn => btn.classList.remove('active'));
  const btnIds = { interact: 'map-tool-interact', edit: 'map-tool-edit', ruler: 'map-tool-ruler' };
  if (btnIds[tool]) {
    document.getElementById(btnIds[tool])?.classList.add('active');
  } else if (tool.startsWith('place-')) {
    const typeId = parseInt(tool.split('-')[1], 10);
    document.querySelector(`.poi-type-btn[data-type-id="${typeId}"]`)?.classList.add('active');
  }
  const wrap = document.getElementById('map-canvas-wrap');
  if (wrap) {
    if      (tool === 'interact')                            wrap.style.cursor = 'grab';
    else if (tool === 'ruler' || tool.startsWith('place-')) wrap.style.cursor = 'crosshair';
    else                                                    wrap.style.cursor = '';
  }
}

function openMapBgUpload() {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/worlds/${state.ui.activeWorldId}/map/background`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload fehlgeschlagen (' + res.status + ')');
      if (state.map.bgUrl) { URL.revokeObjectURL(state.map.bgUrl); state.map.bgUrl = null; }
      const bgRes = await fetch(`/api/worlds/${state.ui.activeWorldId}/map/background`);
      if (bgRes.ok) {
        state.map.bgScale = parseFloat(bgRes.headers.get('X-Bg-Scale') || '1.0');
        const scaleSlider = document.getElementById('map-bg-scale');
        const scaleVal    = document.getElementById('map-bg-scale-val');
        if (scaleSlider) scaleSlider.value = state.map.bgScale;
        if (scaleVal)    scaleVal.textContent = Math.round(state.map.bgScale * 100) + '%';
        state.map.bgUrl = URL.createObjectURL(await bgRes.blob());
      }
      renderMap();
    } catch (e) { alert('Fehler beim Hochladen: ' + e.message); }
  };
  input.click();
}

let _bgScaleTimer = null;

function setMapBgScale(scale) {
  state.map.bgScale = scale;
  const val = document.getElementById('map-bg-scale-val');
  if (val) val.textContent = Math.round(scale * 100) + '%';
  const scaleVal2 = scale !== 1.0 ? `scale(${scale})` : '';
  const bgImg = document.getElementById('map-bg-img');
  if (bgImg) bgImg.style.transform = scaleVal2;
  const grid = document.getElementById('map-grid');
  if (grid) grid.style.transform = scaleVal2;

  // Persist after 500 ms of slider inactivity (admin only)
  clearTimeout(_bgScaleTimer);
  _bgScaleTimer = setTimeout(async () => {
    try {
      await api('PATCH', `/worlds/${state.ui.activeWorldId}/map/background/scale`, { scale });
    } catch (e) {
      console.error('[setMapBgScale] save failed', e);
    }
  }, 500);
}

/* ══════════════════════════════════════
   MAP — RENDERING
══════════════════════════════════════ */
function renderMap() {
  const bgImg = document.getElementById('map-bg-img');
  if (bgImg) {
    if (state.map.bgUrl) {
      bgImg.src = state.map.bgUrl;
      bgImg.style.display = '';
      bgImg.style.transform = state.map.bgScale !== 1.0 ? `scale(${state.map.bgScale})` : '';
      // Re-render POIs once the image has loaded so letterbox bounds are accurate
      bgImg.onload = () => renderMapPois();
    } else {
      bgImg.style.display = 'none';
      bgImg.onload = null;
    }
  }
  const grid = document.getElementById('map-grid');
  if (grid) grid.style.transform = state.map.bgScale !== 1.0 ? `scale(${state.map.bgScale})` : '';

  renderMapPois();
  applyMapViewport();
}

/**
 * Re-renders only the POI elements into the POI layer.
 * Called from renderMap and on window resize / image load to keep
 * POI positions accurate after letterbox bounds change.
 */
function renderMapPois() {
  const layer = document.getElementById('map-pois-layer');
  if (!layer) return;
  layer.innerHTML = '';
  layer.style.pointerEvents = 'none';
  for (const poi of state.map.pois) {
    layer.appendChild(buildPoiElement(poi));
  }
}

/**
 * Applies the current zoom and pan transform to the map viewport element.
 */
function applyMapViewport() {
  const vp = document.getElementById('map-viewport');
  if (vp) vp.style.transform = `translate(${state.map.panX}px, ${state.map.panY}px) scale(${state.map.zoom})`;
}

/**
 * Sets the map zoom level, clamped to [0.25, 4.0], and syncs the zoom slider.
 * @param {number} zoom - desired zoom level as a multiplier (1.0 = 100%)
 */
function setMapZoom(zoom) {
  state.map.zoom = Math.max(0.25, Math.min(4.0, zoom));
  const slider = document.getElementById('map-zoom-slider');
  const val    = document.getElementById('map-zoom-val');
  if (slider) slider.value = Math.round(state.map.zoom * 100);
  if (val)    val.textContent = Math.round(state.map.zoom * 100) + '%';
  applyMapViewport();
}

/**
 * Returns the rendered image bounds as fractions of the map-canvas-wrap,
 * accounting for object-fit:contain letterboxing.
 * Falls back to {x:0,y:0,w:1,h:1} (full container) when the image is not loaded.
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function getImageBoundsInViewport() {
  const img  = document.getElementById('map-bg-img');
  const wrap = document.getElementById('map-canvas-wrap');
  if (!img || !img.naturalWidth || !img.naturalHeight || !wrap) {
    console.debug('[getImageBoundsInViewport] ← fallback (image not loaded), naturalW=%o naturalH=%o', img?.naturalWidth, img?.naturalHeight);
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  const cW = wrap.clientWidth;
  const cH = wrap.clientHeight;
  if (!cW || !cH) {
    console.debug('[getImageBoundsInViewport] ← fallback (canvas not sized), cW=%o cH=%o', cW, cH);
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  const imgA = img.naturalWidth / img.naturalHeight;
  const cA   = cW / cH;
  let imgW, imgH, imgX, imgY;
  if (cA > imgA) {
    // Container wider than image: letterbox left/right
    imgH = cH; imgW = cH * imgA; imgX = (cW - imgW) / 2; imgY = 0;
  } else {
    // Container taller than image: letterbox top/bottom
    imgW = cW; imgH = cW / imgA; imgX = 0; imgY = (cH - imgH) / 2;
  }
  const ib = { x: imgX / cW, y: imgY / cH, w: imgW / cW, h: imgH / cH };
  console.debug('[getImageBoundsInViewport] canvas=%ox%o img=%ox%o ib=', cW, cH, img.naturalWidth, img.naturalHeight, ib);
  return ib;
}

/**
 * Converts screen coordinates to map percentage position relative to the image,
 * accounting for zoom, pan, and object-fit:contain letterboxing.
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ xPct: number, yPct: number }}
 */
function screenToMapPct(clientX, clientY) {
  const wrap = document.getElementById('map-canvas-wrap');
  if (!wrap) return { xPct: 0, yPct: 0 };
  const rect   = wrap.getBoundingClientRect();
  const ib     = getImageBoundsInViewport();
  const cxFrac = 0.5 + (clientX - rect.left - rect.width  / 2 - state.map.panX) / (rect.width  * state.map.zoom);
  const cyFrac = 0.5 + (clientY - rect.top  - rect.height / 2 - state.map.panY) / (rect.height * state.map.zoom);
  const result = { xPct: (cxFrac - ib.x) / ib.w, yPct: (cyFrac - ib.y) / ib.h };
  console.debug('[screenToMapPct] click=(%o,%o) rect=%ox%o zoom=%o pan=(%o,%o) cFrac=(%o,%o) →', clientX, clientY, rect.width, rect.height, state.map.zoom, state.map.panX, state.map.panY, cxFrac, cyFrac, result);
  return result;
}

function buildPoiElement(poi) {
  const wrap = document.createElement('div');
  const gc = gesinnungClass(poi.gesinnung);
  wrap.className = 'map-poi' + (gc ? ' ' + gc : '');
  wrap.dataset.poiId = poi.id;
  const ib = getImageBoundsInViewport();
  const leftPct  = (ib.x + poi.xPct * ib.w) * 100;
  const topPct   = (ib.y + poi.yPct * ib.h) * 100;
  console.debug('[buildPoiElement] poi#%o stored=(%o,%o) ib=', poi.id, poi.xPct, poi.yPct, ib, '→ left=%o% top=%o%', leftPct, topPct);
  wrap.style.left = leftPct + '%';
  wrap.style.top  = topPct  + '%';
  wrap.style.pointerEvents = 'auto';

  if (poi.poiTypeShape === 'TEXT') {
    // TEXT POI: no icon pin, just styled text centered on the placed point
    wrap.classList.add('map-poi--text');
    if (poi.label) {
      const linked = wikiLinkCheck(poi.label, state.ui.activeWorldId);
      const txt = document.createElement('span');
      txt.className   = 'map-poi-text' + (linked ? ' wiki-linked' : '');
      txt.textContent = poi.label;
      if (poi.textBold)   txt.style.fontWeight = 'bold';
      if (poi.textItalic) txt.style.fontStyle  = 'italic';
      if (poi.textSize)   txt.style.fontSize   = poi.textSize + 'px';
      if (linked) {
        const entry = state.wikiTitles.find(w =>
          w.worldId === state.ui.activeWorldId && w.title.toLowerCase() === poi.label.trim().toLowerCase()
        );
        if (entry) {
          txt.dataset.wikiId    = entry.id;
          txt.dataset.wikiTitle = entry.title;
        }
        txt.title = 'Wiki-Artikel öffnen';
        txt.addEventListener('click', e => {
          e.stopPropagation();
          if (entry) openWikiFromEvent(entry.id);
        });
      }
      wrap.appendChild(txt);
    }
  } else {
    // Standard POI: icon pin + optional label below
    const icon = document.createElement('span');
    icon.className = 'map-poi-pin';
    icon.innerHTML = poiShapeHtml(poi.poiTypeShape, poi.poiTypeIcon);
    wrap.appendChild(icon);

    if (poi.label) {
      const linked = wikiLinkCheck(poi.label, state.ui.activeWorldId);
      const lbl = document.createElement('span');
      lbl.className   = 'map-poi-label' + (linked ? ' wiki-linked' : '');
      lbl.textContent = poi.label;
      if (linked) {
        const entry = state.wikiTitles.find(w =>
          w.worldId === state.ui.activeWorldId && w.title.toLowerCase() === poi.label.trim().toLowerCase()
        );
        if (entry) {
          lbl.dataset.wikiId    = entry.id;
          lbl.dataset.wikiTitle = entry.title;
        }
        lbl.title = 'Wiki-Artikel öffnen';
        lbl.addEventListener('click', e => {
          e.stopPropagation();
          if (entry) openWikiFromEvent(entry.id);
        });
      }
      wrap.appendChild(lbl);
    }
  }

  wrap.addEventListener('click', e => {
    e.stopPropagation();
    if (state.map.activeTool === 'edit') openPoiDialog(poi.id);
  });

  attachPoiDrag(wrap, poi);
  return wrap;
}

function gesinnungClass(g) {
  if (g === 'FRIENDLY') return 'poi-friendly';
  if (g === 'HOSTILE')  return 'poi-hostile';
  if (g === 'NEUTRAL')  return 'poi-neutral';
  return '';
}

function wikiLinkCheck(label, worldId) {
  if (!label || !state.wikiTitles || !state.wikiTitles.length) return false;
  const lower = label.toLowerCase();
  return state.wikiTitles.some(e => e.worldId === worldId && e.title.toLowerCase() === lower);
}

function bindMapCanvasEvents() {
  const wrap = document.getElementById('map-canvas-wrap');
  if (!wrap || wrap._mapBound) return;
  wrap._mapBound = true;

  // Left-click: ruler or POI placement, using zoom/pan-aware coordinate conversion
  wrap.addEventListener('click', e => {
    if (e.target.closest('.map-poi')) return;
    const { xPct, yPct } = screenToMapPct(e.clientX, e.clientY);

    if (state.map.activeTool === 'ruler') {
      handleRulerClick(xPct, yPct);
    } else if (state.map.activeTool.startsWith('place-')) {
      if (!isFinite(xPct) || !isFinite(yPct)) return;
      state.map.pendingX = xPct;
      state.map.pendingY = yPct;
      openPoiDialog(null);
    }
  });

  // Right-click: suppress context menu; cancel ruler or start pan drag
  wrap.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (state.map.activeTool === 'ruler') {
      state.map.rulerStep  = 0;
      state.map.rulerStart = null;
      renderRuler();
    }
  });

  // Right-click drag: pan the viewport
  wrap.addEventListener('mousedown', e => {
    if (e.button !== 2) return;
    e.preventDefault();
    const startX    = e.clientX;
    const startY    = e.clientY;
    const startPanX = state.map.panX;
    const startPanY = state.map.panY;
    wrap.style.cursor = 'grabbing';

    function onPanMove(e) {
      state.map.panX = startPanX + (e.clientX - startX);
      state.map.panY = startPanY + (e.clientY - startY);
      applyMapViewport();
    }

    function onPanUp() {
      document.removeEventListener('mousemove', onPanMove);
      document.removeEventListener('mouseup',   onPanUp);
      // Restore cursor based on active tool
      const tool = state.map.activeTool;
      wrap.style.cursor = (tool === 'ruler' || tool.startsWith('place-')) ? 'crosshair' : 'grab';
    }

    document.addEventListener('mousemove', onPanMove);
    document.addEventListener('mouseup',   onPanUp);
  });

  // Mouse wheel: zoom in/out
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setMapZoom(state.map.zoom + delta);
  }, { passive: false });
}

/* ══════════════════════════════════════
   MAP — POI DRAG
══════════════════════════════════════ */
function attachPoiDrag(el, poi) {
  const canEdit = state.auth.isAdmin || poi.createdByUserId === state.auth.userId;
  if (!canEdit) return;

  let dragging = false;
  let startX, startY, origLeft, origTop;

  el.addEventListener('mousedown', e => {
    if (state.map.activeTool !== 'interact') return;
    e.preventDefault();
    dragging = false;
    startX    = e.clientX;
    startY    = e.clientY;
    origLeft  = el.style.left;
    origTop   = el.style.top;

    function onMove(e) {
      const wrap = document.getElementById('map-canvas-wrap');
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) dragging = true;
      if (!dragging) return;
      const newX = (parseFloat(origLeft) / 100) + dx / (rect.width  * state.map.zoom);
      const newY = (parseFloat(origTop)  / 100) + dy / (rect.height * state.map.zoom);
      el.style.left = newX * 100 + '%';
      el.style.top  = newY * 100 + '%';
    }

    async function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
      if (!dragging) return;
      const wrap = document.getElementById('map-canvas-wrap');
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newCxFrac = (parseFloat(origLeft) / 100) + dx / (rect.width  * state.map.zoom);
      const newCyFrac = (parseFloat(origTop)  / 100) + dy / (rect.height * state.map.zoom);
      const ib = getImageBoundsInViewport();
      const newX = (newCxFrac - ib.x) / ib.w;
      const newY = (newCyFrac - ib.y) / ib.h;
      try {
        const updated = await api('PUT', `/worlds/${state.ui.activeWorldId}/map/pois/${poi.id}`, { xPct: newX, yPct: newY });
        const idx = state.map.pois.findIndex(p => p.id === poi.id);
        if (idx >= 0) state.map.pois[idx] = updated;
        renderMap();
      } catch (ex) {
        el.style.left = origLeft;
        el.style.top  = origTop;
        alert('Fehler beim Verschieben: ' + ex.message);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

/* ══════════════════════════════════════
   MAP — POI DIALOG
══════════════════════════════════════ */
function openPoiDialog(poiId) {
  state.map.editPoiId = poiId;

  const modal     = document.getElementById('poi-modal');
  const title     = document.getElementById('poi-modal-title');
  const gesGrp    = document.getElementById('poi-gesinnung-grp');
  const delBtn    = document.getElementById('poi-delete-btn');
  const errEl     = document.getElementById('poi-modal-err');
  const wikiHint  = document.getElementById('poi-wiki-hint');
  const labelInp  = document.getElementById('poi-label-inp');

  if (!modal) return;
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (wikiHint) wikiHint.style.display = 'none';

  const textGrp   = document.getElementById('poi-text-grp');
  const boldInp   = document.getElementById('poi-text-bold');
  const italicInp = document.getElementById('poi-text-italic');
  const sizeInp   = document.getElementById('poi-text-size');

  if (poiId) {
    const poi  = state.map.pois.find(p => p.id === poiId);
    if (!poi) return;
    const type   = state.map.poiTypes.find(t => t.id === poi.poiTypeId);
    const isText = type?.shape === 'TEXT';
    title.textContent = (type ? type.icon + ' ' + type.name : 'POI') + ' bearbeiten';
    if (labelInp) labelInp.value = poi.label || '';
    state.map.selectedGesinnung = poi.gesinnung || null;
    if (gesGrp)  gesGrp.style.display  = type?.hasGesinnung ? '' : 'none';
    if (textGrp) textGrp.style.display = isText ? '' : 'none';
    if (isText) {
      if (boldInp)   boldInp.checked = poi.textBold   ?? false;
      if (italicInp) italicInp.checked = poi.textItalic ?? false;
      if (sizeInp)   sizeInp.value   = poi.textSize   ?? 14;
    }
    const canDelete = state.auth.isAdmin || canDeleteActiveWorld();
    if (delBtn) delBtn.style.display = canDelete ? '' : 'none';
  } else {
    const typeId = parseInt(state.map.activeTool.split('-')[1], 10);
    const type   = state.map.poiTypes.find(t => t.id === typeId);
    const isText = type?.shape === 'TEXT';
    title.textContent = (type ? type.icon + ' ' + type.name : 'POI') + ' platzieren';
    if (labelInp) labelInp.value = '';
    state.map.selectedGesinnung = null;
    if (gesGrp)  gesGrp.style.display  = type?.hasGesinnung ? '' : 'none';
    if (textGrp) textGrp.style.display = isText ? '' : 'none';
    if (isText) {
      if (boldInp)   boldInp.checked   = false;
      if (italicInp) italicInp.checked = false;
      if (sizeInp)   sizeInp.value     = 14;
    }
    if (delBtn) delBtn.style.display = 'none';
  }

  updateGesinnungButtons();

  if (labelInp) {
    labelInp.oninput = () => {
      const linked = wikiLinkCheck(labelInp.value.trim(), state.ui.activeWorldId);
      if (wikiHint) wikiHint.style.display = linked ? '' : 'none';
    };
  }

  modal.classList.add('open');
  if (labelInp) labelInp.focus();
}

function updateGesinnungButtons() {
  document.querySelectorAll('.poi-gesinnung-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === state.map.selectedGesinnung);
  });
}

function selectGesinnung(value) {
  state.map.selectedGesinnung = state.map.selectedGesinnung === value ? null : value;
  updateGesinnungButtons();
}

function closePoiModal() {
  const modal = document.getElementById('poi-modal');
  if (modal) modal.classList.remove('open');
  state.map.editPoiId  = null;
  state.map.pendingX   = null;
  state.map.pendingY   = null;
}

async function savePoiModal() {
  const errEl   = document.getElementById('poi-modal-err');
  const labelInp = document.getElementById('poi-label-inp');
  const label   = labelInp ? labelInp.value.trim() : '';

  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  try {
    if (state.map.editPoiId) {
      const poi    = state.map.pois.find(p => p.id === state.map.editPoiId);
      const type   = poi ? state.map.poiTypes.find(t => t.id === poi.poiTypeId) : null;
      const isText = type?.shape === 'TEXT';
      const body   = { label: label || null };
      if (type?.hasGesinnung) body.gesinnung = state.map.selectedGesinnung || null;
      if (isText) {
        body.textBold   = document.getElementById('poi-text-bold')?.checked   ?? false;
        body.textItalic = document.getElementById('poi-text-italic')?.checked ?? false;
        body.textSize   = parseInt(document.getElementById('poi-text-size')?.value || '14', 10);
      }
      const updated = await api('PUT', `/worlds/${state.ui.activeWorldId}/map/pois/${state.map.editPoiId}`, body);
      const idx = state.map.pois.findIndex(p => p.id === state.map.editPoiId);
      if (idx >= 0) state.map.pois[idx] = updated;
    } else {
      if (state.map.pendingX == null || state.map.pendingY == null ||
          !isFinite(state.map.pendingX) || !isFinite(state.map.pendingY)) {
        if (errEl) { errEl.textContent = 'Fehler: Position fehlt – bitte erneut auf die Karte klicken.'; errEl.style.display = ''; }
        return;
      }
      const typeId = parseInt(state.map.activeTool.split('-')[1], 10);
      const type   = state.map.poiTypes.find(t => t.id === typeId);
      const isText = type?.shape === 'TEXT';
      const body = {
        poiTypeId: typeId,
        xPct:      state.map.pendingX,
        yPct:      state.map.pendingY,
        label:     label || null,
        gesinnung: (type?.hasGesinnung && state.map.selectedGesinnung) ? state.map.selectedGesinnung : null,
      };
      if (isText) {
        body.textBold   = document.getElementById('poi-text-bold')?.checked   ?? false;
        body.textItalic = document.getElementById('poi-text-italic')?.checked ?? false;
        body.textSize   = parseInt(document.getElementById('poi-text-size')?.value || '14', 10);
      }
      const created = await api('POST', `/worlds/${state.ui.activeWorldId}/map/pois`, body);
      state.map.pois.push(created);
      setMapTool('interact');
    }
    closePoiModal();
    renderMap();
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.style.display = ''; }
  }
}

async function deleteCurrentPoi() {
  if (!state.map.editPoiId) return;
  if (!confirm('POI wirklich löschen?')) return;
  try {
    await api('DELETE', `/worlds/${state.ui.activeWorldId}/map/pois/${state.map.editPoiId}`);
    state.map.pois = state.map.pois.filter(p => p.id !== state.map.editPoiId);
    closePoiModal();
    renderMap();
  } catch (e) { alert('Fehler: ' + e.message); }
}

/* ══════════════════════════════════════
   MAP — RULER TOOL
══════════════════════════════════════ */
const MAP_CELL_PX = 44;

/** Returns the miles-per-cell scale for the active world (default 5). */
function getMapMilesPerCell() {
  const world = state.worlds.find(w => w.id === state.ui.activeWorldId);
  return (world?.milesPerCell) || 5;
}

function handleRulerClick(xPct, yPct) {
  if (state.map.rulerStep === 0) {
    state.map.rulerStart = { x: xPct, y: yPct };
    state.map.rulerStep  = 1;
    state.map.ruler      = null;
    renderRuler();
  } else {
    const wrap = document.getElementById('map-canvas-wrap');
    if (!wrap) return;
    const rect  = wrap.getBoundingClientRect();
    const dx    = (xPct - state.map.rulerStart.x) * rect.width;
    const dy    = (yPct - state.map.rulerStart.y) * rect.height;
    const miles = (Math.sqrt(dx * dx + dy * dy) / (MAP_CELL_PX * state.map.bgScale)) * getMapMilesPerCell();
    state.map.ruler      = { x1: state.map.rulerStart.x, y1: state.map.rulerStart.y, x2: xPct, y2: yPct, miles };
    state.map.rulerStep  = 0;
    state.map.rulerStart = null;
    renderRuler();
  }
}

function renderRuler() {
  const svg = document.getElementById('map-ruler-svg');
  if (!svg) return;
  // Remove all children except <defs>
  Array.from(svg.childNodes).forEach(n => { if (n.tagName !== 'defs') svg.removeChild(n); });

  const wrap = document.getElementById('map-canvas-wrap');
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();

  // Waiting for second click — show start dot
  if (state.map.rulerStep === 1 && state.map.rulerStart) {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', state.map.rulerStart.x * rect.width);
    c.setAttribute('cy', state.map.rulerStart.y * rect.height);
    c.setAttribute('r',  5);
    c.setAttribute('fill', 'var(--gold)');
    c.setAttribute('opacity', '0.85');
    svg.appendChild(c);
    return;
  }

  if (!state.map.ruler) return;
  const { x1, y1, x2, y2, miles } = state.map.ruler;
  const px1 = x1 * rect.width,  py1 = y1 * rect.height;
  const px2 = x2 * rect.width,  py2 = y2 * rect.height;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', px1); line.setAttribute('y1', py1);
  line.setAttribute('x2', px2); line.setAttribute('y2', py2);
  line.setAttribute('stroke', 'var(--gold)');
  line.setAttribute('stroke-width', '2');
  line.setAttribute('stroke-dasharray', '6 3');
  line.setAttribute('marker-start', 'url(#ruler-dot)');
  line.setAttribute('marker-end',   'url(#ruler-dot)');
  svg.appendChild(line);

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', (px1 + px2) / 2);
  text.setAttribute('y', (py1 + py2) / 2 - 8);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('fill', 'var(--gold)');
  text.setAttribute('font-size', '12');
  text.setAttribute('font-weight', 'bold');
  text.textContent = miles < 10
    ? miles.toFixed(1) + ' Meilen'
    : Math.round(miles) + ' Meilen';
  svg.appendChild(text);
}

/* ══════════════════════════════════════
   MAP — POI TYPE MANAGER (Admin)
══════════════════════════════════════ */
const POI_ICON_PALETTE = ['⭐','●','?','▲','🏰','⛪','🌲','🌊','🏔','🗡','💀','🔥','🏺','💎','🐉','🚢','🌙','☀','🌿'];

/**
 * Returns the inner HTML for a POI symbol — inline SVG for shaped types, escaped emoji for ICON.
 * @param {string} shape  - 'STAR', 'CIRCLE', 'TRIANGLE', 'QUESTION', or 'ICON'
 * @param {string} icon   - emoji fallback used when shape is 'ICON'
 */
function poiShapeHtml(shape, icon) {
  switch (shape) {
    case 'STAR':
      return `<svg viewBox="0 0 28 28" width="28" height="28" xmlns="http://www.w3.org/2000/svg"><polygon points="14,3 16.9,10 24.5,10.6 18.8,15.6 20.5,22.9 14,19 7.5,22.9 9.2,15.6 3.5,10.6 11.1,10" fill="currentColor"/></svg>`;
    case 'CIRCLE':
      return `<svg viewBox="0 0 28 28" width="17" height="17" xmlns="http://www.w3.org/2000/svg"><circle cx="14" cy="14" r="11" fill="currentColor"/></svg>`;
    case 'TRIANGLE':
      return `<svg viewBox="0 0 28 28" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><polygon points="14,3 25,23 3,23" fill="currentColor"/></svg>`;
    case 'QUESTION':
      return `<svg viewBox="0 0 28 28" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><text x="14" y="21" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor">?</text></svg>`;
    default:
      return escHtml(icon || '●');
  }
}

function openPoiTypeManager(editTypeId) {
  const modal      = document.getElementById('poi-type-modal');
  const title      = document.getElementById('poi-type-modal-title');
  const nameInp    = document.getElementById('ptm-name');
  const iconCustom = document.getElementById('ptm-icon-custom');
  const hasGes     = document.getElementById('ptm-has-gesinnung');
  const hasLbl     = document.getElementById('ptm-has-label');
  const delBtn     = document.getElementById('ptm-delete-btn');
  const palette    = document.getElementById('ptm-icon-palette');

  if (!modal || !title) return;

  if (palette) {
    palette.innerHTML = POI_ICON_PALETTE.map(ic =>
      `<button class="ptm-icon-chip" data-icon="${ic}" onclick="selectPtmIcon('${ic}')" title="${ic}">${ic}</button>`
    ).join('');
  }

  if (editTypeId) {
    const t = state.map.poiTypes.find(x => x.id === editTypeId);
    if (!t) return;
    modal.dataset.editTypeId = editTypeId;
    title.textContent        = t.name + ' bearbeiten';
    if (nameInp)    nameInp.value    = t.name;
    if (iconCustom) iconCustom.value = POI_ICON_PALETTE.includes(t.icon) ? '' : t.icon;
    if (hasGes)     hasGes.checked   = t.hasGesinnung;
    if (hasLbl)     hasLbl.checked   = t.hasLabel;
    selectPtmShape(t.shape || 'ICON');
    selectPtmIcon(t.icon);
    if (delBtn) delBtn.style.display = t.isDefault ? 'none' : '';
  } else {
    delete modal.dataset.editTypeId;
    title.textContent = 'POI-Typ anlegen';
    if (nameInp)    nameInp.value    = '';
    if (iconCustom) iconCustom.value = '';
    if (hasGes)     hasGes.checked   = true;
    if (hasLbl)     hasLbl.checked   = true;
    if (palette)    palette.querySelectorAll('.ptm-icon-chip').forEach(b => b.classList.remove('active'));
    selectPtmShape('ICON');
    if (delBtn)     delBtn.style.display = 'none';
  }

  modal.classList.add('open');
  if (nameInp) nameInp.focus();
}

function selectPtmShape(shape) {
  document.querySelectorAll('.ptm-shape-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.shape === shape);
  });
  const iconGrp = document.getElementById('ptm-icon-grp');
  if (iconGrp) iconGrp.style.display = shape === 'ICON' ? '' : 'none';
}

function selectPtmIcon(icon) {
  document.querySelectorAll('.ptm-icon-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.icon === icon);
  });
  // If it's a custom icon, clear the chip selection and populate the custom field
  const iconCustom = document.getElementById('ptm-icon-custom');
  if (iconCustom && !POI_ICON_PALETTE.includes(icon)) iconCustom.value = icon;
}

function closePoiTypeModal() {
  const modal = document.getElementById('poi-type-modal');
  if (modal) modal.classList.remove('open');
}

async function savePoiTypeModal() {
  const modal      = document.getElementById('poi-type-modal');
  const nameInp    = document.getElementById('ptm-name');
  const iconCustom = document.getElementById('ptm-icon-custom');
  const hasGes     = document.getElementById('ptm-has-gesinnung');
  const hasLbl     = document.getElementById('ptm-has-label');

  const name = nameInp?.value.trim();
  if (!name) { alert('Bitte einen Namen eingeben.'); return; }

  const selectedChip  = document.querySelector('.ptm-icon-chip.active');
  const icon          = selectedChip ? selectedChip.dataset.icon : (iconCustom?.value.trim() || '●');
  const selectedShape = document.querySelector('.ptm-shape-chip.active')?.dataset.shape || 'ICON';

  const body = {
    name,
    icon,
    shape:        selectedShape,
    hasGesinnung: hasGes?.checked ?? true,
    hasLabel:     hasLbl?.checked ?? true,
  };

  try {
    const editTypeId = modal?.dataset.editTypeId ? parseInt(modal.dataset.editTypeId, 10) : null;
    let result;
    if (editTypeId) {
      result = await api('PUT', `/poi-types/${editTypeId}`, body);
      const idx = state.map.poiTypes.findIndex(t => t.id === editTypeId);
      if (idx >= 0) state.map.poiTypes[idx] = result;
    } else {
      result = await api('POST', '/poi-types', body);
      state.map.poiTypes.push(result);
    }
    closePoiTypeModal();
    renderPoiTypeSidebar();
    renderMap();
  } catch (e) { alert('Fehler: ' + e.message); }
}

async function deletePoiType() {
  const modal      = document.getElementById('poi-type-modal');
  const editTypeId = modal?.dataset.editTypeId ? parseInt(modal.dataset.editTypeId, 10) : null;
  if (!editTypeId) return;
  if (!confirm('POI-Typ wirklich löschen? Bestehende POIs dieses Typs bleiben erhalten.')) return;
  try {
    await api('DELETE', `/poi-types/${editTypeId}`);
    state.map.poiTypes = state.map.poiTypes.filter(t => t.id !== editTypeId);
    closePoiTypeModal();
    renderPoiTypeSidebar();
  } catch (e) { alert('Fehler: ' + e.message); }
}
