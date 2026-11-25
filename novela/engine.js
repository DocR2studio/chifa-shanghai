/* Motor de la demo: intro, casa, HUD, guardado y editor. */
(function () {
  "use strict";

  const TYPE_MS = 26;
  const TZ = "America/Lima";
  const $ = (id) => document.getElementById(id);
  if (typeof loadStoryPatch === "function") loadStoryPatch();

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
    evaMeet: false,
    evaInfo: defaultEvaInfo(),
    ejected: false,
    pendingKick: false,
    meetSub: null,
    missions: { active: [], done: [] },
    eventsDone: [],
    introCine: false,
    settings: { music: 70, sfx: 70, textSpeed: "normal" }
  };
  let editorLive = false;
  try { editorLive = sessionStorage.getItem("eva_novela_editor_live") === "1"; } catch (e) { /* ignore */ }
  let editSaveFn = null;
  let meetSceneId = null;
  const PENCIL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17.3V20h2.7L18.2 8.5l-2.7-2.7L4 17.3zM16.2 4.5l2.7 2.7 1.4-1.4c.5-.5.5-1.3 0-1.8l-.9-.9c-.5-.5-1.3-.5-1.8 0L16.2 4.5z"/></svg>';

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
    if (id !== "game") stopIntroCine();
    document.querySelectorAll(".screen").forEach((s) => {
      const on = s.id === "screen-" + id;
      s.classList.toggle("is-on", on);
      s.setAttribute("aria-hidden", on ? "false" : "true");
    });
    if (id === "title") playTitleIntro();
    refreshEditorLiveBar();
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
    ["modal-menu", "modal-saves", "modal-confirm", "modal-map", "modal-tasks", "modal-bag", "modal-settings", "modal-phone", "modal-edit"].forEach((id) => {
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
      chats: cloneChats(state.chats),
      evaInfo: cloneEvaInfo(state.evaInfo),
      ejected: !!state.ejected,
      missions: { active: ensureMissions().active.slice(), done: ensureMissions().done.slice() },
      eventsDone: (state.eventsDone || []).slice(),
      introCine: !!state.introCine
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
    const wd = typeof weekdayName === "function" ? weekdayName(state.day) : "";
    return wd ? ("Día " + state.day + " · " + wd + " · " + mom) : ("Día " + state.day + " · " + mom);
  }
  function currentEvaStatus() {
    if (typeof evaStatus === "function") {
      return evaStatus(state.day, state.moment, state.activityCount, state.phase);
    }
    return { loc: (typeof evaAt === "function" ? evaAt(state.moment, state.phase, state.day, state.activityCount) : null), cleaning: false, move: 0 };
  }
  function applyTimeShade() {
    const el = $("game-shade");
    if (!el) return;
    el.classList.remove("is-manana", "is-tarde", "is-noche", "is-madrugada");
    const cls = { "mañana": "is-manana", "tarde": "is-tarde", "noche": "is-noche", "madrugada": "is-madrugada" }[state.moment];
    if (cls) el.classList.add(cls);
  }
  function isEvaHere(locId) {
    return currentEvaStatus().loc === locId;
  }
  function isEvaCleaning(locId) {
    const st = currentEvaStatus();
    return !!(st.cleaning && st.loc === locId);
  }
  function isEvaSleeping() {
    const st = currentEvaStatus();
    if (!st || st.loc !== "cuarto_eva" || st.cleaning) return false;
    if (state.moment === "madrugada") return true;
    if (state.moment === "noche") return (st.move || 0) >= 1;
    return false;
  }
  function currentSceneVariant() {
    if (state.phase !== "house") return null;
    const loc = state.location;
    if (!loc || !isEvaHere(loc)) return null;
    const list = (typeof EVA_SCENES !== "undefined" && Array.isArray(EVA_SCENES)) ? EVA_SCENES : [];
    const variants = list.filter((v) => v && v.loc === loc);
    if (!variants.length) return null;
    const cleaning = isEvaCleaning(loc);
    if (cleaning) {
      return variants.find((v) => v.when === "cleaning") || variants.find((v) => v.when === "present") || null;
    }
    if (loc === "cuarto_eva" && isEvaSleeping()) {
      return variants.find((v) => v.when === "sleeping") || null;
    }
    return variants.find((v) => v.when === "awake") || variants.find((v) => v.when === "present") || null;
  }
  function sceneMediaKey(id) {
    return "escena:" + id;
  }
  function findActionById(id) {
    const locs = (typeof HOUSE !== "undefined" && HOUSE.locations) || [];
    for (let i = 0; i < locs.length; i++) {
      const acts = (locs[i] && locs[i].actions) || [];
      for (let j = 0; j < acts.length; j++) {
        if (acts[j] && acts[j].id === id) return acts[j];
        const opts = (acts[j] && acts[j].options) || [];
        for (let k = 0; k < opts.length; k++) {
          if (opts[k] && opts[k].id === id) return opts[k];
        }
      }
    }
    const tmpl = typeof EVA_ROOM_ACTIONS !== "undefined" ? EVA_ROOM_ACTIONS : {};
    const keys = Object.keys(tmpl);
    for (let i = 0; i < keys.length; i++) {
      const a = tmpl[keys[i]];
      if (a && typeof a === "object" && a.id === id) return a;
    }
    return null;
  }
  function sceneCatalogAction(id) {
    if (id === "ayudar-eva") return ayudarEvaAction();
    if (id === "broma") {
      const src = findActionById("broma");
      return src ? Object.assign({}, src) : { id: "broma", label: "Hacer una broma", paciencia: -9, scene: "broma" };
    }
    const src = findActionById(id);
    return src ? Object.assign({}, src) : null;
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
    renderMissionHud(false);
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
  function sceneWebpPath(path) {
    if (!path || /^(blob:|data:|https?:)/i.test(path)) return "";
    const bare = String(path).split("?")[0];
    if (/^assets\/escenas\/.+\.(png|jpe?g)$/i.test(bare)) return bare.replace(/\.(png|jpe?g)$/i, ".webp");
    return "";
  }
  function setImgWithFallback(url) {
    const img = $("bg-img");
    if (!url) {
      setImg("");
      return;
    }
    const list = [];
    const webp = sceneWebpPath(url);
    if (webp) list.push(assetUrl(webp));
    const u = /^(blob:|data:|https?:)/i.test(url) ? url : assetUrl(url);
    if (list.indexOf(u) < 0) list.push(u);
    let i = 0;
    const tryNext = () => {
      if (i >= list.length) {
        img.classList.add("is-missing");
        return;
      }
      const src = list[i++];
      img.onload = () => img.classList.remove("is-missing");
      img.onerror = () => tryNext();
      if (img.getAttribute("src") === src && img.complete && img.naturalWidth) {
        img.classList.remove("is-missing");
        return;
      }
      img.classList.remove("is-missing");
      img.src = src;
    };
    tryNext();
  }
  async function applyLocationVisual(locId, fallbackImage) {
    const layer = $("bg-layer");
    layer.className = "bg-layer bg-cafe";
    $("game-shade").classList.add("is-house");
    clearVideo();
    const variant = currentSceneVariant();
    if (variant) {
      const customScene = await MediaStore.mediaFor(sceneMediaKey(variant.id));
      if (customScene.imageURL) {
        setImg(customScene.imageURL);
        return;
      }
      setImgWithFallback(variant.image || "");
      return;
    }
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
  async function refreshRoomVisual() {
    const loc = locById(state.location);
    if (!loc) return;
    await applyLocationVisual(loc.id, loc.image);
    const evaHere = isEvaHere(loc.id);
    showRoomEva(evaHere);
    renderActions(loc, evaHere);
    renderHotspots();
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
  function eva2WebpPath(path) {
    if (!path || /^(blob:|data:|https?:)/i.test(path)) return "";
    const bare = String(path).split("?")[0];
    if (/^assets\/eva2\/.+\.png$/i.test(bare)) return bare.replace(/\.png$/i, ".webp");
    return "";
  }
  function loadExprImage(img, url, fallback) {
    return new Promise((res) => {
      const list = [];
      const webp = eva2WebpPath(url);
      if (webp) list.push(assetUrl(webp));
      if (url) {
        const u = assetUrl(url);
        if (list.indexOf(u) < 0) list.push(u);
      }
      if (fallback) {
        const fb = assetUrl(fallback);
        if (list.indexOf(fb) < 0) list.push(fb);
      }
      let i = 0;
      const tryNext = () => {
        if (i >= list.length) { res(); return; }
        const src = list[i++];
        img.onload = () => res();
        img.onerror = () => tryNext();
        if (img.getAttribute("src") === src && img.complete && img.naturalWidth) { res(); return; }
        img.src = src;
      };
      tryNext();
    });
  }
  async function resolveExprUrl(charId, expr) {
    expr = expr || "neutral";
    const custom = await MediaStore.mediaFor(mediaKey(charId, expr));
    if (custom.imageURL) return custom.imageURL;
    if (expr === "neutral") {
      const legacy = await MediaStore.mediaFor(charId);
      if (legacy.imageURL) return legacy.imageURL;
    }
    return exprAsset(charId, expr) || (typeof EVA_EXPR_FALLBACK !== "undefined" && EVA_EXPR_FALLBACK) || EVA.image;
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
    const curSrc = visible.getAttribute("src");
    const webpSrc = eva2WebpPath(url) ? assetUrl(eva2WebpPath(url)) : "";
    if (spriteVisible && currentExpr === expr && (curSrc === url || curSrc === assetUrl(url) || (webpSrc && curSrc === webpSrc))) {
      layer.hidden = false;
      return;
    }
    const incoming = spriteOn === "a" ? b : a;
    const outgoing = spriteOn === "a" ? a : b;
    incoming.alt = (CHARACTERS[charId] && CHARACTERS[charId].name) || "Eva";
    incoming.removeAttribute("src");
    incoming.hidden = false;
    await loadExprImage(incoming, url, charId === "eva" ? ((typeof EVA_EXPR_FALLBACK !== "undefined" && EVA_EXPR_FALLBACK) || "assets/eva-close.png") : "");
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
    if (!on) setDuoLayout(null);
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
      speaker.textContent = displayWho(who);
    } else {
      speaker.hidden = true;
      speaker.textContent = "";
    }
    if (line.moment) {
      state.moment = line.moment;
      renderHUD();
    }
    const cid = charIdFromName(who);
    if (cid && !exprSeqActive()) showEvaSprite(true, lineExpr(line));
    else if (cid && exprSeqActive()) showEvaSprite(true, currentExpr || lineExpr(line));
    showDialogue(true);
    setDuoLayout(cid === "eva" ? "eva" : (isProtaWho(who) ? "prota" : "none"));
    typeLine(fillName(line.text, state.name));
    bindLinePencil(line);
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
    state.evaInfo = defaultEvaInfo();
    state.evaMeet = false;
    state.ejected = false;
    state.pendingKick = false;
    state.missions = { active: [], done: [] };
    state.eventsDone = [];
    setPeek(false);
    hideModals();
    if ($("eva-eject")) $("eva-eject").hidden = true;
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
    state.actionSub = null;
    hideActionScene();
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
    closeEvaMeet(true);
    showEvaSprite(false);
    showRoomEva(evaHere);
    renderActions(loc, evaHere);
    completeTaskBy("enter", loc.id);
    renderHotspots();
    autosave();
  }
  function ayudarEvaAction() {
    const src = (typeof EVA_ROOM_ACTIONS !== "undefined" && EVA_ROOM_ACTIONS.ayudarEva) || {
      id: "ayudar-eva", label: "Ayudar a Eva", recover: "ayudar", energia: -5, vinculo: 1,
      text: "Echas una mano con la limpieza. Eva lo agradece."
    };
    return Object.assign({}, src);
  }
  function actionNeedsUnmet(act) {
    if (!act) return false;
    const ev = ensureEvaInfo();
    if (act.needHeart != null && (ev.afecto || 0) < act.needHeart) return true;
    if (act.needRosa != null && (ev.bars.rosa || 0) < act.needRosa) return true;
    if (act.needMorada != null && (ev.bars.morada || 0) < act.needMorada) return true;
    return false;
  }
  function isActionLocked(act) {
    if (!act || act.denyTalk) return false;
    return actionNeedsUnmet(act);
  }
  function playDeniedAction(act) {
    const text = act.deniedText || "Ve a descansar a tu propia cama.";
    const expr = act.deniedExpr || "neutral";
    startTalk([{
      who: "Eva",
      expr: expr,
      text: text,
      _onEdit: (v) => { act.deniedText = v; saveStoryPatch(); }
    }]);
  }
  function isActionDisabled(act) {
    return !!(act && act.disabledAt && state.moment === act.disabledAt);
  }
  function roomActionList(loc) {
    if (state.actionSub && state.actionSub.options) {
      return { list: state.actionSub.options.slice(), back: true };
    }
    let list = ((loc && loc.actions) || []).slice();
    const variant = currentSceneVariant();
    const hide = {};
    ((variant && variant.hideActions) || []).forEach((id) => { hide[id] = true; });
    list = list.filter((a) => a && !hide[a.id]);
    const extras = ((variant && variant.actions) || []).map((id) => sceneCatalogAction(id)).filter(Boolean);
    let insertAt = Math.min(1, list.length);
    extras.forEach((ex) => {
      if (!list.some((x) => x.id === ex.id)) {
        list.splice(insertAt, 0, ex);
        insertAt += 1;
      }
    });
    if (loc && isEvaCleaning(loc.id)) {
      if (!list.some((x) => x.id === "ayudar-eva")) {
        list.splice(Math.min(1, list.length), 0, ayudarEvaAction());
      }
    }
    return { list: list, back: false };
  }
  function renderActions(loc, evaHere) {
    const bar = $("action-bar");
    bar.innerHTML = "";
    const pack = roomActionList(loc);
    pack.list.forEach((act) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      if (act.comingSoon) b.classList.add("is-soon");
      if (act.needAprendizaje && state.bars.aprendizaje < act.needAprendizaje) b.classList.add("is-locked");
      if (isActionLocked(act) || isActionDisabled(act)) b.classList.add("is-locked");
      b.textContent = act.comingSoon ? act.label + " (Próximamente)" : act.label;
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        doAction(act);
      });
      if (editorLive) {
        const wrap = document.createElement("div");
        wrap.className = "ed-row";
        wrap.appendChild(b);
        wrap.appendChild(makePencil(() => {
          openEditModal("Acción", act.label || "", (v) => {
            act.label = v;
            saveStoryPatch();
            renderActions(loc, evaHere);
          });
        }, "Editar acción"));
        bar.appendChild(wrap);
      } else {
        bar.appendChild(b);
      }
    });
    if (pack.back) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "chip";
      back.textContent = (typeof EVA_ROOM_ACTIONS !== "undefined" && EVA_ROOM_ACTIONS.backLabel) || (EVA_HABLAR && EVA_HABLAR.backLabel) || "Volver";
      back.addEventListener("click", (e) => {
        e.stopPropagation();
        state.actionSub = null;
        renderActions(loc, evaHere);
      });
      bar.appendChild(back);
    }
    bar.hidden = pack.list.length === 0 && !pack.back;
  }
  function doAction(act) {
    if (!act) return;
    if (act.comingSoon) {
      toast("Próximamente.");
      return;
    }
    if (isActionDisabled(act)) {
      toast(act.disabledHint || "No puedes hacer eso ahora.");
      return;
    }
    if (isActionLocked(act)) {
      toast(act.lockedHint || "Todavía no.");
      return;
    }
    if (act.denyTalk && actionNeedsUnmet(act)) {
      playDeniedAction(act);
      return;
    }
    if (act.options && act.options.length) {
      state.actionSub = { options: act.options, parent: act };
      const loc = locById(state.location);
      renderActions(loc, isEvaHere(state.location));
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
    const skipAt = act.pacienciaSkipAtHeart;
    let paciencia = act.paciencia || 0;
    if (paciencia && skipAt != null && (ensureEvaInfo().afecto || 0) >= skipAt) {
      paciencia = 0;
      if (act.textIfSkipped) text = act.textIfSkipped;
    }
    const applied = applyStatDelta({
      afecto: act.afecto,
      vinculo: act.vinculo,
      confianza: act.confianza,
      rosa: act.rosa,
      morada: act.morada,
      paciencia: paciencia
    });
    if (applied && applied.paciencia) showStatDelta({ paciencia: applied.paciencia });
    if (act.recover) recoverPaciencia(act.recover);
    const advances = act.advance === "day" || act.advance === "moment";
    if (!advances) countActivity();
    renderHUD();
    autosave();
    state.actionSub = null;
    if (act.scene) {
      showActionScene(act.scene);
      state.pendingActionScene = true;
    }
    if (advances) state.pendingAdvance = act.advance;
    if (act.wakeAngry) state.pendingWakeReproach = true;
    startTalk([{
      speaker: "",
      text: text,
      _onEdit: (v) => { act.text = v; saveStoryPatch(); }
    }]);
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
    showRoomEva(false);
    state.conv = conv;
    if (opts && opts.countsAsActivity) {
      countActivity();
      completeTaskBy("talk", state.location);
      renderHUD();
    }
    startNode(nodeId || conv.start);
  }
  function endTalk() {
    const hook = talkDoneHook;
    talkDoneHook = null;
    endTalkCore();
    if (typeof hook === "function") hook();
  }
  function endTalkCore() {
    state.talking = null;
    state.talkLines = [];
    state.conv = null;
    state.nodeId = null;
    $("choices").hidden = true;
    $("choices").innerHTML = "";
    showDialogue(false);
    clearLinePencil();
    stopExprSeq();
    if (state.pendingActionScene) {
      state.pendingActionScene = false;
      hideActionScene();
    }
    if (state.pendingKick || isPacienciaKick()) {
      ejectFromHouse();
      return;
    }
    if (state.pendingAdvance) {
      const kind = state.pendingAdvance;
      state.pendingAdvance = null;
      fadeAdvance(kind);
      return;
    }
    if (state.pendingLeaveRoom) {
      const to = state.pendingLeaveRoom;
      state.pendingLeaveRoom = null;
      travelTo(to);
      return;
    }
    if (state.evaMeet) {
      showEvaSprite(false);
      const meet = $("eva-meet");
      if (meet) meet.classList.remove("is-talking");
      if (!state.meetSub) showMeetScene(null);
      buildEvaMeetMenu();
      renderEvaMeetStats();
      autosave();
      return;
    }
    showEvaSprite(false);
    refreshRoomVisual();
    autosave();
  }

  function advance() {
    if (!$("screen-game").classList.contains("is-on")) return;
    if (state.peek) return;
    if (["modal-menu", "modal-saves", "modal-confirm", "modal-map", "modal-tasks", "modal-bag", "modal-settings", "modal-phone", "modal-edit"].some((id) => $(id) && !$(id).hidden)) return;
    if ($("eva-eject") && !$("eva-eject").hidden) return;
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


  function assetUrl(path) {
    if (!path) return path;
    if (/^(blob:|data:|https?:)/i.test(path)) return path;
    const s = document.querySelector("script[src*=\"story.js\"]");
    const m = s && s.src && s.src.match(/[?&]v=([^&]+)/);
    if (!m) return path;
    return path + (path.indexOf("?") >= 0 ? "&" : "?") + "v=" + m[1];
  }
  function evaInfoBarRange(id) {
    const info = typeof EVA_INFO !== "undefined" ? EVA_INFO : {};
    const found = (info.bars || []).find((b) => b.id === id) || {};
    let max = found.max;
    let min = found.min;
    if (max == null) max = (id === "rosa" || id === "morada") ? 250 : (id === "roja" ? 0 : 100);
    if (min == null) min = id === "roja" ? -100 : 0;
    return { min: min, max: max };
  }
  function evaInfoBarMax(id) {
    return evaInfoBarRange(id).max;
  }
  function evaInfoBarMin(id) {
    return evaInfoBarRange(id).min;
  }
  function clampInfoVal(n, max, min) {
    const lo = min == null ? 0 : min;
    const hi = max == null ? 100 : max;
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    return Math.max(a, Math.min(b, Math.round(Number(n) || 0)));
  }
  function clampBarVal(id, n) {
    const r = evaInfoBarRange(id);
    return clampInfoVal(n, r.max, r.min);
  }
  function clampAfecto(n) {
    const info = typeof EVA_INFO !== "undefined" ? EVA_INFO : {};
    const max = info.afectoMax != null ? info.afectoMax : 200;
    const min = info.afectoMin != null ? info.afectoMin : -50;
    return clampInfoVal(n, max, min);
  }
  function migrateBarRaw(id, raw) {
    let v = raw;
    /* Partidas viejas: Paciencia subía de 0 a 100. Ahora va de 0 a -100. */
    if (id === "roja" && v > 0) v = -v;
    return clampBarVal(id, v);
  }
  function defaultEvaInfo() {
    const info = typeof EVA_INFO !== "undefined" ? EVA_INFO : {};
    const bars = {};
    const start = info.startBars || { rosa: 0, morada: 0, roja: 0 };
    (info.bars || [{ id: "rosa" }, { id: "morada" }, { id: "roja" }]).forEach((b) => {
      const raw = start[b.id] != null ? start[b.id] : 0;
      bars[b.id] = migrateBarRaw(b.id, raw);
    });
    return {
      bars: bars,
      afecto: clampAfecto(info.startAfecto != null ? info.startAfecto : 10)
    };
  }
  function cloneEvaInfo(src) {
    const base = defaultEvaInfo();
    if (!src) return base;
    const bars = { ...base.bars };
    const ids = new Set(Object.keys(bars).concat(src.bars ? Object.keys(src.bars) : []));
    ids.forEach((k) => {
      const raw = src.bars && src.bars[k] != null ? src.bars[k] : bars[k];
      bars[k] = migrateBarRaw(k, raw);
    });
    const afecto = clampAfecto(src.afecto != null ? src.afecto : base.afecto);
    return { bars: bars, afecto: afecto };
  }
  function mergeEvaInfo(src) {
    /* Partidas viejas: Paciencia positiva se invierte; rosa/morada se abren a 250; afecto a -50..200. */
    return cloneEvaInfo(src);
  }
  function ensureEvaInfo() {
    state.evaInfo = cloneEvaInfo(state.evaInfo);
    return state.evaInfo;
  }
  function refreshEvaInfoUI() {
    if (phoneScreen === "info" && $("modal-phone") && !$("modal-phone").hidden) openPhoneApp("info");
    if (state.evaMeet && !state.talking) renderEvaMeetStats();
  }
  function addAfecto(n) {
    const info = typeof EVA_INFO !== "undefined" ? EVA_INFO : {};
    const ev = ensureEvaInfo();
    const add = Number(n) || 0;
    ev.afecto = clampAfecto((ev.afecto || 0) + add);
    if (add > 0) ev.bars.rosa = clampBarVal("rosa", (ev.bars.rosa || 0) + Math.max(1, Math.round(add * 0.75)));
    autosave();
    refreshEvaInfoUI();
    return ev.afecto;
  }
  function setAfecto(n) {
    const info = typeof EVA_INFO !== "undefined" ? EVA_INFO : {};
    const ev = ensureEvaInfo();
    ev.afecto = clampAfecto(n);
    autosave();
    refreshEvaInfoUI();
    return ev.afecto;
  }
  function addEvaInfoBar(id, n) {
    const ev = ensureEvaInfo();
    ev.bars[id] = clampBarVal(id, (ev.bars[id] || 0) + (Number(n) || 0));
    autosave();
    refreshEvaInfoUI();
    return ev.bars[id];
  }
  function setEvaInfoBar(id, n) {
    const ev = ensureEvaInfo();
    ev.bars[id] = clampBarVal(id, n);
    autosave();
    refreshEvaInfoUI();
    return ev.bars[id];
  }
  function appendEvaBarRow(parent, b, ev) {
    const row = document.createElement("div");
    row.className = "phone-eva-bar-row";
    const track = document.createElement("div");
    track.className = "phone-eva-bar";
    track.setAttribute("data-bar", b.id);
    const col = b.color || "#888";
    let hx = String(col).replace("#", "");
    if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];
    if (hx.length === 6) {
      const r = parseInt(hx.slice(0, 2), 16), g = parseInt(hx.slice(2, 4), 16), bl = parseInt(hx.slice(4, 6), 16);
      track.style.background = "rgba(" + r + "," + g + "," + bl + ",0.28)";
    }
    const range = evaInfoBarRange(b.id);
    const v = ev.bars[b.id] != null ? ev.bars[b.id] : 0;
    const fill = document.createElement("span");
    let frac = 0;
    if (range.min < 0 && range.max <= 0) {
      const span = Math.abs(range.min - range.max) || 1;
      frac = Math.abs(Math.min(0, v) - range.max) / span;
    } else {
      const span = (range.max - range.min) || 1;
      frac = (v - range.min) / span;
    }
    fill.style.width = (Math.max(0, Math.min(100, frac * 100))) + "%";
    fill.style.background = col;
    track.appendChild(fill);
    const head = document.createElement("div");
    head.className = "phone-eva-bar-head";
    const name = document.createElement("span");
    name.className = "phone-eva-bar-name";
    name.textContent = b.name || "";
    if (editorLive) {
      const wrap = document.createElement("span");
      wrap.className = "ed-wrap";
      wrap.appendChild(name);
      wrap.appendChild(makePencil(() => {
        openEditModal("Nombre de la barra", b.name || "", (v) => {
          b.name = v;
          saveStoryPatch();
          refreshEvaInfoUI();
        });
      }, "Editar nombre"));
      head.appendChild(wrap);
    } else {
      head.appendChild(name);
    }
    const lab = document.createElement("span");
    lab.className = "phone-eva-bar-val";
    lab.textContent = v + "/" + (range.min < 0 ? range.min : range.max);
    head.appendChild(lab);
    row.appendChild(head);
    row.appendChild(track);
    parent.appendChild(row);
  }
  function renderEvaInfoSheet() {
    const cfg = typeof EVA_INFO !== "undefined" ? EVA_INFO : {};
    const ev = ensureEvaInfo();
    const sheet = document.createElement("section");
    sheet.className = "phone-eva-sheet";
    const top = document.createElement("div");
    top.className = "phone-eva-top";
    const barsBox = document.createElement("div");
    barsBox.className = "phone-eva-bars";
    (cfg.bars || []).forEach((b) => appendEvaBarRow(barsBox, b, ev));
    top.appendChild(barsBox);
    top.appendChild(renderEvaHeart(ev.afecto, "info"));
    sheet.appendChild(top);
    const img = document.createElement("img");
    img.className = "phone-eva-photo";
    img.alt = "Eva";
    img.src = assetUrl(cfg.image || "assets/eva-info.png");
    sheet.appendChild(img);
    const dl = document.createElement("dl");
    dl.className = "phone-eva-fields";
    (cfg.fields || []).forEach((f) => {
      const dt = document.createElement("dt");
      dt.textContent = f.label || "";
      const dd = document.createElement("dd");
      dd.textContent = fillName(f.value || "", state.name);
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    sheet.appendChild(dl);
    return sheet;
  }


  function hideEvaMeetStats() {
    const box = $("eva-meet-stats");
    if (box) {
      box.hidden = true;
      box.innerHTML = "";
    }
  }
  function renderEvaMeetStats() {
    const box = $("eva-meet-stats");
    if (!box) return;
    box.innerHTML = "";
    const cfg = typeof EVA_INFO !== "undefined" ? EVA_INFO : {};
    const ev = ensureEvaInfo();
    const top = document.createElement("div");
    top.className = "eva-meet-stats-row";
    const barsBox = document.createElement("div");
    barsBox.className = "eva-meet-stats-bars";
    (cfg.bars || []).forEach((b) => appendEvaBarRow(barsBox, b, ev));
    top.appendChild(barsBox);
    top.appendChild(renderEvaHeart(ev.afecto, "meet"));
    box.appendChild(top);
    box.hidden = false;
  }

    let evaMeetBusy = false;
  function coverBox(el) {
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (!vw || !vh) return null;
    const iw = 1280, ih = 720;
    const scale = Math.max(vw / iw, vh / ih);
    return { w: iw * scale, h: ih * scale, x: (vw - iw * scale) / 2, y: (vh - ih * scale) / 2 };
  }

  function setEvaSceneSil(variant) {
    const svg = $("eva-scene-sil");
    if (!svg) return;
    svg.innerHTML = "";
    const sleeping = !variant || variant.talk === false || variant.when === "sleeping" || variant.id === "cuarto-eva-durmiendo";
    if (sleeping) {
      svg.hidden = true;
      svg.setAttribute("hidden", "");
      return;
    }
    const map = (typeof EVA_SCENE_SILS !== "undefined" && EVA_SCENE_SILS) || {};
    const d = map[variant.id];
    if (!d) {
      svg.hidden = true;
      svg.setAttribute("hidden", "");
      return;
    }
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "hotspot");
    path.setAttribute("fill-rule", "evenodd");
    path.setAttribute("pointer-events", "none");
    path.setAttribute("id", "eva-sil-path");
    svg.appendChild(path);
    svg.hidden = false;
    svg.removeAttribute("hidden");
  }
  function placeRoomEva() {
    const layer = $("eva-room");
    const hit = $("eva-room-hit");
    if (!layer || !hit || layer.hidden) return;
    const box = coverBox(layer);
    if (!box) return;
    const variant = layer.classList.contains("is-scene") ? currentSceneVariant() : null;
    if (variant) {
      const h = variant.hit || { x: 0.32, y: 0.18, w: 0.36, h: 0.72 };
      hit.style.width = (h.w * box.w) + "px";
      hit.style.height = (h.h * box.h) + "px";
      hit.style.left = (box.x + h.x * box.w) + "px";
      hit.style.top = (box.y + h.y * box.h) + "px";
      hit.style.transform = "none";
      return;
    }
    hit.style.width = "";
    hit.style.transform = "";
    const places = (typeof EVA_MENU !== "undefined" && EVA_MENU.place) || {};
    const place = places[state.location] || { x: 0.5, y: 0.90, h: 0.60 };
    const height = place.h * box.h;
    hit.style.height = height + "px";
    hit.style.left = (box.x + place.x * box.w) + "px";
    hit.style.top = (box.y + place.y * box.h - height) + "px";
  }
  function showRoomEva(on) {
    const layer = $("eva-room");
    const img = $("eva-room-sprite");
    const hit = $("eva-room-hit");
    if (!layer) return;
    if (!on || state.evaMeet) {
      layer.hidden = true;
      layer.classList.remove("is-scene");
      setEvaSceneSil(null);
      return;
    }
    const variant = currentSceneVariant();
    if (variant) {
      layer.classList.add("is-scene");
      layer.hidden = false;
      if (img) img.hidden = true;
      if (hit) {
        hit.hidden = false;
        hit.setAttribute("aria-label", "Eva");
      }
      setEvaSceneSil(variant);
      placeRoomEva();
      return;
    }
    layer.classList.remove("is-scene");
    setEvaSceneSil(null);
    if (img) img.hidden = false;
    const src = assetUrl((typeof EVA_MENU !== "undefined" && EVA_MENU.fullImage) || "assets/eva-full.png");
    if (img) {
      img.alt = "Eva";
      if (img.getAttribute("src") !== src) {
        img.onload = () => placeRoomEva();
        img.src = src;
      }
    }
    layer.hidden = false;
    if (hit) hit.hidden = false;
    placeRoomEva();
  }
  function finishMeetMenu(box) {
    if (!box) return;
    const n = box.querySelectorAll(".eva-meet-opt").length;
    box.classList.toggle("is-long", n >= 6);
  }
  function buildEvaMeetMenu() {
    const box = $("eva-meet-menu");
    if (!box) return;
    box.innerHTML = "";
    box.classList.remove("is-long");
    const sub = state.meetSub;
    if (sub === "hablar") {
      const opts = (typeof EVA_HABLAR !== "undefined" && EVA_HABLAR.options) || [];
      opts.forEach((opt, i) => {
        appendMeetOption(box, opt.label, () => openHablarGroup(opt.id), () => {
          openEditModal("Opción de Hablar", opt.label, (v) => { opt.label = v; saveStoryPatch(); buildEvaMeetMenu(); });
        }, () => {
          opts.splice(i, 1);
          saveStoryPatch();
          buildEvaMeetMenu();
        });
      });
      if (editorLive) appendAddButton(box, "Añadir opción", () => {
        opts.push({ id: "h" + Date.now(), label: "Nueva opción" });
        saveStoryPatch();
        buildEvaMeetMenu();
      });
      appendMeetOption(box, (EVA_HABLAR && EVA_HABLAR.backLabel) || "Volver", () => {
        state.meetSub = null;
        showMeetScene(null);
        buildEvaMeetMenu();
        renderEvaMeetStats();
      }, () => {
        openEditModal("Volver", EVA_HABLAR.backLabel || "Volver", (v) => { EVA_HABLAR.backLabel = v; saveStoryPatch(); buildEvaMeetMenu(); });
      });
      finishMeetMenu(box);
      return;
    }
    if (sub === "elogiar" || sub === "charlar") {
      const list = (EVA_HABLAR && EVA_HABLAR[sub]) || [];
      list.forEach((topic, i) => {
        appendMeetOption(box, topic.label || "Tema", () => playHablarTopic(sub, topic), () => {
          openEditModal("Tema", topic.label || "", (v) => { topic.label = v; saveStoryPatch(); buildEvaMeetMenu(); });
        }, () => {
          list.splice(i, 1);
          saveStoryPatch();
          buildEvaMeetMenu();
        });
      });
      if (editorLive) appendAddButton(box, "Añadir tema", () => {
        list.push({
          id: "t" + Date.now(),
          label: "Nuevo tema",
          player: "…",
          reactions: [
            { maxAfecto: 29, expr: "molesta", eva: "Prefiero no hablar de eso ahora.", paciencia: -5 },
            { maxAfecto: 100, expr: "feliz", eva: "Me agrada oírte.", vinculo: 2, afecto: 1 }
          ]
        });
        saveStoryPatch();
        buildEvaMeetMenu();
      });
      appendMeetOption(box, (EVA_HABLAR && EVA_HABLAR.backLabel) || "Volver", () => {
        state.meetSub = "hablar";
        buildEvaMeetMenu();
      });
      finishMeetMenu(box);
      return;
    }
    if (sub === "peticion" || sub === "accion") {
      const data = (typeof EVA_MENU !== "undefined" && EVA_MENU[sub]) || { options: [] };
      const list = data.options || [];
      const groupId = sub === "accion" ? state.meetAccionGroup : null;
      const group = groupId && list.find((o) => o && o.id === groupId && o.options);
      const shown = group ? group.options : list;
      const shownList = group ? group.options : list;
      shown.forEach((opt, i) => {
        const openGroup = !group && opt && opt.options && opt.options.length;
        const run = () => {
          if (openGroup) {
            state.meetAccionGroup = opt.id;
            buildEvaMeetMenu();
            return;
          }
          if (opt && opt.effects) playAccionOption(opt);
          else playUnlockable(opt, opt.ok, opt.locked);
        };
        appendMeetOption(box, opt.label || "Opción", run, () => {
          openEditModal("Opción", opt.label || "", (v) => { opt.label = v; saveStoryPatch(); buildEvaMeetMenu(); });
        }, () => {
          shownList.splice(i, 1);
          saveStoryPatch();
          buildEvaMeetMenu();
        });
      });
      if (editorLive) appendAddButton(box, "Añadir recuadro", () => {
        const addTo = shownList;
        addTo.push({ id: "o" + Date.now(), label: "Nueva opción", need: 0, ok: { expr: "neutral", eva: "De acuerdo.", vinculo: 1 } });
        saveStoryPatch();
        buildEvaMeetMenu();
      });
      appendMeetOption(box, (EVA_HABLAR && EVA_HABLAR.backLabel) || "Volver", () => {
        if (group) {
          state.meetAccionGroup = null;
          buildEvaMeetMenu();
          return;
        }
        state.meetSub = null;
        state.meetAccionGroup = null;
        showMeetScene(null);
        buildEvaMeetMenu();
        renderEvaMeetStats();
      });
      finishMeetMenu(box);
      return;
    }
    const opts = (typeof EVA_MENU !== "undefined" && EVA_MENU.options) || [];
    opts.forEach((opt, i) => {
      appendMeetOption(box, opt.label, () => onEvaMeetOption(opt.id), () => {
        openEditModal("Botón del menú", opt.label, (v) => { opt.label = v; saveStoryPatch(); buildEvaMeetMenu(); });
      }, editorLive && opt.id !== "olvidalo" && opt.id !== "hablar" ? () => {
        opts.splice(i, 1);
        saveStoryPatch();
        buildEvaMeetMenu();
      } : null);
    });
    if (editorLive) appendAddButton(box, "Añadir botón", () => {
      opts.splice(Math.max(0, opts.length - 1), 0, { id: "extra" + Date.now(), label: "Nuevo" });
      saveStoryPatch();
      buildEvaMeetMenu();
    });
    finishMeetMenu(box);
  }
  function openEvaMeet() {
    if (state.ejected || isPacienciaKick()) {
      ejectFromHouse();
      return;
    }
    state.evaMeet = true;
    state.meetSub = null;
    showMeetScene(null);
    const meet = $("eva-meet");
    const img = $("eva-meet-close");
    if (img) {
      img.alt = "Eva";
      const expr = evaMoodExpr();
      const closeSrc = exprAsset("eva", expr) || (typeof EVA_MENU !== "undefined" && EVA_MENU.closeImage) || "assets/eva-close.png";
      loadExprImage(img, closeSrc, (typeof EVA_EXPR_FALLBACK !== "undefined" && EVA_EXPR_FALLBACK) || "assets/eva-close.png");
    }
    buildEvaMeetMenu();
    renderEvaMeetStats();
    if (meet) {
      meet.classList.remove("is-talking");
      meet.hidden = false;
      meet.classList.remove("is-in");
      void meet.offsetWidth;
      meet.classList.add("is-in");
    }
    const game = $("screen-game");
    if (game) game.classList.add("is-eva-meet");
    if ($("action-bar")) $("action-bar").hidden = true;
    showRoomEva(false);
    refreshEditorLiveBar();
    const p = ensureEvaInfo().bars.roja || 0;
    if (isPacienciaWarn(p)) {
      const w = (typeof EVA_RULES !== "undefined" && EVA_RULES.warning) || {};
      beginMeetTalk([{ who: "Eva", expr: w.expr || "molesta", text: w.text || "Estoy perdiendo la paciencia." }], null, { countsAsActivity: false });
    }
  }
  function closeEvaMeet(instant) {
    state.evaMeet = false;
    state.meetSub = null;
    state.meetAccionGroup = null;
    showMeetScene(null);
    stopExprSeq();
    evaMeetBusy = false;
    const meet = $("eva-meet");
    hideEvaMeetStats();
    if (meet) {
      meet.hidden = true;
      meet.classList.remove("is-talking", "is-in");
    }
    const game = $("screen-game");
    if (game) game.classList.remove("is-eva-meet");
    if (state.phase !== "house") return;
    const loc = locById(state.location);
    const evaHere = isEvaHere(state.location);
    if (!state.talking) {
      showRoomEva(evaHere);
      if (loc) renderActions(loc, evaHere);
    }
  }
  function beginMeetTalk(talk, nodeId, opts) {
    const meet = $("eva-meet");
    if (meet) meet.classList.add("is-talking");
    startTalk(talk, nodeId, opts);
  }
  function sayNoGift() {
    const line = (typeof EVA_MENU !== "undefined" && EVA_MENU.noGift) || { expr: "neutral", text: "No tienes nada que pueda aceptar ahora, {nombre}." };
    beginMeetTalk([{ who: "Eva", expr: line.expr || "neutral", text: line.text }], null, { countsAsActivity: false });
  }
  function isGiftSuitable(it) {
    if (!it) return false;
    if (it.example) return false;
    if (it.gift === false) return false;
    return !!it.gift;
  }
  function tryGift(it) {
    if (!isGiftSuitable(it)) {
      sayNoGift();
      return;
    }
    $("modal-bag").hidden = true;
    playUnlockable(it, it.ok || (typeof EVA_MENU !== "undefined" && EVA_MENU.giftOk && { expr: EVA_MENU.giftOk.expr, eva: EVA_MENU.giftOk.text }), it.locked);
  }
  function onEvaMeetOption(id) {
    hideEvaMeetStats();
    if (id === "olvidalo") {
      closeEvaMeet();
      return;
    }
    if (id === "hablar") {
      state.meetSub = "hablar";
      buildEvaMeetMenu();
      return;
    }
    if (id === "regalar") {
      showMeetScene((typeof EDITOR_SCENES !== "undefined" && EDITOR_SCENES.find((s) => s.id === "eva-regalo") && "eva-regalo") || "eva-regalo");
      const items = state.inventory || [];
      if (!items.length) {
        sayNoGift();
        return;
      }
      openBag({ gift: true });
      return;
    }
    if (id === "peticion" || id === "accion") {
      const data = (typeof EVA_MENU !== "undefined" && EVA_MENU[id]) || {};
      state.meetSub = id;
      state.meetAccionGroup = null;
      showMeetScene(data.scene || ("eva-" + id));
      buildEvaMeetMenu();
    }
  }
  async function onRoomEvaClick(e) {
    if (e) e.stopPropagation();
    if (traveling || evaMeetBusy || state.evaMeet) return;
    if (state.talking || state.peek) return;
    const variant = currentSceneVariant();
    if (variant && variant.talk === false) return;
    evaMeetBusy = true;
    const sil = $("eva-sil-path");
    const hit = $("eva-room-hit");
    const scene = $("eva-room") && $("eva-room").classList.contains("is-scene");
    if (sil) {
      sil.classList.add("is-flash");
      await wait(300);
      sil.classList.remove("is-flash");
    } else if (hit && !scene) {
      hit.classList.add("is-flash");
      await wait(300);
      hit.classList.remove("is-flash");
    }
    openEvaMeet();
    evaMeetBusy = false;
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
        const evaHereTile = isEvaHere(loc.id);
        t.className = "map-tile" + (loc.id === state.location ? " is-here" : "") + (evaHereTile ? " is-eva" : "");
        t.style.backgroundImage = "url('" + loc.image + "')";
        const who = [];
        if (loc.id === state.location) who.push("Tú");
        if (evaHereTile) who.push("Eva");
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

  /* ---------- v25: protagonista, diálogos a dos, misiones, eventos e intro ---------- */
  let talkDoneHook = null;
  function protaInfo() {
    return (typeof PROTA !== "undefined" && PROTA) || { id: "prota", name: "???", sprite: "assets/intro/prota.webp" };
  }
  function isProtaWho(who) {
    const w = String(who || "").trim().toLowerCase();
    if (!w) return false;
    return w === "prota" || w === "???" || w === String(protaInfo().name || "").toLowerCase();
  }
  function displayWho(who) {
    if (isProtaWho(who)) return protaInfo().name || "???";
    return who || "";
  }
  function showProtaSprite(on) {
    const layer = $("sprite-prota-layer");
    const img = $("sprite-prota");
    if (!layer || !img) return;
    if (!on) {
      layer.hidden = true;
      return;
    }
    if (!img.getAttribute("src")) {
      const info = protaInfo();
      img.onerror = () => {
        img.onerror = null;
        if (info.spriteFallback) img.src = assetUrl(info.spriteFallback);
      };
      img.src = assetUrl(info.sprite);
    }
    layer.hidden = false;
  }
  function setDuoLayout(kind) {
    const game = $("screen-game");
    if (!game) return;
    if (!kind) {
      game.classList.remove("is-duo", "speak-eva", "speak-prota", "speak-none");
      showProtaSprite(false);
      return;
    }
    const evaOn = kind === "eva" || spriteVisible;
    const duo = evaOn || kind === "prota";
    showProtaSprite(duo);
    game.classList.toggle("is-duo", duo);
    game.classList.toggle("speak-eva", duo && kind === "eva");
    game.classList.toggle("speak-prota", duo && kind === "prota");
    game.classList.toggle("speak-none", duo && kind === "none");
  }

  function normalizeMissions(m) {
    const out = { active: [], done: [] };
    if (m && typeof m === "object") {
      if (Array.isArray(m.active)) out.active = m.active.filter((x) => typeof x === "string");
      if (Array.isArray(m.done)) out.done = m.done.filter((x) => typeof x === "string");
    }
    return out;
  }
  function ensureMissions() {
    if (!state.missions || !Array.isArray(state.missions.active) || !Array.isArray(state.missions.done)) {
      state.missions = normalizeMissions(state.missions);
    }
    return state.missions;
  }
  function missionById(id) {
    return (typeof MISSIONS !== "undefined" ? MISSIONS : []).find((m) => m && m.id === id) || null;
  }
  let missionDoneTimer = null;
  function renderMissionHud(flash) {
    const box = $("hud-mission");
    if (!box) return;
    if (box.classList.contains("is-done")) return;
    const ms = ensureMissions();
    const m = ms.active.map(missionById).filter(Boolean)[0];
    if (!m || state.phase !== "house") {
      box.hidden = true;
      return;
    }
    $("hud-mission-kicker").textContent = "Misión";
    $("hud-mission-text").textContent = m.title;
    box.hidden = false;
    if (flash) {
      box.classList.remove("is-new");
      void box.offsetWidth;
      box.classList.add("is-new");
    }
  }
  function startMission(id, announce) {
    const m = missionById(id);
    if (!m) return;
    const ms = ensureMissions();
    if (ms.active.indexOf(id) === -1 && ms.done.indexOf(id) === -1) ms.active.push(id);
    renderMissionHud(!!announce);
    if (announce) toast("Nueva misión: " + m.title);
    renderHotspots();
    autosave();
  }
  function completeMission(id) {
    const m = missionById(id);
    const ms = ensureMissions();
    ms.active = ms.active.filter((x) => x !== id);
    if (ms.done.indexOf(id) === -1) ms.done.push(id);
    const box = $("hud-mission");
    if (box && m) {
      clearTimeout(missionDoneTimer);
      $("hud-mission-kicker").textContent = "Misión completada";
      $("hud-mission-text").textContent = m.title;
      box.hidden = false;
      box.classList.remove("is-new");
      box.classList.add("is-done");
      void box.offsetWidth;
      box.classList.add("is-new");
      missionDoneTimer = setTimeout(() => {
        box.classList.remove("is-done", "is-new");
        renderMissionHud(false);
      }, 3600);
    }
    renderHotspots();
    autosave();
  }

  function storyEvents() {
    return typeof STORY_EVENTS !== "undefined" && Array.isArray(STORY_EVENTS) ? STORY_EVENTS : [];
  }
  function eventPending(ev) {
    if (!ev || !ev.id || !ev.location) return false;
    if ((state.eventsDone || []).indexOf(ev.id) !== -1) return false;
    if (ev.moment && ev.moment !== state.moment) return false;
    if (ev.minDay && (state.day || 0) < ev.minDay) return false;
    if (ev.mission) return ensureMissions().active.indexOf(ev.mission) !== -1;
    return ev.enabled !== false;
  }
  /* Puertas (destinos) que acercan a un evento pendiente: camino más corto por DOORS. */
  function eventDoorTargets(locId) {
    const out = new Set();
    if (state.phase !== "house" || typeof DOORS === "undefined") return out;
    const targets = storyEvents().filter(eventPending).map((ev) => ev.location);
    if (!targets.length) return out;
    const rev = {};
    Object.keys(DOORS).forEach((from) => {
      (DOORS[from] || []).forEach((d) => {
        if (!d || !d.to || d.closed) return;
        (rev[d.to] = rev[d.to] || []).push(from);
      });
    });
    const dist = {};
    const queue = [];
    targets.forEach((t) => { if (dist[t] == null) { dist[t] = 0; queue.push(t); } });
    while (queue.length) {
      const cur = queue.shift();
      (rev[cur] || []).forEach((from) => {
        if (dist[from] == null) {
          dist[from] = dist[cur] + 1;
          queue.push(from);
        }
      });
    }
    const here = dist[locId];
    if (here == null || here === 0) return out;
    (DOORS[locId] || []).forEach((d) => {
      if (d && d.to && !d.closed && dist[d.to] === here - 1) out.add(d.to);
    });
    return out;
  }
  function appendEventMark(svg, pts, isBack) {
    const xs = pts.map((p) => p[0] * 1280);
    const ys = pts.map((p) => p[1] * 720);
    const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    const cx = (minX + maxX) / 2;
    let cy = isBack ? minY - 46 : minY + Math.min((maxY - minY) * 0.3, 170);
    cy = Math.max(170, Math.min(640, cy));
    const NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "event-mark");
    g.setAttribute("transform", "translate(" + cx.toFixed(1) + "," + cy.toFixed(1) + ")");
    const bob = document.createElementNS(NS, "g");
    bob.setAttribute("class", "event-mark-bob");
    const bar = document.createElementNS(NS, "path");
    bar.setAttribute("d", "M -9 -40 Q 0 -46 9 -40 L 6 6 Q 0 10 -6 6 Z");
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", "0");
    dot.setAttribute("cy", "24");
    dot.setAttribute("r", "8.5");
    bob.appendChild(bar);
    bob.appendChild(dot);
    g.appendChild(bob);
    svg.appendChild(g);
  }
  async function showPlainLocationBg(loc) {
    if (!loc) return;
    const custom = await MediaStore.mediaFor(loc.id);
    if (custom.videoURL) return;
    clearVideo();
    setImg(custom.imageURL || loc.image || "");
  }
  function maybeTriggerEvent() {
    if (state.phase !== "house" || state.talking || state.evaMeet || traveling) return false;
    const ev = storyEvents().find((e) => eventPending(e) && e.location === state.location);
    if (!ev || !Array.isArray(ev.lines) || !ev.lines.length) return false;
    playStoryEvent(ev);
    return true;
  }
  function playStoryEvent(ev) {
    closeEvaMeet(true);
    showPlainLocationBg(locById(state.location));
    talkDoneHook = () => {
      if ((state.eventsDone || []).indexOf(ev.id) === -1) state.eventsDone = (state.eventsDone || []).concat([ev.id]);
      if (ev.completes) completeMission(ev.completes);
      else { renderHotspots(); autosave(); }
    };
    startTalk(ev.lines);
  }

  /* Intro cinematográfica (solo partida nueva). */
  let cineRun = 0;
  let cineTap = null;
  let cineFront = "a";
  let cineFinishing = false;
  function cineSleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function cineWait(ms) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        if (cineTap === finish) cineTap = null;
        resolve();
      };
      const t = setTimeout(finish, ms);
      cineTap = finish;
    });
  }
  function cineTapNow() {
    const txt = $("cine-text");
    if (txt && txt.classList.contains("is-typing")) {
      txt.classList.remove("is-typing");
      txt.classList.add("is-full");
      return;
    }
    if (cineTap) cineTap();
  }
  function cineSetText(who, text) {
    const sub = $("cine-sub");
    const w = $("cine-who");
    const t = $("cine-text");
    if (!sub || !t) return 0;
    w.textContent = who ? displayWho(who) : "";
    w.className = "cine-who" + (isProtaWho(who) ? " is-prota" : (who ? " is-eva" : ""));
    t.innerHTML = "";
    t.className = "cine-text is-typing";
    const words = String(text || "").split(/(\s+)/);
    let i = 0;
    words.forEach((wd) => {
      if (/^\s+$/.test(wd)) { t.appendChild(document.createTextNode(wd)); return; }
      if (!wd) return;
      const sp = document.createElement("span");
      sp.textContent = wd;
      sp.style.animationDelay = (i * 0.11) + "s";
      t.appendChild(sp);
      i += 1;
    });
    sub.classList.add("is-on");
    return i * 110 + 650;
  }
  function cineHideText() {
    const sub = $("cine-sub");
    if (sub) sub.classList.remove("is-on");
  }
  function cineShow(shot) {
    const next = cineFront === "a" ? $("cine-shot-b") : $("cine-shot-a");
    const prev = cineFront === "a" ? $("cine-shot-a") : $("cine-shot-b");
    const img = next.querySelector(".cine-img");
    const blur = next.querySelector(".cine-blur");
    const url = assetUrl(shot.image);
    return new Promise((resolve) => {
      let fired = false;
      const go = () => {
        if (fired) return;
        fired = true;
        next.className = "cine-shot fx-" + (shot.fx || "kb-in");
        next.style.setProperty("--cine-dur", ((shot.hold || 4000) + 3200) + "ms");
        blur.style.backgroundImage = "url(\"" + url + "\")";
        const fy = typeof shot.focus === "number" ? Math.max(0, Math.min(100, shot.focus)) : 45;
        img.style.objectPosition = "50% " + fy + "%";
        img.style.transformOrigin = "50% " + fy + "%";
        void next.offsetWidth;
        next.classList.add("is-on");
        prev.classList.remove("is-on");
        prev.classList.add("is-out");
        cineFront = cineFront === "a" ? "b" : "a";
        resolve();
      };
      img.onload = go;
      img.onerror = go;
      if (img.getAttribute("src") === url && img.complete) go();
      else img.src = url;
      setTimeout(go, 2500);
    });
  }
  function resetCine() {
    ["cine-shot-a", "cine-shot-b"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.className = "cine-shot";
      const img = el.querySelector(".cine-img");
      if (img) img.removeAttribute("src");
    });
    cineFront = "a";
    cineHideText();
    const black = $("cine-black");
    if (black) black.classList.remove("is-on", "is-text");
    const cine = $("cine");
    if (cine) cine.classList.remove("is-bars", "is-leaving");
  }
  function stopIntroCine() {
    const cine = $("cine");
    if (!cine || cine.hidden) return;
    cineRun += 1;
    cineTap = null;
    cineFinishing = false;
    cine.hidden = true;
    resetCine();
  }
  async function startIntroCine() {
    const cine = $("cine");
    const shots = (typeof INTRO_CINE !== "undefined" && Array.isArray(INTRO_CINE.shots)) ? INTRO_CINE.shots : [];
    if (!cine || !shots.length) {
      startIntroStory();
      return;
    }
    state.phase = "intro";
    state.location = HOUSE.start;
    state.lineIndex = 0;
    state.talking = null;
    state.talkLines = [];
    state.bars = { ...HOUSE.startBars };
    state.day = 0;
    state.moment = "noche";
    state.activityCount = 0;
    state.inventory = exampleInventory();
    state.unlockedScenes = [];
    state.tasksDone = [];
    state.chats = seedChatHistory(emptyChatState());
    state.evaInfo = defaultEvaInfo();
    state.evaMeet = false;
    state.ejected = false;
    state.pendingKick = false;
    state.missions = { active: [], done: [] };
    state.eventsDone = [];
    state.introCine = true;
    setPeek(false);
    hideModals();
    if ($("eva-eject")) $("eva-eject").hidden = true;
    showScreen("game");
    showHudChrome(false);
    $("action-bar").hidden = true;
    $("btn-saltar").hidden = true;
    $("end-card").hidden = true;
    showDialogue(false);
    showEvaSprite(false);
    showRoomEva(false);
    renderHotspots();
    renderMissionHud(false);
    const run = ++cineRun;
    cineFinishing = false;
    resetCine();
    cine.hidden = false;
    shots.forEach((sh) => { const im = new Image(); im.src = assetUrl(sh.image); });
    await cineSleep(80);
    if (run !== cineRun) return;
    cine.classList.add("is-bars");
    await cineSleep(1000);
    for (let i = 0; i < shots.length; i++) {
      if (run !== cineRun) return;
      const shot = shots[i];
      await cineShow(shot);
      if (run !== cineRun) return;
      await cineSleep(shot.fx && shot.fx.indexOf("panel") === 0 ? 650 : 900);
      if (run !== cineRun) return;
      if (shot.text) {
        const reveal = cineSetText(shot.who, shot.text);
        await cineWait(Math.max(shot.hold || 3500, reveal + 1800));
        if (run !== cineRun) return;
        cineHideText();
        await cineSleep(500);
      } else {
        await cineWait(shot.hold || 3500);
      }
    }
    if (run !== cineRun) return;
    const black = $("cine-black");
    black.classList.add("is-on");
    await cineSleep(1500);
    if (run !== cineRun) return;
    const dawn = (typeof INTRO_CINE !== "undefined" && INTRO_CINE.dawnText) || "";
    if (dawn) {
      $("cine-black-text").textContent = dawn;
      black.classList.add("is-text");
      await cineWait(2600);
      if (run !== cineRun) return;
      black.classList.remove("is-text");
      await cineSleep(800);
      if (run !== cineRun) return;
    }
    finishIntroCine(false);
  }
  function skipIntroCine() {
    const cine = $("cine");
    if (!cine || cine.hidden || cineFinishing) return;
    finishIntroCine(true);
  }
  async function finishIntroCine(skipped) {
    if (cineFinishing) return;
    cineFinishing = true;
    cineRun += 1;
    const run = cineRun;
    cineTap = null;
    const cine = $("cine");
    const black = $("cine-black");
    cineHideText();
    if (black) black.classList.add("is-on");
    if (black) black.classList.remove("is-text");
    await cineSleep(skipped ? 450 : 200);
    if (run !== cineRun) return;
    const firstId = (typeof INTRO_CINE !== "undefined" && INTRO_CINE.firstMission) || "";
    state.phase = "intro";
    state.missions = { active: missionById(firstId) ? [firstId] : [], done: [] };
    state.eventsDone = [];
    state.introCine = true;
    enterHouse(HOUSE.start);
    cine.classList.add("is-leaving");
    await cineSleep(1300);
    if (run !== cineRun) return;
    cine.hidden = true;
    resetCine();
    cineFinishing = false;
    const wake = (typeof INTRO_CINE !== "undefined" && Array.isArray(INTRO_CINE.wake)) ? INTRO_CINE.wake : [];
    const announce = () => { if (firstId) startMission(firstId, true); };
    if (!skipped && wake.length) {
      talkDoneHook = announce;
      startTalk(wake);
    } else {
      announce();
    }
  }

  function renderIntroCineCard() {
    const card = document.createElement("article");
    card.className = "editor-card editor-aviso-card editor-intro-card";
    const h = document.createElement("h3");
    h.textContent = "Intro, despertar y primera misión";
    card.appendChild(h);
    const note = document.createElement("p");
    note.className = "editor-note";
    note.textContent = "Textos de la intro de partida nueva. ??? es el protagonista: Eva todavía no sabe su nombre.";
    card.appendChild(note);
    const addRow = (label, value, multi, onSave) => {
      const row = document.createElement("div");
      row.className = "seq-row";
      const lab = document.createElement("label");
      lab.textContent = label;
      const inp = multi ? document.createElement("textarea") : document.createElement("input");
      if (!multi) inp.type = "text";
      inp.value = value != null ? value : "";
      const save = () => { onSave(inp.value); saveStoryPatch(); };
      inp.addEventListener("change", save);
      row.appendChild(lab);
      row.appendChild(inp);
      row.appendChild(makePencil(() => {
        openEditModal(label, inp.value, (v) => { inp.value = v; save(); });
      }, "Editar"));
      card.appendChild(row);
    };
    const sub = (t) => {
      const p = document.createElement("p");
      p.className = "editor-note editor-subhead";
      p.textContent = t;
      card.appendChild(p);
    };
    const whoLabel = (w) => (isProtaWho(w) ? (protaInfo().name || "???") : (w || "Narración"));
    if (typeof INTRO_CINE !== "undefined") {
      sub("Intro (cada imagen)");
      (INTRO_CINE.shots || []).forEach((shot, i) => {
        addRow((i + 1) + ". " + shot.id + " · " + whoLabel(shot.who), shot.text, true, (v) => { shot.text = v; });
      });
      addRow("Texto en negro (amanece)", INTRO_CINE.dawnText, false, (v) => { INTRO_CINE.dawnText = v; });
      sub("Despertar (Día 1, mañana)");
      (INTRO_CINE.wake || []).forEach((line, i) => {
        addRow((i + 1) + ". " + whoLabel(line.who), line.text, true, (v) => { line.text = v; });
      });
    }
    if (typeof MISSIONS !== "undefined") {
      sub("Misiones");
      MISSIONS.forEach((m) => {
        addRow("Misión · título", m.title, false, (v) => { m.title = v; renderMissionHud(false); });
        addRow("Misión · pista", m.hint, false, (v) => { m.hint = v; });
      });
    }
    storyEvents().forEach((ev) => {
      sub("Evento: " + ev.id);
      (ev.lines || []).forEach((line, i) => {
        addRow((i + 1) + ". " + whoLabel(line.who), line.text, true, (v) => { line.text = v; });
      });
    });
    return card;
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
    startIntroCine();
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
    state.evaInfo = mergeEvaInfo(snap.evaInfo);
    state.ejected = !!snap.ejected;
    state.pendingKick = false;
    state.missions = normalizeMissions(snap.missions);
    state.eventsDone = Array.isArray(snap.eventsDone) ? snap.eventsDone.slice() : [];
    state.introCine = !!snap.introCine;
    setPeek(false);
    hideModals();
    if (state.ejected) {
      showScreen("game");
      ejectFromHouse();
      return;
    }
    if (state.phase === "intro") {
      /* v25: las partidas guardadas no vuelven a ver la intro. */
      enterHouse(HOUSE.start);
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
    const ms = ensureMissions();
    let missionRows = 0;
    (typeof MISSIONS !== "undefined" ? MISSIONS : []).forEach((m) => {
      const active = ms.active.indexOf(m.id) !== -1;
      const done = ms.done.indexOf(m.id) !== -1;
      if (!active && !done) return;
      missionRows += 1;
      const li = document.createElement("li");
      li.className = "task-item is-mission" + (done ? " is-done" : "");
      const mark = document.createElement("span");
      mark.className = "task-mark";
      const text = document.createElement("span");
      text.className = "task-text";
      text.textContent = "Misión: " + m.title + (!done && m.hint ? " — " + m.hint : "");
      li.appendChild(mark);
      li.appendChild(text);
      list.appendChild(li);
    });
    if (!items.length && !missionRows) {
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
    const marked = eventDoorTargets(state.location);
    doors.forEach((d) => {
      const pts = doorPoints(d);
      if (pts.length < 3) return;
      const el = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      el.setAttribute("points", pts.map((pt) => (pt[0] * 1280).toFixed(1) + "," + (pt[1] * 720).toFixed(1)).join(" "));
      el.setAttribute("class", "hotspot" + (d.closed ? " is-closed" : "") + (d.kind === "back" ? " is-back" : ""));
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", d.label || "");
      const go = (ev) => { ev.preventDefault(); ev.stopPropagation(); onDoor(d, el); };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") go(ev);
      });
      svg.appendChild(el);
      if (d.to && !d.closed && marked.has(d.to)) appendEventMark(svg, pts, d.kind === "back");
    });
  }
  async function onDoor(d, el) {
    if (traveling) return;
    traveling = true;
    if (el) {
      el.classList.add("is-flash");
      await wait(300);
    }
    if (d.closed || !d.to) {
      if (el) el.classList.remove("is-flash");
      traveling = false;
      toast(d.label || "Cerrado por ahora.");
      return;
    }
    traveling = false;
    travelTo(d.to);
  }
  let traveling = false;
  async function travelTo(locId) {
    const loc = locById(locId);
    if (!loc || traveling) return;
    if (state.phase === "house" && state.location === locId) return;
    traveling = true;
    const prev = state.location;
    const fade = $("travel-fade");
    if (fade) fade.classList.add("is-on");
    await wait(350);
    enterHouse(locId);
    if (fade) {
      fade.offsetWidth;
      fade.classList.remove("is-on");
    }
    await wait(280);
    if (prev && prev !== locId) recoverPaciencia("room");
    await wait(220);
    traveling = false;
    maybeTriggerEvent();
  }
  async function fadeAdvance(kind) {
    traveling = true;
    const fade = $("travel-fade");
    if (fade) fade.classList.add("is-on");
    await wait(350);
    if (kind === "day") {
      state.day = (state.day || 1) + 1;
      state.moment = "mañana";
      state.activityCount = 0;
      toast("Amanece. Día " + state.day + ".");
    } else if (kind === "moment") {
      const times = (typeof TIMES !== "undefined" && TIMES) || ["mañana", "tarde", "noche", "madrugada"];
      const i = times.indexOf(state.moment);
      if (i >= 0 && i < times.length - 1) {
        state.moment = times[i + 1];
        state.activityCount = 0;
        toast("Ahora es de " + (TIME_LABELS[state.moment] || state.moment).toLowerCase() + ".");
      } else if (i === times.length - 1) {
        state.day = (state.day || 1) + 1;
        state.moment = "mañana";
        state.activityCount = 0;
        toast("Amanece. Día " + state.day + ".");
      }
    }
    applyTimeShade();
    renderHUD();
    await refreshRoomVisual();
    autosave();
    if (fade) {
      fade.offsetWidth;
      fade.classList.remove("is-on");
    }
    await wait(500);
    traveling = false;
    if (state.pendingWakeReproach) {
      state.pendingWakeReproach = false;
      const ev = ensureEvaInfo();
      const needRosa = 100;
      const needMorada = 100;
      if ((ev.bars.rosa || 0) < needRosa || (ev.bars.morada || 0) < needMorada) {
        const lines = (typeof EVA_SCENE_LINES !== "undefined" && EVA_SCENE_LINES) || {};
        startTalk([{
          who: "Eva",
          expr: lines.wakeAngryExpr || "molesta",
          text: lines.wakeAngry || "¿Qué haces aquí? Vete a tu cuarto.",
          _onEdit: (v) => {
            if (typeof EVA_SCENE_LINES !== "undefined") EVA_SCENE_LINES.wakeAngry = v;
            saveStoryPatch();
          }
        }]);
        state.pendingLeaveRoom = "cuarto";
      }
    }
  }
  function hideActionScene() {
    const meet = $("eva-meet");
    if (meet) meet.classList.remove("is-scene-only");
    if (!state.evaMeet) {
      showMeetScene(null);
      if (meet) {
        meet.hidden = true;
        meet.classList.remove("has-scene", "is-in", "is-talking");
      }
      const game = $("screen-game");
      if (game) game.classList.remove("is-eva-meet");
    }
  }
  function showActionScene(sceneId) {
    if (!sceneId) return;
    const meet = $("eva-meet");
    if (meet) {
      meet.hidden = false;
      meet.classList.add("is-scene-only");
      meet.classList.remove("is-talking", "is-in");
    }
    const game = $("screen-game");
    if (game) game.classList.add("is-eva-meet");
    showMeetScene(sceneId, { showEmpty: true });
  }
  function openBag(opts) {
    hideModals();
    const giftMode = !!(opts && opts.gift);
    const title = document.querySelector("#modal-bag .modal-title");
    if (title) title.textContent = giftMode ? "Regalar" : "Mochila";
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
          if (giftMode) {
            $("modal-bag").hidden = true;
            tryGift(it);
            return;
          }
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
      img.src = assetUrl(avatar);
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
      body.appendChild(renderEvaInfoSheet());
      if (CODEX.player) {
        const card = document.createElement("article");
        card.className = "phone-codex";
        const h = document.createElement("h3");
        h.textContent = fillName(CODEX.player.name || "Tú", state.name);
        const p = document.createElement("p");
        p.textContent = fillName(CODEX.player.text || "", state.name);
        card.appendChild(h);
        card.appendChild(p);
        body.appendChild(card);
      }
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
      av.src = assetUrl(c.avatar);
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


  /* ---------- v16: Paciencia, Hablar, editor en vivo ---------- */
  function warningAt() {
    return (typeof EVA_RULES !== "undefined" && EVA_RULES.warningAt != null) ? EVA_RULES.warningAt : -80;
  }
  function kickLimit() {
    return (typeof EVA_RULES !== "undefined" && EVA_RULES.kickAt != null) ? EVA_RULES.kickAt : -100;
  }
  function isPacienciaKick(p) {
    const v = p == null ? (ensureEvaInfo().bars.roja || 0) : p;
    return v <= kickLimit();
  }
  function isPacienciaWarn(p) {
    const v = p == null ? (ensureEvaInfo().bars.roja || 0) : p;
    return v <= warningAt() && v > kickLimit();
  }
  function pickElogiarTier(ev) {
    const list = (typeof EVA_ELOGIAR_TIERS !== "undefined" && EVA_ELOGIAR_TIERS) || [{ id: "BASE" }];
    const a = ev.afecto || 0;
    const rosa = ev.bars.rosa || 0;
    const morada = ev.bars.morada || 0;
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      if (!t || t.id === "BASE") return t || { id: "BASE" };
      const okC = t.corazon == null || a >= t.corazon;
      const okR = t.rosa == null || rosa >= t.rosa;
      const okM = t.morada == null || morada >= t.morada;
      if (okC && okR && okM) return t;
    }
    return { id: "BASE" };
  }
  function evaMoodExpr(topic, gain) {
    const ev = ensureEvaInfo();
    const a = ev.afecto || 0;
    const rosa = ev.bars.rosa || 0;
    const morada = ev.bars.morada || 0;
    const pAbs = Math.abs(ev.bars.roja || 0);
    const rules = (typeof EVA_EXPR_RULES !== "undefined" && EVA_EXPR_RULES) || {};
    const half = rules.halfBars != null ? rules.halfBars : 125;
    const full = rules.fullBars != null ? rules.fullBars : 250;
    const bothFull = rosa >= full && morada >= full;
    const bothMid = rosa >= half && morada >= half;
    const pAbsNeed = rules.pacienciaAbs != null ? rules.pacienciaAbs : 80;
    if (a < 0) {
      if (bothFull) {
        const from = (rules.full && rules.full.tristeFrom != null) ? rules.full.tristeFrom : -1;
        if (a <= from) return "triste";
      } else if (bothMid) {
        const mid = rules.mid || {};
        if (a <= (mid.molestaAt != null ? mid.molestaAt : -40)) return "molesta";
        if (a <= (mid.tristeAt != null ? mid.tristeAt : -30)) return "triste";
      } else {
        const low = rules.low || {};
        if (a <= (low.molestaAt != null ? low.molestaAt : -40)) return "molesta";
        if (a <= (low.tristeAt != null ? low.tristeAt : -20)) return "triste";
      }
    }
    if (pAbs >= pAbsNeed && !bothFull) return "molesta";
    if (topic && topic.posExpr) return topic.posExpr;
    if (gain && gain >= 8) return "feliz";
    if (a >= 80) return "feliz";
    if (a >= 30) return "feliz";
    return "neutral";
  }
  function evaPacienciaExpr() {
    return evaMoodExpr();
  }
  let heartClipSeq = 0;
  function renderEvaHeart(afecto, key) {
    const a = clampAfecto(afecto != null ? afecto : 10);
    const wrap = document.createElement("div");
    wrap.className = "phone-eva-heart" + (key === "meet" ? " eva-meet-stats-heart" : "") + (a < 0 ? " is-broken" : "");
    const id = "eva-hclip-" + (key || "x") + "-" + (++heartClipSeq);
    const info = typeof EVA_INFO !== "undefined" ? EVA_INFO : {};
    const posMax = info.afectoMax != null ? info.afectoMax : 200;
    const negMin = info.afectoMin != null ? info.afectoMin : -50;
    let frac = 0;
    if (a >= 0) frac = posMax ? Math.max(0, Math.min(1, a / posMax)) : 0;
    else frac = negMin ? Math.max(0, Math.min(1, Math.abs(a) / Math.abs(negMin))) : 0;
    const top = (24 * (1 - frac)).toFixed(2);
    const h = (24 * frac).toFixed(2);
    const intact = "M12 20.4 S3.2 14.2 3.2 8.8 A4.6 4.6 0 0 1 12 6.7 A4.6 4.6 0 0 1 20.8 8.8 C20.8 14.2 12 20.4 12 20.4 Z";
    const left = "M11.35 20.4 C11.35 20.4 3 14 3 8.8 A4.55 4.55 0 0 1 11.2 6.85 L11.15 7.6 10.35 9.1 11.4 10.5 10.2 12.1 11.45 13.7 10.15 15.4 11.4 17.2 10.55 18.6 11.35 20.4 Z";
    const right = "M12.65 20.4 C12.65 20.4 21 14 21 8.8 A4.55 4.55 0 0 0 12.8 6.85 L12.85 7.6 13.65 9.1 12.6 10.5 13.8 12.1 12.55 13.7 13.85 15.4 12.6 17.2 13.45 18.6 12.65 20.4 Z";
    const crack = "M12 6.85 L11.15 7.6 10.35 9.1 11.4 10.5 10.2 12.1 11.45 13.7 10.15 15.4 11.4 17.2 10.55 18.6 11.35 20.4";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    clip.setAttribute("id", id);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", String(top));
    rect.setAttribute("width", "24");
    rect.setAttribute("height", String(h));
    clip.appendChild(rect);
    defs.appendChild(clip);
    svg.appendChild(defs);
    function path(d, cls) {
      const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
      el.setAttribute("d", d);
      el.setAttribute("class", cls);
      return el;
    }
    if (a < 0) {
      svg.appendChild(path(left, "eva-heart-track"));
      svg.appendChild(path(right, "eva-heart-track"));
      const fl = path(left, "eva-heart-fill eva-heart-broken-fill");
      const fr = path(right, "eva-heart-fill eva-heart-broken-fill");
      fl.setAttribute("clip-path", "url(#" + id + ")");
      fr.setAttribute("clip-path", "url(#" + id + ")");
      svg.appendChild(fl);
      svg.appendChild(fr);
      svg.appendChild(path(crack, "eva-heart-crack"));
    } else {
      svg.appendChild(path(intact, "eva-heart-track"));
      const fill = path(intact, "eva-heart-fill");
      fill.setAttribute("clip-path", "url(#" + id + ")");
      svg.appendChild(fill);
    }
    wrap.appendChild(svg);
    const pct = document.createElement("b");
    pct.textContent = a + "%";
    wrap.appendChild(pct);
    return wrap;
  }
  function fmtDelta(n) {
    const v = Math.round(Number(n) || 0);
    return (v > 0 ? "+" : "") + v;
  }
  function showStatDelta(delta) {
    const host = $("eva-meet") || $("screen-game");
    if (!host || !delta) return;
    host.querySelectorAll(".eva-delta").forEach((el) => el.remove());
    const labels = (typeof EVA_DELTA_LABELS !== "undefined" && EVA_DELTA_LABELS) || {
      afecto: "Corazón", paciencia: "Paciencia", rosa: "Rosa", morada: "Morada"
    };
    const order = [["afecto", labels.afecto], ["paciencia", labels.paciencia], ["rosa", labels.rosa], ["morada", labels.morada]];
    const parts = [];
    order.forEach((pair) => {
      const v = delta[pair[0]];
      if (!v) return;
      parts.push(pair[1] + " " + fmtDelta(v));
    });
    if (!parts.length) return;
    const el = document.createElement("div");
    el.className = "eva-delta";
    el.textContent = parts.join("   ");
    host.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
  }
  function pacienciaRecoverCfg() {
    return (typeof EVA_PACIENCIA_RECOVERY !== "undefined" && EVA_PACIENCIA_RECOVERY) || {};
  }
  function pacienciaRecoverAmount(kind) {
    const cfg = pacienciaRecoverCfg();
    const base = Number(cfg[kind]) || 0;
    if (!base) return 0;
    const ev = ensureEvaInfo();
    const at = cfg.heartBonusAt != null ? Number(cfg.heartBonusAt) : 100;
    const bonus = (ev.afecto || 0) >= at ? (Number(cfg.heartBonus) || 0) : 0;
    return base + bonus;
  }
  function showPacienciaRecover(n) {
    const v = Math.round(Number(n) || 0);
    if (v <= 0) return;
    const meet = $("eva-meet");
    const host = (meet && !meet.hidden) ? meet : ($("screen-game") || meet);
    if (!host) return;
    host.querySelectorAll(".eva-delta-paciencia").forEach((el) => el.remove());
    const el = document.createElement("div");
    el.className = "eva-delta eva-delta-paciencia";
    el.textContent = "+" + v + " Paciencia";
    host.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
  }
  function recoverPaciencia(kind) {
    const amount = pacienciaRecoverAmount(kind);
    if (!amount) return 0;
    const ev = ensureEvaInfo();
    const before = ev.bars.roja || 0;
    ev.bars.roja = clampBarVal("roja", before + amount);
    const applied = ev.bars.roja - before;
    autosave();
    refreshEvaInfoUI();
    if (applied > 0) showPacienciaRecover(amount);
    return applied;
  }
  function setEditorLive(on) {
    editorLive = !!on;
    try { sessionStorage.setItem("eva_novela_editor_live", editorLive ? "1" : "0"); } catch (e) { /* ignore */ }
    refreshEditorLiveBar();
  }
  function refreshEditorLiveBar() {
    const bar = $("editor-live-bar");
    if (!bar) return;
    const game = $("screen-game");
    const gameOn = game && game.classList.contains("is-on");
    if (game) game.classList.toggle("is-editor-live", !!editorLive);
    const ejecting = $("eva-eject") && !$("eva-eject").hidden;
    bar.hidden = !editorLive || !gameOn || ejecting;
  }
  function makePencil(onClick, label) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ed-pencil";
    b.setAttribute("aria-label", label || "Editar");
    b.innerHTML = PENCIL_SVG;
    b.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); onClick(); });
    return b;
  }
  function openEditModal(title, value, onSave) {
    editSaveFn = onSave;
    if ($("edit-title")) $("edit-title").textContent = title || "Editar";
    if ($("input-edit")) $("input-edit").value = value == null ? "" : String(value);
    if ($("modal-edit")) $("modal-edit").hidden = false;
    setTimeout(() => { if ($("input-edit")) $("input-edit").focus(); }, 50);
  }
  function closeEditModal() {
    editSaveFn = null;
    if ($("modal-edit")) $("modal-edit").hidden = true;
  }
  function confirmEditModal() {
    const v = $("input-edit") ? $("input-edit").value : "";
    const fn = editSaveFn;
    closeEditModal();
    if (fn) fn(v);
  }
  function clearLinePencil() {
    const box = $("dialogue");
    if (!box) return;
    const p = box.querySelector(".ed-pencil");
    if (p) p.remove();
  }
  function bindLinePencil(line) {
    const box = $("dialogue");
    if (!box) return;
    clearLinePencil();
    if (!editorLive || !line) return;
    box.appendChild(makePencil(() => {
      openEditModal("Editar línea", line.text || "", (v) => {
        line.text = v;
        if (typeof line._onEdit === "function") line._onEdit(v);
        saveStoryPatch();
        const filled = fillName(v, state.name);
        state.typedFull = filled;
        if ($("line")) $("line").textContent = filled;
      });
    }, "Editar línea"));
  }
  function appendMeetOption(box, label, onClick, onEdit, onRemove) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "eva-meet-opt";
    b.textContent = fillName(label || "", state.name);
    b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    if (editorLive && onEdit) {
      const wrap = document.createElement("div");
      wrap.className = "ed-row";
      wrap.appendChild(b);
      wrap.appendChild(makePencil(onEdit));
      if (onRemove) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "ed-del";
        del.textContent = "Quitar";
        del.addEventListener("click", (e) => { e.stopPropagation(); onRemove(); });
        wrap.appendChild(del);
      }
      box.appendChild(wrap);
    } else {
      box.appendChild(b);
    }
  }
  function appendAddButton(box, label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ed-add";
    b.textContent = label;
    b.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    box.appendChild(b);
  }
  function openHablarGroup(id) {
    if (id === "elogiar" || id === "charlar") {
      state.meetSub = id;
      buildEvaMeetMenu();
      return;
    }
    const opt = ((EVA_HABLAR && EVA_HABLAR.options) || []).find((o) => o.id === id);
    if (opt && Array.isArray(EVA_HABLAR[id])) {
      state.meetSub = id;
      buildEvaMeetMenu();
      return;
    }
    toast("Todavía no hay temas en esta opción.");
  }
  function pickReaction(list, afecto) {
    const arr = (list || []).slice().sort((a, b) => (a.maxAfecto == null ? 100 : a.maxAfecto) - (b.maxAfecto == null ? 100 : b.maxAfecto));
    for (let i = 0; i < arr.length; i++) {
      const cap = arr[i].maxAfecto == null ? 100 : arr[i].maxAfecto;
      if (afecto <= cap) return arr[i];
    }
    return arr[arr.length - 1] || { expr: "neutral", eva: "…" };
  }
  function applyReaction(r) {
    if (!r) return;
    if (r.afecto) addAfecto(r.afecto);
    if (r.vinculo) addEvaInfoBar("rosa", r.vinculo);
    if (r.confianza) addEvaInfoBar("morada", r.confianza);
    if (r.paciencia) addEvaInfoBar("roja", r.paciencia);
    if (isPacienciaKick()) state.pendingKick = true;
  }
  function confianzaNow() {
    return ensureEvaInfo().bars.morada || 0;
  }
  function applyStatDelta(d) {
    if (!d) return { afecto: 0, paciencia: 0, rosa: 0, morada: 0 };
    const ev = ensureEvaInfo();
    const beforeA = ev.afecto || 0;
    const beforeR = ev.bars.rosa || 0;
    const beforeM = ev.bars.morada || 0;
    const beforeP = ev.bars.roja || 0;
    if (d.afecto) ev.afecto = clampAfecto(beforeA + (Number(d.afecto) || 0));
    if (d.rosa) ev.bars.rosa = clampBarVal("rosa", beforeR + (Number(d.rosa) || 0));
    if (d.morada) ev.bars.morada = clampBarVal("morada", beforeM + (Number(d.morada) || 0));
    if (d.vinculo) ev.bars.rosa = clampBarVal("rosa", ev.bars.rosa + (Number(d.vinculo) || 0));
    if (d.confianza) ev.bars.morada = clampBarVal("morada", ev.bars.morada + (Number(d.confianza) || 0));
    if (d.paciencia) ev.bars.roja = clampBarVal("roja", beforeP + (Number(d.paciencia) || 0));
    if (isPacienciaKick()) state.pendingKick = true;
    autosave();
    refreshEvaInfoUI();
    return {
      afecto: ev.afecto - beforeA,
      rosa: ev.bars.rosa - beforeR,
      morada: ev.bars.morada - beforeM,
      paciencia: ev.bars.roja - beforeP
    };
  }
  let exprSeqTicket = 0;
  function exprSeqActive() {
    return !!state.exprSeq;
  }
  function stopExprSeq() {
    exprSeqTicket += 1;
    state.exprSeq = null;
  }
  function playExprSeq(seq) {
    const steps = (seq || []).filter(Boolean);
    if (!steps.length) return;
    const ticket = ++exprSeqTicket;
    const cfg = (typeof EVA_ELOGIAR_SEQ !== "undefined" && EVA_ELOGIAR_SEQ) || {};
    const waitMs = [cfg.firstMs != null ? cfg.firstMs : 1200, cfg.secondMs != null ? cfg.secondMs : 1200];
    state.exprSeq = { steps: steps, i: 0 };
    (async function run() {
      for (let i = 0; i < steps.length; i++) {
        if (ticket !== exprSeqTicket) return;
        state.exprSeq.i = i;
        await setExpression("eva", steps[i], { instant: i === 0 });
        if (i < steps.length - 1) {
          await wait(waitMs[i] != null ? waitMs[i] : 1200);
        }
      }
      if (ticket === exprSeqTicket) state.exprSeq = { steps: steps, i: steps.length - 1, done: true };
    })();
  }
  function playHablarTopic(group, topic) {
    hideEvaMeetStats();
    const ev = ensureEvaInfo();
    let expr = "neutral";
    let evaText = topic.eva || "…";
    let onEditEva = (v) => { topic.eva = v; };
    let gain = 0;
    let seq = null;
    if (topic.effects) {
      const tier = pickElogiarTier(ev);
      const pack = topic.effects[tier.id] || topic.effects.BASE || {};
      const applied = applyStatDelta(pack);
      gain = applied.afecto || 0;
      seq = pack.seq || null;
      expr = (seq && seq[0]) || evaMoodExpr(topic, gain);
      showStatDelta(applied);
    } else {
      const reaction = pickReaction(topic.reactions, ev.afecto || 0);
      applyReaction(reaction);
      expr = reaction.expr || evaMoodExpr(topic);
      evaText = reaction.eva || topic.eva || "…";
      onEditEva = (v) => { if (reaction) reaction.eva = v; else topic.eva = v; };
    }
    const lines = [];
    if (topic.player) {
      lines.push({
        who: state.name || "Tú",
        text: topic.player,
        _onEdit: (v) => { topic.player = v; }
      });
    }
    lines.push({
      who: "Eva",
      expr: expr,
      text: evaText,
      _onEdit: onEditEva
    });
    const p = ensureEvaInfo().bars.roja || 0;
    if (isPacienciaWarn(p) && !state.pendingKick) {
      const w = (typeof EVA_RULES !== "undefined" && EVA_RULES.warning) || {};
      lines.push({ who: "Eva", expr: (seq && seq[seq.length - 1]) || evaMoodExpr(topic, gain), text: w.text || "Estoy perdiendo la paciencia." });
    }
    beginMeetTalk(lines, null, { countsAsActivity: true });
    if (seq) playExprSeq(seq);
  }
  function playUnlockable(item, ok, locked) {
    hideEvaMeetStats();
    const need = item && item.need != null ? item.need : 0;
    const allowed = confianzaNow() >= need;
    const r = allowed ? (ok || {}) : (locked || { expr: "molesta", eva: "Todavía no, {nombre}.", paciencia: -5 });
    const use = {
      expr: r.expr || (allowed ? "feliz" : "molesta"),
      eva: r.eva || r.text || (allowed ? "De acuerdo." : "Todavía no."),
      afecto: r.afecto,
      vinculo: r.vinculo,
      confianza: r.confianza,
      paciencia: r.paciencia
    };
    applyReaction(use);
    if (allowed && item && item.id) recoverPaciencia(item.id);
    beginMeetTalk([{
      who: "Eva",
      expr: use.expr,
      text: use.eva,
      _onEdit: (v) => {
        if (allowed && ok) ok.eva = v;
        else if (!allowed && locked) locked.eva = v;
      }
    }], null, { countsAsActivity: false });
  }
  function findAccionOption(id) {
    const opts = (typeof EVA_MENU !== "undefined" && EVA_MENU.accion && EVA_MENU.accion.options) || [];
    for (let i = 0; i < opts.length; i++) {
      const g = opts[i];
      if (g && g.id === id) return g;
      const hit = ((g && g.options) || []).find((s) => s && s.id === id);
      if (hit) return hit;
    }
    return null;
  }
  function playAccionOption(opt) {
    if (!opt) return;
    if (!opt.effects) {
      playUnlockable(opt, opt.ok, opt.locked);
      return;
    }
    hideEvaMeetStats();
    const ev = ensureEvaInfo();
    const tier = pickElogiarTier(ev);
    const pack = opt.effects[tier.id] || opt.effects.BASE || {};
    const applied = applyStatDelta(pack);
    showStatDelta(applied);
    const evaText = pack.eva || opt.eva || "…";
    const expr = pack.expr || (pack.seq && pack.seq[0]) || evaMoodExpr(opt, applied.afecto || 0);
    const lines = [];
    if (opt.player) {
      lines.push({
        who: state.name || "Tú",
        text: opt.player,
        _onEdit: (v) => { opt.player = v; saveStoryPatch(); }
      });
    }
    lines.push({
      who: "Eva",
      expr: expr,
      text: evaText,
      _onEdit: (v) => {
        pack.eva = v;
        saveStoryPatch();
      }
    });
    const p = ensureEvaInfo().bars.roja || 0;
    if (isPacienciaWarn(p) && !state.pendingKick) {
      const w = (typeof EVA_RULES !== "undefined" && EVA_RULES.warning) || {};
      lines.push({ who: "Eva", expr: (pack.seq && pack.seq[pack.seq.length - 1]) || expr, text: w.text || "Estoy perdiendo la paciencia." });
    }
    beginMeetTalk(lines, null, { countsAsActivity: true });
    if (pack.seq) playExprSeq(pack.seq);
  }

  async function showMeetScene(sceneId, opts) {
    meetSceneId = sceneId || null;
    const slot = $("eva-scene-slot");
    const meet = $("eva-meet");
    if (!slot) return;
    if (!sceneId) {
      slot.hidden = true;
      if (meet) meet.classList.remove("has-scene");
      if ($("btn-agregar-foto")) $("btn-agregar-foto").hidden = true;
      if ($("eva-scene-bg")) $("eva-scene-bg").style.backgroundImage = "";
      return;
    }
    let media = { imageURL: null };
    try { media = await MediaStore.mediaFor(sceneId); } catch (e) { /* ignore */ }
    const has = !!(media && media.imageURL);
    const showEmpty = !!(opts && opts.showEmpty);
    if (!has && !editorLive && !showEmpty) {
      slot.hidden = true;
      if (meet) meet.classList.remove("has-scene");
      if ($("btn-agregar-foto")) $("btn-agregar-foto").hidden = true;
      return;
    }
    slot.hidden = false;
    slot.classList.toggle("is-empty", !has);
    if (meet) meet.classList.add("has-scene");
    if ($("eva-scene-bg")) $("eva-scene-bg").style.backgroundImage = has ? "url('" + media.imageURL + "')" : "";
    if ($("btn-agregar-foto")) $("btn-agregar-foto").hidden = !editorLive;
  }
  function ejectFromHouse() {
    state.ejected = true;
    state.pendingKick = false;
    state.talking = null;
    state.evaMeet = false;
    closeEvaMeet(true);
    showEvaSprite(false);
    hideModals();
    showDialogue(false);
    const rules = (typeof EVA_RULES !== "undefined" && EVA_RULES.kick) || {};
    if ($("eva-eject-title")) $("eva-eject-title").textContent = rules.title || "Eva te echó de la casa";
    if ($("eva-eject-note")) $("eva-eject-note").textContent = rules.note || "";
    if ($("btn-eject-title")) $("btn-eject-title").textContent = rules.button || "Volver al título";
    if ($("eva-eject")) $("eva-eject").hidden = false;
    refreshEditorLiveBar();
    const game = $("screen-game");
    if (game) {
      game.classList.add("is-on");
      showScreen("game");
    }
    autosave();
  }
  function leaveEjectToTitle() {
    if ($("eva-eject")) $("eva-eject").hidden = true;
    hideModals();
    refreshTitleButtons();
    showScreen("title");
  }
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  function dataURLToBlob(dataUrl) {
    const m = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    if (!m) return null;
    const mime = m[1] || "application/octet-stream";
    const bin = atob(m[3]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
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
      setEditorLive(true);
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
    if (media.imageURL || item.defaultImage) {
      img.src = media.imageURL || item.defaultImage;
      pre.appendChild(img);
    } else {
      const empty = document.createElement("div");
      empty.className = "editor-slot-empty";
      empty.textContent = "Agregar foto";
      pre.appendChild(empty);
    }
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
    actions.appendChild(fileButton(item.kind === "scene" || !item.defaultImage ? "Agregar foto" : "Agregar imagen", "image/*", async (f) => {
      await MediaStore.put(item.id, "image", f, f.name);
      await renderEditor();
    }));
    if (item.kind !== "scene") actions.appendChild(fileButton("Agregar video", "video/*", async (f) => {
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
  async function renderEvaScenesCard() {
    const card = document.createElement("article");
    card.className = "editor-card editor-scenes-card";
    const h = document.createElement("h3");
    h.textContent = "Escenas de Eva";
    card.appendChild(h);
    const note = document.createElement("p");
    note.className = "editor-note";
    note.textContent = "Cuando Eva está en una habitación con una variante para su actividad, esa foto reemplaza el fondo y el sprite. Puedes cambiar cada foto.";
    card.appendChild(note);
    const list = (typeof EVA_SCENES !== "undefined" && EVA_SCENES) || [];
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      const media = await MediaStore.mediaFor(sceneMediaKey(v.id));
      const row = document.createElement("div");
      row.className = "scene-variant-row";
      const pre = document.createElement("div");
      pre.className = "editor-previews";
      const src = media.imageURL || (v.image ? assetUrl(v.image) : "");
      if (src) {
        const img = document.createElement("img");
        img.className = "prev";
        img.alt = v.label || v.id;
        img.src = src;
        pre.appendChild(img);
      } else {
        const empty = document.createElement("div");
        empty.className = "editor-slot-empty";
        empty.textContent = "Agregar foto";
        pre.appendChild(empty);
      }
      row.appendChild(pre);
      const side = document.createElement("div");
      side.className = "scene-variant-meta";
      const lab = document.createElement("p");
      lab.className = "scene-variant-label";
      lab.textContent = v.label || v.id;
      side.appendChild(lab);
      const actions = document.createElement("div");
      actions.className = "editor-actions";
      actions.appendChild(fileButton("Agregar foto", "image/*", async (f) => {
        await MediaStore.put(sceneMediaKey(v.id), "image", f, f.name);
        await renderEditor();
      }));
      if (media.image) {
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "btn btn-ghost btn-tiny";
        rm.textContent = "Quitar";
        rm.addEventListener("click", async () => {
          await MediaStore.remove(sceneMediaKey(v.id), "image");
          await renderEditor();
        });
        actions.appendChild(rm);
      }
      side.appendChild(actions);
      row.appendChild(side);
      card.appendChild(row);
    }
    const lines = (typeof EVA_SCENE_LINES !== "undefined" && EVA_SCENE_LINES) || {};
    const actionsT = typeof EVA_ROOM_ACTIONS !== "undefined" ? EVA_ROOM_ACTIONS : {};
    const fields = [
      { key: "wakeAngry", label: "Al despertar a su lado (si no cumple)", get: () => lines.wakeAngry || "", set: (v) => { lines.wakeAngry = v; } },
      { key: "dormirLadoLabel", label: "Acción: Dormir a su lado", get: () => (actionsT.dormirLado && actionsT.dormirLado.label) || "", set: (v) => { if (actionsT.dormirLado) actionsT.dormirLado.label = v; } },
      { key: "dormirLadoText", label: "Texto: Dormir a su lado", get: () => (actionsT.dormirLado && actionsT.dormirLado.text) || "", set: (v) => { if (actionsT.dormirLado) actionsT.dormirLado.text = v; } },
      { key: "verTvEvaLabel", label: "Acción: Ver TV junto a Eva", get: () => (actionsT.verTvEva && actionsT.verTvEva.label) || "", set: (v) => { if (actionsT.verTvEva) actionsT.verTvEva.label = v; } },
      { key: "verTvEvaText", label: "Texto: Ver TV junto a Eva", get: () => (actionsT.verTvEva && actionsT.verTvEva.text) || "", set: (v) => { if (actionsT.verTvEva) actionsT.verTvEva.text = v; } },
      { key: "dormirPiernasLabel", label: "Acción: Dormir en sus piernas", get: () => (actionsT.dormirPiernas && actionsT.dormirPiernas.label) || "", set: (v) => { if (actionsT.dormirPiernas) actionsT.dormirPiernas.label = v; } },
      { key: "dormirPiernasText", label: "Texto: Dormir en sus piernas", get: () => (actionsT.dormirPiernas && actionsT.dormirPiernas.text) || "", set: (v) => { if (actionsT.dormirPiernas) actionsT.dormirPiernas.text = v; } },
      { key: "mejorNo", label: "Dormir en sus piernas (si no cumple)", get: () => (actionsT.dormirPiernas && actionsT.dormirPiernas.deniedText) || "", set: (v) => { if (actionsT.dormirPiernas) actionsT.dormirPiernas.deniedText = v; } }
    ];
    fields.forEach((f) => {
      const row = document.createElement("div");
      row.className = "seq-row";
      const lab = document.createElement("label");
      lab.textContent = f.label;
      const isLong = /Texto|despiert|cumple/.test(f.key + f.label);
      const inp = isLong ? document.createElement("textarea") : document.createElement("input");
      if (!isLong) inp.type = "text";
      inp.value = f.get();
      const save = () => { f.set(inp.value); saveStoryPatch(); };
      inp.addEventListener("change", save);
      row.appendChild(lab);
      row.appendChild(inp);
      row.appendChild(makePencil(() => {
        openEditModal(f.label, inp.value, (v) => { inp.value = v; save(); });
      }, "Editar"));
      card.appendChild(row);
    });
    return card;
  }
  async function renderEditor() {
    const list = $("editor-list");
    list.innerHTML = "";
    list.appendChild(renderBarsEditorCard());
    list.appendChild(renderAvisoCard());
    list.appendChild(renderIntroCineCard());
    list.appendChild(renderPacienciaRecoverCard());
    list.appendChild(renderEvaScheduleCard());
    list.appendChild(renderRoomActionsCard());
    list.appendChild(await renderEvaScenesCard());
    list.appendChild(renderElogiarSeqCard());
    list.appendChild(renderAccionEffectsCard());
    for (const item of EDITOR_ITEMS.filter((i) => i.kind === "scene")) {
      list.appendChild(await renderMediaCard(item));
    }
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

  function parseExprSeq(text) {
    return String(text || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  }
  function renderAccionEffectsCard() {
    const card = document.createElement("article");
    card.className = "editor-card editor-seq-card editor-accion-card";
    const h = document.createElement("h3");
    h.textContent = "Beso, Masaje y Tocar";
    card.appendChild(h);
    const note = document.createElement("p");
    note.className = "editor-note";
    note.textContent = "Valores exactos por nivel (BASE, T50, T100, MAX). Corazón, Rosa, Morada y Paciencia. La etiqueta de cada opción se puede cambiar, incluida Opción C.";
    card.appendChild(note);
    const tiers = ["BASE", "T50", "T100", "MAX"];
    const fields = [
      ["afecto", "Corazón"],
      ["rosa", "Rosa"],
      ["morada", "Morada"],
      ["paciencia", "Paciencia"]
    ];
    const groups = (typeof EVA_MENU !== "undefined" && EVA_MENU.accion && EVA_MENU.accion.options) || [];
    const wanted = { beso: 1, masaje: 1, tocar: 1 };
    groups.filter((g) => g && wanted[g.id]).forEach((group) => {
      const block = document.createElement("div");
      block.className = "seq-opt";
      const title = document.createElement("h4");
      const titleInp = document.createElement("input");
      titleInp.type = "text";
      titleInp.value = group.label || group.id;
      titleInp.addEventListener("change", () => {
        group.label = titleInp.value.trim() || group.label;
        titleInp.value = group.label;
        saveStoryPatch();
      });
      title.appendChild(titleInp);
      block.appendChild(title);
      (group.options || []).forEach((opt) => {
        if (!opt) return;
        const sub = document.createElement("div");
        sub.className = "accion-opt";
        const head = document.createElement("div");
        head.className = "seq-row";
        const lab = document.createElement("label");
        lab.textContent = "Etiqueta";
        const nameInp = document.createElement("input");
        nameInp.type = "text";
        nameInp.value = opt.label || "";
        nameInp.addEventListener("change", () => {
          opt.label = nameInp.value.trim();
          nameInp.value = opt.label;
          saveStoryPatch();
        });
        head.appendChild(lab);
        head.appendChild(nameInp);
        head.appendChild(makePencil(() => {
          openEditModal("Etiqueta", nameInp.value, (v) => {
            nameInp.value = v;
            opt.label = v;
            saveStoryPatch();
          });
        }, "Editar etiqueta"));
        sub.appendChild(head);
        const playerRow = document.createElement("div");
        playerRow.className = "seq-row";
        const plab = document.createElement("label");
        plab.textContent = "Tú";
        const pinp = document.createElement("input");
        pinp.type = "text";
        pinp.value = opt.player || "";
        pinp.addEventListener("change", () => {
          opt.player = pinp.value;
          saveStoryPatch();
        });
        playerRow.appendChild(plab);
        playerRow.appendChild(pinp);
        playerRow.appendChild(makePencil(() => {
          openEditModal("Lo que dices", pinp.value, (v) => {
            pinp.value = v;
            opt.player = v;
            saveStoryPatch();
          });
        }, "Editar línea"));
        sub.appendChild(playerRow);
        if (!opt.effects) opt.effects = {};
        tiers.forEach((tier) => {
          if (!opt.effects[tier]) opt.effects[tier] = { afecto: 0, rosa: 0, morada: 0, paciencia: 0, eva: "…", expr: "neutral", skipBalance: true };
          const pack = opt.effects[tier];
          pack.skipBalance = true;
          const row = document.createElement("div");
          row.className = "accion-tier";
          const tlab = document.createElement("div");
          tlab.className = "accion-tier-name";
          tlab.textContent = tier;
          row.appendChild(tlab);
          const nums = document.createElement("div");
          nums.className = "accion-nums";
          fields.forEach((pair) => {
            const cell = document.createElement("label");
            cell.textContent = pair[1];
            const inp = document.createElement("input");
            inp.type = "number";
            inp.step = "1";
            inp.value = pack[pair[0]] != null ? pack[pair[0]] : 0;
            const save = () => {
              const n = Number(inp.value);
              pack[pair[0]] = isFinite(n) ? n : 0;
              pack.skipBalance = true;
              opt.skipBalance = true;
              inp.value = pack[pair[0]];
              saveStoryPatch();
            };
            inp.addEventListener("change", save);
            cell.appendChild(inp);
            nums.appendChild(cell);
          });
          row.appendChild(nums);
          const evaRow = document.createElement("div");
          evaRow.className = "seq-row";
          const elab = document.createElement("label");
          elab.textContent = "Eva · " + tier;
          const einp = document.createElement("input");
          einp.type = "text";
          einp.value = pack.eva || "";
          einp.addEventListener("change", () => {
            pack.eva = einp.value;
            saveStoryPatch();
          });
          evaRow.appendChild(elab);
          evaRow.appendChild(einp);
          evaRow.appendChild(makePencil(() => {
            openEditModal((opt.label || opt.id) + " · " + tier, einp.value, (v) => {
              einp.value = v;
              pack.eva = v;
              saveStoryPatch();
            });
          }, "Editar respuesta"));
          row.appendChild(evaRow);
          sub.appendChild(row);
        });
        block.appendChild(sub);
      });
      card.appendChild(block);
    });
    return card;
  }
  function renderElogiarSeqCard() {
    const card = document.createElement("article");
    card.className = "editor-card editor-seq-card";
    const h = document.createElement("h3");
    h.textContent = "Reacciones de Elogiar";
    card.appendChild(h);
    const note = document.createElement("p");
    note.className = "editor-note";
    note.textContent = "Tres expresiones por nivel: primera, segunda y resto. Separa con comas (por ejemplo: feliz, sonrojada, neutral). La primera y la segunda duran 1.2 s.";
    card.appendChild(note);
    const times = document.createElement("div");
    times.className = "seq-times";
    const cfg = (typeof EVA_ELOGIAR_SEQ !== "undefined" && EVA_ELOGIAR_SEQ) || { firstMs: 1200, secondMs: 1200 };
    [["firstMs", "Primera (ms)"], ["secondMs", "Segunda (ms)"]].forEach((pair) => {
      const lab = document.createElement("label");
      lab.textContent = pair[1];
      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "200";
      inp.step = "100";
      inp.value = cfg[pair[0]] != null ? cfg[pair[0]] : 1200;
      inp.addEventListener("change", () => {
        if (typeof EVA_ELOGIAR_SEQ === "undefined") return;
        EVA_ELOGIAR_SEQ[pair[0]] = Math.max(200, Number(inp.value) || 1200);
        saveStoryPatch();
      });
      lab.appendChild(inp);
      times.appendChild(lab);
    });
    card.appendChild(times);
    const tiers = ["BASE", "T50", "T100", "MAX"];
    const list = (typeof EVA_HABLAR !== "undefined" && EVA_HABLAR.elogiar) || [];
    list.forEach((opt) => {
      const block = document.createElement("div");
      block.className = "seq-opt";
      const title = document.createElement("h4");
      title.textContent = opt.label || opt.id;
      block.appendChild(title);
      if (!opt.effects) opt.effects = {};
      tiers.forEach((tier) => {
        if (!opt.effects[tier]) opt.effects[tier] = { afecto: 0, paciencia: 0, rosa: 0, morada: 0, seq: ["neutral", "neutral", "neutral"] };
        const row = document.createElement("div");
        row.className = "seq-row";
        const lab = document.createElement("label");
        lab.textContent = tier;
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = (opt.effects[tier].seq || []).join(", ");
        const save = () => {
          opt.effects[tier].seq = parseExprSeq(inp.value);
          inp.value = opt.effects[tier].seq.join(", ");
          saveStoryPatch();
        };
        inp.addEventListener("change", save);
        row.appendChild(lab);
        row.appendChild(inp);
        row.appendChild(makePencil(() => {
          openEditModal((opt.label || opt.id) + " · " + tier, inp.value, (v) => {
            inp.value = v;
            save();
          });
        }, "Editar reacción"));
        block.appendChild(row);
      });
      card.appendChild(block);
    });
    return card;
  }


  function formatCleaningDay(jobs) {
    return (jobs || []).map((j) => (j.slot || "") + ":" + (j.room || "")).filter((s) => s !== ":").join(", ");
  }
  function parseCleaningDay(text) {
    return String(text || "").split(",").map((part) => {
      const s = part.trim();
      if (!s) return null;
      const i = s.indexOf(":");
      if (i < 0) return { slot: s, room: "" };
      return { slot: s.slice(0, i).trim(), room: s.slice(i + 1).trim() };
    }).filter((j) => j && j.slot && j.room);
  }
  function renderEvaScheduleCard() {
    const card = document.createElement("article");
    card.className = "editor-card editor-schedule-card";
    const h = document.createElement("h3");
    h.textContent = "Horario de Eva";
    card.appendChild(h);
    const note = document.createElement("p");
    note.className = "editor-note";
    note.textContent = "Día 1 es lunes. En cada franja Eva se mueve dos veces. Escribe las habitaciones de cada franja (separadas por coma) y el plan de limpieza: mañana:cocina, tarde:sala.";
    card.appendChild(note);
    if (typeof EVA_SCHEDULE === "undefined") return card;
    const sch = EVA_SCHEDULE;
    const slots = ["mañana", "tarde", "noche", "madrugada"];
    const poolBox = document.createElement("div");
    poolBox.className = "schedule-pools";
    slots.forEach((slot) => {
      const row = document.createElement("div");
      row.className = "seq-row";
      const lab = document.createElement("label");
      lab.textContent = (typeof TIME_LABELS !== "undefined" && TIME_LABELS[slot]) || slot;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = ((sch.pools && sch.pools[slot]) || []).join(", ");
      inp.addEventListener("change", () => {
        if (!sch.pools) sch.pools = {};
        sch.pools[slot] = inp.value.split(",").map((s) => s.trim()).filter(Boolean);
        saveStoryPatch();
      });
      row.appendChild(lab);
      row.appendChild(inp);
      poolBox.appendChild(row);
    });
    card.appendChild(poolBox);
    const cleanTitle = document.createElement("h4");
    cleanTitle.textContent = "Plan de limpieza (lunes a domingo)";
    card.appendChild(cleanTitle);
    const days = sch.weekdays || [];
    if (!Array.isArray(sch.cleaning)) sch.cleaning = days.map(() => []);
    days.forEach((name, i) => {
      const row = document.createElement("div");
      row.className = "seq-row";
      const lab = document.createElement("label");
      lab.textContent = name;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = formatCleaningDay(sch.cleaning[i] || []);
      inp.addEventListener("change", () => {
        sch.cleaning[i] = parseCleaningDay(inp.value);
        inp.value = formatCleaningDay(sch.cleaning[i]);
        saveStoryPatch();
      });
      row.appendChild(lab);
      row.appendChild(inp);
      card.appendChild(row);
    });
    return card;
  }
  function renderRoomActionsCard() {
    const card = document.createElement("article");
    card.className = "editor-card editor-room-actions-card";
    const h = document.createElement("h3");
    h.textContent = "Acciones de cada habitación";
    card.appendChild(h);
    const note = document.createElement("p");
    note.className = "editor-note";
    note.textContent = "Puedes cambiar el texto de cada botón y la línea que se ve al usarlo. «Ayudar a Eva» solo aparece cuando ella está limpiando.";
    card.appendChild(note);
    if (typeof EVA_ROOM_ACTIONS !== "undefined" && EVA_ROOM_ACTIONS.ayudarEva) {
      const a = EVA_ROOM_ACTIONS.ayudarEva;
      const row = document.createElement("div");
      row.className = "seq-row";
      const lab = document.createElement("label");
      lab.textContent = "Ayudar a Eva";
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = a.label || "";
      inp.addEventListener("change", () => { a.label = inp.value; saveStoryPatch(); });
      row.appendChild(lab);
      row.appendChild(inp);
      row.appendChild(makePencil(() => {
        openEditModal("Línea de Ayudar a Eva", a.text || "", (v) => { a.text = v; saveStoryPatch(); });
      }, "Editar línea"));
      card.appendChild(row);
    }
    (HOUSE.locations || []).forEach((loc) => {
      const block = document.createElement("div");
      block.className = "room-act-block";
      const title = document.createElement("h4");
      title.textContent = loc.name || loc.id;
      block.appendChild(title);
      const acts = loc.actions || [];
      if (!acts.length) {
        const empty = document.createElement("p");
        empty.className = "editor-note";
        empty.textContent = "Sin acciones fijas.";
        block.appendChild(empty);
      }
      const walk = (act, prefix) => {
        const row = document.createElement("div");
        row.className = "seq-row";
        const lab = document.createElement("label");
        lab.textContent = prefix || "Acción";
        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = act.label || "";
        inp.addEventListener("change", () => { act.label = inp.value; saveStoryPatch(); });
        row.appendChild(lab);
        row.appendChild(inp);
        row.appendChild(makePencil(() => {
          openEditModal(act.label || "Línea", act.text || "", (v) => { act.text = v; saveStoryPatch(); });
        }, "Editar línea"));
        block.appendChild(row);
        if (act.denyTalk || act.deniedText != null) {
          const drow = document.createElement("div");
          drow.className = "seq-row";
          const dlab = document.createElement("label");
          dlab.textContent = "Negativa";
          const dinp = document.createElement("input");
          dinp.type = "text";
          dinp.value = act.deniedText || "";
          const saveDenied = () => { act.deniedText = dinp.value; saveStoryPatch(); };
          dinp.addEventListener("change", saveDenied);
          drow.appendChild(dlab);
          drow.appendChild(dinp);
          drow.appendChild(makePencil(() => {
            openEditModal("Negativa de " + (act.label || "acción"), dinp.value, (v) => {
              dinp.value = v;
              saveDenied();
            });
          }, "Editar negativa"));
          block.appendChild(drow);
        }
        (act.options || []).forEach((opt) => walk(opt, act.label || "Opción"));
      };
      acts.forEach((act) => walk(act, loc.name));
      card.appendChild(block);
    });
    return card;
  }

  function renderAvisoCard() {
    const card = document.createElement("article");
    card.className = "editor-card editor-aviso-card";
    const h = document.createElement("h3");
    h.textContent = "Aviso inicial";
    card.appendChild(h);
    const note = document.createElement("p");
    note.className = "editor-note";
    note.textContent = "Este texto se muestra al abrir el juego, antes de la pantalla de título.";
    card.appendChild(note);
    if (typeof AVISO === "undefined") return card;
    const fields = [
      ["title", "Título"],
      ["text", "Texto"],
      ["button", "Botón"]
    ];
    fields.forEach((pair) => {
      const row = document.createElement("div");
      row.className = "seq-row";
      const lab = document.createElement("label");
      lab.textContent = pair[1];
      const isText = pair[0] === "text";
      const inp = isText ? document.createElement("textarea") : document.createElement("input");
      if (!isText) inp.type = "text";
      inp.value = AVISO[pair[0]] != null ? AVISO[pair[0]] : "";
      const save = () => {
        AVISO[pair[0]] = inp.value;
        saveStoryPatch();
        fillAvisoScreen();
      };
      inp.addEventListener("change", save);
      row.appendChild(lab);
      row.appendChild(inp);
      row.appendChild(makePencil(() => {
        openEditModal(pair[1], inp.value, (v) => {
          inp.value = v;
          save();
        });
      }, "Editar"));
      card.appendChild(row);
    });
    return card;
  }
  function renderPacienciaRecoverCard() {
    const card = document.createElement("article");
    card.className = "editor-card editor-recover-card";
    const h = document.createElement("h3");
    h.textContent = "Recuperar Paciencia";
    card.appendChild(h);
    const note = document.createElement("p");
    note.className = "editor-note";
    note.textContent = "Estas acciones acercan la Paciencia a 0 (la barra se vacía). Si el corazón llega al mínimo, se suma el extra.";
    card.appendChild(note);
    if (typeof EVA_PACIENCIA_RECOVERY === "undefined") return card;
    const cfg = EVA_PACIENCIA_RECOVERY;
    const fields = [
      ["room", "Cambiar de habitación"],
      ["masajes", "Masajes"],
      ["ayudar", "Ayudar en casa"],
      ["heartBonus", "Extra si el corazón llega al mínimo"],
      ["heartBonusAt", "Corazón mínimo para el extra (%)"]
    ];
    const box = document.createElement("div");
    box.className = "recover-fields";
    fields.forEach((pair) => {
      const row = document.createElement("div");
      row.className = "seq-row";
      const lab = document.createElement("label");
      lab.textContent = pair[1];
      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = "1";
      inp.value = cfg[pair[0]] != null ? cfg[pair[0]] : 0;
      const save = () => {
        cfg[pair[0]] = Number(inp.value);
        if (!isFinite(cfg[pair[0]])) cfg[pair[0]] = 0;
        inp.value = cfg[pair[0]];
        saveStoryPatch();
      };
      inp.addEventListener("change", save);
      row.appendChild(lab);
      row.appendChild(inp);
      row.appendChild(makePencil(() => {
        openEditModal(pair[1], String(inp.value), (v) => {
          inp.value = v;
          save();
        });
      }, "Editar valor"));
      box.appendChild(row);
    });
    card.appendChild(box);
    return card;
  }
  function renderBarsEditorCard() {
    const card = document.createElement("article");
    card.className = "editor-card editor-bars-card";
    const h = document.createElement("h3");
    h.textContent = "Nombres de las barras";
    card.appendChild(h);
    const fields = document.createElement("div");
    fields.className = "bar-fields";
    (EVA_INFO.bars || []).forEach((b) => {
      const row = document.createElement("div");
      row.className = "bar-name-row";
      const lab = document.createElement("label");
      lab.textContent = b.id === "rosa" ? "Rosa" : b.id === "morada" ? "Morada" : b.id === "roja" ? "Roja" : b.id;
      const sw = document.createElement("span");
      sw.className = "bar-swatch";
      sw.style.background = b.color || "#888";
      sw.title = lab.textContent;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = b.name || "";
      inp.maxLength = 16;
      inp.addEventListener("change", () => {
        b.name = inp.value.trim();
        saveStoryPatch();
      });
      row.appendChild(lab);
      row.appendChild(sw);
      row.appendChild(inp);
      row.appendChild(makePencil(() => {
        openEditModal("Nombre de la barra", b.name || "", (v) => {
          b.name = v;
          inp.value = v;
          saveStoryPatch();
        });
      }));
      fields.appendChild(row);
    });
    card.appendChild(fields);
    const note = document.createElement("p");
    note.className = "editor-note";
    note.textContent = "Estos nombres se ven en Info y en el panel junto a Eva. Puedes cambiarlos cuando quieras.";
    card.appendChild(note);
    return card;
  }
  async function exportEditorPack() {
    toast("Preparando archivo…");
    try {
      const media = [];
      const rows = await MediaStore.getAll();
      for (const rec of rows) {
        if (!rec.blob) continue;
        media.push({
          id: rec.id,
          kind: rec.kind,
          name: rec.name,
          type: rec.type,
          data: await blobToDataURL(rec.blob)
        });
      }
      const pack = {
        kind: "eva-novela-editor",
        title: STORY.title,
        version: STORY.version,
        exportedAt: new Date().toISOString(),
        story: editableStory(),
        media: media
      };
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
      MediaStore.downloadBlob(blob, "novela-editor.json");
      toast("Descarga lista.");
    } catch (err) {
      console.error(err);
      toast("No se pudo exportar.");
    }
  }
  async function importEditorPack(file) {
    try {
      const text = await file.text();
      const pack = JSON.parse(text);
      if (!pack || (pack.kind !== "eva-novela-editor" && !pack.story && !pack.media)) {
        toast("El archivo no es un export del editor.");
        return;
      }
      if (pack.story) {
        applyEditableStory(pack.story);
        saveStoryPatch();
      }
      if (Array.isArray(pack.media)) {
        for (const rec of pack.media) {
          if (!rec || !rec.data || !rec.id) continue;
          const blob = dataURLToBlob(rec.data);
          if (blob) await MediaStore.put(rec.id, rec.kind || "image", blob, rec.name || "foto");
        }
      }
      await renderEditor();
      toast("Importado.");
    } catch (err) {
      console.error(err);
      toast("No se pudo importar.");
    }
  }
  function playFromEditor() {
    setEditorLive(true);
    if (state.ejected) {
      leaveEjectToTitle();
      return;
    }
    if (state.phase === "house" || state.phase === "intro") {
      showScreen("game");
      refreshEditorLiveBar();
      if (state.phase === "house") {
        enterHouse(state.location || HOUSE.start);
      }
      return;
    }
    refreshTitleButtons();
    showScreen("title");
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
    if (demo === "aviso") { fillAvisoScreen(); showScreen("aviso"); return; }
    if (demo === "title") { showScreen("title"); refreshTitleButtons(); return; }
    if (demo === "closed") { showScreen("closed"); return; }
    if (demo === "name") { openName(); return; }
    if (demo === "editor" || demo === "agregar-foto") { setEditorLive(true); openEditor(); return; }
    if (demo === "eject") {
      state.name = "Doc";
      state.bars = { ...HOUSE.startBars };
      state.day = 1;
      state.moment = "mañana";
      state.evaInfo = defaultEvaInfo();
      setEvaInfoBar("roja", -100);
      showScreen("game");
      ejectFromHouse();
      return;
    }
    if (demo === "house" || demo === "map" || demo === "talk" || demo === "enojada" || demo === "enamorada" || demo === "triste" || demo === "peek" || demo === "bag" || demo === "settings" || demo === "phone" || demo === "info" || demo === "tasks" || demo === "pasillo" || demo === "sala" || demo === "cuarto_eva" || demo === "fade" || demo === "chats" || demo === "chat" || demo === "cocina" || demo === "eva" || demo === "eva-menu" || demo === "eva-hablar" || demo === "hablar" || demo === "reaccion" || demo === "paciencia" || demo === "editor-live" || demo === "elogiar" || demo === "heart-100" || demo === "heart-neg" || demo === "accion" || demo === "masajes" || demo === "ayudar" || demo === "recover-room") {
      state.name = "Doc";
      state.bars = { ...HOUSE.startBars };
      state.day = 1;
      state.moment = "mañana";
      state.activityCount = 0;
      state.inventory = exampleInventory();
      state.unlockedScenes = [];
      state.tasksDone = [];
      state.chats = seedChatHistory(emptyChatState());
      state.evaInfo = defaultEvaInfo();
      state.evaMeet = false;
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
        const startLoc = (demo === "pasillo" || demo === "fade") ? "pasillo" : (demo === "sala" ? "sala" : (demo === "cuarto_eva" ? "cuarto_eva" : ((demo === "cocina" || demo === "eva" || demo === "eva-menu" || demo === "eva-hablar" || demo === "hablar" || demo === "reaccion" || demo === "paciencia" || demo === "editor-live" || demo === "elogiar" || demo === "heart-100" || demo === "heart-neg" || demo === "accion" || demo === "masajes" || demo === "ayudar" || demo === "recover-room") ? "cocina" : "cuarto")));
        enterHouse(startLoc);
        if (demo === "editor-live") setEditorLive(true);
        if (demo === "eva-menu" || demo === "eva-hablar" || demo === "hablar" || demo === "reaccion" || demo === "paciencia" || demo === "editor-live" || demo === "elogiar" || demo === "heart-100" || demo === "heart-neg" || demo === "accion" || demo === "masajes" || demo === "ayudar") {
          if (demo === "paciencia") setEvaInfoBar("roja", -80);
          if (demo === "heart-100") setAfecto(100);
          if (demo === "heart-neg") setAfecto(-50);
          if (demo === "accion" || demo === "masajes" || demo === "ayudar") setEvaInfoBar("roja", -50);
          openEvaMeet();
        }
        if (demo === "accion" || demo === "masajes" || demo === "ayudar") {
          state.meetSub = "accion";
          buildEvaMeetMenu();
        }
        if (demo === "recover-room") {
          setEvaInfoBar("roja", -80);
          travelTo("sala");
        }
        if (demo === "hablar" || demo === "eva-hablar") {
          state.meetSub = "hablar";
          buildEvaMeetMenu();
        }
        if (demo === "elogiar") {
          state.meetSub = "elogiar";
          buildEvaMeetMenu();
        }
        if (demo === "reaccion") {
          const topic = EVA_HABLAR.elogiar.find((t) => t.id === "sonrisa") || EVA_HABLAR.elogiar[0];
          playHablarTopic("elogiar", topic);
        }
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
    if (demo === "intro") {
      state.name = "Doc";
      startIntroCine();
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
    waitOrTap(4000, $("screen-legal"), 400).then(goAviso);
  }
  function fillAvisoScreen() {
    const cfg = (typeof AVISO !== "undefined" && AVISO) || {};
    if ($("aviso-title")) $("aviso-title").textContent = cfg.title || "Aviso";
    if ($("aviso-text")) $("aviso-text").textContent = cfg.text || "";
    if ($("btn-aviso")) $("btn-aviso").textContent = cfg.button || "Entendido";
  }
  function goAviso() {
    fillAvisoScreen();
    showScreen("aviso");
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
    window.addEventListener("resize", () => { updateRotateOverlay(); placeRoomEva(); });
    window.addEventListener("orientationchange", () => placeRoomEva());
    let lockTried = false;
    document.addEventListener("pointerup", () => {
      if (lockTried) return;
      lockTried = true;
      tryLockLandscape();
    }, true);

    $("btn-yes").addEventListener("click", (e) => { e.stopPropagation(); goPowered(); });
    $("btn-no").addEventListener("click", (e) => { e.stopPropagation(); closeGame(); });
    if ($("btn-aviso")) $("btn-aviso").addEventListener("click", (e) => { e.stopPropagation(); goTitle(); });
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
    $("btn-editor-cerrar").addEventListener("click", () => { refreshTitleButtons(); showScreen("title"); refreshEditorLiveBar(); });
    $("btn-exportar").addEventListener("click", exportEditorPack);
    if ($("btn-editor-play")) $("btn-editor-play").addEventListener("click", playFromEditor);
    if ($("input-importar")) $("input-importar").addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) await importEditorPack(f);
    });
    if ($("btn-edit-ok")) $("btn-edit-ok").addEventListener("click", (e) => { e.stopPropagation(); confirmEditModal(); });
    if ($("btn-edit-cancel")) $("btn-edit-cancel").addEventListener("click", (e) => { e.stopPropagation(); closeEditModal(); });
    if ($("modal-edit")) $("modal-edit").addEventListener("click", (e) => { if (e.target === $("modal-edit")) closeEditModal(); });
    if ($("btn-eject-title")) $("btn-eject-title").addEventListener("click", (e) => { e.stopPropagation(); leaveEjectToTitle(); });
    if ($("btn-ed-medios")) $("btn-ed-medios").addEventListener("click", (e) => { e.stopPropagation(); openEditor(); });
    if ($("btn-ed-salir")) $("btn-ed-salir").addEventListener("click", (e) => { e.stopPropagation(); setEditorLive(false); });
    if ($("input-scene-foto")) $("input-scene-foto").addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f || !meetSceneId) return;
      await MediaStore.put(meetSceneId, "image", f, f.name);
      await showMeetScene(meetSceneId);
    });

    if ($("btn-saltar-intro")) $("btn-saltar-intro").addEventListener("click", (e) => {
      e.stopPropagation();
      skipIntroCine();
    });
    if ($("cine")) {
      $("cine").addEventListener("pointerup", (e) => {
        if (e.target.closest("button")) return;
        e.stopPropagation();
        cineTapNow();
      });
    }
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
    $("btn-cerrar-bag").addEventListener("click", () => {
      $("modal-bag").hidden = true;
      if (state.evaMeet && !state.talking) renderEvaMeetStats();
    });
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

    if ($("eva-room-hit")) {
      $("eva-room-hit").addEventListener("click", (e) => { e.stopPropagation(); onRoomEvaClick(e); });
    }
    $("screen-game").addEventListener("pointerup", (e) => {
      if (e.target.closest("button, .action-bar, .modal, .end-card, .menu-btn, .hud, .hud-icons, .chip, .phone-shell, .hud-panel, .hotspots, .travel-fade, .eva-meet, .eva-room, .eva-eject, .editor-live-bar, .ed-pencil, .eva-scene-slot, .cine")) return;
      if (state.evaMeet && !state.talking) return;
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
        if ($("cine") && !$("cine").hidden && document.activeElement.tagName !== "INPUT") {
          e.preventDefault();
          cineTapNow();
          return;
        }
        if ($("screen-game").classList.contains("is-on") && document.activeElement.tagName !== "INPUT") {
          e.preventDefault();
          advance();
        }
      }
      if (e.key === "Escape") hideModals();
    });
  }

  window.__VN = { showScreen, enterHouse, openMap, openEditor, openName, playBoot, showFullLine, advance, playTitleIntro, openBag, openSettings, openPhone, openChatThread, openTasks, travelTo, setPeek, getExpr: () => currentExpr, getState: () => state, openEvaMeet, closeEvaMeet, addAfecto, setAfecto, addEvaInfoBar, setEvaInfoBar, setEditorLive, ejectFromHouse, evaStatus: currentEvaStatus, weekdayName: (d) => weekdayName(d != null ? d : state.day), renderHUD, renderActions, showRoomEva, isEvaHere, isEvaCleaning, currentSceneVariant, isEvaSleeping, refreshRoomVisual, startIntroCine, skipIntroCine, startMission, completeMission, maybeTriggerEvent, renderHotspots, eventDoorTargets, pickElogiarTier, playAccionOption, findAccionOption, applyStatDelta, buildEvaMeetMenu };

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    loadSettings();
    refreshTitleButtons();
    MediaStore.open().catch(() => {});
    playBoot();
  });
})();
