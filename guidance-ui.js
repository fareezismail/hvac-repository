/* Design Guidance v3.0 — client-side applicability engine and UI.
   Runs entirely in the browser. No backend, no API keys, no live web search.
   The Design Guidance tab is a curated, traceable reference tool: every
   answer cites entries in guidance-data.js with their access and
   verification status, plus the user's own browser-local document library
   (guidance-library.js). Nothing here reproduces copyrighted standard text.
   Uploaded documents are read and indexed on this machine only. */
(function () {
"use strict";
var D = window.HVAC_GUIDE_DATA;
if (!D) { return; }
/* Fallback if guidance-library.js failed to load: library features degrade
   to in-memory only and the UI says so. */
var LIB = window.HVAC_GUIDE_LIBRARY || (function () {
  var cl = [];
  return {
    readyOrTimeout: function () { return Promise.resolve(); },
    storageMode: function () { return "unavailable"; },
    getUpload: function () { return null; },
    getMeta: function () { return null; },
    libStatus: function (ref) { return ref.access === "PAYWALLED" ? "Upload required" : (ref.access === "PUBLIC PARTIAL" ? "Partial" : (ref.access === "PUBLIC" ? "Available" : "Unverified")); },
    isAvailableForReview: function (ref) { return ref.access === "PUBLIC"; },
    searchUploads: function () { return []; },
    getChecklist: function () { return cl.slice(); },
    addChecklist: function (t, s) { var it = { id: "cl-" + Date.now(), text: t, source: s || "", done: false, addedAt: "" }; cl.push(it); return it; },
    addChecks: function (items, s) { var n = 0; (items || []).forEach(function (t) { if (!cl.some(function (x) { return x.text === t; })) { cl.push({ id: "cl-" + Date.now() + "-" + (n++), text: t, source: s || "", done: false, addedAt: "" }); } }); return n; },
    toggleChecklist: function (id) { var c = false; cl.forEach(function (it) { if (it.id === id) { it.done = !it.done; c = true; } }); return c; },
    removeChecklist: function (id) { var b = cl.length; cl = cl.filter(function (it) { return it.id !== id; }); return cl.length !== b; },
    clearCompleted: function () { var n = cl.filter(function (it) { return it.done; }).length; cl = cl.filter(function (it) { return !it.done; }); return n; },
    exportLibraryJSON: function () { return "{}"; },
    importLibraryJSON: function () { throw new Error("Library storage is unavailable in this browser session."); },
    saveMeta: function () { return null; },
    removeUpload: function () {},
    extractFile: function () { return Promise.reject(new Error("Library storage is unavailable in this browser session.")); },
    saveUpload: function () { return Promise.reject(new Error("Library storage is unavailable in this browser session.")); }
  };
})();

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function $(id) { return document.getElementById(id); }
function uniq(arr) { var seen = {}, out = []; arr.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }
function refById(id) { for (var i = 0; i < D.REFERENCES.length; i++) { if (D.REFERENCES[i].id === id) return D.REFERENCES[i]; } return null; }
function spaceGroupOf(spaceId) { for (var i = 0; i < D.SPACE_GROUPS.length; i++) { var g = D.SPACE_GROUPS[i]; for (var j = 0; j < g.spaces.length; j++) { if (g.spaces[j][0] === spaceId) return g.id; } } return null; }
function spaceProfile(spaceId) {
  if (D.SPACE_PROFILES[spaceId]) return D.SPACE_PROFILES[spaceId];
  var g = spaceGroupOf(spaceId);
  return g && D.GROUP_FALLBACK[g] ? D.GROUP_FALLBACK[g] : null;
}
function downloadText(filename, text, fallbackEl) {
  try {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} a.remove(); }, 200);
    return true;
  } catch (e) {
    if (fallbackEl) fallbackEl.innerHTML = '<p class="dg-note">Download is unavailable in this browser — copy the text below:</p><textarea rows="8" style="width:100%" readonly>' + esc(text) + '</textarea>';
    return false;
  }
}

var state = {
  spaces: {},          /* spaceId -> true */
  otherSpace: "",
  equip: "",           /* equipment id */
  query: "",
  jurisdiction: "us-model",
  ahj: "",
  editions: "",
  configs: {},          /* per-equipment config choice: equip -> option id (or "both"); remembered for the session so each equipment is asked once */
  libFilter: "",
  libCat: "",
  libStatus: ""
};

