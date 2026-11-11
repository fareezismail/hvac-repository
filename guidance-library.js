/* Design Guidance v3.0 — browser-local document library, upload extraction
   and persistent project checklist.
   Runs entirely in the browser. Nothing here is ever transmitted to any
   external service: uploaded files are read and indexed on this machine only.
   Storage: IndexedDB when available (file text + metadata), localStorage
   fallback for checklist and metadata, in-memory fallback when neither
   exists. Every storage call is guarded so the app never crashes where
   storage is unavailable (e.g. jsdom, private browsing).
   Reader libraries are loaded lazily from cdnjs on first use of each format
   (the same versions the Data Center tool uses):
     pdf.js 3.11.174, Mammoth 1.8.0, SheetJS xlsx 0.18.5. */
(function () {
"use strict";

var LIBS = {
  pdf: { src: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", global: "pdfjsLib", worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js" },
  docx: { src: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js", global: "mammoth" },
  xlsx: { src: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", global: "XLSX" }
};
var MAX_TEXT_CHARS = 2000000;   /* per file: extracted text cap */
var MAX_CHUNKS = 4000;          /* per file: indexed chunk cap */

var loadedLibs = {};
function loadScript(src) {
  if (loadedLibs[src]) return loadedLibs[src];
  var p = new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; reject(new Error("Reader library timed out loading: " + src)); } }, 20000);
    var s = document.createElement("script");
    s.src = src;
    s.onload = function () { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    s.onerror = function () { if (!done) { done = true; clearTimeout(timer); reject(new Error("Reader library failed to load: " + src)); } };
    document.head.appendChild(s);
  });
  loadedLibs[src] = p;
  return p;
}
function ensureLib(kind) {
  var lib = LIBS[kind];
  if (window[lib.global]) return Promise.resolve(window[lib.global]);
  return loadScript(lib.src).then(function () {
    if (kind === "pdf" && window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = lib.worker;
    }
    if (!window[lib.global]) throw new Error("Reader library did not expose " + lib.global);
    return window[lib.global];
  });
}
function kindFor(fileName) {
  var n = (fileName || "").toLowerCase();
  if (/\.pdf$/.test(n)) return "pdf";
  if (/\.docx$/.test(n)) return "docx";
  if (/\.xlsx$/.test(n)) return "xlsx";
  if (/\.txt$/.test(n)) return "txt";
  return "";
}
function fileBuffer(file) {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(new Error("Could not read file")); };
    r.readAsArrayBuffer(file);
  });
}
function fileText(file) {
  if (file.text) return file.text();
  return new Promise(function (resolve, reject) {
    var r = new FileReader();
    r.onload = function () { resolve(String(r.result || "")); };
    r.onerror = function () { reject(new Error("Could not read file")); };
    r.readAsText(file);
  });
}
function sha256Hex(buf) {
  try {
    var cryptoObj = (typeof crypto !== "undefined" && crypto.subtle) ? crypto : (window.crypto && window.crypto.subtle ? window.crypto : null);
    if (!cryptoObj || !cryptoObj.subtle) return Promise.resolve(null);
    return cryptoObj.subtle.digest("SHA-256", buf).then(function (hash) {
      var bytes = new Uint8Array(hash), out = "";
      for (var i = 0; i < bytes.length; i++) out += ("0" + bytes[i].toString(16)).slice(-2);
      return { algo: "sha256", value: out };
    }).catch(function () { return null; });
  } catch (e) { return Promise.resolve(null); }
}
function fnv1a(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return ("0000000" + h.toString(16)).slice(-8);
}
function cleanChunk(text, loc) {
  var t = String(text || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  if (!t) return null;
  return { loc: loc, text: t };
}

/* ---------- Extraction (one function per format) ---------- */
function extractPdf(buf) {
  return ensureLib("pdf").then(function (pdfjsLib) {
    return pdfjsLib.getDocument({ data: buf }).promise;
  }).then(function (pdf) {
    var chunks = [], jobs = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      (function (pageNum) {
        jobs.push(pdf.getPage(pageNum).then(function (page) {
          return page.getTextContent();
        }).then(function (tc) {
          var text = tc.items.map(function (it) { return it.str; }).join(" ");
          var c = cleanChunk(text, "p. " + pageNum);
          if (c) chunks.push(c);
        }));
      })(p);
    }
    return Promise.all(jobs).then(function () {
      chunks.sort(function (a, b) { return parseInt(a.loc.slice(3), 10) - parseInt(b.loc.slice(3), 10); });
      return chunks;
    });
  });
}
function extractDocx(buf) {
  /* Mammoth cannot paginate: location is the nearest preceding heading
     in document order, never an invented page number. */
  return ensureLib("docx").then(function (mammoth) {
    return mammoth.convertToHtml({ arrayBuffer: buf });
  }).then(function (result) {
    var div = document.createElement("div");
    div.innerHTML = result.value || "";
    var chunks = [], heading = "";
    var nodes = div.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li");
    nodes.forEach(function (node) {
      var tag = node.tagName.toLowerCase();
      var text = (node.textContent || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
      if (!text) return;
      if (tag.charAt(0) === "h") { heading = text; return; }
      var c = cleanChunk(text, heading ? "§ " + heading : "Document text");
      if (c) chunks.push(c);
    });
    return chunks;
  });
}
function extractXlsx(buf) {
  return ensureLib("xlsx").then(function (XLSX) {
    var wb = XLSX.read(buf, { type: "array" });
    var chunks = [];
    wb.SheetNames.forEach(function (name) {
      var sheet = wb.Sheets[name];
      var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      rows.forEach(function (row, i) {
        var text = row.map(function (v) { return String(v == null ? "" : v); }).join(" ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
        if (!text) return;
        var c = cleanChunk(text, "Sheet '" + name + "' · row " + (i + 1));
        if (c) chunks.push(c);
      });
    });
    return chunks;
  });
}
function extractTxt(file) {
  return fileText(file).then(function (text) {
    var chunks = [];
    String(text || "").split(/\r?\n/).forEach(function (line, i) {
      var c = cleanChunk(line, "line " + (i + 1));
      if (c) chunks.push(c);
    });
    return chunks;
  });
}
function extractFile(file) {
  var kind = kindFor(file.name);
  if (!kind) return Promise.reject(new Error("Unsupported file type: only PDF, DOCX, XLSX and TXT can be indexed."));
  var bufP = kind === "txt" ? Promise.resolve(null) : fileBuffer(file);
  return bufP.then(function (buf) {
    if (kind === "pdf") return extractPdf(buf);
    if (kind === "docx") return extractDocx(buf);
    if (kind === "xlsx") return extractXlsx(buf);
    return extractTxt(file);
  }).then(function (chunks) {
    var total = 0;
    chunks.forEach(function (c) { total += c.text.length; });
    var truncated = false;
    if (total > MAX_TEXT_CHARS || chunks.length > MAX_CHUNKS) {
      truncated = true;
      var kept = [], keptLen = 0;
      for (var i = 0; i < chunks.length && kept.length < MAX_CHUNKS && keptLen < MAX_TEXT_CHARS; i++) {
        kept.push(chunks[i]); keptLen += chunks[i].text.length;
      }
      chunks = kept;
    }
    var result = { fileName: file.name, mime: file.type || "", size: file.size || 0, kind: kind, chunks: chunks, textLength: total, truncated: truncated };
    /* Checksum of the source bytes (or of the text for TXT, which has no
       separate buffer). Falls back to a hash of the extracted text. */
    var hashSource = (kind === "txt") ? null : bufP;
    return Promise.resolve(hashSource).then(function (buf) {
      if (!buf) return null;
      return sha256Hex(buf);
    }).then(function (hash) {
      result.checksum = hash || { algo: "fnv1a", value: fnv1a(chunks.map(function (c) { return c.text; }).join(" ")) };
      return result;
    });
  });
}

/* ---------- Storage: IndexedDB, localStorage fallback, memory fallback ---------- */
var DB_NAME = "hvac-guide-library", DB_VERSION = 1;
var store = { mode: "memory", db: null };
var mem = { uploads: {}, meta: {}, checklist: [] };

function idbOpen() {
  return new Promise(function (resolve, reject) {
    var req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains("uploads")) db.createObjectStore("uploads", { keyPath: "refId" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "refId" });
      if (!db.objectStoreNames.contains("checklist")) db.createObjectStore("checklist", { keyPath: "id" });
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error || new Error("IndexedDB open failed")); };
  });
}
function idbAll(storeName) {
  return new Promise(function (resolve, reject) {
    try {
      var tx = store.db.transaction(storeName, "readonly");
      var req = tx.objectStore(storeName).getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error || new Error("IndexedDB read failed")); };
    } catch (e) { reject(e); }
  });
}
function idbPut(storeName, value) {
  return new Promise(function (resolve, reject) {
    try {
      var tx = store.db.transaction(storeName, "readwrite");
      var req = tx.objectStore(storeName).put(value);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error || new Error("IndexedDB write failed")); };
    } catch (e) { reject(e); }
  });
}
function idbDelete(storeName, key) {
  return new Promise(function (resolve, reject) {
    try {
      var tx = store.db.transaction(storeName, "readwrite");
      var req = tx.objectStore(storeName).delete(key);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error || new Error("IndexedDB delete failed")); };
    } catch (e) { reject(e); }
  });
}
function lsGet(key) {
  try { var raw = window.localStorage && window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function lsSet(key, value) {
  try { if (window.localStorage) window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or unavailable — memory only */ }
}
function lsRemove(key) {
  try { if (window.localStorage) window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

function persistChecklist() {
  if (store.mode === "indexeddb") {
    mem.checklist.forEach(function (item) { idbPut("checklist", item).catch(function () {}); });
  } else {
    lsSet("hvacGuide.checklist.v1", mem.checklist);
  }
}
function persistMeta(refId) {
  if (store.mode === "indexeddb") {
    if (mem.meta[refId]) idbPut("meta", mem.meta[refId]).catch(function () {});
    else idbDelete("meta", refId).catch(function () {});
  } else {
    lsSet("hvacGuide.meta.v1", mem.meta);
  }
}
function persistUpload(refId) {
  if (store.mode === "indexeddb") {
    if (mem.uploads[refId]) idbPut("uploads", mem.uploads[refId]).catch(function () {});
    else idbDelete("uploads", refId).catch(function () {});
  }
  /* localStorage fallback cannot hold file text reliably: uploads stay in
     memory for the session and the UI says so. */
}

var readyPromise = null;
function initStorage() {
  if (readyPromise) return readyPromise;
  readyPromise = new Promise(function (resolve) {
    var done = false;
    function finish() { if (!done) { done = true; resolve(); } }
    setTimeout(finish, 2000); /* never block the UI on storage */
    var hasIdb = false;
    try { hasIdb = typeof indexedDB !== "undefined" && !!indexedDB; } catch (e) { hasIdb = false; }
    if (!hasIdb) {
      store.mode = "localstorage";
      var cl = lsGet("hvacGuide.checklist.v1");
      if (cl) mem.checklist = cl;
      var mm = lsGet("hvacGuide.meta.v1");
      if (mm) mem.meta = mm;
      finish();
      return;
    }
    idbOpen().then(function (db) {
      store.mode = "indexeddb";
      store.db = db;
      return Promise.all([idbAll("uploads"), idbAll("meta"), idbAll("checklist")]);
    }).then(function (parts) {
      (parts[0] || []).forEach(function (u) { mem.uploads[u.refId] = u; });
      (parts[1] || []).forEach(function (m) { mem.meta[m.refId] = m; });
      mem.checklist = parts[2] || [];
      finish();
    }).catch(function () {
      store.mode = "localstorage";
      var cl = lsGet("hvacGuide.checklist.v1");
      if (cl) mem.checklist = cl;
      var mm = lsGet("hvacGuide.meta.v1");
      if (mm) mem.meta = mm;
      finish();
    });
  });
  return readyPromise;
}
function readyOrTimeout(ms) {
  return Promise.race([initStorage(), new Promise(function (resolve) { setTimeout(resolve, ms || 1500); })]);
}

/* ---------- Library state ---------- */
function refData(refId) {
  var D = window.HVAC_GUIDE_DATA;
  if (!D) return null;
  for (var i = 0; i < D.REFERENCES.length; i++) if (D.REFERENCES[i].id === refId) return D.REFERENCES[i];
  return null;
}
function getUpload(refId) { return mem.uploads[refId] || null; }
function getMeta(refId) { return mem.meta[refId] || null; }
function libStatus(ref) {
  var meta = mem.meta[ref.id] || {};
  if (meta.supersededBy) return "Superseded";
  if (mem.uploads[ref.id]) return "Available";
  if (meta.statusOverride) return meta.statusOverride;
  if (ref.access === "PAYWALLED") return "Upload required";
  if (ref.access === "PUBLIC PARTIAL") return "Partial";
  if (ref.access === "PUBLIC") return "Available";
  return "Unverified";
}
function isAvailableForReview(ref) {
  /* A reference counts as available for a review when its full text is
     freely available here (PUBLIC) or the user has uploaded an authorised
     copy. PUBLIC PARTIAL still leaves gaps. */
  if (mem.uploads[ref.id]) return true;
  var meta = mem.meta[ref.id] || {};
  if (meta.statusOverride === "Available") return true;
  return ref.access === "PUBLIC";
}
function saveUpload(refId, extracted, opts) {
  opts = opts || {};
  var info = {
    refId: refId,
    fileName: extracted.fileName,
    mime: extracted.mime || "",
    size: extracted.size || 0,
    kind: extracted.kind,
    uploadedAt: new Date().toISOString().slice(0, 10),
    edition: opts.edition || "",
    checksum: extracted.checksum || { algo: "fnv1a", value: fnv1a(extracted.chunks.map(function (c) { return c.text; }).join(" ")) },
    chunks: extracted.chunks,
    textLength: extracted.textLength,
    truncated: !!extracted.truncated
  };
  mem.uploads[refId] = info;
  persistUpload(refId);
  return Promise.resolve(info);
}
function indexText(refId, fileInfo) {
  /* Directly index already-extracted text (used by tests and by import). */
  var info = {
    refId: refId,
    fileName: fileInfo.fileName || "imported text",
    mime: fileInfo.mime || "",
    size: fileInfo.size || 0,
    kind: fileInfo.kind || "txt",
    uploadedAt: fileInfo.uploadedAt || new Date().toISOString().slice(0, 10),
    edition: fileInfo.edition || "",
    checksum: fileInfo.checksum || { algo: "fnv1a", value: fnv1a((fileInfo.chunks || []).map(function (c) { return c.text; }).join(" ")) },
    chunks: fileInfo.chunks || [],
    textLength: fileInfo.textLength || 0,
    truncated: !!fileInfo.truncated
  };
  mem.uploads[refId] = info;
  persistUpload(refId);
  return info;
}
function removeUpload(refId) {
  delete mem.uploads[refId];
  persistUpload(refId);
}
function saveMeta(refId, patch) {
  var m = mem.meta[refId] || { refId: refId };
  Object.keys(patch || {}).forEach(function (k) {
    if (patch[k] === "" || patch[k] == null) delete m[k]; else m[k] = patch[k];
  });
  if (!Object.keys(m).length || (Object.keys(m).length === 1 && m.refId)) delete mem.meta[refId];
  else mem.meta[refId] = m;
  persistMeta(refId);
  return mem.meta[refId] || null;
}
function searchUploads(query) {
  var q = (query || "").toLowerCase();
  var words = q.split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 3; });
  if (!words.length) return [];
  var out = [];
  Object.keys(mem.uploads).forEach(function (refId) {
    var up = mem.uploads[refId];
    var ref = refData(refId);
    up.chunks.forEach(function (c) {
      var low = c.text.toLowerCase();
      var hit = words[0];
      if (low.indexOf(hit) === -1) return;
      var at = low.indexOf(hit);
      var start = Math.max(0, at - 70), end = Math.min(c.text.length, at + 90);
      var snippet = (start > 0 ? "…" : "") + c.text.slice(start, end) + (end < c.text.length ? "…" : "");
      out.push({ refId: refId, refNum: ref ? ref.num : refId, loc: c.loc, snippet: snippet });
    });
  });
  return out.slice(0, 10);
}

/* ---------- Project checklist (persistent, local only) ---------- */
var checklistSeq = 1;
function getChecklist() { return mem.checklist.slice(); }
function addChecklist(text, source) {
  var t = String(text || "").replace(/^\s+|\s+$/g, "");
  if (!t) return null;
  var existing = null;
  mem.checklist.forEach(function (it) { if (it.text === t) existing = it; });
  if (existing) return existing;
  var item = { id: "cl-" + Date.now().toString(36) + "-" + (checklistSeq++), text: t, source: source || "", done: false, addedAt: new Date().toISOString().slice(0, 10) };
  mem.checklist.push(item);
  persistChecklist();
  return item;
}
function addChecks(items, source) {
  var added = 0;
  (items || []).forEach(function (t) { if (addChecklist(t, source)) added++; });
  return added;
}
function toggleChecklist(id) {
  var changed = false;
  mem.checklist.forEach(function (it) { if (it.id === id) { it.done = !it.done; changed = true; } });
  if (changed) persistChecklist();
  return changed;
}
function removeChecklist(id) {
  var before = mem.checklist.length;
  mem.checklist = mem.checklist.filter(function (it) { return it.id !== id; });
  if (mem.checklist.length !== before) { persistChecklist(); if (store.mode === "indexeddb") idbDelete("checklist", id).catch(function () {}); return true; }
  return false;
}
function clearCompleted() {
  var done = mem.checklist.filter(function (it) { return it.done; });
  mem.checklist = mem.checklist.filter(function (it) { return !it.done; });
  done.forEach(function (it) { if (store.mode === "indexeddb") idbDelete("checklist", it.id).catch(function () {}); });
  persistChecklist();
  return done.length;
}

/* ---------- Library export / import (local files only) ---------- */
function exportLibraryJSON() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    note: "Backup of the browser-local engineering standards library. Contains extracted text and metadata, NOT the original uploaded files — keep your originals. Nothing in this file was ever sent to a server.",
    meta: mem.meta,
    checklist: mem.checklist,
    uploads: Object.keys(mem.uploads).map(function (k) { return mem.uploads[k]; })
  }, null, 2);
}
function importLibraryJSON(text) {
  var data;
  try { data = JSON.parse(text); } catch (e) { throw new Error("That file is not a library backup (could not be read as JSON)."); }
  if (!data || data.version !== 1) throw new Error("That file is not a version-1 library backup.");
  var summary = { meta: 0, checklist: 0, uploads: 0 };
  Object.keys(data.meta || {}).forEach(function (k) { mem.meta[k] = data.meta[k]; persistMeta(k); summary.meta++; });
  (data.checklist || []).forEach(function (it) {
    if (!it || !it.text) return;
    var exists = mem.checklist.some(function (x) { return x.id === it.id; });
    if (!exists) { mem.checklist.push(it); summary.checklist++; }
  });
  persistChecklist();
  (data.uploads || []).forEach(function (u) {
    if (!u || !u.refId || !u.chunks) return;
    mem.uploads[u.refId] = u;
    persistUpload(u.refId);
    summary.uploads++;
  });
  return summary;
}

window.HVAC_GUIDE_LIBRARY = {
  LIBS: LIBS,
  ready: initStorage,
  readyOrTimeout: readyOrTimeout,
  storageMode: function () { return store.mode; },
  kindFor: kindFor,
  extractFile: extractFile,
  getUpload: getUpload,
  listUploads: function () { return Object.keys(mem.uploads).map(function (k) { return mem.uploads[k]; }); },
  saveUpload: saveUpload,
  indexText: indexText,
  removeUpload: removeUpload,
  getMeta: getMeta,
  saveMeta: saveMeta,
  libStatus: libStatus,
  isAvailableForReview: isAvailableForReview,
  searchUploads: searchUploads,
  getChecklist: getChecklist,
  addChecklist: addChecklist,
  addChecks: addChecks,
  toggleChecklist: toggleChecklist,
  removeChecklist: removeChecklist,
  clearCompleted: clearCompleted,
  exportLibraryJSON: exportLibraryJSON,
  importLibraryJSON: importLibraryJSON
};
})();
