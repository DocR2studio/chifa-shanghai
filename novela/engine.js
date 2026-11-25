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
    currentBgKey: null,
    day: 0,
    moment: "noche",
    activityCount: 0,
    inventory: [],
    unlockedScenes: [],
    tasksDone: [],
    chats: {},
    peek: false,
    settings: { music: 70, sfx: 70, textSpeed: "normal" }
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
    if (id === "title") playTitleIntro();
  }

  let titleTimer = null;
  function playTitleIntro() {
    const el = $("screen-title");
    if (!el) return;
    el.classList.remove("title-play", "title-ready");
    void el.offsetWidth;
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { /* ignore */ }
    if (reduce) {
      el.classList.add("title-play", "title-ready");
      return;
    }
    el.classList.add("title-play");
    clearTimeout(titleTimer);
    titleTimer = setTimeout(() => el.classList.add("title-ready"), 2200);
  }
  function hideModals() {
    ["modal-menu", "modal-saves", "modal-confirm", "modal-map", "modal-tasks", "modal-bag", "modal-settings", "modal-phone"].forEach((id) => {
      if ($(id)) $(id).hidden = true;
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
      updated: Date.now(),
      day: state.day,
      moment: state.moment,
      activityCount: state.activityCount,
      inventory: (state.inventory || []).map((it) => Object.assign({}, it)),
      unlockedScenes: (state.unlockedScenes || []).slice(),
      tasksDone: (state.tasksDone || []).slice(),
      chats: cloneChats(state.chats)
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
    const cargar = $("btn-title-cargar");
    if (cargar) cargar.disabled = !latestSave();
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
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        state.settings = Object.assign(state.settings, data);
      }
    } catch (e) { /* ignore */ }
  }
  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (e) { /* ignore */ }
  }
  function typeDelay() {
    const s = (state.settings && state.settings.textSpeed) || "normal";
    if (s === "slow") return 48;
    if (s === "fast") return 12;
    return TYPE_MS;
  }
  function timeLabel() {
    const mom = TIME_LABELS[state.moment] || state.moment;
    if (!state.day) return mom;
    return "Día " + state.day + " · " + mom;
  }
  function applyTimeShade() {
    const el = $("game-shade");
    if (!el) return;
    el.classList.remove("is-manana", "is-tarde", "is-noche", "is-madrugada");
    const cls = { "mañana": "is-manana", "tarde": "is-tarde", "noche": "is-noche", "madrugada": "is-madrugada" }[state.moment];
    if (cls) el.classList.add(cls);
  }
  function isEvaHere(locId) {
    return evaAt(state.moment, state.phase) === locId;
  }
  function setPeek(on) {
    state.peek = !!on;
    const game = $("screen-game");
    if (game) game.classList.toggle("is-peek", state.peek);
    const btn = $("btn-peek");
    if (btn) btn.setAttribute("aria-pressed", state.peek ? "true" : "false");
  }
  function showHudChrome(on) {
    $("hud").hidden = !on;
    if ($("hud-icons")) $("hud-icons").hidden = !on;
    if ($("hud-day")) $("hud-day").hidden = !on;
  }
  function renderHUD() {
    if (state.bars.extra == null) state.bars.extra = 0;
    ["energia", "fuerza", "aprendizaje", "extra"].forEach((k) => {
      const v = clamp(state.bars[k] || 0);
      state.bars[k] = v;
      const fill = $("fill-" + k);
      const val = $("val-" + k);
      if (fill) fill.style.width = v + "%";
      if (val) val.textContent = String(v);
    });
    const loc = locById(state.location);
    if ($("loc-name")) {
      let n = loc ? loc.name : "";
      if (loc && loc.placeholder) n = n + " (por ahora)";
      $("loc-name").textContent = n;
    }
    if ($("hud-day")) $("hud-day").textContent = timeLabel();
    applyTimeShade();
  }
  function countActivity() {
    if (state.phase !== "house") return;
    state.activityCount = (state.activityCount || 0) + 1;
    if (state.activityCount < ACTIVITIES_PER_TIME) return;
    state.activityCount = 0;
    const i = TIMES.indexOf(state.moment);
    if (i < 0 || i >= TIMES.length - 1) {
      state.day = (state.day || 1) + 1;
      state.moment = "mañana";
      toast("Amanece. Día " + state.day + ".");
    } else {
      state.moment = TIMES[i + 1];
      toast("Ahora es de " + (TIME_LABELS[state.moment] || state.moment).toLowerCase() + ".");
    }
    applyTimeShade();
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
    const game = $("screen-game");
    if (game) game.classList.toggle("has-dialogue", !!on);
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
      const delay = ".,;:!?…".indexOf(ch) !== -1 ? Math.round(typeDelay() * 6.5) : typeDelay();
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
    if (line.moment) {
      state.moment = line.moment;
      renderHUD();
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
    state.day = 0;
    state.moment = "noche";
    state.activityCount = 0;
    state.inventory = exampleInventory();
    state.unlockedScenes = [];
    state.tasksDone = [];
    state.chats = seedChatHistory(emptyChatState());
    setPeek(false);
    hideModals();
    showScreen("game");
    showHudChrome(true);
    $("action-bar").hidden = true;
    $("btn-saltar").hidden = false;
    renderHUD();
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
    const fromIntro = state.phase === "intro";
    state.phase = "house";
    if (fromIntro) {
      state.day = 1;
      state.moment = "mañana";
      state.activityCount = 0;
    }
    state.location = loc.id;
    state.lineIndex = 0;
    state.talking = null;
    state.talkLines = [];
    setPeek(false);
    stopTyping();
    hideModals();
    showScreen("game");
    $("btn-saltar").hidden = true;
    showHudChrome(true);
    $("end-card").hidden = true;
    showDialogue(false);
    $("game-shade").classList.add("is-house");
    renderHUD();
    applyLocationVisual(loc.id, loc.image);
    const evaHere = isEvaHere(loc.id);
    if (evaHere) showEvaSprite(true, "neutral");
    else showEvaSprite(false);
    renderActions(loc, evaHere);
    completeTaskBy("enter", loc.id);
    renderHotspots();
    autosave();
  }
  function renderActions(loc, evaHere) {
    const bar = $("action-bar");
    bar.innerHTML = "";
    if (evaHere) {
      const talk = document.createElement("button");
      talk.type = "button";
      talk.className = "chip";
      talk.textContent = "Hablar con Eva";
      talk.addEventListener("click", (e) => {
        e.stopPropagation();
        startTalk(EVA.talk[loc.id] || [], null, { countsAsActivity: true });
      });
      bar.appendChild(talk);
    }
    (loc.actions || []).forEach((act) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      if (act.comingSoon) b.classList.add("is-soon");
      if (act.needAprendizaje && state.bars.aprendizaje < act.needAprendizaje) b.classList.add("is-locked");
      b.textContent = act.comingSoon ? act.label + " (Próximamente)" : act.label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        doAction(act);
      });
      bar.appendChild(b);
    });
    bar.hidden = false;
  }
  function doAction(act) {
    if (act.comingSoon) {
      toast("Próximamente.");
      return;
    }
    if (act.needAprendizaje && state.bars.aprendizaje < act.needAprendizaje) {
      toast("Todavía no sabes lo suficiente. Necesitas Aprendizaje " + act.needAprendizaje + ".");
      return;
    }
    const cost = act.energia && act.energia < 0 ? -act.energia : 0;
    if (cost && state.bars.energia < cost) {
      toast("No tienes suficiente energía.");
      return;
    }
    if (act.energia) state.bars.energia = clamp(state.bars.energia + act.energia);
    let text = act.text || "";
    if (act.kind === "exercise-home") {
      const gain = 2 + Math.floor(Math.random() * 4);
      state.bars.fuerza = clamp(state.bars.fuerza + gain);
      text = text + " Fuerza +" + gain + ".";
      completeTaskBy("action", state.location, "exercise-home");
    } else if (act.fuerza) {
      state.bars.fuerza = clamp(state.bars.fuerza + act.fuerza);
    }
    if (act.aprendizaje) state.bars.aprendizaje = clamp(state.bars.aprendizaje + act.aprendizaje);
    countActivity();
    renderHUD();
    autosave();
    startTalk([{ speaker: "", text: text }]);
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
  function startTalk(talk, nodeId, opts) {
    const conv = normalizeTalk(talk);
    if (!conv) return;
    state.conv = conv;
    if (opts && opts.countsAsActivity) {
      countActivity();
      completeTaskBy("talk", state.location);
      renderHUD();
    }
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
    const evaHere = isEvaHere(state.location);
    if (evaHere) showEvaSprite(true, "neutral");
    else showEvaSprite(false);
    renderActions(loc, evaHere);
    autosave();
  }

  function advance() {
    if (!$("screen-game").classList.contains("is-on")) return;
    if (state.peek) return;
    if (["modal-menu", "modal-saves", "modal-confirm", "modal-map", "modal-tasks", "modal-bag", "modal-settings", "modal-phone"].some((id) => $(id) && !$(id).hidden)) return;
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
        const who = [];
        if (loc.id === state.location) who.push("Tú");
        if (isEvaHere(loc.id)) who.push("Eva");
        if (who.length) {
          const pins = document.createElement("em");
          pins.className = "map-pins";
          pins.textContent = who.join(" · ");
          t.appendChild(pins);
        }
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
        if (loc.placeholder) t.classList.add("is-placeholder");
        MediaStore.mediaFor(loc.id).then((m) => {
          if (m.imageURL) t.style.backgroundImage = "url('" + m.imageURL + "')";
        });
        t.addEventListener("click", () => {
          if (loc.id === state.location) {
            $("modal-map").hidden = true;
            return;
          }
          $("modal-map").hidden = true;
          travelTo(loc.id);
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
    state.bars = { energia: 70, fuerza: 30, aprendizaje: 30, extra: 0, ...(snap.bars || {}) };
    if (state.bars.extra == null) state.bars.extra = 0;
    state.location = snap.location || HOUSE.start;
    state.phase = snap.phase || "house";
    state.lineIndex = snap.lineIndex || 0;
    state.day = snap.day != null ? snap.day : (state.phase === "intro" ? 0 : 1);
    state.moment = snap.moment || (state.phase === "intro" ? "noche" : "mañana");
    state.activityCount = snap.activityCount || 0;
    state.inventory = Array.isArray(snap.inventory) ? snap.inventory.map((it) => Object.assign({}, it)) : exampleInventory();
    state.unlockedScenes = Array.isArray(snap.unlockedScenes) ? snap.unlockedScenes.slice() : [];
    state.tasksDone = Array.isArray(snap.tasksDone) ? snap.tasksDone.slice() : [];
    state.chats = normalizeChats(snap.chats);
    setPeek(false);
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


  /* ---------- Tasks / doors / travel / bag / settings / phone ---------- */
  function isTaskDone(id) {
    return (state.tasksDone || []).indexOf(id) !== -1;
  }
  function completeTaskBy(type, location, kind) {
    (TASKS || []).forEach((tsk) => {
      const w = tsk.when || {};
      if (w.type !== type) return;
      if (w.location && w.location !== location) return;
      if (w.kind && w.kind !== kind) return;
      if (isTaskDone(tsk.id)) return;
      state.tasksDone = (state.tasksDone || []).concat([tsk.id]);
      toast("Tarea hecha: " + tsk.text);
    });
  }
  function openTasks() {
    hideModals();
    const list = $("tasks-list");
    list.innerHTML = "";
    const items = TASKS || [];
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "tasks-empty";
      empty.textContent = "No hay tareas por ahora.";
      list.appendChild(empty);
    } else {
      items.forEach((tsk) => {
        const li = document.createElement("li");
        li.className = "task-item" + (isTaskDone(tsk.id) ? " is-done" : "");
        const mark = document.createElement("span");
        mark.className = "task-mark";
        const text = document.createElement("span");
        text.className = "task-text";
        text.textContent = tsk.text;
        li.appendChild(mark);
        li.appendChild(text);
        list.appendChild(li);
      });
    }
    $("modal-tasks").hidden = false;
  }
  function doorPoints(d) {
    if (d.points && d.points.length) return d.points;
    if (d.rect && d.rect.length === 4) {
      const x = d.rect[0], y = d.rect[1], w = d.rect[2], h = d.rect[3];
      return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    }
    return [];
  }
  function setSvgHidden(svg, hide) {
    if (hide) svg.setAttribute("hidden", "");
    else svg.removeAttribute("hidden");
  }
  function renderHotspots() {
    const svg = $("hotspots");
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (state.phase !== "house") {
      setSvgHidden(svg, true);
      return;
    }
    const doors = (typeof DOORS !== "undefined" && DOORS[state.location]) || [];
    setSvgHidden(svg, doors.length === 0);
    doors.forEach((d) => {
      const pts = doorPoints(d);
      if (pts.length < 3) return;
      const el = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      el.setAttribute("points", pts.map((pt) => (pt[0] * 1280).toFixed(1) + "," + (pt[1] * 720).toFixed(1)).join(" "));
      el.setAttribute("class", "hotspot" + (d.closed ? " is-closed" : "") + (d.kind === "back" ? " is-back" : ""));
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", d.label || "");
      const go = (ev) => { ev.preventDefault(); ev.stopPropagation(); onDoor(d); };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") go(ev);
      });
      const glow = el.cloneNode();
      glow.setAttribute("class", "hotspot-glow");
      glow.removeAttribute("tabindex");
      glow.removeAttribute("role");
      svg.appendChild(glow);
      svg.appendChild(el);
      if (d.kind === "back") {
        const xs = pts.map((pt) => pt[0]);
        const ys = pts.map((pt) => pt[1]);
        const cx = ((Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2) * 1280;
        const cy = ((Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2) * 720;
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrow.setAttribute("class", "hotspot-arrow");
        arrow.setAttribute("d", "M " + (cx - 28) + " " + (cy + 12) + " L " + cx + " " + (cy - 16) + " L " + (cx + 28) + " " + (cy + 12));
        svg.appendChild(arrow);
      }
    });
  }
  function onDoor(d) {
    if (traveling) return;
    if (d.closed || !d.to) {
      toast(d.label || "Cerrado por ahora.");
      return;
    }
    travelTo(d.to);
  }
  let traveling = false;
  async function travelTo(locId) {
    const loc = locById(locId);
    if (!loc || traveling) return;
    if (state.phase === "house" && state.location === locId) return;
    traveling = true;
    const fade = $("travel-fade");
    if (fade) fade.classList.add("is-on");
    await wait(350);
    enterHouse(locId);
    if (fade) {
      fade.offsetWidth;
      fade.classList.remove("is-on");
    }
    await wait(500);
    traveling = false;
  }
  function openBag() {
    hideModals();
    const grid = $("bag-grid");
    const detail = $("bag-detail");
    grid.innerHTML = "";
    detail.hidden = true;
    const items = state.inventory || [];
    const slots = Math.max(8, items.length);
    for (let i = 0; i < slots; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "bag-slot";
      const it = items[i];
      if (it) {
        cell.classList.add("has-item");
        cell.textContent = it.name;
        if (it.example) {
          const tag = document.createElement("small");
          tag.textContent = "ejemplo";
          cell.appendChild(tag);
        }
        cell.addEventListener("click", (e) => {
          e.stopPropagation();
          detail.hidden = false;
          detail.textContent = it.name + (it.example ? " (ejemplo). " : ". ") + (it.desc || "");
        });
      } else {
        cell.classList.add("is-empty");
      }
      grid.appendChild(cell);
    }
    $("modal-bag").hidden = false;
  }
  function syncSettingsForm() {
    const s = state.settings;
    if ($("set-music")) $("set-music").value = String(s.music);
    if ($("set-sfx")) $("set-sfx").value = String(s.sfx);
    if ($("set-speed")) $("set-speed").value = s.textSpeed || "normal";
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if ($("btn-fullscreen")) $("btn-fullscreen").textContent = fs ? "Salir de pantalla completa" : "Pantalla completa";
  }
  function openSettings() {
    hideModals();
    syncSettingsForm();
    $("modal-settings").hidden = false;
  }
  function toggleFullscreen() {
    const root = document.documentElement;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) {
      const ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) Promise.resolve(ex.call(document)).catch(() => {});
    } else {
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (req) Promise.resolve(req.call(root)).catch(() => {});
    }
    setTimeout(syncSettingsForm, 300);
  }
  let phoneScreen = "home";
  let phoneChatId = null;

  function cloneChats(chats) {
    const src = chats || {};
    const out = {};
    Object.keys(src).forEach((id) => {
      const c = src[id] || {};
      out[id] = {
        node: c.node,
        started: !!c.started,
        history: (c.history || []).map((m) => ({ who: m.who, text: m.text, at: m.at }))
      };
    });
    return out;
  }
  function normalizeChats(raw) {
    const base = emptyChatState();
    if (raw && typeof raw === "object") {
      Object.keys(raw).forEach((id) => {
        const c = raw[id] || {};
        base[id] = {
          node: c.node || (chatById(id) || {}).start || "saludo",
          started: !!c.started,
          history: Array.isArray(c.history)
            ? c.history.filter((m) => m && m.text).map((m) => ({ who: m.who, text: m.text, at: m.at }))
            : [],
          draft: -1
        };
      });
    }
    return seedChatHistory(base);
  }
  function seedChatHistory(chats) {
    const next = chats || emptyChatState();
    (CHATS || []).forEach((c) => {
      if (!next[c.id]) next[c.id] = { node: c.start, history: [], started: false, draft: -1 };
      const st = next[c.id];
      if (!st.started) {
        const node = (c.nodes && (c.nodes[st.node] || c.nodes[c.start])) || {};
        const now = Date.now();
        (node.incoming || []).forEach((text, i) => {
          st.history.push({ who: c.id, text, at: now + i });
        });
        st.started = true;
        if (!st.node) st.node = c.start;
      }
      if (st.draft == null) st.draft = -1;
    });
    return next;
  }
  function ensureChat(id) {
    if (!state.chats) state.chats = seedChatHistory(emptyChatState());
    if (!state.chats[id]) {
      const def = chatById(id);
      state.chats[id] = { node: def ? def.start : "saludo", history: [], started: false, draft: -1 };
      seedChatHistory(state.chats);
    }
    return state.chats[id];
  }
  function phoneClockText() {
    try {
      return new Intl.DateTimeFormat("es-PE", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date());
    } catch (err) {
      const d = new Date();
      return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }
  }
  function formatChatTime(ts) {
    if (!ts) return "";
    try {
      return new Intl.DateTimeFormat("es-PE", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(ts));
    } catch (err) {
      const d = new Date(ts);
      return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }
  }
  function setPhoneClock() {
    if ($("phone-clock")) $("phone-clock").textContent = phoneClockText();
  }
  function setPhoneTitle(title, avatar) {
    $("phone-app-title").textContent = title || "App";
    const img = $("phone-app-avatar");
    if (!img) return;
    if (avatar) {
      img.src = avatar;
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
  }
  function openPhone(app) {
    hideModals();
    setPhoneClock();
    if (app) openPhoneApp(app);
    else phoneHome();
    $("modal-phone").hidden = false;
  }
  function phoneHome() {
    phoneScreen = "home";
    phoneChatId = null;
    $("phone-home").hidden = false;
    $("phone-app").hidden = true;
    $("phone-app-body").innerHTML = "";
    setPhoneTitle("App");
    setPhoneClock();
  }
  function phoneBack() {
    if (phoneScreen === "chat") {
      openPhoneApp("contacts");
      return;
    }
    phoneHome();
  }
  function openPhoneApp(app) {
    phoneScreen = app || "home";
    phoneChatId = null;
    $("phone-home").hidden = true;
    $("phone-app").hidden = false;
    const titles = { contacts: "Chats", camera: "Cámara", info: "Info" };
    setPhoneTitle(titles[app] || "App");
    const body = $("phone-app-body");
    body.innerHTML = "";
    if (app === "contacts") {
      renderChatList(body);
    } else if (app === "camera") {
      const shot = document.createElement("div");
      shot.className = "phone-camera";
      const img = document.createElement("img");
      const loc = locById(state.location);
      img.alt = loc ? loc.name : "";
      if (loc) {
        img.src = loc.image;
        MediaStore.mediaFor(loc.id).then((m) => { if (m.imageURL) img.src = m.imageURL; });
      }
      const cap = document.createElement("p");
      cap.textContent = "Próximamente";
      shot.appendChild(img);
      shot.appendChild(cap);
      body.appendChild(shot);
    } else if (app === "info") {
      [["eva", CODEX.eva], ["player", CODEX.player]].forEach(([id, entry]) => {
        if (!entry) return;
        const card = document.createElement("article");
        card.className = "phone-codex";
        const h = document.createElement("h3");
        h.textContent = fillName(entry.name || id, state.name);
        const p = document.createElement("p");
        p.textContent = fillName(entry.text || "", state.name);
        card.appendChild(h);
        card.appendChild(p);
        body.appendChild(card);
      });
    }
  }
  function lastChatPreview(id) {
    const st = ensureChat(id);
    const hist = st.history || [];
    if (!hist.length) return { text: "Sin mensajes", at: 0 };
    const last = hist[hist.length - 1];
    const prefix = last.who === "player" ? "Tú: " : "";
    return { text: prefix + last.text, at: last.at };
  }
  function renderChatList(body) {
    const list = document.createElement("div");
    list.className = "chat-list";
    (CHATS || []).forEach((c) => {
      const preview = lastChatPreview(c.id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = "chat-row";
      row.setAttribute("data-chat-id", c.id);
      const av = document.createElement("img");
      av.className = "chat-avatar";
      av.src = c.avatar;
      av.alt = "";
      const name = document.createElement("span");
      name.className = "chat-row-name";
      name.textContent = c.name;
      const last = document.createElement("span");
      last.className = "chat-row-last";
      last.textContent = preview.text;
      const time = document.createElement("span");
      time.className = "chat-row-time";
      time.textContent = formatChatTime(preview.at);
      row.appendChild(av);
      row.appendChild(name);
      row.appendChild(time);
      row.appendChild(last);
      list.appendChild(row);
    });
    body.appendChild(list);
  }
  function currentChatNode(def, st) {
    if (!def || !def.nodes) return null;
    return def.nodes[st.node] || def.nodes[def.start] || null;
  }
  function openChatThread(id) {
    const def = chatById(id);
    if (!def) return;
    phoneScreen = "chat";
    phoneChatId = id;
    ensureChat(id);
    $("phone-home").hidden = true;
    $("phone-app").hidden = false;
    setPhoneTitle(def.name, def.avatar);
    renderChatThread(id);
  }
  function renderChatThread(id) {
    const def = chatById(id);
    const st = ensureChat(id);
    const body = $("phone-app-body");
    body.innerHTML = "";
    const thread = document.createElement("div");
    thread.className = "chat-thread";
    const log = document.createElement("div");
    log.className = "chat-log";
    (st.history || []).forEach((m) => {
      const b = document.createElement("div");
      b.className = "chat-bubble " + (m.who === "player" ? "chat-bubble-player" : "chat-bubble-eva");
      b.appendChild(document.createTextNode(m.text));
      const tm = document.createElement("span");
      tm.className = "chat-bubble-time";
      tm.textContent = formatChatTime(m.at);
      b.appendChild(tm);
      log.appendChild(b);
    });
    thread.appendChild(log);
    const node = currentChatNode(def, st);
    const replies = (node && node.replies) || [];
    if (replies.length) {
      const box = document.createElement("div");
      box.className = "chat-replies";
      replies.forEach((r, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chat-reply" + (st.draft === i ? " is-selected" : "");
        btn.setAttribute("data-reply", String(i));
        btn.textContent = r.text;
        box.appendChild(btn);
      });
      thread.appendChild(box);
    }
    const compose = document.createElement("div");
    compose.className = "chat-compose";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "chat-input";
    input.id = "chat-input";
    input.readOnly = true;
    input.tabIndex = -1;
    if (st.draft >= 0 && replies[st.draft]) {
      input.value = replies[st.draft].text;
    } else if (!replies.length) {
      input.placeholder = "No hay más respuestas";
    } else {
      input.placeholder = "Elige una respuesta";
    }
    const send = document.createElement("button");
    send.type = "button";
    send.className = "chat-send";
    send.id = "chat-send";
    send.setAttribute("aria-label", "Enviar");
    send.disabled = !(st.draft >= 0 && replies[st.draft]);
    send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.2 12 L20.5 4.4 15.2 20.2 12.2 13.2 Z"/></svg>';
    compose.appendChild(input);
    compose.appendChild(send);
    thread.appendChild(compose);
    body.appendChild(thread);
    log.scrollTop = log.scrollHeight;
  }
  function selectChatReply(index) {
    if (!phoneChatId) return;
    const def = chatById(phoneChatId);
    const st = ensureChat(phoneChatId);
    const node = currentChatNode(def, st);
    const replies = (node && node.replies) || [];
    const i = Number(index);
    if (!replies[i]) return;
    st.draft = i;
    renderChatThread(phoneChatId);
  }
  function sendChatReply() {
    if (!phoneChatId) return;
    const def = chatById(phoneChatId);
    const st = ensureChat(phoneChatId);
    const node = currentChatNode(def, st);
    const replies = (node && node.replies) || [];
    if (st.draft < 0 || !replies[st.draft]) return;
    const choice = replies[st.draft];
    const now = Date.now();
    st.history.push({ who: "player", text: choice.text, at: now });
    st.draft = -1;
    st.node = choice.next;
    const next = currentChatNode(def, st);
    (next && next.incoming ? next.incoming : []).forEach((text, i) => {
      st.history.push({ who: def.id, text, at: now + 1 + i });
    });
    autosave();
    renderChatThread(phoneChatId);
  }
  function onPhoneBodyClick(e) {
    const row = e.target.closest("[data-chat-id]");
    if (row) {
      e.stopPropagation();
      openChatThread(row.getAttribute("data-chat-id"));
      return;
    }
    const reply = e.target.closest("[data-reply]");
    if (reply) {
      e.stopPropagation();
      selectChatReply(reply.getAttribute("data-reply"));
      return;
    }
    if (e.target.closest("#chat-send")) {
      e.stopPropagation();
      sendChatReply();
    }
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
    if (demo === "house" || demo === "map" || demo === "talk" || demo === "enojada" || demo === "enamorada" || demo === "triste" || demo === "peek" || demo === "bag" || demo === "settings" || demo === "phone" || demo === "info" || demo === "tasks" || demo === "pasillo" || demo === "sala" || demo === "cuarto_eva" || demo === "fade" || demo === "chats" || demo === "chat") {
      state.name = "Doc";
      state.bars = { ...HOUSE.startBars };
      state.day = 1;
      state.moment = "mañana";
      state.activityCount = 0;
      state.inventory = exampleInventory();
      state.unlockedScenes = [];
      state.tasksDone = [];
      state.chats = seedChatHistory(emptyChatState());
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
        const startLoc = (demo === "pasillo" || demo === "fade") ? "pasillo" : (demo === "sala" ? "sala" : (demo === "cuarto_eva" ? "cuarto_eva" : "cuarto"));
        enterHouse(startLoc);
        if (demo === "map") openMap();
        if (demo === "peek") setPeek(true);
        if (demo === "bag") openBag();
        if (demo === "settings") openSettings();
        if (demo === "phone") openPhone();
        if (demo === "info") openPhone("info");
        if (demo === "chats") openPhone("contacts");
        if (demo === "chat") { openPhone("contacts"); openChatThread("eva"); }
        if (demo === "tasks") openTasks();
        if (demo === "fade") { travelTo("sala"); }
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
    $("btn-title-cargar").addEventListener("click", () => {
      if (!latestSave()) return;
      openSaves("load");
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
    $("btn-peek").addEventListener("click", (e) => { e.stopPropagation(); setPeek(!state.peek); });
    $("btn-tasks").addEventListener("click", (e) => { e.stopPropagation(); openTasks(); });
    $("btn-map").addEventListener("click", (e) => { e.stopPropagation(); openMap(); });
    $("btn-bag").addEventListener("click", (e) => { e.stopPropagation(); openBag(); });
    $("btn-settings").addEventListener("click", (e) => { e.stopPropagation(); openSettings(); });
    $("btn-phone").addEventListener("click", (e) => { e.stopPropagation(); openPhone(); });
    $("btn-cerrar-tasks").addEventListener("click", () => { $("modal-tasks").hidden = true; });
    $("btn-cerrar-bag").addEventListener("click", () => { $("modal-bag").hidden = true; });
    $("btn-cerrar-settings").addEventListener("click", () => { $("modal-settings").hidden = true; });
    $("btn-cerrar-phone").addEventListener("click", () => { $("modal-phone").hidden = true; phoneHome(); });
    $("phone-back").addEventListener("click", (e) => { e.stopPropagation(); phoneBack(); });
    $("phone-app-body").addEventListener("click", onPhoneBodyClick);
    document.querySelectorAll(".phone-app").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openPhoneApp(btn.getAttribute("data-app"));
      });
    });
    $("set-music").addEventListener("input", () => { state.settings.music = Number($("set-music").value); saveSettings(); });
    $("set-sfx").addEventListener("input", () => { state.settings.sfx = Number($("set-sfx").value); saveSettings(); });
    $("set-speed").addEventListener("change", () => { state.settings.textSpeed = $("set-speed").value; saveSettings(); });
    $("btn-fullscreen").addEventListener("click", (e) => { e.stopPropagation(); toggleFullscreen(); });
    $("btn-set-guardar").addEventListener("click", () => openSaves("save"));
    $("btn-set-cargar").addEventListener("click", () => openSaves("load"));
    $("btn-set-inicio").addEventListener("click", () => {
      $("modal-settings").hidden = true;
      hideModals();
      refreshTitleButtons();
      showScreen("title");
    });
    ["modal-tasks", "modal-bag", "modal-settings", "modal-phone"].forEach((id) => {
      $(id).addEventListener("click", (e) => {
        if (e.target === $(id)) {
          $(id).hidden = true;
          if (id === "modal-phone") phoneHome();
        }
      });
    });
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
      if (e.target.closest("button, .action-bar, .modal, .end-card, .menu-btn, .hud, .hud-icons, .chip, .phone-shell, .hud-panel, .hotspots, .travel-fade")) return;
      if (state.peek) {
        setPeek(false);
        return;
      }
      advance();
    });
    ["modal-menu", "modal-saves", "modal-map"].forEach((id) => {
      $(id).addEventListener("click", (e) => {
        if (e.target === $(id)) $(id).hidden = true;
      });
    });

    $("version-label").textContent = "v" + (STORY.version || "0.1");
    document.title = STORY.title || "Unknown Love";

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

  window.__VN = { showScreen, enterHouse, openMap, openEditor, openName, playBoot, showFullLine, advance, playTitleIntro, openBag, openSettings, openPhone, openChatThread, openTasks, travelTo, setPeek, getExpr: () => currentExpr, getState: () => state };

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    loadSettings();
    refreshTitleButtons();
    MediaStore.open().catch(() => {});
    playBoot();
  });
})();