/* ---------- Build the interface (v3.0 workflow) ---------- */
function build() {
  var mount = $("dg-app");
  if (!mount) return;
  var html = "";
  html += '<p class="dg-intro">A browser-local engineering standards library and search tool. Upload your authorised copies of standards and they are indexed on this machine only — nothing is ever sent to a server.</p>';
  html += '<p class="dg-note"><strong>Scope and honesty:</strong> this is a curated reference database, not a live search of full standard text. Most ASHRAE, NFPA, ASME and ICC documents are <strong>paywalled</strong> — this tool links to the official source and summarises applicability; it does not reproduce standard text. Editions were checked against publisher sources on 11 November 2026; each reference shows its verification status. A model code is <strong>not</strong> enforceable until adopted by the authority having jurisdiction (AHJ) for the project.</p>';


  /* 1 · Project context: jurisdiction, spaces, equipment */
  html += '<section class="dg-block" aria-label="Project context"><h3>1 · Project context — jurisdiction, space types, equipment</h3>';
  html += '<div class="dg-row"><label>Country / state / city <select id="dg-jurisdiction">' + D.JURISDICTIONS.map(function (j) { return '<option value="' + esc(j.id) + '"' + (j.id === state.jurisdiction ? " selected" : "") + '>' + esc(j.label) + '</option>'; }).join("") + '</select></label>';
  html += '<label>Authority having jurisdiction (AHJ) <input id="dg-ahj" type="text" placeholder="e.g. Seattle Department of Construction &amp; Inspections" /></label>';
  html += '<label>Adopted code editions (if known) <input id="dg-editions" type="text" placeholder="e.g. 2021 WSEC, 2021 Seattle Mechanical Code" /></label></div>';
  html += '<p class="dg-juris-note" id="dg-juris-note"></p>';
  html += '<h4>Space types <span class="dg-sub">— select as many as apply</span></h4>';
  html += '<div class="dg-row"><label class="dg-filter">Filter spaces <input id="dg-space-filter" type="search" placeholder="Type to filter the list…" /></label>';
  html += '<button type="button" class="dg-btn" id="dg-select-all">Select all</button><button type="button" class="dg-btn" id="dg-clear-all">Clear all</button>';
  html += '<span class="dg-count" id="dg-space-count"></span></div>';
  html += '<div class="dg-groups" id="dg-groups">';
  D.SPACE_GROUPS.forEach(function (g) {
    html += '<fieldset class="dg-group" data-group="' + esc(g.id) + '"><legend>' + esc(g.label) + '</legend><div class="dg-group-actions"><button type="button" data-group-all="' + esc(g.id) + '">Select all</button><button type="button" data-group-clear="' + esc(g.id) + '">Clear</button></div><div class="dg-checks">';
    g.spaces.forEach(function (sp) {
      html += '<label class="dg-check"><input type="checkbox" data-space="' + esc(sp[0]) + '" /> ' + esc(sp[1]) + '</label>';
    });
    html += '</div></fieldset>';
  });
  html += '<fieldset class="dg-group" data-group="other"><legend>Other / specialist</legend><div class="dg-checks"><label class="dg-check"><input type="checkbox" data-space="other-space" /> Other / specialist space</label></div><label class="dg-other-label">Specify the unlisted space type <input id="dg-other-space" type="text" placeholder="e.g. vivarium, MRI suite, hydrogen storage" /></label></fieldset>';
  html += '</div>';
  html += '<h4>Equipment / system</h4><div class="dg-row"><label>Equipment / system <select id="dg-equip"><option value="">— choose or type a question below —</option>';
  D.EQUIPMENT_GROUPS.forEach(function (g) {
    html += '<optgroup label="' + esc(g.label) + '">' + g.items.map(function (it) { return '<option value="' + esc(it[0]) + '">' + esc(it[1]) + '</option>'; }).join("") + '</optgroup>';
  });
  html += '</select></label></div></section>';

  /* 2 · Search */
  html += '<section class="dg-block" aria-label="Search"><h3>2 · Search</h3><div class="dg-row">';
  html += '<label class="dg-q">Question or search <input id="dg-query" type="search" placeholder="e.g. What are the ventilation requirements for an operating theatre?" /></label>';
  html += '<button type="button" class="dg-btn dg-go" id="dg-search">Search guidance</button>';
  html += '</div><div class="dg-suggest" id="dg-suggest"></div></section>';

  html += '<div id="dg-clarify" aria-live="polite"></div>';
  html += '<div id="dg-results" aria-live="polite"></div>';

  /* 3 · Library */
  html += '<section class="dg-block" aria-label="Engineering standards library"><h3>3 · Engineering standards library</h3>';
  html += '<p class="dg-note">Your documents live in this browser only (IndexedDB where available). Upload an authorised copy to make a reference Available for review — the search re-runs with it included. Back up the library with Export; restore it with Import. <span id="dg-lib-storage"></span></p>';
  html += '<div class="dg-row"><button type="button" class="dg-btn" id="dg-lib-export">Export library backup</button><button type="button" class="dg-btn" id="dg-lib-import-btn">Import backup</button><input type="file" id="dg-lib-import-file" accept=".json,application/json" hidden /><span class="dg-count" id="dg-lib-count"></span></div>';
  html += '<div class="dg-row"><label class="dg-filter">Filter library <input id="dg-lib-filter" type="search" placeholder="Filter by title, organisation, or number…" /></label><label>Category <select id="dg-lib-cat"><option value="">All categories</option>' + D.LIB_CATS.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>'; }).join("") + '</select></label><label>Status <select id="dg-lib-status"><option value="">All statuses</option><option>Available</option><option>Partial</option><option>Upload required</option><option>Link required</option><option>Unverified</option><option>Superseded</option></select></label></div>';
  html += '<div id="dg-lib-export-area"></div><div id="dg-library"></div></section>';

  /* 4 · Project checklist (persistent, local only) */
  html += '<section class="dg-block" aria-label="Project checklist"><h3>4 · Project checklist</h3>';
  html += '<p class="dg-note">Checks you add from reports accumulate here and are stored only in this browser, alongside the library. Tick an item off when <strong>you</strong> have verified it — this tool never marks anything compliant on its own. <span id="dg-checklist-count"></span></p>';
  html += '<div class="dg-row"><button type="button" class="dg-btn" id="dg-checklist-export">Export checklist (JSON)</button><button type="button" class="dg-btn" id="dg-checklist-print">Print</button><button type="button" class="dg-btn" id="dg-checklist-clear">Clear completed</button></div>';
  html += '<div id="dg-checklist-export-area"></div><ul id="dg-checklist" class="dg-checklist"></ul></section>';

  /* Topic library */
  html += '<section class="dg-block" aria-label="Topic library"><h3>HVAC design topic library</h3><div class="dg-topics" id="dg-topics"></div><div id="dg-topic-detail"></div></section>';

  mount.innerHTML = html;
  wire();
  renderTopics();
  renderLibrary();
  renderChecklist();
  updateJurisNote();
  updateSpaceCount();
  renderSuggest();
  updateLibStorageNote();
}

function updateLibStorageNote() {
  var el = $("dg-lib-storage");
  if (!el) return;
  var mode = LIB.storageMode();
  if (mode === "indexeddb") el.textContent = "Storage: IndexedDB in this browser — uploads and the index persist here.";
  else if (mode === "localstorage") el.textContent = "Storage: localStorage in this browser — the checklist and library metadata persist here; uploaded files are kept for this session only.";
  else if (mode === "unavailable") el.textContent = "Storage is unavailable in this browser session — the library and checklist will not persist.";
  else el.textContent = "Storage: this browser only — uploads are kept for this session.";
}
function updateJurisNote() {
  var j = null;
  D.JURISDICTIONS.forEach(function (x) { if (x.id === state.jurisdiction) j = x; });
  if (j) $("dg-juris-note").textContent = j.note;
}
function updateSpaceCount() {
  var n = Object.keys(state.spaces).filter(function (k) { return state.spaces[k]; }).length;
  var el = $("dg-space-count");
  if (el) el.textContent = n === 0 ? "No space types selected — equipment-only mode." : n + " space type" + (n === 1 ? "" : "s") + " selected.";
}
function renderSuggest() {
  var sugs = ["No space selected + chiller", "Operating theatre + AHU", "Chemical laboratory + exhaust", "Data hall + cooling system", "Battery room + ventilation", "Residential apartment + ventilation", "Commercial office + AHU", "What standards apply to refrigerant piping?"];
  $("dg-suggest").innerHTML = '<span class="suggest-label">Try:</span> ' + sugs.map(function (s) { return '<button type="button" data-sug="' + esc(s) + '">' + esc(s) + '</button>'; }).join("");
}

