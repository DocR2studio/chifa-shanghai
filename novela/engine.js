/* Motor de novela visual — demostración offline (sin servidor). */
(function () {
  "use strict";

  const SAVE_KEY = "eva_novela_v1";
  const TYPE_MS = 26;
  const FADE_MS = 900;
  const TZ = "America/Lima";

  const $ = (id) => document.getElementById(id);

  const state = {
    sceneId: null,
    lineIndex: 0,
    typing: false,
    typedFull: "",
    typedShown: "",
    typeTimer: null,
    blocked: false,
    savesMode: "load",
    pendingConfirm: null
  };

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    $("modal-menu").hidden = true;
    $("modal-saves").hidden = true;
    $("modal-confirm").hidden = true;
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

  function snapshot() {
    const scene = STORY.scenes[state.sceneId];
    return {
      sceneId: state.sceneId,
      lineIndex: state.lineIndex,
      sceneName: scene ? scene.name : "Partida",
      updated: Date.now()
    };
  }

  function autosave() {
    if (!state.sceneId) return;
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
    const btn = $("btn-continuar");
    const has = !!latestSave();
    btn.disabled = !has;
  }

  /* ---------- Backgrounds ---------- */
  function applyBackground(scene) {
    const layer = $("bg-layer");
    const img = $("bg-img");
    const video = $("bg-video");

    layer.className = "bg-layer " + (scene.bg || "bg-rain");

    video.pause();
    video.removeAttribute("src");
    video.classList.remove("has-src");
    video.load();

    if (scene.video) {
      img.removeAttribute("src");
      img.classList.add("is-missing");
      video.src = scene.video;
      video.classList.add("has-src");
      video.play().catch(() => {});
      return;
    }

    if (scene.background) {
      img.classList.remove("is-missing");
      img.onload = () => img.classList.remove("is-missing");
      img.onerror = () => img.classList.add("is-missing");
      img.src = scene.background;
    } else {
      img.removeAttribute("src");
      img.classList.add("is-missing");
    }
  }

  /* ---------- Typewriter ---------- */
  function stopTyping() {
    if (state.typeTimer) {
      clearTimeout(state.typeTimer);
      state.typeTimer = null;
    }
    state.typing = false;
  }

  function showFullLine() {
    stopTyping();
    $("line").textContent = state.typedFull;
    state.typing = false;
    const scene = STORY.scenes[state.sceneId];
    const last = state.lineIndex >= scene.lines.length - 1;
    $("click-hint").hidden = last && (scene.choices || scene.end);
    if (last && scene.choices) showChoices(scene.choices);
  }

  function typeLine(text) {
    stopTyping();
    state.typedFull = text;
    state.typedShown = "";
    state.typing = true;
    $("line").textContent = "";
    $("click-hint").hidden = true;

    const tick = () => {
      if (!state.typing) return;
      const i = state.typedShown.length;
      if (i >= text.length) {
        showFullLine();
        return;
      }
      state.typedShown = text.slice(0, i + 1);
      $("line").textContent = state.typedShown;
      const ch = text[i];
      let delay = TYPE_MS;
      if (".,;:!?…".indexOf(ch) !== -1) delay = 180;
      state.typeTimer = setTimeout(tick, delay);
    };
    tick();
  }

  function renderLine() {
    const scene = STORY.scenes[state.sceneId];
    const line = scene.lines[state.lineIndex];
    const speaker = $("speaker");
    if (line.speaker) {
      speaker.hidden = false;
      speaker.textContent = line.speaker;
    } else {
      speaker.hidden = true;
      speaker.textContent = "";
    }
    $("end-card").hidden = true;
    $("choices").hidden = true;
    $("choices").innerHTML = "";
    $("dialogue").classList.remove("is-dim");
    $("dialogue").hidden = false;
    typeLine(line.text);
    autosave();
  }

  function showChoices(choices) {
    const box = $("choices");
    box.innerHTML = "";
    choices.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = c.text;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        enterScene(c.next);
      });
      box.appendChild(btn);
    });
    box.hidden = false;
    $("click-hint").hidden = true;
  }

  function enterScene(id) {
    const scene = STORY.scenes[id];
    if (!scene) return;
    state.sceneId = id;
    state.lineIndex = 0;
    applyBackground(scene);
    renderLine();
  }

  function advance() {
    if (state.blocked) return;
    if (!$("screen-game").classList.contains("is-on")) return;
    if (!$("modal-menu").hidden || !$("modal-saves").hidden || !$("modal-confirm").hidden) return;
    if (!$("end-card").hidden) return;
    if (!$("choices").hidden) return;

    if (state.typing) {
      showFullLine();
      return;
    }

    const scene = STORY.scenes[state.sceneId];
    if (!scene) return;

    if (state.lineIndex < scene.lines.length - 1) {
      state.lineIndex += 1;
      renderLine();
      return;
    }

    if (scene.choices) {
      showChoices(scene.choices);
      return;
    }
    if (scene.end) {
      $("end-card").hidden = false;
      $("dialogue").classList.add("is-dim");
      $("click-hint").hidden = true;
      return;
    }
    if (scene.next) enterScene(scene.next);
  }

  function startNewGame() {
    hideModals();
    showScreen("game");
    enterScene(STORY.start);
  }

  function loadSnapshot(snap) {
    if (!snap || !STORY.scenes[snap.sceneId]) return;
    hideModals();
    showScreen("game");
    state.sceneId = snap.sceneId;
    const scene = STORY.scenes[snap.sceneId];
    const max = Math.max(0, scene.lines.length - 1);
    state.lineIndex = Math.min(Math.max(0, snap.lineIndex || 0), max);
    applyBackground(scene);
    renderLine();
  }

  /* ---------- Save UI ---------- */
  function slotButton(label, rec, { disabled, onClick }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "save-slot" + (rec ? "" : " is-empty");
    btn.disabled = !!disabled;
    const date = rec ? formatDate(rec.updated) : "";
    btn.innerHTML =
      '<span class="slot-label"></span>' +
      '<span class="slot-name"></span>' +
      (date ? '<span class="slot-date"></span>' : "");
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
      list.appendChild(
        slotButton("Autoguardado", data.autosave, {
          disabled: !data.autosave,
          onClick: () => loadSnapshot(data.autosave)
        })
      );
    } else if (data.autosave) {
      list.appendChild(
        slotButton("Autoguardado", data.autosave, { disabled: true, onClick: null })
      );
    }

    data.slots.forEach((rec, i) => {
      list.appendChild(
        slotButton("Ranura " + (i + 1), rec, {
          disabled: mode === "load" && !rec,
          onClick: () => {
            if (mode === "load") {
              loadSnapshot(rec);
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

  /* ---------- Intro ---------- */
  async function playIntro() {
    const params = new URLSearchParams(location.search);
    const demo = params.get("demo");

    if (demo === "warning") {
      showScreen("warning");
      return;
    }
    if (demo === "powered") {
      showScreen("powered");
      return;
    }
    if (demo === "legal") {
      showScreen("legal");
      return;
    }
    if (demo === "title") {
      showScreen("title");
      refreshTitleButtons();
      return;
    }
    if (demo === "game") {
      startNewGame();
      return;
    }
    if (demo === "closed") {
      showScreen("closed");
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
    try {
      window.close();
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
    }, 400);
  }

  /* ---------- Wire events ---------- */
  function bind() {
    $("btn-yes").addEventListener("click", (e) => {
      e.stopPropagation();
      goPowered();
    });
    $("btn-no").addEventListener("click", (e) => {
      e.stopPropagation();
      closeGame();
    });

    $("btn-jugar").addEventListener("click", startNewGame);
    $("btn-continuar").addEventListener("click", () => {
      const snap = latestSave();
      if (snap) loadSnapshot(snap);
    });

    $("btn-menu").addEventListener("click", (e) => {
      e.stopPropagation();
      $("modal-menu").hidden = false;
    });
    $("btn-cerrar-menu").addEventListener("click", () => {
      $("modal-menu").hidden = true;
    });
    $("btn-guardar").addEventListener("click", () => openSaves("save"));
    $("btn-cargar").addEventListener("click", () => openSaves("load"));
    $("btn-inicio").addEventListener("click", () => {
      hideModals();
      refreshTitleButtons();
      showScreen("title");
    });
    $("btn-cerrar-saves").addEventListener("click", () => {
      $("modal-saves").hidden = true;
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
      if (e.target.closest("button, .choices, .modal, .end-card, .menu-btn")) return;
      advance();
    });

    $("modal-menu").addEventListener("click", (e) => {
      if (e.target === $("modal-menu")) $("modal-menu").hidden = true;
    });
    $("modal-saves").addEventListener("click", (e) => {
      if (e.target === $("modal-saves")) $("modal-saves").hidden = true;
    });

    const portada = $("portada-img");
    portada.addEventListener("error", () => portada.classList.add("is-missing"));

    $("game-title").textContent = STORY.title || "Título del juego";
    $("version-label").textContent = "v" + (STORY.version || "0.1");
    document.title = STORY.title || "Título del juego";

    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
        if ($("screen-game").classList.contains("is-on")) {
          e.preventDefault();
          advance();
        }
      }
      if (e.key === "Escape") hideModals();
    });
  }

  window.__VN = {
    showScreen,
    startNewGame,
    loadSnapshot,
    latestSave,
    playIntro
  };

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    refreshTitleButtons();
    playIntro();
  });
})();
