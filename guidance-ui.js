/* Design Guidance v2.2 — client-side applicability engine and UI.
   Runs entirely in the browser. No backend, no API keys, no live web search.
   The Design Guidance tab is therefore a curated, traceable reference tool:
   every answer cites entries in guidance-data.js with their access and
   verification status. Nothing here reproduces copyrighted standard text. */
(function () {
"use strict";
var D = window.HVAC_GUIDE_DATA;
if (!D) { return; }

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

var state = {
  spaces: {},          /* spaceId -> true */
  otherSpace: "",
  equip: "",           /* equipment id */
  query: "",
  jurisdiction: "us-model",
  ahj: "",
  editions: ""
};

/* ---------- Build the interface ---------- */
function build() {
  var mount = $("dg-app");
  if (!mount) return;
  var html = "";
  html += '<p class="dg-intro">Select one or more space types, pick an equipment or system, choose a jurisdiction, and ask a question — or browse the topic library and reference database below. <strong>With no space types selected, answers are equipment-specific only</strong> and never assume a building type.</p>';
  html += '<p class="dg-note"><strong>Scope and honesty:</strong> this is a curated reference database, not a live search of full standard text. Most ASHRAE, NFPA, ASME and ICC documents are <strong>paywalled</strong> — this tool links to the official source and summarises applicability; it does not reproduce standard text. Editions were checked against publisher sources on 11 November 2026; each reference shows its verification status. A model code is <strong>not</strong> enforceable until adopted by the authority having jurisdiction (AHJ) for the project.</p>';

  /* Jurisdiction */
  html += '<section class="dg-block" aria-label="Jurisdiction"><h3>1 · Jurisdiction</h3><div class="dg-row">';
  html += '<label>Country / state / city <select id="dg-jurisdiction">' + D.JURISDICTIONS.map(function (j) { return '<option value="' + esc(j.id) + '"' + (j.id === state.jurisdiction ? " selected" : "") + '>' + esc(j.label) + '</option>'; }).join("") + '</select></label>';
  html += '<label>Authority having jurisdiction (AHJ) <input id="dg-ahj" type="text" placeholder="e.g. Seattle Department of Construction &amp; Inspections" /></label>';
  html += '<label>Adopted code editions (if known) <input id="dg-editions" type="text" placeholder="e.g. 2021 WSEC, 2021 Seattle Mechanical Code" /></label>';
  html += '</div><p class="dg-juris-note" id="dg-juris-note"></p></section>';

  /* Space types */
  html += '<section class="dg-block" aria-label="Space types"><h3>2 · Space types <span class="dg-sub">— select as many as apply</span></h3>';
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
  html += '</div></section>';

  /* Equipment + query */
  html += '<section class="dg-block" aria-label="Equipment and question"><h3>3 · Equipment / system and question</h3><div class="dg-row">';
  html += '<label>Equipment / system <select id="dg-equip"><option value="">— choose or type a question below —</option>';
  D.EQUIPMENT_GROUPS.forEach(function (g) {
    html += '<optgroup label="' + esc(g.label) + '">' + g.items.map(function (it) { return '<option value="' + esc(it[0]) + '">' + esc(it[1]) + '</option>'; }).join("") + '</optgroup>';
  });
  html += '</select></label>';
  html += '<label class="dg-q">Question or search <input id="dg-query" type="search" placeholder="e.g. What are the ventilation requirements for an operating theatre?" /></label>';
  html += '<button type="button" class="dg-btn dg-go" id="dg-search">Search guidance</button>';
  html += '</div><div class="dg-suggest" id="dg-suggest"></div></section>';

  html += '<div id="dg-results" aria-live="polite"></div>';

  /* Topic library + reference database */
  html += '<section class="dg-block" aria-label="Topic library"><h3>HVAC design topic library</h3><div class="dg-topics" id="dg-topics"></div><div id="dg-topic-detail"></div></section>';
  html += '<section class="dg-block" aria-label="Reference database"><h3>Reference database</h3><div class="dg-row"><label>Filter references <input id="dg-ref-filter" type="search" placeholder="Filter by title, organisation, or number…" /></label><label>Access <select id="dg-ref-access"><option value="">All access</option><option>PUBLIC</option><option>PUBLIC PARTIAL</option><option>PAYWALLED</option><option>NOT VERIFIED</option></select></label><label>Verification <select id="dg-ref-ver"><option value="">All statuses</option><option>VERIFIED</option><option>PARTIALLY VERIFIED</option><option>NOT VERIFIED</option><option>SUPERSEDED</option></select></label></div><p class="dg-count" id="dg-ref-count"></p><div class="dg-ref-table-wrap"><table class="dg-ref-table" id="dg-ref-table"><thead><tr><th>Reference</th><th>Edition</th><th>Clauses</th><th>Access</th><th>Verification</th><th>Classification</th><th>Official source</th></tr></thead><tbody></tbody></table></div><p class="dg-note">Paywalled references require an authorised copy or a user-provided document — this tool never bypasses paywalls. To add or update a reference, edit <code>guidance-data.js</code> (see README).</p></section>';

  mount.innerHTML = html;
  wire();
  renderTopics();
  renderRefs();
  updateJurisNote();
  updateSpaceCount();
  renderSuggest();
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

/* ---------- Wiring ---------- */
function wire() {
  $("dg-jurisdiction").addEventListener("change", function (ev) { state.jurisdiction = ev.target.value; updateJurisNote(); });
  $("dg-ahj").addEventListener("input", function (ev) { state.ahj = ev.target.value; });
  $("dg-editions").addEventListener("input", function (ev) { state.editions = ev.target.value; });
  $("dg-other-space").addEventListener("input", function (ev) { state.otherSpace = ev.target.value; });
  $("dg-equip").addEventListener("change", function (ev) { state.equip = ev.target.value; });
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
  $("dg-ref-filter").addEventListener("input", renderRefs);
  $("dg-ref-access").addEventListener("change", renderRefs);
  $("dg-ref-ver").addEventListener("change", renderRefs);
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

/* ---------- Interpretation (§6) ---------- */
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

function runSearch() {
  state.query = $("dg-query").value.trim();
  state.equip = $("dg-equip").value;
  var inter = interpret(state.query);
  var spaces = selectedSpaceIds();
  var equip = inter.equip;
  var out = $("dg-results");

  if (!state.query && !equip && spaces.length === 0) {
    out.innerHTML = '<div class="dg-result"><p>Choose at least one space type, an equipment/system, or type a question — or browse the topic library and reference database below.</p></div>';
    return;
  }
  var jur = null;
  D.JURISDICTIONS.forEach(function (j) { if (j.id === state.jurisdiction) jur = j; });

  var html = '<div class="dg-result">';
  /* A. Search interpretation */
  html += '<h3>Search interpretation</h3><dl class="dg-interp">';
  html += '<dt>Question</dt><dd>' + (state.query ? esc(state.query) : '(none — equipment / space selection only)') + '</dd>';
  html += '<dt>Equipment / system</dt><dd>' + (equip ? esc(D.EQUIP_LABEL[equip] || equip) + (inter.equipFromQuery ? ' (identified from your question)' : ' (selected)') : 'None identified — results are general') + '</dd>';
  html += '<dt>Space types</dt><dd>' + (spaces.length ? spaces.map(function (s) { return esc(D.SPACE_LABEL[s] || s); }).join("; ") + (state.spaces["other-space"] && state.otherSpace ? ' — other: ' + esc(state.otherSpace) : '') : 'None selected — <strong>equipment-specific mode</strong>') + '</dd>';
  html += '<dt>Jurisdiction</dt><dd>' + esc(jur ? jur.label : state.jurisdiction) + (state.ahj ? ' · AHJ: ' + esc(state.ahj) : '') + (state.editions ? ' · Adopted editions: ' + esc(state.editions) : ' · Adopted editions not stated') + '</dd>';
  html += '<dt>Assumptions</dt><dd>' + (spaces.length === 0 ? 'No building type or room function is assumed. Requirements that depend on installation context are labelled conditional below.' : 'Requirements are shown per selected space; where spaces conflict, they are shown separately, not merged.') + '</dd>';
  var missing = [];
  if (!equip) missing.push('no equipment/system identified — pick one or name it in the question');
  if (spaces.length === 0) missing.push('no space type selected — select space types for space-specific requirements');
  if (!state.editions) missing.push('adopted code editions not stated — confirm with the AHJ');
  if (state.spaces["other-space"] && !state.otherSpace) missing.push('other/specialist space selected but not specified');
  html += '<dt>Missing information</dt><dd>' + (missing.length ? esc(missing.join('; ')) : 'None flagged for this search.') + '</dd></dl>';

  /* Conflicts: differing pressure directions among selected spaces */
  if (spaces.length > 1) {
    var pressures = {};
    spaces.forEach(function (s) { var p = spaceProfile(s); if (p) (pressures[p.pressure] = pressures[p.pressure] || []).push(s); });
    var dirs = Object.keys(pressures).filter(function (d) { return d === "positive" || d === "negative"; });
    if (dirs.length > 1) {
      html += '<div class="dg-conflict"><strong>Conflicting requirements — do not merge:</strong> ' + dirs.map(function (d) { return esc(d) + ' pressure: ' + pressures[d].map(function (s) { return esc(D.SPACE_LABEL[s]); }).join(', '); }).join(' · ') + '. These spaces must be served by separate systems or zones with their own pressure relationships.</div>';
    }
  }

  /* Equipment section (general + conditional) */
  var equipProfile = equip ? D.EQUIP_PROFILES[equip] : null;
  if (equipProfile) {
    html += '<h3>Equipment requirements — ' + esc(D.EQUIP_LABEL[equip]) + (spaces.length === 0 ? ' (general, any space)' : '') + '</h3>';
    html += '<p>' + esc(equipProfile.general) + '</p>';
    if (equipProfile.conditional && equipProfile.conditional.length) {
      html += '<h4>Conditional requirements</h4><ul>' + equipProfile.conditional.map(function (c) { return '<li><strong>' + esc(c.when) + ':</strong> ' + esc(c.what) + '</li>'; }).join("") + '</ul>';
    }
  }

  /* Per-space sections */
  if (spaces.length) {
    spaces.forEach(function (sid) {
      var p = spaceProfile(sid);
      if (!p) return;
      html += '<h3>' + esc(D.SPACE_LABEL[sid] || sid) + '</h3>';
      html += '<dl class="dg-interp"><dt>Ventilation</dt><dd>' + esc(p.ventilation) + '</dd><dt>Temperature / humidity</dt><dd>' + esc(p.temp) + '</dd><dt>Filtration</dt><dd>' + esc(p.filtration) + '</dd><dt>Pressure</dt><dd>' + esc(p.pressure) + (p.pressureNote ? ' — ' + esc(p.pressureNote) : '') + '</dd></dl>';
    });
  } else if (equip) {
    html += '<div class="dg-clarify"><strong>Clarifying question:</strong> which space will this ' + esc(D.EQUIP_LABEL[equip].toLowerCase()) + ' serve? Requirements change materially with the space — for example, an AHU serving an operating theatre, an isolation room, a laboratory, and a general office each has different ventilation, filtration, and pressure requirements. Select the space types above to see the space-specific requirements, or continue with the general requirements shown here.</div>';
  }

  /* B. Applicable references */
  var refs = applicableRefs(equip, spaces, inter);
  /* Clause-level match: if the question names a section, show it first. */
  if (inter.section) {
    var clauseHits = [];
    D.REFERENCES.forEach(function (r) {
      (r.clauseList || []).forEach(function (c) {
        if (c.s === inter.section || c.s.indexOf(inter.section + ".") === 0 || inter.section.indexOf(c.s + ".") === 0) {
          clauseHits.push({ r: r, c: c });
        }
      });
    });
    if (clauseHits.length) {
      html += '<h3>Clause match — ' + esc(inter.section) + '</h3><ul>' + clauseHits.map(function (h) {
        return '<li><strong>' + esc(h.r.num) + ' §' + esc(h.c.s) + ' — ' + esc(h.c.t) + ':</strong> ' + esc(h.c.about) + ' (' + esc(h.c.kind) + '; ' + esc(h.r.edition) + ' edition — <a href="' + esc(h.r.url) + '" target="_blank" rel="noopener noreferrer">official source ↗</a>)</li>';
      }).join("") + '</ul>';
    } else {
      html += '<p class="dg-note">No indexed clause matches section ' + esc(inter.section) + ' yet — the references below are the closest match. Clause-level sections are added as they are verified against the publisher.</p>';
    }
  }
  html += '<h3>Applicable references (' + refs.length + ')</h3>';
  html += '<p class="dg-note">Classification: <strong>Statutory / mandatory</strong> and <strong>adopted code</strong> items are only enforceable where adopted for this jurisdiction — ' + (jur && jur.id === "us-model" ? 'no adopted jurisdiction is selected, so adoption is <strong>unconfirmed</strong>.' : 'verify adoption for ' + esc(jur.label) + '.') + '</p>';
  html += '<div class="dg-ref-list">' + refs.map(function (r) { return refCard(r, equip, spaces); }).join("") + '</div>';

  /* Outstanding documents: references this search relies on whose full text
     is not freely available here. The review is incomplete until they are
     provided or the gaps are otherwise closed. */
  var outstanding = refs.filter(function (item) { return item.r.access === "PAYWALLED" || item.r.access === "PUBLIC PARTIAL"; });
  if (outstanding.length) {
    html += '<h3>Outstanding documents — this review is incomplete</h3>';
    html += '<p>The following references apply to this search, but their full text is not freely available in this tool, so the findings that depend on them are not fully verified.</p><ul>';
    html += outstanding.map(function (item) {
      var r = item.r;
      return '<li><strong>' + esc(r.num) + ' — ' + esc(r.title) + '</strong> (' + esc(r.edition) + ' edition, ' + esc(r.org) + ') — needed for: ' + esc(item.appliesTo.join("; ")) + '. Cannot be verified without it: full clause text for ' + esc(r.clauses) + ' <a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">Official source ↗</a> — action: upload an authorised copy or provide an accessible link.</li>';
    }).join("");
    html += '</ul><p><strong>Do not mark this review complete until the outstanding documents are provided or the gaps are otherwise closed.</strong></p>';
  }

  /* E/F/G. Checklist, coordination, missing info */
  var checklist = [], coord = [], miss = [];
  if (equipProfile) { checklist = checklist.concat(equipProfile.checklist || []); coord = coord.concat(equipProfile.coordination || []); miss = miss.concat(equipProfile.missing || []); }
  spaces.forEach(function (sid) { var p = spaceProfile(sid); if (!p) return; checklist = checklist.concat(p.checklist || []); coord = coord.concat(p.coordination || []); miss = miss.concat(p.missing || []); });
  checklist = uniq(checklist); coord = uniq(coord); miss = uniq(miss);
  if (checklist.length) html += '<h3>Design checklist</h3><ul class="dg-checklist">' + checklist.map(function (c) { return '<li><label><input type="checkbox" /> ' + esc(c) + '</label></li>'; }).join("") + '</ul>';
  if (coord.length) html += '<h3>Coordination requirements</h3><p>Coordinate with: ' + coord.map(esc).join('; ') + '.</p>';
  if (miss.length) html += '<h3>Missing information — confirm before finalising the design</h3><ul>' + miss.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join("") + '</ul>';
  html += '<p class="dg-note"><strong>Engineering interpretation:</strong> the guidance above is a research starting point, not a design. Confirm every requirement against the current, adopted edition of the cited document and the AHJ for the project. Where a reference is marked PAYWALLED, obtain an authorised copy before relying on its text.</p>';
  html += '</div>';
  out.innerHTML = html;
  if (out.scrollIntoView) out.scrollIntoView({ behavior: "smooth", block: "start" });
}

function applicableRefs(equip, spaces, inter) {
  var scored = [];
  D.REFERENCES.forEach(function (r) {
    var score = 0, appliesTo = [];
    var spaceMatch = r.spaces.indexOf("all") !== -1 || spaces.some(function (s) { return r.spaces.indexOf(s) !== -1; });
    var equipMatch = !equip || r.equip.indexOf("all") !== -1 || r.equip.indexOf(equip) !== -1;
    if (spaces.length === 0) {
      /* Equipment-only mode: reference must be relevant to the equipment,
         or be a general code that governs all HVAC work. */
      if (!equip) return;
      if (r.equip.indexOf("all") !== -1 && ["imc","ibc","iecc","nec","ashrae-901"].indexOf(r.id) !== -1) { score += 2; appliesTo.push("General (all equipment)"); }
      else if (r.equip.indexOf(equip) !== -1) { score += 3; appliesTo.push("Equipment: " + D.EQUIP_LABEL[equip]); }
      else return;
    } else {
      if (!spaceMatch && !equipMatch) return;
      var matchedSpaces = spaces.filter(function (s) { return r.spaces.indexOf(s) !== -1; });
      if (matchedSpaces.length) { score += 3; appliesTo.push(matchedSpaces.length === spaces.length ? "All selected spaces" : "Only: " + matchedSpaces.map(function (s) { return D.SPACE_LABEL[s]; }).join(", ")); }
      else if (r.spaces.indexOf("all") !== -1 && equipMatch) { score += 1; appliesTo.push("General — applies across space types"); }
      if (equip && r.equip.indexOf(equip) !== -1) { score += 3; appliesTo.push("Equipment: " + D.EQUIP_LABEL[equip]); }
      else if (equip && r.equip.indexOf("all") === -1) score -= 1;
    }
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

function refCard(item, equip, spaces) {
  var r = item.r;
  var html = '<article class="dg-ref"><header><strong>' + esc(r.num) + ' — ' + esc(r.title) + '</strong> <span class="dg-badge">' + esc(r.org) + '</span></header>'
    + '<p class="dg-ref-meta">Edition ' + esc(r.edition) + ' · ' + esc(r.type) + ' · ' + esc(r.cls) + '</p>'
    + '<p>' + esc(r.clauses) + '</p>'
    + '<p class="dg-ref-meta">Applies to: ' + esc(item.appliesTo.join(" · ")) + '</p>'
    + '<p><a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">Official source ↗</a> '
    + '<span class="dg-badge ' + (r.access === "PAYWALLED" ? "dg-badge-pay" : "dg-badge-pub") + '">' + esc(r.access) + '</span> '
    + '<span class="dg-badge">' + esc(r.verification) + '</span></p>'
    + (r.notes ? '<p class="dg-ref-note">' + esc(r.notes) + '</p>' : '');
  if (r.clauseList && r.clauseList.length) {
    html += '<details class="dg-clauses"><summary>Clause-level sections (' + r.clauseList.length + ') — section, subject, what it covers</summary>'
      + '<table class="dg-clause-table"><thead><tr><th>Section</th><th>Subject</th><th>What it covers</th><th>Type</th></tr></thead><tbody>'
      + r.clauseList.map(function (c) { return '<tr><td><strong>' + esc(c.s) + '</strong></td><td>' + esc(c.t) + '</td><td>' + esc(c.about) + '</td><td>' + esc(c.kind) + '</td></tr>'; }).join("")
      + '</tbody></table><p class="dg-ref-note">Section titles are from the published table of contents; descriptions are paraphrased summaries, not quoted text. Check the exact wording in the current adopted edition before relying on a clause.</p></details>';
  } else {
    html += '<p class="dg-ref-note">Clause-level sections for this reference are not yet indexed — the summary above is the current level of detail. Section structures are added as they are verified against the publisher.</p>';
  }
  return html + '</article>';
}

/* ---------- Topic library (§9) ---------- */
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
  el.innerHTML = '<div class="dg-result dg-topic-detail"><h3>' + esc(t.label) + '</h3><p>' + esc(t.desc) + '</p><p><button type="button" class="dg-btn dg-go" id="dg-topic-search">Search guidance on this topic</button> <span class="dg-note-inline">Runs a tailored search using the space types and equipment you have selected above.</span></p><div class="dg-ref-list">' + refs.map(function (r) { return refCard({ r: r, score: 0, appliesTo: ["Topic: " + t.label] }, "", []); }).join("") + '</div></div>';
  if (el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- Reference database manager (§10) ---------- */
function renderRefs() {
  var tbody = document.querySelector("#dg-ref-table tbody");
  if (!tbody) return;
  var q = ($("dg-ref-filter").value || "").trim().toLowerCase();
  var acc = $("dg-ref-access").value;
  var ver = $("dg-ref-ver").value;
  var rows = D.REFERENCES.filter(function (r) {
    if (acc && r.access !== acc) return false;
    if (ver && r.verification !== ver) return false;
    if (q && (r.title + " " + r.num + " " + r.org).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  tbody.innerHTML = rows.map(function (r) {
    return '<tr><td><strong>' + esc(r.num) + '</strong><br/>' + esc(r.title) + '</td><td>' + esc(r.edition) + '</td><td>' + ((r.clauseList && r.clauseList.length) ? r.clauseList.length + ' sections' : '—') + '</td><td>' + esc(r.access) + '</td><td>' + esc(r.verification) + '</td><td>' + esc(r.cls) + '</td><td><a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">Official source ↗</a></td></tr>';
  }).join("") || '<tr><td colspan="7">No references match the current filters.</td></tr>';
  var c = $("dg-ref-count");
  if (c) {
    var pay = D.REFERENCES.filter(function (r) { return r.access === "PAYWALLED"; }).length;
    var unv = D.REFERENCES.filter(function (r) { return r.verification === "NOT VERIFIED"; }).length;
    c.textContent = rows.length + " of " + D.REFERENCES.length + " references shown · " + pay + " paywalled (authorised copy required) · " + unv + " with unverified editions/applicability.";
  }
}

/* ---------- Init ---------- */
function init() {
  var mount = $("dg-app");
  if (mount && !mount.hasChildNodes()) build();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
/* The tab switcher in the page's own script toggles the panel; build lazily
   on first click of the Design Guidance tab so the notes search is untouched. */
var tabGuide = document.getElementById("tab-guide");
if (tabGuide) tabGuide.addEventListener("click", function () { setTimeout(init, 0); });
})();