/* ---------- Library rendering ---------- */
function libStatusBadge(ref) {
  var s = LIB.libStatus(ref);
  var cls = s === "Available" ? "dg-badge-pub" : (s === "Upload required" ? "dg-badge-pay" : "");
  return '<span class="dg-badge ' + cls + '">' + esc(s) + '</span>';
}
function renderLibrary() {
  var host = $("dg-library");
  if (!host) return;
  var q = (state.libFilter || "").trim().toLowerCase();
  var cat = state.libCat || "";
  var st = state.libStatus || "";
  var shown = 0, up = 0;
  D.REFERENCES.forEach(function (r) { if (LIB.getUpload(r.id)) up++; });
  var html = "";
  D.LIB_CATS.forEach(function (c) {
    if (cat && c.id !== cat) return;
    var rows = c.refs.map(refById).filter(Boolean).filter(function (r) {
      if (q && (r.title + " " + r.num + " " + r.org).toLowerCase().indexOf(q) === -1) return false;
      if (st && LIB.libStatus(r) !== st) return false;
      return true;
    });
    if (!rows.length) return;
    shown += rows.length;
    html += '<h4>' + esc(c.label) + ' <span class="dg-sub">— ' + rows.length + ' references</span></h4><p class="dg-ref-note">' + esc(c.desc) + '</p>';
    html += rows.map(function (r) { return libRow(r); }).join("");
  });
  host.innerHTML = html || '<p>No references match the current library filters.</p>';
  var cnt = $("dg-lib-count");
  if (cnt) {
    var pay = D.REFERENCES.filter(function (r) { return r.access === "PAYWALLED"; }).length;
    var unv = D.REFERENCES.filter(function (r) { return r.verification === "NOT VERIFIED"; }).length;
    cnt.textContent = shown + " of " + D.REFERENCES.length + " references shown · " + up + " with your uploaded copy · " + pay + " paywalled (authorised copy required) · " + unv + " with unverified editions/applicability.";
  }
}
function libRow(r) {
  var upload = LIB.getUpload(r.id);
  var meta = LIB.getMeta(r.id) || {};
  var status = LIB.libStatus(r);
  var html = '<details class="dg-lib-row" data-ref="' + esc(r.id) + '"><summary><strong>' + esc(r.num) + ' — ' + esc(r.title) + '</strong> ' + libStatusBadge(r) + ' <span class="dg-ref-meta">Edition ' + esc(r.edition) + '</span></summary><div class="dg-lib-body">';
  html += '<p class="dg-ref-meta">' + esc(r.org) + ' · ' + esc(r.type) + ' · ' + esc(r.cls) + ' · <a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">Official source ↗</a></p>';
  html += '<p>' + esc(r.clauses) + '</p>';
  html += '<p class="dg-ref-meta">Access: ' + esc(r.access) + ' · Verification: ' + esc(r.verification) + (r.notes ? ' · ' + esc(r.notes) : '') + '</p>';
  if (upload) {
    html += '<p class="dg-lib-copy"><strong>Your copy:</strong> ' + esc(upload.fileName) + ' (' + esc(upload.kind.toUpperCase()) + ', ' + esc(String(upload.size)) + ' bytes, uploaded ' + esc(upload.uploadedAt) + (upload.edition ? ', edition on file: ' + esc(upload.edition) : '') + ', checksum ' + esc(upload.checksum.algo) + ' ' + esc(String(upload.checksum.value).slice(0, 12)) + '…; ' + esc(String(upload.textLength)) + ' characters indexed' + (upload.truncated ? ' — text truncated at the storage cap' : '') + '). Search matches from this copy show the location (page / heading / sheet / line) in the report.</p>';
  } else {
    html += '<p class="dg-lib-copy">No copy uploaded yet — this reference is ' + esc(status.toLowerCase()) + ' for review.</p>';
  }
  html += '<div class="dg-lib-actions"><label>Upload authorised copy <input type="file" data-upload="' + esc(r.id) + '" accept=".pdf,.docx,.xlsx,.txt" /></label>';
  html += '<label>Edition on file <input type="text" data-edition="' + esc(r.id) + '" placeholder="e.g. 2022" value="' + esc(upload && upload.edition ? upload.edition : "") + '" /></label>';
  if (upload) html += '<button type="button" class="dg-btn" data-remove-upload="' + esc(r.id) + '">Remove copy</button>';
  html += '</div>';
  html += '<div class="dg-lib-actions"><label>Direct URL <input type="url" data-url="' + esc(r.id) + '" placeholder="https://…" value="' + esc(meta.url || "") + '" /></label>';
  html += '<button type="button" class="dg-btn" data-save-url="' + esc(r.id) + '">Save link</button>';
  html += '<label>Status <select data-status="' + esc(r.id) + '"><option value="">Auto (' + esc(status) + ')</option>' + ["Available", "Partial", "Upload required", "Link required", "Unverified"].map(function (s) { return '<option' + (meta.statusOverride === s ? " selected" : "") + '>' + s + '</option>'; }).join("") + '</select></label></div>';
  html += '<div class="dg-lib-actions"><label>Superseded by <input type="text" data-superseded="' + esc(r.id) + '" placeholder="e.g. 2025 edition" value="' + esc(meta.supersededBy || "") + '" /></label>';
  html += '<button type="button" class="dg-btn" data-save-superseded="' + esc(r.id) + '">Mark superseded</button></div>';
  html += '<p class="dg-lib-status" data-lib-status="' + esc(r.id) + '"></p>';
  html += '</div></details>';
  return html;
}
function libStatusLine(refId, msg) {
  var el = document.querySelector('[data-lib-status="' + refId + '"]');
  if (el) el.textContent = msg;
}
function handleUpload(refId, input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var row = input.closest ? input.closest("details") : null;
  var editionInput = row ? row.querySelector('[data-edition="' + refId + '"]') : null;
  var edition = editionInput ? editionInput.value.trim() : "";
  libStatusLine(refId, "Extracting text from " + file.name + "… (this happens on your machine; the file is not sent anywhere.)");
  LIB.extractFile(file).then(function (extracted) {
    return LIB.saveUpload(refId, extracted, { edition: edition });
  }).then(function (info) {
    renderLibrary();
    libStatusLine(refId, "Indexed " + info.chunks.length + " text sections from " + info.fileName + " (" + info.textLength + " characters). This reference is now Available for review.");
    var out = $("dg-results");
    if (out && out.innerHTML) runSearch();
  }).catch(function (err) {
    libStatusLine(refId, "Could not index this file: " + (err && err.message ? err.message : err));
    input.value = "";
  });
}

/* ---------- Project checklist rendering ---------- */
function renderChecklist() {
  var ul = $("dg-checklist");
  if (!ul) return;
  var items = LIB.getChecklist();
  ul.innerHTML = items.map(function (it) {
    return '<li class="' + (it.done ? "dg-done" : "") + '"><label><input type="checkbox" data-cl-toggle="' + esc(it.id) + '"' + (it.done ? " checked" : "") + ' /> ' + esc(it.text) + '</label>' + (it.source ? ' <span class="dg-ref-meta">— ' + esc(it.source) + '</span>' : '') + ' <button type="button" class="dg-btn dg-mini" data-cl-remove="' + esc(it.id) + '">Remove</button></li>';
  }).join("") || '<li class="dg-ref-note">No checks yet — add design checks from any report (Part 7) and they accumulate here.</li>';
  var c = $("dg-checklist-count");
  if (c) {
    var done = items.filter(function (it) { return it.done; }).length;
    c.textContent = items.length + " checks · " + done + " ticked off.";
  }
}

