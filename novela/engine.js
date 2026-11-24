/* Motor de la demo: intro, casa, HUD, guardado y editor. */
(function () {
  "use strict";

  const TYPE_MS = 26;
  const TZ = "America/Lima";
  const $ = (id) => document.getElementById(id);

  const state = {
    phase: null,
    location: HOUSE.start,
    name: "",
    bars: { ...HOUSE.startBars },
    lineIndex: 0,
    talking: null,
    talkLines: [],
    conv: null,
    nodeId: null,
    typing: false,
    typedFull: "",
    typeTimer: null,
    savesMode: "load",
    pendingConfirm: null,
    currentBgKey: null
  };

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function waitOrTap(ms, el, minIgnore) {
    return new Promise((resolve) => {
      let done = false;
      const start = Date.now();
      const finish = (ev) => {
        if (done) return;
        if (ev && minIgnore && Date.now() - start < minIgnore) return;
        done = true;
        clearTimeout(timer);
        if (el) el.removeEventListener("pointerup", finish);
        resolve();
      };
      const timer = setTimeout(() => finish(), ms);
      if (el) el.addEventListener("pointerup", finish);
    });
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => {
      const on = s.id === "screen-" + id;
      s.classList.toggle("is-on", on);
      s.setAttribute("aria-hidden", on ? "false" : "true");
    });
  }
  function hideModals() {
    ["modal-menu", "modal-saves", "modal-confirm", "modal-map"].forEach((id) => {
      $(id).hidden = true;
    });
  }

  function clamp(n) {
    return Math.max(0, Math.min(HOUSE.barsMax, Math.round(n)));
  }

  /* ---------- Saves ---------- */
  function emptySaves() {
    return { autosave: null, slots: [null, null, null] };
  }
  function readSaves() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return emptySaves();
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.slots)) return emptySaves();
      while (data.slots.length < 3) data.slots.push(null);
      return data;
    } catch {
      return emptySaves();
    }
  }
  function writeSaves(data) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    refreshTitleButtons();
  }
  function locationLabel() {
    if (state.phase === "intro") return INTRO.name;
    const loc = locById(state.location);
    return loc ? loc.name : "Casa";
  }
  function snapshot() {
    return {
      name: state.name,
      location: state.location,
      bars: { ...state.bars },
      phase: state.phase,
      lineIndex: state.lineIndex,
      sceneName: (state.name ? state.name + " · " : "") + locationLabel(),
      updated: Date.now()
    };
  }
  function autosave() {
    if (!state.phase) return;
    const data = readSaves();
    data.autosave = snapshot();
    writeSaves(data);
  }
  function saveToSlot(i) {
    const data = readSaves();
    data.slots[i] = snapshot();
    writeSaves(data);
  }
  function latestSave() {
    const data = readSaves();
    const all = [data.autosave, ...data.slots].filter(Boolean);
    if (!all.length) return null;
    return all.sort((a, b) => b.updated - a.updated)[0];
  }
  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleString("es-PE", {
        timeZone: TZ,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return new Date(ts).toLocaleString("es-PE");
    }
  }
  function refreshTitleButtons() {
    $("btn-continuar").disabled = !latestSave();
  }

  /* ---------- Toast / HUD ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 2400);
  }
  function renderHUD() {
    ["energia", "fuerza", "aprendizaje"].forEach((k) => {
      const v = clamp(state.bars[k]);
      state.bars[k] = v;
      $("fill-" + k).style.width = v + "%";
      $("val-" + k).textContent = String(v);
    });
    const loc = locById(state.location);
    $("loc-name").textContent = loc ? loc.name : "";
  }

  /* ---------- Media / backgrounds ---------- */
  function clearVideo() {
    const video = $("bg-video");
    video.pause();
    video.removeAttribute("src");
    video.classList.remove("has-src");
    video.load();
  }
  function setImg(src) {
    const img = $("bg-img");
    if (!src) {
      img.removeAttribute("src");
      img.classList.add("is-missing");
      return;
    }
    img.classList.remove("is-missing");
    img.onload = () => img.classList.remove("is-missing");
    img.onerror = () => img.classList.add("is-missing");
    img.src = src;
  }
  async function applyLocationVisual(locId, fallbackImage) {
    const layer = $("bg-layer");
    layer.className = "bg-layer bg-cafe";
    $("game-shade").classList.add("is-house");
    clearVideo();
    const custom = await MediaStore.mediaFor(locId);
    if (custom.videoURL) {
      setImg("");
      const video = $("bg-video");
      video.src = custom.videoURL;
      video.classList.add("has-src");
      video.play().catch(() => {});
      return;
    }
    setImg(custom.imageURL || fallbackImage || "");
  }
  let spriteOn = "a";
  let currentExpr = null;
  let spriteVisible = false;
  let exprTicket = 0;

  function lineWho(line) {
    return (line && (line.who || line.speaker)) || "";
  }
  function lineExpr(line) {
    return (line && line.expr) || "neutral";
  }
  function charIdFromName(name) {
    const n = String(name || "").trim().toLowerCase();
    if (CHARACTERS[n]) return n;
    const found = Object.keys(CHARACTERS).find((k) => CHARACTERS[k].name.toLowerCase() === n);
    return found || (n === "eva" ? "eva" : "");
  }
  async function resolveExprUrl(charId, expr) {
    expr = expr || "neutral";
    const custom = await MediaStore.mediaFor(mediaKey(charId, expr));
    if (custom.imageURL) return custom.imageURL;
    if (expr === "neutral") {
      const legacy = await MediaStore.mediaFor(charId);
      if (legacy.imageURL) return legacy.imageURL;
    }
    return exprAsset(charId, expr) || EVA.image;
  }
  async function setExpression(charId, expr, opts) {
    expr = expr || "neutral";
    const ticket = ++exprTicket;
    const layer = $("sprite-layer");
    const url = await resolveExprUrl(charId, expr);
    if (ticket !== exprTicket) return;
    const a = $("sprite-eva-a");
    const b = $("sprite-eva-b");
    const instant = !spriteVisible || (opts && opts.instant) || currentExpr === expr;
    const visible = spriteOn === "a" ? a : b;
    if (spriteVisible && currentExpr === expr && visible.getAttribute("src") === url) {
      layer.hidden = false;
      return;
    }
    const incoming = spriteOn === "a" ? b : a;
    const outgoing = spriteOn === "a" ? a : b;
    incoming.alt = (CHARACTERS[charId] && CHARACTERS[charId].name) || "Eva";
    incoming.removeAttribute("src");
    incoming.src = url;
    incoming.hidden = false;
    const ready = new Promise((res) => {
      if (incoming.complete && incoming.naturalWidth && incoming.getAttribute("src") === url) res();
      else {
        incoming.onload = () => res();
        incoming.onerror = () => res();
      }
    });
    await ready;
    if (ticket !== exprTicket) return;
    incoming.classList.add("is-on");
    outgoing.classList.remove("is-on");
    if (instant) outgoing.hidden = true;
    else setTimeout(() => { if (!outgoing.classList.contains("is-on")) outgoing.hidden = true; }, 300);
    spriteOn = incoming === a ? "a" : "b";
    currentExpr = expr;
    spriteVisible = true;
    layer.hidden = false;
  }
  async function showEvaSprite(on, expr) {
    const layer = $("sprite-layer");
    if (!on) {
      exprTicket += 1;
      layer.hidden = true;
      $("sprite-eva-a").classList.remove("is-on");
      $("sprite-eva-b").classList.remove("is-on");
      spriteVisible = false;
      currentExpr = null;
      return;
    }
    await setExpression("eva", expr || currentExpr || "neutral", { instant: !spriteVisible });
  }

  function currentNode() {
    if (!state.conv || !state.nodeId) return null;
    return (state.conv.nodes && state.conv.nodes[state.nodeId]) || null;
  }
  function normalizeTalk(talk) {
    if (!talk) return null;
    if (Array.isArray(talk)) return { start: "main", nodes: { main: { lines: talk } } };
    return talk;
  }

  /* ---------- Typewriter ---------- */
  function stopTyping() {
    if (state.typeTimer) {
      clearTimeout(state.typeTimer);
      state.typeTimer = null;
    }
    state.typing = false;
  }
  function showDialogue(on) {
    $("dialogue").hidden = !on;
  }
  function showFullLine() {
    stopTyping();
    $("line").textContent = state.typedFull;
    const last = state.lineIndex >= state.talkLines.length - 1;
    const node = currentNode();
    const hasChoices = last && node && node.choices && node.choices.length;
    $("click-hint").hidden = last;
    if (state.phase === "intro") $("click-hint").hidden = last;
    if (hasChoices) showNodeChoices(node.choices);
  }
  function typeLine(text) {
    stopTyping();
    state.typedFull = text;
    state.typing = true;
    $("line").textContent = "";
    $("click-hint").hidden = true;
    const tick = () => {
      if (!state.typing) return;
      const i = $("line").textContent.length;
      if (i >= text.length) {
        showFullLine();
        return;
      }
      $("line").textContent = text.slice(0, i + 1);
      const ch = text[i];
      const delay = ".,;:!?…".indexOf(ch) !== -1 ? 180 : TYPE_MS;
      state.typeTimer = setTimeout(tick, delay);
    };
    tick();
  }
  function playLine() {
    const line = state.talkLines[state.lineIndex];
    if (!line) return;
    const who = lineWho(line);
    const speaker = $("speaker");
    if (who) {
      speaker.hidden = false;
      speaker.textContent = who;
    } else {
      speaker.hidden = true;
      speaker.textContent = "";
    }
    const cid = charIdFromName(who);
    if (cid) showEvaSprite(true, lineExpr(line));
    showDialogue(true);
    typeLine(fillName(line.text, state.name));
    if (state.phase === "intro") autosave();
  }

  /* ---------- Intro after name ---------- */
  function startIntroStory() {
    state.phase = "intro";
    state.location = HOUSE.start;
    state.lineIndex = 0;
    state.talking = "intro";
    state.talkLines = INTRO.lines;
    state.bars = { ...HOUSE.startBars };
    hideModals();
    showScreen("game");
    $("hud").hidden = true;
    $("action-bar").hidden = true;
    $("btn-saltar").hidden = false;
    $("end-card").hidden = true;
    applyLocationVisual("intro", INTRO.image).then(() => applyLocationVisual("cuarto", locById("cuarto").image));
    // Prefer custom intro media; if none, cuarto is already the intro default.
    MediaStore.mediaFor("intro").then((m) => {
      if (m.videoURL || m.imageURL) applyLocationVisual("intro", INTRO.image);
    });
    showEvaSprite(false);
    playLine();
  }
  function enterHouse(locId, opts) {
    const loc = locById(locId) || locById(HOUSE.start);
    const charge = !!(opts && opts.chargeMove);
    if (charge && locId !== state.location) {
      if (state.bars.energia < HOUSE.moveCost) {
        toast("No tienes suficiente energía. Deberías dormir o comer.");
        return;
      }
      state.bars.energia = clamp(state.bars.energia - HOUSE.moveCost);
    }
    state.phase = "house";
    state.location = loc.id;
    state.lineIndex = 0;
    state.talking = null;
    state.talkLines = [];
    stopTyping();
    hideModals();
    showScreen("game");
    $("btn-saltar").hidden = true;
    $("hud").hidden = false;
    $("end-card").hidden = true;
    showDialogue(false);
    $("game-shade").classList.add("is-house");
    renderHUD();
    applyLocationVisual(loc.id, loc.image);
    const evaHere = HOUSE.evaIn.indexOf(loc.id) !== -1;
    if (evaHere) showEvaSprite(true, "neutral");
    else showEvaSprite(false);
    renderActions(loc, evaHere);
    autosave();
  }
  function renderActions(loc, evaHere) {
    const bar = $("action-bar");
    bar.innerHTML = "";
    const mapBtn = document.createElement("button");
    mapBtn.type = "button";
    mapBtn.className = "chip chip-map";
    mapBtn.textContent = "Mapa";
    mapBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openMap();
    });
    bar.appendChild(mapBtn);
    if (evaHere) {
      const talk = document.createElement("button");
      talk.type = "button";
      talk.className = "chip";
      talk.textContent = "Hablar con Eva";
      talk.addEventListener("click", (e) => {
        e.stopPropagation();
        startTalk(EVA.talk[loc.id] || []);
      });
      bar.appendChild(talk);
    }
    (loc.actions || []).forEach((act) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = act.label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        doAction(act);
      });
      bar.appendChild(b);
    });
    bar.hidden = false;
  }
  function doAction(act) {
    const cost = act.energia && act.energia < 0 ? -act.energia : 0;
    if (cost && state.bars.energia < cost) {
      toast("No tienes suficiente energía.");
      return;
    }
    if (act.energia) state.bars.energia = clamp(state.bars.energia + act.energia);
    if (act.fuerza) state.bars.fuerza = clamp(state.bars.fuerza + act.fuerza);
    if (act.aprendizaje) state.bars.aprendizaje = clamp(state.bars.aprendizaje + act.aprendizaje);
    renderHUD();
    autosave();
    startTalk([{ speaker: "", text: act.text }]);
  }
  function showNodeChoices(choices) {
    const box = $("choices");
    box.innerHTML = "";
    choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = fillName(c.text, state.name);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        startNode(c.next);
      });
      box.appendChild(btn);
    });
    box.hidden = false;
    $("click-hint").hidden = true;
  }
  function startNode(id) {
    const node = state.conv && state.conv.nodes && state.conv.nodes[id];
    if (!node) return;
    state.nodeId = id;
    state.talking = "talk";
    state.talkLines = node.lines || [];
    state.lineIndex = 0;
    $("choices").hidden = true;
    $("choices").innerHTML = "";
    $("action-bar").hidden = true;
    $("end-card").hidden = true;
    playLine();
  }
  function startTalk(talk, nodeId) {
    const conv = normalizeTalk(talk);
    if (!conv) return;
    state.conv = conv;
    startNode(nodeId || conv.start);
  }
  function endTalk() {
    state.talking = null;
    state.talkLines = [];
    state.conv = null;
    state.nodeId = null;
    $("choices").hidden = true;
    $("choices").innerHTML = "";
    showDialogue(false);
    const loc = locById(state.location);
    const evaHere = HOUSE.evaIn.indexOf(state.location) !== -1;
    if (evaHere) showEvaSprite(true, "neutral");
    else showEvaSprite(false);
    renderActions(loc, evaHere);
    autosave();
  }

  function advance() {
    if (!$("screen-game").classList.contains("is-on")) return;
    if (!$("modal-menu").hidden || !$("modal-saves").hidden || !$("modal-confirm").hidden || !$("modal-map").hidden) return;
    if (!$("end-card").hidden) return;
    if ($("dialogue").hidden) return;
    if (!$("choices").hidden) return;

    if (state.typing) {
      showFullLine();
      return;
    }
    if (state.lineIndex < state.talkLines.length - 1) {
      state.lineIndex += 1;
      playLine();
      return;
    }
    const node = currentNode();
    if (node && node.choices && node.choices.length) {
      showNodeChoices(node.choices);
      return;
    }
    if (state.phase === "intro") {
      enterHouse(HOUSE.start);
      return;
    }
    endTalk();
  }

  /* ---------- Map ---------- */
  function openMap() {
    const box = $("map-floors");
    box.innerHTML = "";
    const floors = [
      { label: "Piso 2", ids: ["cuarto", "pasillo", "cuarto_eva", "estudio", "bano"] },
      { label: "Piso 1", ids: ["escaleras", "sala", "cocina", "lavanderia", "jardin", "cochera"] }
    ];
    floors.forEach((f) => {
      const locs = f.ids.map((id) => locById(id)).filter(Boolean);
      if (!locs.length) return;
      const wrap = document.createElement("div");
      const lab = document.createElement("p");
      lab.className = "map-floor-label";
      lab.textContent = f.label;
      const grid = document.createElement("div");
      grid.className = "map-grid map-cols-" + locs.length;
      locs.forEach((loc) => {
        const t = document.createElement("button");
        t.type = "button";
        t.className = "map-tile" + (loc.id === state.location ? " is-here" : "");
        t.style.backgroundImage = "url('" + loc.image + "')";
        const span = document.createElement("span");
        const shortNames = {
          pasillo: "Pasillo",
          cuarto_eva: "Cuarto Eva",
          jardin: "Jardín",
          lavanderia: "Lavandería",
          cuarto: "Tu cuarto"
        };
        span.textContent = shortNames[loc.id] || loc.name;
        t.appendChild(span);
        MediaStore.mediaFor(loc.id).then((m) => {
          if (m.imageURL) t.style.backgroundImage = "url('" + m.imageURL + "')";
        });
        t.addEventListener("click", () => {
          if (loc.id === state.location) {
            $("modal-map").hidden = true;
            return;
          }
          $("modal-map").hidden = true;
          enterHouse(loc.id, { chargeMove: true });
        });
        grid.appendChild(t);
      });
      wrap.appendChild(lab);
      wrap.appendChild(grid);
      box.appendChild(wrap);
    });
    $("modal-map").hidden = false;
  }

  /* ---------- Name / new game ---------- */
  function openName() {
    hideModals();
    $("input-nombre").value = "";
    $("btn-nombre").disabled = true;
    showScreen("name");
    setTimeout(() => $("input-nombre").focus(), 300);
  }
  function confirmName() {
    const name = $("input-nombre").value.trim().replace(/\s+/g, " ");
    if (name.length < 1) return;
    state.name = name.slice(0, 20);
    startIntroStory();
  }

  function applySnapshot(snap) {
    if (!snap) return;
    state.name = snap.name || "Tú";
    state.bars = { energia: 70, fuerza: 30, aprendizaje: 30, ...(snap.bars || {}) };
    state.location = snap.location || HOUSE.start;
    state.phase = snap.phase || "house";
    state.lineIndex = snap.lineIndex || 0;
    hideModals();
    if (state.phase === "intro") {
      startIntroStory();
      state.lineIndex = Math.min(snap.lineIndex || 0, INTRO.lines.length - 1);
      playLine();
    } else {
      enterHouse(state.location);
    }
  }

  /* ---------- Save UI (same 3 slots + autosave) ---------- */
  function slotButton(label, rec, { disabled, onClick }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "save-slot" + (rec ? "" : " is-empty");
    btn.disabled = !!disabled;
    const date = rec ? formatDate(rec.updated) : "";
    btn.innerHTML = '<span class="slot-label"></span><span class="slot-name"></span>' + (date ? '<span class="slot-date"></span>' : "");
    btn.querySelector(".slot-label").textContent = label;
    btn.querySelector(".slot-name").textContent = rec ? rec.sceneName : "Vacío";
    if (date) btn.querySelector(".slot-date").textContent = date;
    if (onClick && !disabled) btn.addEventListener("click", onClick);
    return btn;
  }
  function openSaves(mode) {
    state.savesMode = mode;
    $("saves-title").textContent = mode === "save" ? "Guardar partida" : "Cargar partida";
    const list = $("saves-list");
    list.innerHTML = "";
    const data = readSaves();
    if (mode === "load") {
      list.appendChild(slotButton("Autoguardado", data.autosave, { disabled: !data.autosave, onClick: () => applySnapshot(data.autosave) }));
    } else if (data.autosave) {
      list.appendChild(slotButton("Autoguardado", data.autosave, { disabled: true, onClick: null }));
    }
    data.slots.forEach((rec, i) => {
      list.appendChild(
        slotButton("Ranura " + (i + 1), rec, {
          disabled: mode === "load" && !rec,
          onClick: () => {
            if (mode === "load") {
              applySnapshot(rec);
              return;
            }
            if (rec) {
              askConfirm("¿Sobrescribir esta partida?", () => {
                saveToSlot(i);
                openSaves("save");
              });
            } else {
              saveToSlot(i);
              openSaves("save");
            }
          }
        })
      );
    });
    $("modal-saves").hidden = false;
    $("modal-menu").hidden = true;
  }
  function askConfirm(text, fn) {
    $("confirm-text").textContent = text;
    state.pendingConfirm = fn;
    $("modal-confirm").hidden = false;
  }

  /* ---------- Editor ---------- */
  function openPin() {
    $("input-pin").value = "";
    $("pin-error").hidden = true;
    showScreen("pin");
    setTimeout(() => $("input-pin").focus(), 300);
  }
  function tryPin() {
    const v = $("input-pin").value.trim();
    if (v === EDITOR_PIN) {
      $("pin-error").hidden = true;
      openEditor();
    } else {
      $("pin-error").hidden = false;
    }
  }
  async function openEditor() {
    showScreen("editor");
    await renderEditor();
  }
  function fileButton(label, accept, onFile) {
    const lab = document.createElement("label");
    lab.className = "file-btn";
    lab.textContent = label;
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = accept;
    inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      await onFile(f);
    });
    lab.appendChild(inp);
    return lab;
  }
  async function renderExprSlot(item) {
    const media = await MediaStore.mediaFor(item.id);
    const slot = document.createElement("div");
    slot.className = "expr-slot";
    const lab = document.createElement("p");
    lab.textContent = EXPR_LABELS[item.expr] || item.name;
    slot.appendChild(lab);
    const img = document.createElement("img");
    img.className = "prev prev-sprite";
    img.alt = lab.textContent;
    img.src = media.imageURL || item.defaultImage;
    slot.appendChild(img);
    const actions = document.createElement("div");
    actions.className = "editor-actions";
    actions.appendChild(fileButton("Agregar imagen", "image/*", async (f) => {
      await MediaStore.put(item.id, "image", f, f.name);
      await renderEditor();
    }));
    if (media.image) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn-ghost btn-tiny";
      rm.textContent = "Quitar";
      rm.addEventListener("click", async () => {
        await MediaStore.remove(item.id, "image");
        await renderEditor();
      });
      actions.appendChild(rm);
    }
    slot.appendChild(actions);
    return slot;
  }
  async function renderMediaCard(item) {
    const media = await MediaStore.mediaFor(item.id);
    const card = document.createElement("article");
    card.className = "editor-card";
    const h = document.createElement("h3");
    h.textContent = item.name;
    card.appendChild(h);
    const pre = document.createElement("div");
    pre.className = "editor-previews";
    const img = document.createElement("img");
    img.className = "prev" + (item.kind === "sprite" || item.kind === "expression" ? " prev-sprite" : "");
    img.alt = "";
    img.src = media.imageURL || item.defaultImage;
    pre.appendChild(img);
    if (media.videoURL) {
      const vid = document.createElement("video");
      vid.className = "prev";
      vid.src = media.videoURL;
      vid.muted = true;
      vid.playsInline = true;
      pre.appendChild(vid);
    }
    card.appendChild(pre);
    const actions = document.createElement("div");
    actions.className = "editor-actions";
    actions.appendChild(fileButton("Agregar imagen", "image/*", async (f) => {
      await MediaStore.put(item.id, "image", f, f.name);
      await renderEditor();
    }));
    actions.appendChild(fileButton("Agregar video", "video/*", async (f) => {
      await MediaStore.put(item.id, "video", f, f.name);
      await renderEditor();
    }));
    if (media.image || media.video) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn btn-ghost btn-tiny";
      rm.textContent = "Quitar";
      rm.addEventListener("click", async () => {
        if (media.image) await MediaStore.remove(item.id, "image");
        if (media.video) await MediaStore.remove(item.id, "video");
        await renderEditor();
      });
      actions.appendChild(rm);
    }
    card.appendChild(actions);
    return card;
  }
  async function renderEditor() {
    const list = $("editor-list");
    list.innerHTML = "";
    const intro = EDITOR_ITEMS.find((i) => i.kind === "intro");
    if (intro) list.appendChild(await renderMediaCard(intro));

    const exprItems = EDITOR_ITEMS.filter((i) => i.kind === "expression");
    const byChar = {};
    exprItems.forEach((i) => {
      (byChar[i.character] = byChar[i.character] || []).push(i);
    });
    for (const charId of Object.keys(byChar)) {
      const ch = CHARACTERS[charId] || { name: charId };
      const card = document.createElement("article");
      card.className = "editor-card editor-character";
      const h = document.createElement("h3");
      h.textContent = ch.name + " — expresiones";
      card.appendChild(h);
      const grid = document.createElement("div");
      grid.className = "expr-grid";
      for (const item of byChar[charId]) {
        grid.appendChild(await renderExprSlot(item));
      }
      card.appendChild(grid);
      list.appendChild(card);
    }

    for (const item of EDITOR_ITEMS.filter((i) => i.kind === "location")) {
      list.appendChild(await renderMediaCard(item));
    }
  }
  async function exportMedia() {
    toast("Preparando archivo…");
    try {
      const pack = await MediaStore.exportArchive();
      MediaStore.downloadBlob(pack.blob, pack.filename);
      toast(pack.filename.endsWith(".zip") ? "Descarga lista." : "Se exportó en JSON (sin librería zip).");
    } catch (err) {
      console.error(err);
      toast("No se pudo exportar.");
    }
  }

  /* ---------- Boot intro (unchanged sequence) ---------- */
  async function playBoot() {
    const params = new URLSearchParams(location.search);
    const demo = params.get("demo");
    if (demo === "warning") { showScreen("warning"); return; }
    if (demo === "powered") { showScreen("powered"); return; }
    if (demo === "legal") { showScreen("legal"); return; }
    if (demo === "title") { showScreen("title"); refreshTitleButtons(); return; }
    if (demo === "closed") { showScreen("closed"); return; }
    if (demo === "name") { openName(); return; }
    if (demo === "editor") { openEditor(); return; }
    if (demo === "house" || demo === "map" || demo === "talk" || demo === "enojada" || demo === "enamorada" || demo === "triste") {
      state.name = "Doc";
      state.bars = { ...HOUSE.startBars };
      if (demo === "talk" || demo === "enojada" || demo === "enamorada" || demo === "triste") {
        enterHouse("cocina");
        if (demo === "enojada") startTalk(EVA.talk.cocina, "enojo");
        else if (demo === "enamorada") startTalk(EVA.talk.cocina, "cariño");
        else startTalk(EVA.talk.cocina);
        if (demo === "triste") {
          state.lineIndex = 2;
          playLine();
        }
      } else {
        enterHouse("cuarto");
        if (demo === "map") openMap();
      }
      return;
    }
    if (demo === "game") {
      state.name = "Doc";
      startIntroStory();
      return;
    }

    showScreen("black");
    await wait(1500);
    showScreen("warning");
  }
  function goPowered() {
    showScreen("powered");
    waitOrTap(3200, $("screen-powered"), 400).then(goLegal);
  }
  function goLegal() {
    showScreen("legal");
    waitOrTap(4000, $("screen-legal"), 400).then(goTitle);
  }
  async function goTitle() {
    showScreen("black");
    await wait(900);
    refreshTitleButtons();
    showScreen("title");
  }
  function closeGame() {
    showScreen("closed");
    try { window.close(); } catch (e) { /* ignore */ }
    setTimeout(() => { try { window.close(); } catch (e) { /* ignore */ } }, 400);
  }

  /* ---------- Landscape lock + portrait overlay ---------- */
  function isPortraitPhone() {
    try {
      return window.matchMedia("(orientation: portrait) and (max-width: 900px)").matches;
    } catch (e) {
      return window.innerHeight > window.innerWidth && window.innerWidth <= 900;
    }
  }
  function updateRotateOverlay() {
    const el = $("rotate-overlay");
    if (!el) return;
    el.classList.toggle("is-visible", isPortraitPhone());
  }
  function tryLockLandscape() {
    try {
      const root = document.documentElement;
      const req = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen;
      if (req && !document.fullscreenElement && !document.webkitFullscreenElement) {
        Promise.resolve(req.call(root)).catch(() => {});
      }
    } catch (e) { /* ignore */ }
    try {
      const ori = screen.orientation || screen.mozOrientation || screen.msOrientation;
      if (ori && typeof ori.lock === "function") {
        ori.lock("landscape").catch(() => {});
      } else if (typeof screen.lockOrientation === "function") {
        screen.lockOrientation("landscape");
      }
    } catch (e) { /* ignore */ }
  }

  function bind() {
    updateRotateOverlay();
    window.addEventListener("orientationchange", updateRotateOverlay);
    window.addEventListener("resize", updateRotateOverlay);
    let lockTried = false;
    document.addEventListener("pointerup", () => {
      if (lockTried) return;
      lockTried = true;
      tryLockLandscape();
    }, true);

    $("btn-yes").addEventListener("click", (e) => { e.stopPropagation(); goPowered(); });
    $("btn-no").addEventListener("click", (e) => { e.stopPropagation(); closeGame(); });
    $("btn-jugar").addEventListener("click", openName);
    $("btn-continuar").addEventListener("click", () => {
      const snap = latestSave();
      if (snap) applySnapshot(snap);
    });
    $("btn-editor-lock").addEventListener("click", (e) => { e.stopPropagation(); openPin(); });

    $("input-nombre").addEventListener("input", () => {
      $("btn-nombre").disabled = $("input-nombre").value.trim().length < 1;
    });
    $("input-nombre").addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmName();
    });
    $("btn-nombre").addEventListener("click", confirmName);
    $("btn-nombre-atras").addEventListener("click", () => { refreshTitleButtons(); showScreen("title"); });

    $("btn-pin").addEventListener("click", tryPin);
    $("input-pin").addEventListener("keydown", (e) => { if (e.key === "Enter") tryPin(); });
    $("btn-pin-atras").addEventListener("click", () => { refreshTitleButtons(); showScreen("title"); });
    $("btn-editor-cerrar").addEventListener("click", () => { refreshTitleButtons(); showScreen("title"); });
    $("btn-exportar").addEventListener("click", exportMedia);

    $("btn-saltar").addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.phase === "intro") enterHouse(HOUSE.start);
    });
    $("btn-menu").addEventListener("click", (e) => { e.stopPropagation(); $("modal-menu").hidden = false; });
    $("btn-cerrar-menu").addEventListener("click", () => { $("modal-menu").hidden = true; });
    $("btn-guardar").addEventListener("click", () => openSaves("save"));
    $("btn-cargar").addEventListener("click", () => openSaves("load"));
    $("btn-inicio").addEventListener("click", () => {
      hideModals();
      refreshTitleButtons();
      showScreen("title");
    });
    $("btn-cerrar-saves").addEventListener("click", () => { $("modal-saves").hidden = true; });
    $("btn-cerrar-mapa").addEventListener("click", () => { $("modal-map").hidden = true; });
    $("btn-confirm-ok").addEventListener("click", () => {
      const fn = state.pendingConfirm;
      $("modal-confirm").hidden = true;
      state.pendingConfirm = null;
      if (fn) fn();
    });
    $("btn-confirm-cancel").addEventListener("click", () => {
      $("modal-confirm").hidden = true;
      state.pendingConfirm = null;
    });
    $("btn-end-home").addEventListener("click", (e) => {
      e.stopPropagation();
      hideModals();
      refreshTitleButtons();
      showScreen("title");
    });

    $("screen-game").addEventListener("pointerup", (e) => {
      if (e.target.closest("button, .action-bar, .modal, .end-card, .menu-btn, .hud, .chip")) return;
      advance();
    });
    ["modal-menu", "modal-saves", "modal-map"].forEach((id) => {
      $(id).addEventListener("click", (e) => {
        if (e.target === $(id)) $(id).hidden = true;
      });
    });

    const portada = $("portada-img");
    portada.addEventListener("error", () => portada.classList.add("is-missing"));
    $("game-title").textContent = STORY.title || "Título del juego";
    $("version-label").textContent = "v" + (STORY.version || "0.1");
    document.title = STORY.title || "Título del juego";

    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        if ($("screen-game").classList.contains("is-on") && document.activeElement.tagName !== "INPUT") {
          e.preventDefault();
          advance();
        }
      }
      if (e.key === "Escape") hideModals();
    });
  }

  window.__VN = { showScreen, enterHouse, openMap, openEditor, openName, playBoot, showFullLine, advance, getExpr: () => currentExpr };

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    refreshTitleButtons();
    MediaStore.open().catch(() => {});
    playBoot();
  });
})();
