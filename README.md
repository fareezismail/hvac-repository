# HVAC Repository

The **Search my notes** tab searches Fareez's indexed engineering-notes
repository — the "HVAC" folder in Google Drive — covering design guides and
codes, project calculations, equipment and vendor catalogs, and the folder
structure itself. Results show the index entry and folder path; "Open in
Drive" opens the file directly where it was resolved against Drive, and
otherwise runs a Drive search for the file name.

Live site: https://fareezismail.github.io/hvac-repository/

## Design Guidance (v3.2.2)

The **Design guidance** tab is a space-type-based HVAC design codes and
guidance platform. It is fully client-side: there is no backend, no API key,
and no live web search. Answers are generated from a curated reference
database in `guidance-data.js` by the applicability engine in
`guidance-ui.js`, with a browser-local document library in
`guidance-library.js`.

Workflow order in the tab: **(1) Document library → (2) space types /
equipment / jurisdiction → (3) search → (4) 10-part report → (5) project
checklist.** The topic library sits below the report.

- **Space types:** 79 space types in 8 groups, multi-select checkboxes
  (healthcare, laboratory, data centre, commercial, residential, industrial,
  public/assembly, building support) plus an "Other / specialist space" option
  with a free-text field. Filter, select-all, and clear-all controls included.
- **Equipment/system:** 72 equipment and system types in 6 groups, plus a
  natural-language question field. Data-centre liquid cooling is covered in
  depth: cooling distribution units (CDUs), direct-to-chip cooling, and
  immersion cooling, with the Technology Cooling System (TCS) vs Facility
  Water System (FWS) split.
- **No space selected = equipment-only mode.** The tool never assumes a
  building type. Requirements that depend on installation context are labelled
  conditional, and a clarifying question is shown.
- **Multiple spaces:** results are shown per space; conflicting requirements
  (for example positive-pressure operating theatres vs negative-pressure
  isolation rooms) are flagged as conflicts and shown separately, not merged.
- **Jurisdiction:** US model codes, Washington State, and Seattle, with
  fields for the AHJ and adopted code editions. A model code is never
  presented as enforceable law — adoption must be verified for the project.
- **Reference database:** 76 references (ICC, ASHRAE, NFPA, ASME, AHRI,
  AMCA, CTI, SMACNA, Hydraulic Institute, NEBB/AABC, UL, FGI, ISO, TIA,
  Uptime Institute, OSHA, EPA, Washington State and Seattle codes). Each
  entry carries its edition, official source URL, access status, and
  verification status. Editions were checked against publisher sources on
  11 November 2026; see CHANGELOG.md for the verified / unverified lists.
- **Clause-level references:** 192 section entries across 13 references
  (IMC, ASHRAE 15/62.1/170/90.1/90.4, NFPA 90A/92/101, ASME B31.5,
  ANSI/ASSP Z9.5, ISO 14644-1, IBC), each with section, subject, what it
  covers, and mandatory/advisory classification. Section-number questions
  ("IMC 1107", "1109.2.7") surface the matching clause first **and** the
  matched reference's card with its clause table. Section titles come from
  published tables of contents; descriptions are paraphrased, never quoted
  text. References without verified clause structures say so instead of
  showing a guessed list.
- **Document library (browser-local):** the 76 references are the library
  catalogue, grouped in five categories (01 Building and Mechanical Codes,
  02 ASHRAE, 03 NFPA and Fire Codes, 04 Piping and Equipment, 05 Data Centre
  Standards). Each entry shows its metadata and one of five statuses:
  Available / Partial / Upload required / Link required / Unverified. Each
  entry has an upload control (PDF, DOCX, XLSX, TXT) and a direct-URL field.
  Uploading an authorised copy extracts its full text in the browser, makes
  it keyword-searchable, flips the reference to Available (your copy), and
  re-runs the current query with it included. Adding a newer edition flags
  the older one as Superseded instead of replacing it. Nothing ever leaves
  the browser: uploads and the index live in IndexedDB (localStorage /
  in-memory fallback where IndexedDB is unavailable). Library Export
  downloads a backup file; Import restores it — local files only. The
  library replaces the old reference-manager table.
- **Upload extraction (location references, honestly by format):** PDF =
  page numbers; DOCX = section headings in document order (no page numbers
  are invented for DOCX); XLSX = sheet and cell; TXT = line numbers.
  Search results surface matches from uploaded documents in Part 5 with
  their location reference. No structured clause extraction — full text is
  enough. Reader libraries (pdf.js 3.11.174, Mammoth 1.8.0, SheetJS
  xlsx 0.18.5) are loaded from cdnjs on demand; uploaded documents are
  never transmitted to any external service.
- **10-part engineering report:** every search result is structured as
  (1) Search term and equipment configuration, (2) Related mechanical
  systems, (3) Applicable codes and standards, (4) Exact clauses and
  subsections, (5) Relevant code language or concise paraphrase,
  (6) Engineering interpretation, (7) Specific design checks,
  (8) Required calculations, drawings or schedules, (9) Exceptions and
  applicability conditions, (10) Official source links and verification
  status. A completeness banner sits above Part 1, and the
  outstanding-documents section follows Part 10. Existing content
  (interpretation, per-space sections, conflict warnings, checklist items,
  coordination, missing information) is mapped into the parts, not dropped.