/* ---------- Wiring ---------- */
function wire() {
  $("dg-jurisdiction").addEventListener("change", function (ev) { state.jurisdiction = ev.target.value; updateJurisNote(); });
  $("dg-ahj").addEventListener("input", function (ev) { state.ahj = ev.target.value; });
  $("dg-editions").addEventListener("input", function (ev) { state.editions = ev.target.value; });
  $("dg-other-space").addEventListener("input", function (ev) { state.otherSpace = ev.target.value; });
  $("dg-equip").addEventListener("change", function (ev) {
    state.equip = ev.target.value; /* per-equipment config choices in state.configs are kept — each equipment is asked once per session */
  });
  $("dg-query").addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); runSearch(); } });
  $("dg-search").addEventListener("click", runSearch);

  $("dg-groups").addEventListener("change", function (ev) {
    var cb = ev.target.closest ? ev.target.closest("input[data-space]") : null;
    if (!cb) return;
    if (cb.checked) state.spaces[cb.getAttribute("data-space")] = true; else delete state.spaces[cb.getAttribute("data-space")];
    updateSpaceCount();
  });
  $("dg-groups").addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("button[data-group-all],button[data-group-clear]") : null;
    if (!b) return;
    var gid = b.getAttribute("data-group-all") || b.getAttribute("data-group-clear");
    var on = !!b.getAttribute("data-group-all");
    var fs = document.querySelector('fieldset[data-group="' + gid + '"]');
    if (!fs) return;
    fs.querySelectorAll("input[data-space]").forEach(function (cb) { cb.checked = on; if (on) state.spaces[cb.getAttribute("data-space")] = true; else delete state.spaces[cb.getAttribute("data-space")]; });
    updateSpaceCount();
  });
  $("dg-select-all").addEventListener("click", function () {
    document.querySelectorAll("#dg-groups input[data-space]").forEach(function (cb) { cb.checked = true; state.spaces[cb.getAttribute("data-space")] = true; });
    updateSpaceCount();
  });
  $("dg-clear-all").addEventListener("click", function () {
    document.querySelectorAll("#dg-groups input[data-space]").forEach(function (cb) { cb.checked = false; delete state.spaces[cb.getAttribute("data-space")]; });
    updateSpaceCount();
  });
  $("dg-space-filter").addEventListener("input", function (ev) {
    var q = ev.target.value.trim().toLowerCase();
    document.querySelectorAll("#dg-groups .dg-check").forEach(function (lab) {
      lab.style.display = !q || lab.textContent.toLowerCase().indexOf(q) !== -1 ? "" : "none";
    });
    document.querySelectorAll("#dg-groups fieldset.dg-group").forEach(function (fs) {
      var any = false;
      fs.querySelectorAll(".dg-check").forEach(function (lab) { if (lab.style.display !== "none") any = true; });
      fs.style.display = any ? "" : "none";
    });
  });
  $("dg-suggest").addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("button[data-sug]") : null;
    if (!b) return;
    applySuggestion(b.getAttribute("data-sug"));
  });
  $("dg-topics").addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("button[data-topic]") : null;
    if (b) renderTopicDetail(b.getAttribute("data-topic"));
  });
  $("dg-topic-detail").addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("#dg-topic-search") : null;
    if (!b) return;
    var t = null;
    D.TOPICS.forEach(function (x) { if (x.id === state.topic) t = x; });
    if (!t) return;
    $("dg-query").value = t.label;
    runSearch();
  });

  /* Library controls (delegated) */
  $("dg-lib-filter").addEventListener("input", function (ev) { state.libFilter = ev.target.value; renderLibrary(); });
  $("dg-lib-cat").addEventListener("change", function (ev) { state.libCat = ev.target.value; renderLibrary(); });
  $("dg-lib-status").addEventListener("change", function (ev) { state.libStatus = ev.target.value; renderLibrary(); });
  $("dg-lib-export").addEventListener("click", function () {
    downloadText("hvac-standards-library-backup.json", LIB.exportLibraryJSON(), $("dg-lib-export-area"));
  });
  $("dg-lib-import-btn").addEventListener("click", function () { $("dg-lib-import-file").click(); });
  $("dg-lib-import-file").addEventListener("change", function (ev) {
    var f = ev.target.files && ev.target.files[0];
    if (!f) return;
    var read = f.text ? f.text() : new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result || "")); }; r.onerror = rej; r.readAsText(f); });
    read.then(function (text) {
      var s = LIB.importLibraryJSON(text);
      renderLibrary(); renderChecklist();
      libStatusLine("", "");
      var cnt = $("dg-lib-count");
      if (cnt) cnt.textContent = "Imported " + s.uploads + " uploaded copies, " + s.meta + " library records, " + s.checklist + " checklist items. " + cnt.textContent;
    }).catch(function (err) {
      var cnt = $("dg-lib-count");
      if (cnt) cnt.textContent = "Import failed: " + (err && err.message ? err.message : err);
    });
    ev.target.value = "";
  });
  $("dg-library").addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.matches && t.matches("input[type=file][data-upload]")) { handleUpload(t.getAttribute("data-upload"), t); return; }
    if (t.matches && t.matches("select[data-status]")) {
      LIB.saveMeta(t.getAttribute("data-status"), { statusOverride: t.value });
      renderLibrary();
    }
  });
  $("dg-library").addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("button[data-save-url],button[data-save-superseded],button[data-remove-upload]") : null;
    if (!b) return;
    if (b.hasAttribute("data-save-url")) {
      var id = b.getAttribute("data-save-url");
      var input = document.querySelector('[data-url="' + id + '"]');
      LIB.saveMeta(id, { url: input ? input.value.trim() : "" });
      libStatusLine(id, "Link saved for this reference.");
      renderLibrary();
    } else if (b.hasAttribute("data-save-superseded")) {
      var sid = b.getAttribute("data-save-superseded");
      var sinput = document.querySelector('[data-superseded="' + sid + '"]');
      LIB.saveMeta(sid, { supersededBy: sinput ? sinput.value.trim() : "" });
      renderLibrary();
    } else if (b.hasAttribute("data-remove-upload")) {
      var rid = b.getAttribute("data-remove-upload");
      LIB.removeUpload(rid);
      renderLibrary();
      var out = $("dg-results");
      if (out && out.innerHTML) runSearch();
    }
  });

  /* Checklist controls */
  $("dg-checklist").addEventListener("change", function (ev) {
    var cb = ev.target.closest ? ev.target.closest("input[data-cl-toggle]") : null;
    if (!cb) return;
    LIB.toggleChecklist(cb.getAttribute("data-cl-toggle"));
    renderChecklist();
  });
  $("dg-checklist").addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("button[data-cl-remove]") : null;
    if (!b) return;
    LIB.removeChecklist(b.getAttribute("data-cl-remove"));
    renderChecklist();
  });
  $("dg-checklist-export").addEventListener("click", function () {
    downloadText("hvac-project-checklist.json", JSON.stringify(LIB.getChecklist(), null, 2), $("dg-checklist-export-area"));
  });
  $("dg-checklist-print").addEventListener("click", function () { if (window.print) window.print(); });
  $("dg-checklist-clear").addEventListener("click", function () {
    LIB.clearCompleted();
    renderChecklist();
  });

  /* Report: add checks to the project checklist (delegated) */
  $("dg-results").addEventListener("click", function (ev) {
    var b = ev.target.closest ? ev.target.closest("button[data-add-check]") : null;
    if (b) {
      LIB.addChecklist(b.getAttribute("data-add-check"), b.getAttribute("data-add-source") || "");
      b.disabled = true; b.textContent = "Added ✓";
      renderChecklist();
      return;
    }
    var all = ev.target.closest ? ev.target.closest("button[data-add-all-checks]") : null;
    if (all) {
      var items = [];
      document.querySelectorAll("#dg-results [data-add-check]").forEach(function (btn) { items.push(btn.getAttribute("data-add-check")); });
      LIB.addChecks(items, all.getAttribute("data-add-source") || "");
      renderChecklist();
      all.disabled = true; all.textContent = "All checks added ✓";
    }
  });
  /* Configuration clarifier answers (the clarifier lives in #dg-clarify). */
  $("dg-clarify").addEventListener("click", function (ev) {
    var cfg = ev.target.closest ? ev.target.closest("button[data-config]") : null;
    if (!cfg) return;
    state.configs[cfg.getAttribute("data-config-equip") || state.equip] = cfg.getAttribute("data-config");
    runSearch();
  });
}

function applySuggestion(s) {
  /* Suggested queries are of the form "X + Y" or a question. */
  var parts = s.split(" + ");
  var q = $("dg-query");
  if (parts.length === 2) {
    var spaceId = null;
    Object.keys(D.SPACE_LABEL).forEach(function (id) { if (D.SPACE_LABEL[id].toLowerCase() === parts[0].toLowerCase()) spaceId = id; });
    if (spaceId) {
      document.querySelectorAll("#dg-groups input[data-space]").forEach(function (cb) { cb.checked = false; delete state.spaces[cb.getAttribute("data-space")]; });
      var cb = document.querySelector('input[data-space="' + spaceId + '"]');
      if (cb) { cb.checked = true; state.spaces[spaceId] = true; }
      updateSpaceCount();
      q.value = parts[1];
    } else if (parts[0].toLowerCase().indexOf("no space") === 0) {
      document.querySelectorAll("#dg-groups input[data-space]").forEach(function (cb) { cb.checked = false; delete state.spaces[cb.getAttribute("data-space")]; });
      updateSpaceCount();
      q.value = parts[1];
    } else { q.value = s; }
  } else { q.value = s; }
  runSearch();
}

