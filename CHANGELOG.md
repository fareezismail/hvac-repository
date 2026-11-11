# Changelog

All notable changes to the HVAC Repository.

## [2.0.0] — 2026-11-11

### Added — Design Guidance platform (replaces the previous static "online sources" panel)

- Multi-select space-type checkboxes: 79 space types in 8 groups (healthcare;
  research/laboratory/pharmaceutical; data centre and mission-critical;
  commercial and institutional; residential and hospitality; industrial and
  specialist; public and assembly; general and building support), plus an
  "Other / specialist space" option with a free-text field. Space filter,
  select-all and clear-all controls (global and per group).
- Equipment/system catalogue: 69 equipment and system types in 6 groups,
  plus a natural-language question field. Equipment selection is independent
  of space selection.
- Applicability engine (`guidance-ui.js` + data in `guidance-data.js`):
  interprets the question, identifies equipment and topics, and tailors
  results to the selected spaces. With no space types selected the tool
  returns equipment-specific guidance only, labels context-dependent
  requirements as conditional, and asks a clarifying question. With multiple
  spaces selected, results are shown per space and conflicting requirements
  (for example positive-pressure operating theatres vs negative-pressure
  isolation rooms) are flagged as conflicts and shown separately.
- Jurisdiction selector: United States model codes, Washington State, and
  Seattle, with free-text fields for the AHJ and adopted code editions.
  Model codes are never presented as enforceable law; adoption must be
  verified for the project.
- Structured reference database: 67 references (ICC, ASHRAE, NFPA, ASME,
  AHRI, AMCA, CTI, SMACNA, Hydraulic Institute, NEBB/AABC, UL, FGI, ISO,
  TIA, Uptime Institute, OSHA, EPA, Washington State and Seattle codes),
  each with edition, official source URL, access status, and verification
  status. 38 VERIFIED, 10 PARTIALLY VERIFIED, 19 NOT VERIFIED (see below).
- Topic library: 25 browsable HVAC design topics linked to references.
- Reference database manager: filterable table of all references.
- Search results now show: search interpretation, applicable references with
  classification, engineering interpretation, design checklist, coordination
  requirements, missing information, and official source links.
- `README.md` with deployment, embed, and reference-maintenance instructions.

### References successfully indexed (67)

All 67 references in `guidance-data.js` are indexed with title, issuing
organisation, edition, official source URL, access status, and verification
status. 38 editions were verified against publisher or government sources
on 11 November 2026, including: IBC/IMC/IFC/IECC/IPC/IFGC/IEBC/IgCC 2024;
NEC 2023; ASHRAE 15-2024, 34-2024, 55-2023, 62.1-2025, 62.2-2025, 90.1-2022,
90.4-2025, 111-2024, 135-2024, 170-2025, 188-2021, 202-2024, Guideline 0-2019,
Guideline 1.1-2025, Guideline 36-2024; NFPA 13-2025, 25-2026, 72-2025, 75-2024,
76-2024, 90A-2024, 91-2026, 92-2024, 101-2024, 110-2025, 111-2025, 855-2026;
ASME B31.9-2025, ASME BPVC-2025; ANSI/ASSP Z9.5-2022; ISO 14644-1:2015;
TIA-942-C (2024); FGI Codes 2026; BMBL 6th edition (2024); WAC 51-11 and
51-52 (2021); Seattle Mechanical and Energy Codes (2021 adoption).

### Paywalled references requiring an authorised copy (52)

All ASHRAE standards/guidelines/handbooks, all NFPA standards, all ASME
codes, all ICC model codes, SMACNA, FGI Codes, ISO/ISO-IEC, EN 50600, and
TIA-942. The tool links to the official source and never bypasses paywalls;
full text requires an authorised copy or a user-provided document.

### References with unverified editions or applicability (19, NOT VERIFIED)

IPC, IFGC, IEBC, IgCC, ASHRAE 180, ASHRAE Handbook volumes, ASME B16
series, ASME Section IX, AHRI, AMCA, CTI, SMACNA, Hydraulic Institute,
NEBB/AABC, UL, EN 50600 (2026 revision reported but not confirmed on a
CENELEC product page), Uptime Institute, OSHA, EPA §608/AIM Act. In
addition, ASME B31.5 is listed as 2022 per ASME's own catalogue; a 2025
edition has been reported by a regulator bulletin but is unresolved —
verify on the ASME product page before citing a 2025 edition. ASHRAE 90.2
(2024 edition) was inferred from ASHRAE Standards Actions and is therefore
PARTIALLY VERIFIED. All other references are PARTIALLY VERIFIED (edition
verified, official URL is a publisher catalogue/landing page rather than an
individually opened product page).

### Testing

- Local jsdom test suite (`/tmp/dg-qa/test.js`): 35 checks, all passing —
  80 space checkboxes, 69 equipment options, 5 jurisdictions, 25 topics,
  67-reference table; the 16 specified searches (no-space chiller,
  refrigerant piping, AHU; operating theatre + AHU; isolation + ventilation;
  chemical laboratory + exhaust; biological laboratory + ventilation;
  data hall + cooling; battery room + ventilation; residential apartment +
  ventilation; commercial office + AHU; multiple spaces + shared system;
  multiple spaces with conflicting requirements; jurisdiction-specific
  query; paywalled reference; superseded/outdated standard handling via
  verification flags); clear-all returns to equipment-only mode; existing
  notes search still works (81 results for "chiller").
- Live browser verification of the deployed site is recorded in the
  delivery message for this release.

### Preserved (unchanged)

- Notes search: 1,161-entry index, keyword scoring, source chips, file-type
  filter, Drive links, suggested queries.
- Single-page static site, GitHub Pages hosting, Google Sites iframe embed.

## [1.0.0] — 2026-11-11 (pre-existing)

- HVAC Repository prototype: notes search across the engineering-notes
  indexes as of Nov 11, 2026, and a static Design Guidance panel with
  curated links (ASHRAE TC 9.9, WAC Title 51, Seattle codes).