- **Intelligent search:** curated related-systems maps for CRAC, CRAH,
  chillers (air- and water-cooled), cooling towers, and AHUs feed Part 2.
  When the configuration of the equipment changes the answer, the tool asks
  a quick clarifying question before showing results: DX vs chilled-water
  CRAC/CRAH, and air- vs water-cooled chiller, with a "Show both" escape.
  The chosen configuration is recorded in Part 1 and remembered per
  equipment for the session.
- **Coverage lists ("what this standard covers"):** curated for the
  refrigeration/piping set — ASME B31.5, ASHRAE 15, ASHRAE 34, IMC
  Chapter 11 (marked partial where the list is known to be incomplete).
  When one of these references is outstanding, the report lists exactly
  which verification areas it blocks. Coverage lists for other references
  are follow-up work, not v3.0.
- **Outstanding documents:** every search result lists the references it
  relies on whose full text is not freely available (paywalled or only
  partly accessible), with the edition, official source, why each is needed,
  what cannot be verified without it, and the action required — and states
  plainly that the review must not be marked complete until those documents
  are provided or the gaps are otherwise closed.
- **Persistent project checklist:** design checks from each report can be
  added to a project checklist that accumulates across searches and is
  stored locally in the same browser as the library. Items can be ticked
  off, removed, or cleared when completed; the checklist can be exported
  as JSON and printed via the browser. The tool never marks anything
  compliant on its own — ticks are the user's only.
- **Topic library:** 25 browsable HVAC design topics. Each topic card is
  clickable ("View references →"): it shows the topic's linked references
  with official source links and a "Search guidance on this topic" button
  that runs a tailored search using the space types and equipment currently
  selected. The library is a subject-based entry point into the reference
  database and the search, not a set of standalone articles.
- **Data-centre depth:** data hall, server room, UPS room, battery room,
  and generator room profiles cover ASHRAE TC 9.9 environmental classes
  A1–A4 (qualitative: A1 narrowest allowable envelope, A4 widest), the
  TCS/FWS liquid-cooling split, Uptime Tier redundancy effects (with the
  warning that Tier certification is not code compliance), battery-room
  gas/off-gas detection, generator combustion air and radiator heat
  rejection, and integrated-systems / failure-mode testing.
- **Washington 2024 code note:** the Washington State and Seattle
  jurisdiction options note that the State Building Code Council states the
  2024 Washington codes are scheduled to take effect 3 May 2027 (final
  adoption still pending at last check, 2021 editions remain the baseline),
  and that Seattle is targeting adoption by about May 2027.

### Honesty and copyright

- Most ASHRAE, NFPA, ASME, and ICC documents are **paywalled**. This tool
  links to the official source and summarises applicability; it does not
  reproduce copyrighted standard text and never bypasses paywalls.
- Clause descriptions are subject-matter summaries, not verbatim clause text.
- Where an edition could not be verified against the publisher, the reference
  is marked **NOT VERIFIED**. Where adoption is not confirmed for the selected
  jurisdiction, applicability is marked **unconfirmed**.
- Uploaded copies are the user's own authorised copies, stored only in the
  user's browser. Do not upload a document you are not authorised to hold.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole site (notes search + Design Guidance tab). Single page. |
| `guidance-data.js` | Space types, equipment catalogue, jurisdictions, reference database, space/equipment profiles, topic library, coverage lists, related-systems maps, configuration definitions. |
| `guidance-library.js` | Browser-local document library: storage (IndexedDB/localStorage/in-memory), upload extraction (pdf.js/Mammoth/SheetJS), keyword search over uploaded text, export/import. |
| `guidance-ui.js` | Design Guidance UI and applicability engine: library rendering, clarifier, 10-part report, project checklist. |
| `README.md` | This file. |
| `CHANGELOG.md` | Version history. |

## Local run

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Deployment (GitHub Pages)

The site is deployed from the `main` branch root via GitHub Pages. To update:

1. Edit the files locally and check the JavaScript syntax:
   `node --check guidance-data.js && node --check guidance-library.js && node --check guidance-ui.js`
2. Run the local jsdom test suite in `/tmp/dg-qa/test.js` (see CHANGELOG for
   the current pass/fail record) before pushing.
3. Push to `fareezismail/hvac-repository` branch `main` (via the GitHub
   connector push-files procedure). GitHub Pages redeploys automatically.
4. Verify the live site shows the new version in the footer and re-test the
   Design Guidance tab.

## Google Sites embed

```html
<iframe src="https://fareezismail.github.io/hvac-repository/" width="100%" height="1200" style="border:0" title="HVAC Repository"></iframe>
```

Insert → Embed → Embed code in Google Sites.

## Adding or updating a reference

Edit `guidance-data.js`: add an entry to `REFERENCES` with `id`, `num`,
`title`, `org`, `edition`, `year`, `type`, `url`, `access`, `verification`,
`cls`, `spaces`, `equip`, `clauses`, and `notes`. Link the reference from the
relevant space/equipment profiles and topics. Set `verification` to
`NOT VERIFIED` until the edition has been checked against the publisher.
Add the reference's category in `LIB_CATS` so it appears in the library.