/* ---------- Interpretation ---------- */
function interpret(query) {
  var q = (query || "").toLowerCase();
  var equip = state.equip || "";
  var equipFromQuery = "";
  if (!equip) {
    /* Longest alias first so "air cooled chiller" beats "chiller". */
    var keys = Object.keys(D.EQUIP_ALIASES).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < keys.length; i++) { if (q.indexOf(keys[i]) !== -1) { equipFromQuery = D.EQUIP_ALIASES[keys[i]]; break; } }
    equip = equipFromQuery;
  }
  var spacesMentioned = [];
  Object.keys(D.SPACE_LABEL).forEach(function (id) {
    if (q.indexOf(D.SPACE_LABEL[id].toLowerCase()) !== -1) spacesMentioned.push(id);
  });
  var topics = [];
  ["ventilation", "filtration", "pressure", "temperature", "humidity", "exhaust", "refrigerant", "commissioning", "smoke", "energy", "redundancy", "fire"].forEach(function (t) { if (q.indexOf(t) !== -1) topics.push(t); });
  /* Clause/section references in the question, e.g. "IMC 1107" or "1109.2.7". */
  var section = "";
  var dotted = q.match(/\b\d{3,4}(?:\.\d+)+\b/);
  if (dotted) section = dotted[0];
  else { var sm = q.match(/(?:section|clause|imc|ashrae|nfpa|ibc|ifc)\s+(\d{3,4})\b/); if (sm) section = sm[1]; }
  return { equip: equip, equipFromQuery: equipFromQuery, spacesMentioned: spacesMentioned, topics: topics, section: section };
}

function selectedSpaceIds() { return Object.keys(state.spaces).filter(function (k) { return state.spaces[k]; }); }

