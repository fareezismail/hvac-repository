# Changelog

All notable changes to the HVAC Repository.

## [2.2.0] — 2026-11-11

### Fixed — version strings

- The v2.1 bump missed the in-tab version line: the Design Guidance tab
  still read "Version 2.0" while the footer read "Design Guidance v2.1".
  Both now read 2.2, and no 2.0/2.1 version strings remain in the UI.

### Added — data-centre depth

- Nine new references (database now 76; 44 VERIFIED, 11 PARTIALLY VERIFIED,
  21 NOT VERIFIED; 59 PAYWALLED):
  - ASHRAE 127-2020 (VERIFIED), including Addendum b (approved 27 February
    2026) which extends the rating method to liquid-cooling equipment and
    CDUs and defines the Technology Cooling System (TCS) and Facility Water
    System (FWS).
  - AHRI 550/590 (I-P) 2026 and AHRI 551/591 (SI) 2026 (both VERIFIED;
    550/590-2026 announced by AHRI in 2026, 551/591-2026 approved
    28 January 2026; both supersede the 2023 editions).
  - CTI ATC-105 and CTI STD-201 (both NOT VERIFIED — secondary sources
    disagree on the ATC-105 edition, and STD-201 has been restructured into
    STD-201RS / Dry RS / OM; both flagged to confirm with CTI).
  - ASHRAE TC 9.9 Thermal Guidelines, 5th edition, revised and expanded
    (2024) (PARTIALLY VERIFIED — the 2024 revised edition is listed by
    standards retailers, not confirmed on ASHRAE's own page).
  - ASHRAE Guideline 12-2020 (VERIFIED), ASHRAE Guideline 1.5-2017
    (VERIFIED; a revised edition is in development, public review
    August–September 2026), ISO/IEC 30134 multi-part KPIs (2016–2026)
    (VERIFIED, from the ISO committee catalogue; Part 2 PUE is the 2026
    edition, the 2016 edition is withdrawn).
  - NFPA 75 note updated: the 2024 edition adds requirements for
    immersion-cooling equipment and off-gas detection, and lithium-ion
    battery requirements moved to NFPA 855 (summarised from the publisher's
    edition summary; exact provisions to be confirmed in the published text).
- Equipment catalogue grows from 69 to 72 items: cooling distribution
  units (CDUs), direct-to-chip liquid cooling, and immersion cooling, with
  natural-language aliases and equipment profiles (TCS/FWS split, coolant
  and water-quality requirements, leak detection, NFPA 75 provisions).
- Data hall, server room, UPS room, battery room, and generator room
  profiles deepened: TC 9.9 classes A1–A4 described qualitatively only
  (A1 narrowest allowable envelope, A4 widest; the recommended envelope is
  narrower than any allowable envelope — no numeric class ranges are
  published), TCS/FWS split, Tier redundancy effects (concurrently
  maintainable design needs N+1 plant, isolation valves, maintenance
  bypasses; Tier certification is not code compliance), battery-room
  gas/off-gas detection, generator combustion air and radiator heat
  rejection, and integrated-systems / failure-mode testing (loss of a
  chiller, pump or cooling-tower cell; standby start-up; chilled-water
  temperature recovery; server inlet temperature envelope; alarms to BMS).
- Commissioning topic now includes ASHRAE Guideline 1.5 and covers
  integrated systems and failure-mode testing.

### Added — outstanding documents section

- Every search result now lists the references it relies on whose full text
  is not freely available (PAYWALLED or PUBLIC PARTIAL), each with title,
  edition, publisher, official source link, why it is needed for this
  search, what cannot be verified without it, and the action ("upload an
  authorised copy or provide an accessible link"). The section ends:
  "Do not mark this review complete until the outstanding documents are
  provided or the gaps are otherwise closed." It is tied to the query's own
  references, not the whole database.

### Added — Washington 2024 code note

- The Washington State and Seattle jurisdiction options now note that the
  State Building Code Council states the 2024 Washington codes are
  scheduled to take effect 3 May 2027 (final adoption still pending at
  last check; 2021 editions remain the baseline), and that Seattle is
  targeting adoption of the 2024 Seattle codes by about May 2027.

### Testing

- Local jsdom test suite (`/tmp/dg-qa/test.js`): 46 checks, all passing —
  the previous 36 checks plus 10 new v2.2 checks (outstanding-documents
  section for a paywalled query, WA 2024 note, TC 9.9 classes / TCS/FWS /
  Tier content, CDU and immersion-cooling equipment, 76-reference table,
  AHRI 550/590 filter, no outstanding section when a query has no refs,
  version strings consistent at 2.2). Live browser verification of the
  deployed site is recorded in the delivery message for this release.

## [2.1.0] — 2026-11-11

### Added — clause-level references

- Clause-level section tables for 13 references (192 section entries):
  IMC (54 sections across Chapters 4, 5, 6, 11 and 12, including Chapter 11
  sections 1101.1–1110 plus 1109.2.7 and 1111), ASHRAE 15 (10), ASHRAE 62.1
  (13, including VRP subsections 6.2–6.5.6.1), ASHRAE 170 (8), ASHRAE 90.1
  (17, including §6.1–6.9), ASHRAE 90.4 (11), NFPA 90A (10), NFPA 92 (9),
  NFPA 101 (25 chapters), ASME B31.5 (12), ANSI/ASSP Z9.5 (7),
  ISO 14644-1 (10), IBC (6 chapters). Each entry gives section, subject,
  what it covers, and whether it is mandatory or advisory. Section titles
  are from the published tables of contents; descriptions are paraphrased
  summaries, not quoted text.
- Section-number search: questions such as "IMC 1107" or "1109.2.7" now
  surface the matching clause first, with its reference, edition, and
  official source link.
- Results show the question itself in the search-interpretation box.
- Reference manager gains a Clauses column (sections indexed per reference).
- References without verified clause structures still show an honest
  "not yet indexed" note instead of a guessed list.

### Fixed — topic library

- The topic cards were technically clickable, but the detail appeared below
  the 25-card grid with no scroll or highlight, so it looked like nothing
  happened. Topics now show a "View references →" affordance; clicking one
  scrolls the detail into view with a highlighted border; and the detail has
  a "Search guidance on this topic" button that runs a tailored search using
  the space types and equipment currently selected. The intended purpose of
  the library is as a subject-based entry point: pick a topic, see its
  linked references with official source links, then run a tailored search
  — not a set of standalone articles.

### Corrected

- IBC Chapter 28 ("Mechanical Systems") does exist (§2801.1 links
  mechanical systems to the IMC and IFGC); the earlier note suggesting
  otherwise was wrong.
- ASHRAE 170 section titles: the 2021 structure is §7 Inpatient Spaces,
  §8 Outpatient Facilities, §10 Construction and System Start-Up. Whether
  the 2025 edition restructured these sections is unverified, so the tool
  uses the 2021 structure and flags the uncertainty on the reference.
- ANSI/ASSP Z9.5-2022 §§6–10 numbering is ambiguous across sources and is
  not published; §§1–5 and the appendices are indexed.
- NFPA 90A:2027 and NFPA 101:2027 supersession reports (retailer listings)
  are unverified and are flagged, not relied on.
- ASME B31.5 clause structure fully verified from the official ASME
  preview table of contents; the 2025-edition report remains unresolved.

### Testing

- Local jsdom test suite (`/tmp/dg-qa/test.js`): 36 checks, all passing —
  the previous 34 checks plus topic click via the card's inner text and the
  topic "Search guidance" button. Live browser verification of the deployed
  site is recorded in the delivery message for this release.

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
