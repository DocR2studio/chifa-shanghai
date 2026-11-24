/* IndexedDB para fotos y videos que Doc agrega desde el teléfono. */
const MediaStore = (() => {
  const DB_NAME = "eva_novela_media";
  const STORE = "files";
  const VERSION = 1;
  let dbp = null;
  const urlCache = new Map();

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function key(id, kind) {
    return id + ":" + kind;
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("abort"));
    });
  }

  async function put(id, kind, blob, name) {
    const db = await open();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      key: key(id, kind),
      id,
      kind,
      name: name || (kind + ".bin"),
      type: blob.type || "",
      blob,
      updated: Date.now()
    });
    revoke(id, kind);
    await txDone(tx);
  }

  async function getRecord(id, kind) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key(id, kind));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll() {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(id, kind) {
    const db = await open();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key(id, kind));
    revoke(id, kind);
    await txDone(tx);
  }

  function revoke(id, kind) {
    const k = key(id, kind);
    if (urlCache.has(k)) {
      URL.revokeObjectURL(urlCache.get(k));
      urlCache.delete(k);
    }
  }

  async function objectURL(id, kind) {
    const rec = await getRecord(id, kind);
    if (!rec || !rec.blob) return null;
    const k = key(id, kind);
    if (urlCache.has(k)) return urlCache.get(k);
    const url = URL.createObjectURL(rec.blob);
    urlCache.set(k, url);
    return url;
  }

  async function mediaFor(id) {
    const image = await getRecord(id, "image");
    const video = await getRecord(id, "video");
    return {
      image: image || null,
      video: video || null,
      imageURL: image ? await objectURL(id, "image") : null,
      videoURL: video ? await objectURL(id, "video") : null
    };
  }

  function extFor(rec, fallback) {
    const n = (rec.name || "").toLowerCase();
    const m = n.match(/\.[a-z0-9]{2,5}$/);
    if (m) return m[0];
    const t = rec.type || "";
    if (t.includes("png")) return ".png";
    if (t.includes("webp")) return ".webp";
    if (t.includes("gif")) return ".gif";
    if (t.includes("mp4")) return ".mp4";
    if (t.includes("webm")) return ".webm";
    if (t.includes("quicktime") || t.includes("mp4")) return ".mp4";
    if (t.includes("jpeg") || t.includes("jpg")) return ".jpg";
    return fallback;
  }

  async function exportArchive() {
    const rows = await getAll();
    const manifest = {
      title: STORY.title,
      version: STORY.version,
      exportedAt: new Date().toISOString(),
      items: []
    };
    const files = {};
    for (const rec of rows) {
      if (!rec.blob) continue;
      const kind = rec.kind === "video" ? "video" : "image";
      const ext = extFor(rec, kind === "video" ? ".mp4" : ".jpg");
      const fname = rec.id + "-" + kind + ext;
      files[fname] = rec.blob;
      let item = manifest.items.find((i) => i.id === rec.id);
      if (!item) {
        const meta = EDITOR_ITEMS.find((e) => e.id === rec.id) || { name: rec.id, kind: "custom" };
        item = { id: rec.id, name: meta.name, type: meta.kind, image: null, video: null };
        manifest.items.push(item);
      }
      item[kind] = fname;
    }

    if (typeof JSZip !== "undefined") {
      const zip = new JSZip();
      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      for (const [fname, blob] of Object.entries(files)) {
        zip.file("media/" + fname, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      return { blob, filename: "novela-medios.zip", mime: "application/zip" };
    }

    // Fallback: JSON con base64 si no hay JSZip.
    const items = [];
    for (const rec of rows) {
      if (!rec.blob) continue;
      const buf = await rec.blob.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      items.push({
        id: rec.id,
        kind: rec.kind,
        name: rec.name,
        type: rec.type,
        data: b64
      });
    }
    const json = JSON.stringify({ manifest, files: items }, null, 2);
    return {
      blob: new Blob([json], { type: "application/json" }),
      filename: "novela-medios.json",
      mime: "application/json"
    };
  }

  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { open, put, getRecord, getAll, remove, mediaFor, objectURL, exportArchive, downloadBlob };
})();