/* ---------- Configuration clarifier ---------- */
function configFor(equip) {
  if (D.CONFIG_PRESETS[equip]) return { preset: true, def: null, choice: D.CONFIG_PRESETS[equip] };
  if (D.CONFIGS[equip]) return { preset: false, def: D.CONFIGS[equip], choice: null };
  return null;
}
function chosenConfig(equip) {
  var cfg = configFor(equip);
  if (!cfg) return null;
  if (cfg.preset) return { id: cfg.choice.configId, label: cfg.choice.label, note: cfg.choice.note, boost: [] };
  if (state.configs[equip]) {
    var opt = null;
    cfg.def.options.forEach(function (o) { if (o.id === state.configs[equip]) opt = o; });
    if (opt) return { id: opt.id, label: opt.label, note: opt.note || opt.desc, boost: opt.boost || [] };
  }
  return null; /* needs asking */
}
function renderClarifier(equip, def) {
  var clarify = $("dg-clarify");
  var out = $("dg-results");
  if (out) out.innerHTML = "";
  var html = '<div class="dg-result dg-clarify"><h3>Before the results — one quick question</h3><p><strong>' + esc(def.question) + '</strong> The answer changes which requirements apply, so the tool asks now rather than assuming.</p><div class="dg-row">';
  def.options.forEach(function (o) {
    html += '<button type="button" class="dg-btn dg-go" data-config="' + esc(o.id) + '" data-config-equip="' + esc(equip) + '">' + esc(o.label) + '</button> ';
  });
  html += '</div><p class="dg-ref-note">' + def.options.map(function (o) { return esc(o.label) + ': ' + esc(o.desc); }).join(' · ') + '</p></div>';
  if (clarify) clarify.innerHTML = html;
  if (clarify && clarify.scrollIntoView) clarify.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Search: the 10-part report ---------- */
function runSearch() {
  state.query = $("dg-query").value.trim();
  state.equip = $("dg-equip").value;
  var inter = interpret(state.query);
  var spaces = selectedSpaceIds();
  var equip = inter.equip;
  var out = $("dg-results");
  var clarify = $("dg-clarify");
  if (clarify) clarify.innerHTML = "";

  if (!state.query && !equip && spaces.length === 0) {
    out.innerHTML = '<div class="dg-result"><p>Choose at least one space type, an equipment/system, or type a question — or browse the topic library and reference database below.</p></div>';
    return;
  }
  /* Configuration clarifier: ask BEFORE showing results when the
     configuration changes the answer. */
  if (equip) {
    var cfg = configFor(equip);
    if (cfg && !cfg.preset) {
      var chosen = chosenConfig(equip);
      if (!chosen) { renderClarifier(equip, cfg.def); return; }
    }
  }
  var config = equip ? chosenConfig(equip) : null;

  var jur = null;
  D.JURISDICTIONS.forEach(function (j) { if (j.id === state.jurisdiction) jur = j; });
  var refs = applicableRefs(equip, spaces, inter, config);
  var sourceLabel = (state.query ? "Search: “" + state.query + "”" : "Search: " + (D.EQUIP_LABEL[equip] || equip)) + " · " + new Date().toISOString().slice(0, 10);

  var html = '<div class="dg-result dg-report">';

  /* Completeness banner — above Part 1. */
  var outstanding = refs.filter(function (item) { return !LIB.isAvailableForReview(item.r); });
  if (outstanding.length) {
    var blocked = [];
    outstanding.forEach(function (item) {
      var cov = D.COVERAGE[item.r.id];
      if (cov) blocked = blocked.concat(cov.areas);
    });
    blocked = uniq(blocked);
    html += '<div class="dg-conflict"><strong>Incomplete engineering reference:</strong> this review is incomplete because ' + outstanding.map(function (item) { return esc(item.r.num); }).join(", ") + (outstanding.length === 1 ? " has" : " have") + ' not been made available.' + (blocked.length ? ' Outstanding verification areas: ' + esc(blocked.join("; ")) + '.' : '') + ' <strong>Do not mark this review complete.</strong> See the outstanding-documents section after Part 10.</div>';
  }

  /* Part 1 — Search term and equipment configuration */
  html += '<h3>1 · Search term and equipment configuration</h3><dl class="dg-interp">';
  html += '<dt>Question</dt><dd>' + (state.query ? esc(state.query) : '(none — equipment / space selection only)') + '</dd>';
  html += '<dt>Equipment / system</dt><dd>' + (equip ? esc(D.EQUIP_LABEL[equip] || equip) + (inter.equipFromQuery ? ' (identified from your question)' : ' (selected)') : 'None identified — results are general') + '</dd>';
  html += '<dt>Configuration</dt><dd>' + (config ? esc(config.label) + ' — ' + esc(config.note) : (equip && configFor(equip) ? 'Not applicable to this equipment.' : 'No configuration applies to this search.')) + '</dd>';
  html += '<dt>Space types</dt><dd>' + (spaces.length ? spaces.map(function (s) { return esc(D.SPACE_LABEL[s] || s); }).join("; ") + (state.spaces["other-space"] && state.otherSpace ? ' — other: ' + esc(state.otherSpace) : '') : 'None selected — <strong>equipment-specific mode</strong>') + '</dd>';
  html += '<dt>Jurisdiction</dt><dd>' + esc(jur ? jur.label : state.jurisdiction) + (state.ahj ? ' · AHJ: ' + esc(state.ahj) : '') + (state.editions ? ' · Adopted editions: ' + esc(state.editions) : ' · Adopted editions not stated') + '</dd>';
  html += '<dt>Assumptions</dt><dd>' + (spaces.length === 0 ? 'No building type or room function is assumed. Requirements that depend on installation context are labelled conditional below.' : 'Requirements are shown per selected space; where spaces conflict, they are shown separately, not merged.') + '</dd>';
  var missing = [];
  if (!equip) missing.push('no equipment/system identified — pick one or name it in the question');
  if (spaces.length === 0) missing.push('no space type selected — select space types for space-specific requirements');
  if (!state.editions) missing.push('adopted code editions not stated — confirm with the AHJ');
  if (state.spaces["other-space"] && !state.otherSpace) missing.push('other/specialist space selected but not specified');
  html += '<dt>Missing information</dt><dd>' + (missing.length ? esc(missing.join('; ')) : 'None flagged for this search.') + '</dd></dl>';

  /* Part 2 — Related mechanical systems */
  html += '<h3>2 · Related mechanical systems</h3>';
  var related = equip ? D.RELATED_SYSTEMS[equip] : null;
  if (related && related.length) {
    html += '<dl class="dg-interp">' + related.map(function (rs) {
      return '<dt>' + esc(rs.label) + '</dt><dd>' + esc(rs.note) + ' References: ' + rs.refs.map(function (id) { var r = refById(id); return r ? esc(r.num) : esc(id); }).join(", ") + '.</dd>';
    }).join("") + '</dl>';
  } else if (equip) {
    html += '<p>No related-systems map is curated for ' + esc(D.EQUIP_LABEL[equip]) + ' yet — related systems are being mapped per equipment. The references in Part 3 cover the governing documents; the equipment profile in Part 6 names the interfaces.</p>';
  } else {
    html += '<p>No equipment identified — related systems cannot be mapped. Name the equipment or system in the question to see its related systems.</p>';
  }

  /* Part 3 — Applicable codes and standards */
  html += '<h3>3 · Applicable codes and standards (' + refs.length + ')</h3>';
  html += '<p class="dg-note">Classification: <strong>Statutory / mandatory</strong> and <strong>adopted code</strong> items are only enforceable where adopted for this jurisdiction — ' + (jur && jur.id === "us-model" ? 'no adopted jurisdiction is selected, so adoption is <strong>unconfirmed</strong>.' : 'verify adoption for ' + esc(jur.label) + '.') + '</p>';
  html += '<div class="dg-ref-list">' + refs.map(function (item) { return refCard(item, equip, spaces, false); }).join("") + '</div>';

  /* Part 4 — Exact clauses and subsections */
  html += '<h3>4 · Exact clauses and subsections</h3>';
  if (inter.section) {
    var clauseHits = [];
    D.REFERENCES.forEach(function (r) {
      (r.clauseList || []).forEach(function (c) {
        if (c.s === inter.section || c.s.indexOf(inter.section + ".") === 0 || inter.section.indexOf(c.s + ".") === 0) clauseHits.push({ r: r, c: c });
      });
    });
    if (clauseHits.length) {
      html += '<h4>Clause match — ' + esc(inter.section) + '</h4><ul>' + clauseHits.map(function (h) {
        return '<li><strong>' + esc(h.r.num) + ' §' + esc(h.c.s) + ' — ' + esc(h.c.t) + ':</strong> ' + esc(h.c.about) + ' (' + esc(h.c.kind) + '; ' + esc(h.r.edition) + ' edition — <a href="' + esc(h.r.url) + '" target="_blank" rel="noopener noreferrer">official source ↗</a>)</li>';
      }).join("") + '</ul>';
    } else {
      html += '<p class="dg-note">No indexed clause matches section ' + esc(inter.section) + ' yet — the references in Part 3 are the closest match. Clause-level sections are added as they are verified against the publisher.</p>';
    }
  }
  var withClauses = refs.filter(function (item) { return item.r.clauseList && item.r.clauseList.length; });
  if (withClauses.length) {
    html += '<p>The clause tables below are from the published tables of contents; descriptions are paraphrased summaries, not quoted text. Check the exact wording in the current adopted edition before relying on a clause.</p>';
    html += withClauses.map(function (item) {
      var r = item.r;
      return '<details class="dg-clauses"><summary>' + esc(r.num) + ' — Clause-level sections (' + r.clauseList.length + ')</summary><table class="dg-clause-table"><thead><tr><th>Section</th><th>Subject</th><th>What it covers</th><th>Type</th></tr></thead><tbody>'
        + r.clauseList.map(function (c) { return '<tr><td><strong>' + esc(c.s) + '</strong></td><td>' + esc(c.t) + '</td><td>' + esc(c.about) + '</td><td>' + esc(c.kind) + '</td></tr>'; }).join("")
        + '</tbody></table></details>';
    }).join("");
  }
  refs.filter(function (item) { return !(item.r.clauseList && item.r.clauseList.length); }).forEach(function (item) {
    html += '<p class="dg-ref-note">' + esc(item.r.num) + ' — clause-level sections are not yet indexed; the summary in Part 3 is the current level of detail.</p>';
  });

  /* Part 5 — Relevant code language or concise paraphrase */
  html += '<h3>5 · Relevant code language or concise paraphrase</h3>';
  html += '<p class="dg-note">Descriptions below are paraphrased summaries of what each document covers — not quoted standard text. Where a full text is paywalled, obtain an authorised copy before relying on its wording.</p><ul>';
  html += refs.map(function (item) {
    return '<li><strong>' + esc(item.r.num) + ':</strong> ' + esc(item.r.clauses) + '</li>';
  }).join("") + '</ul>';
  var uploadMatches = LIB.searchUploads(state.query);
  if (uploadMatches.length) {
    html += '<h4>Matches in your uploaded documents</h4><ul>' + uploadMatches.map(function (m) {
      return '<li><strong>' + esc(m.refNum) + ' — ' + esc(m.loc) + ':</strong> “' + esc(m.snippet) + '”</li>';
    }).join("") + '</ul>';
  }

  /* Part 6 — Engineering interpretation */
  html += '<h3>6 · Engineering interpretation</h3>';
  var equipProfile = equip ? D.EQUIP_PROFILES[equip] : null;
  if (equipProfile) {
    html += '<h4>Equipment — ' + esc(D.EQUIP_LABEL[equip]) + (spaces.length === 0 ? ' (general, any space)' : '') + '</h4>';
    html += '<p>' + esc(equipProfile.general) + '</p>';
    var cond = (equipProfile.conditional || []).filter(function (c) { return configApplies(c, config, equip); });
    var condOther = (equipProfile.conditional || []).filter(function (c) { return !configApplies(c, config, equip); });
    if (cond.length) {
      html += '<h4>Conditional requirements (apply to this configuration)</h4><ul>' + cond.map(function (c) { return '<li><strong>' + esc(c.when) + ':</strong> ' + esc(c.what) + '</li>'; }).join("") + '</ul>';
    }
    if (condOther.length && config && config.id !== "both") {
      html += '<p class="dg-ref-note">Not shown: requirements for the other configuration (' + condOther.map(function (c) { return esc(c.when); }).join("; ") + ') — choose “Show both” to compare.</p>';
    }
  }
  if (spaces.length) {
    spaces.forEach(function (sid) {
      var p = spaceProfile(sid);
      if (!p) return;
      html += '<h4>' + esc(D.SPACE_LABEL[sid] || sid) + '</h4>';
      html += '<dl class="dg-interp"><dt>Ventilation</dt><dd>' + esc(p.ventilation) + '</dd><dt>Temperature / humidity</dt><dd>' + esc(p.temp) + '</dd><dt>Filtration</dt><dd>' + esc(p.filtration) + '</dd><dt>Pressure</dt><dd>' + esc(p.pressure) + (p.pressureNote ? ' — ' + esc(p.pressureNote) : '') + '</dd></dl>';
    });
  }
  if (spaces.length > 1) {
    var pressures = {};
    spaces.forEach(function (s) { var p = spaceProfile(s); if (p) (pressures[p.pressure] = pressures[p.pressure] || []).push(s); });
    var dirs = Object.keys(pressures).filter(function (d) { return d === "positive" || d === "negative"; });
    if (dirs.length > 1) {
      html += '<div class="dg-conflict"><strong>Conflicting requirements — do not merge:</strong> ' + dirs.map(function (d) { return esc(d) + ' pressure: ' + pressures[d].map(function (s) { return esc(D.SPACE_LABEL[s]); }).join(', '); }).join(' · ') + '. These spaces must be served by separate systems or zones with their own pressure relationships.</div>';
    }
  }
  var coord = [], miss = [];
  if (equipProfile) { coord = coord.concat(equipProfile.coordination || []); miss = miss.concat(equipProfile.missing || []); }
  spaces.forEach(function (sid) { var p = spaceProfile(sid); if (!p) return; coord = coord.concat(p.coordination || []); miss = miss.concat(p.missing || []); });
  coord = uniq(coord); miss = uniq(miss);
  if (coord.length) html += '<h4>Coordination</h4><p>Coordinate with: ' + coord.map(esc).join('; ') + '.</p>';
  html += '<p class="dg-note"><strong>Engineering interpretation:</strong> the guidance above is a research starting point, not a design. Confirm every requirement against the current, adopted edition of the cited document and the AHJ for the project. Where a reference is marked PAYWALLED, obtain an authorised copy before relying on its text.</p>';

  /* Part 7 — Specific design checks */
  var checklist = [];
  if (equipProfile) checklist = checklist.concat(equipProfile.checklist || []);
  spaces.forEach(function (sid) { var p = spaceProfile(sid); if (!p) return; checklist = checklist.concat(p.checklist || []); });
  checklist = uniq(checklist);
  html += '<h3>7 · Specific design checks</h3>';
  if (checklist.length) {
    html += '<p><button type="button" class="dg-btn" data-add-all-checks="1" data-add-source="' + esc(sourceLabel) + '">Add all checks to project checklist</button> <span class="dg-note-inline">Checks accumulate in the project checklist (Section 4) — tick them off yourself when verified.</span></p>';
    html += '<ul class="dg-checklist">' + checklist.map(function (c) {
      return '<li>' + esc(c) + ' <button type="button" class="dg-btn dg-mini" data-add-check="' + esc(c) + '" data-add-source="' + esc(sourceLabel) + '">Add to project checklist</button></li>';
    }).join("") + '</ul>';
  } else {
    html += '<p>No specific design checks are itemised for this search yet — see the equipment and space guidance in Part 6.</p>';
  }

  /* Part 8 — Required calculations, drawings or schedules */
  html += '<h3>8 · Required calculations, drawings or schedules</h3>';
  var deliv = equip ? (D.DELIVERABLES[equip] || D.DELIVERABLES_GENERIC) : D.DELIVERABLES_GENERIC;
  if (equip || spaces.length) {
    html += '<p class="dg-note-inline">Typical deliverables for this equipment / space — confirm against the cited references; they are not themselves code requirements.</p><ul>' + deliv.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join("") + '</ul>';
  } else {
    html += '<p>Calculations, drawings and schedules cannot be itemised without an equipment or space context — name the equipment or select the space types.</p>';
  }

  /* Part 9 — Exceptions and applicability conditions */
  html += '<h3>9 · Exceptions and applicability conditions</h3><ul>';
  if (spaces.length === 0) html += '<li>No space type is selected — requirements that depend on installation context are conditional. Select space types for space-specific requirements.</li>';
  if (config && config.id !== "both") {
    var others = (equipProfile && equipProfile.conditional ? equipProfile.conditional.filter(function (c) { return !configApplies(c, config, equip); }) : []);
    others.forEach(function (c) { html += '<li>Not applicable to the selected configuration (' + esc(config.label) + '): ' + esc(c.when) + ' — ' + esc(c.what) + '</li>'; });
  }
  if (config && config.id === "both") html += '<li>Both configurations are shown separately in this report — do not merge DX and chilled-water (or air- and water-cooled) requirements.</li>';
  html += '<li>A model code or standard is enforceable only where adopted by the AHJ for the project' + (jur && jur.id !== "us-model" ? ' — adoption for ' + esc(jur.label) + ' must be verified.' : ' — no adopted jurisdiction is selected, so adoption is unconfirmed.') + '</li>';
  if (miss.length) html += '<li>Missing information — confirm before finalising the design: ' + esc(miss.join('; ')) + '.</li>';
  html += '</ul>';

  /* Part 10 — Official source links and verification status */
  html += '<h3>10 · Official source links and verification status</h3>';
  html += '<table class="dg-clause-table"><thead><tr><th>Reference</th><th>Edition</th><th>Access</th><th>Verification</th><th>Official source</th></tr></thead><tbody>' + refs.map(function (item) {
    var r = item.r;
    return '<tr><td><strong>' + esc(r.num) + '</strong><br/>' + esc(r.title) + '</td><td>' + esc(r.edition) + '</td><td>' + esc(r.access) + '</td><td>' + esc(r.verification) + '</td><td><a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">Official source ↗</a></td></tr>';
  }).join("") + '</tbody></table>';

  /* Outstanding documents — after Part 10. */
  if (outstanding.length) {
    html += '<h3>Outstanding documents — this review is incomplete</h3>';
    html += '<p>The following references apply to this search, but their full text is not freely available in this tool, so the findings that depend on them are not fully verified.</p><ul>';
    html += outstanding.map(function (item) {
      var r = item.r;
      var cov = D.COVERAGE[r.id];
      var blockedTxt = cov ? 'Blocked verification areas: ' + cov.areas.join("; ") + (cov.partial ? ' (partial list — confirm against the published standard)' : '') + '. ' : '';
      return '<li><strong>' + esc(r.num) + ' — ' + esc(r.title) + '</strong> (' + esc(r.edition) + ' edition, ' + esc(r.org) + ') — needed for: ' + esc(item.appliesTo.join("; ")) + '. ' + esc(blockedTxt) + 'Cannot be verified without it: full clause text for ' + esc(r.clauses) + ' <a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">Official source ↗</a> — action: upload an authorised copy or provide an accessible link.</li>';
    }).join("");
    html += '</ul><p><strong>Do not mark this review complete until the outstanding documents are provided or the gaps are otherwise closed.</strong></p>';
  }

  html += '</div>';
  out.innerHTML = html;
  if (out.scrollIntoView) out.scrollIntoView({ behavior: "smooth", block: "start" });
}

function configApplies(cond, config, equip) {
  if (!config || config.id === "both") return true;
  var when = (cond.when || "").toLowerCase();
  if (config.id === "dx") return when.indexOf("dx") !== -1 || when.indexOf("installed") !== -1;
  if (config.id === "chw") return when.indexOf("chilled-water") !== -1 || when.indexOf("installed") !== -1;
  if (config.id === "air") return when.indexOf("air-cooled") !== -1 || when.indexOf("installed") !== -1 || when.indexOf("roof") !== -1;
  if (config.id === "water") return when.indexOf("water-cooled") !== -1 || when.indexOf("cooling tower") !== -1 || when.indexOf("installed") !== -1;
  return true;
}

function applicableRefs(equip, spaces, inter, config) {
  var scored = [];
  /* Section-number matches are force-included (v2.2 nuance fix): a search
     for "IMC 1107" must show the IMC card with its clause table. */
  var sectionRefIds = {};
  if (inter.section) {
    D.REFERENCES.forEach(function (r) {
      (r.clauseList || []).forEach(function (c) {
        if (c.s === inter.section || c.s.indexOf(inter.section + ".") === 0 || inter.section.indexOf(c.s + ".") === 0) sectionRefIds[r.id] = true;
      });
    });
  }
  var boost = (config && config.boost) || [];
  D.REFERENCES.forEach(function (r) {
    var score = 0, appliesTo = [];
    var isSectionMatch = !!sectionRefIds[r.id];
    var spaceMatch = r.spaces.indexOf("all") !== -1 || spaces.some(function (s) { return r.spaces.indexOf(s) !== -1; });
    var equipMatch = !equip || r.equip.indexOf("all") !== -1 || r.equip.indexOf(equip) !== -1;
    if (spaces.length === 0) {
      /* Equipment-only mode: reference must be relevant to the equipment,
         or be a general code that governs all HVAC work — or the section
         the question names. */
      if (!equip && !isSectionMatch) return;
      if (isSectionMatch) { score += 10; appliesTo.push("Section match: §" + inter.section); }
      else if (r.equip.indexOf("all") !== -1 && ["imc", "ibc", "iecc", "nec", "ashrae-901"].indexOf(r.id) !== -1) { score += 2; appliesTo.push("General (all equipment)"); }
      else if (equip && r.equip.indexOf(equip) !== -1) { score += 3; appliesTo.push("Equipment: " + D.EQUIP_LABEL[equip]); }
      else if (!isSectionMatch) return;
    } else {
      if (!spaceMatch && !equipMatch && !isSectionMatch) return;
      var matchedSpaces = spaces.filter(function (s) { return r.spaces.indexOf(s) !== -1; });
      if (matchedSpaces.length) { score += 3; appliesTo.push(matchedSpaces.length === spaces.length ? "All selected spaces" : "Only: " + matchedSpaces.map(function (s) { return D.SPACE_LABEL[s]; }).join(", ")); }
      else if (r.spaces.indexOf("all") !== -1 && equipMatch) { score += 1; appliesTo.push("General — applies across space types"); }
      if (equip && r.equip.indexOf(equip) !== -1) { score += 3; appliesTo.push("Equipment: " + D.EQUIP_LABEL[equip]); }
      else if (equip && r.equip.indexOf("all") === -1) score -= 1;
      if (isSectionMatch) { score += 10; appliesTo.push("Section match: §" + inter.section); }
    }
    if (boost.indexOf(r.id) !== -1) { score += 2; appliesTo.push("Configuration: " + (config ? config.label : "")); }
    if (inter.topics.length) {
      var hay = (r.title + " " + r.clauses).toLowerCase();
      inter.topics.forEach(function (t) { if (hay.indexOf(t) !== -1) score += 1; });
    }
    if (score <= 0) return;
    scored.push({ r: r, score: score, appliesTo: uniq(appliesTo) });
  });
  scored.sort(function (a, b) { return b.score - a.score || a.r.num.localeCompare(b.r.num); });
  return scored.slice(0, 40);
}

function refCard(item, equip, spaces, showClauses) {
  var r = item.r;
  var html = '<article class="dg-ref"><header><strong>' + esc(r.num) + ' — ' + esc(r.title) + '</strong> <span class="dg-badge">' + esc(r.org) + '</span></header>'
    + '<p class="dg-ref-meta">Edition ' + esc(r.edition) + ' · ' + esc(r.type) + ' · ' + esc(r.cls) + '</p>'
    + '<p>' + esc(r.clauses) + '</p>'
    + '<p class="dg-ref-meta">Applies to: ' + esc(item.appliesTo.join(" · ")) + '</p>'
    + '<p><a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">Official source ↗</a> '
    + '<span class="dg-badge ' + (r.access === "PAYWALLED" ? "dg-badge-pay" : "dg-badge-pub") + '">' + esc(r.access) + '</span> '
    + '<span class="dg-badge">' + esc(r.verification) + '</span> ' + libStatusBadge(r) + '</p>'
    + (r.notes ? '<p class="dg-ref-note">' + esc(r.notes) + '</p>' : '');
  var upload = LIB.getUpload(r.id);
  if (upload) html += '<p class="dg-ref-note"><strong>Your copy on file:</strong> ' + esc(upload.fileName) + ' (' + esc(upload.kind.toUpperCase()) + ', uploaded ' + esc(upload.uploadedAt) + ').</p>';
  if (showClauses) {
    if (r.clauseList && r.clauseList.length) {
      html += '<details class="dg-clauses"><summary>Clause-level sections (' + r.clauseList.length + ') — section, subject, what it covers</summary>'
        + '<table class="dg-clause-table"><thead><tr><th>Section</th><th>Subject</th><th>What it covers</th><th>Type</th></tr></thead><tbody>'
        + r.clauseList.map(function (c) { return '<tr><td><strong>' + esc(c.s) + '</strong></td><td>' + esc(c.t) + '</td><td>' + esc(c.about) + '</td><td>' + esc(c.kind) + '</td></tr>'; }).join("")
        + '</tbody></table><p class="dg-ref-note">Section titles are from the published table of contents; descriptions are paraphrased summaries, not quoted text. Check the exact wording in the current adopted edition before relying on a clause.</p></details>';
    } else {
      html += '<p class="dg-ref-note">Clause-level sections for this reference are not yet indexed — the summary above is the current level of detail. Section structures are added as they are verified against the publisher.</p>';
    }
  }
  return html + '</article>';
}

/* ---------- Topic library ---------- */
function renderTopics() {
  var el = $("dg-topics");
  if (!el) return;
  el.innerHTML = D.TOPICS.map(function (t) {
    return '<button type="button" class="dg-topic" data-topic="' + esc(t.id) + '"><strong>' + esc(t.label) + '</strong><span>' + esc(t.desc) + '</span><span class="dg-topic-cta">View references &rarr;</span></button>';
  }).join("");
}
function renderTopicDetail(topicId) {
  var t = null;
  D.TOPICS.forEach(function (x) { if (x.id === topicId) t = x; });
  var el = $("dg-topic-detail");
  if (!t || !el) return;
  state.topic = topicId;
  var refs = t.refs.map(refById).filter(Boolean);
  el.innerHTML = '<div class="dg-result dg-topic-detail"><h3>' + esc(t.label) + '</h3><p>' + esc(t.desc) + '</p><p><button type="button" class="dg-btn dg-go" id="dg-topic-search">Search guidance on this topic</button> <span class="dg-note-inline">Runs a tailored search using the space types and equipment you have selected above.</span></p><div class="dg-ref-list">' + refs.map(function (r) { return refCard({ r: r, score: 0, appliesTo: ["Topic: " + t.label] }, "", [], true); }).join("") + '</div></div>';
  if (el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Init ---------- */
function init() {
  var mount = $("dg-app");
  if (mount && !mount.hasChildNodes()) {
    LIB.readyOrTimeout(1500).then(function () { build(); });
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
/* The tab switcher in the page's own script toggles the panel; build lazily
   on first click of the Design Guidance tab so the notes search is untouched. */
var tabGuide = document.getElementById("tab-guide");
if (tabGuide) tabGuide.addEventListener("click", function () { setTimeout(init, 0); });
})();
