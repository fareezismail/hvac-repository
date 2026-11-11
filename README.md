# HVAC Repository

Search across Fareez's indexed engineering-notes repository — the "HVAC" folder
in Google Drive — covering design guides and codes, project calculations,
equipment and vendor catalogs, and the folder structure itself. Results point
back to the index entry and folder path so the source document can be opened
in Drive.

Live site: https://fareezismail.github.io/hvac-repository/

## Design Guidance (v2.0)

The **Design guidance** tab is a space-type-based HVAC design codes and
guidance platform. It is fully client-side: there is no backend, no API key,
and no live web search. Answers are generated from a curated reference
database in `guidance-data.js` by the applicability engine in
`guidance-ui.js`.

- **Space types:** 79 space types in 8 groups, multi-select checkboxes
  (healthcare, laboratory, data centre, commercial, residential, industrial,
  public/assembly, building support) plus an "Other / specialist space" option
  with a free-text field. Filter, select-all, and clear-all controls included.
- **Equipment/system:** 69 equipment and system types in 6 groups, plus a
  natural-language question field.
- **No space selected = equipment-only mode.** The tool never assumes a
  building type. Requirements that depend on installation context are labelled
  conditional, and a clarifying question is shown.
- **Multiple spaces:** results are shown per space; conflicting requirements
  (for example positive-pressure operating theatres vs negative-pressure
  isolation rooms) are flagged as conflicts and shown separately, not merged.
- **Jurisdiction:** US model codes, Washington State, and Seattle, with
  fields for the AHJ and adopted code editions. A model code is never
  presented as enforceable law — adoption must be verified for the project.
- **Reference database:** 67 references (ICC, ASHRAE, NFPA, ASME, AHRI,
  AMCA, CTI, SMACNA, Hydraulic Institute, NEBB/AABC, UL, FGI, ISO, TIA,
  Uptime Institute, OSHA, EPA, Washington State and Seattle codes). Each
  entry carries its edition, official source URL, access status, and
  verification status. Editions were checked against publisher sources on
  11 November 2026; see CHANGELOG.md for the verified / unverified lists.
- **Clause-level references:** 192 section entries across 13 references
  (IMC, ASHRAE 15/62.1/170/90.1/90.4, NFPA 90A/92/101, ASME B31.5,
  ANSI/ASSP Z9.5, ISO 14644-1, IBC), each with section, subject, what it
  covers, and mandatory/advisory classification. Section-number questions
  ("IMC 1107", "1109.2.7") surface the matching clause first. Section
  titles come from published tables of contents; descriptions are
  paraphrased, never quoted text. References without verified clause
  structures say so instead of showing a guessed list.
- **Topic library:** 25 browsable HVAC design topics. Each topic card is
  clickable ("View references →"): it shows the topic's linked references
  with official source links and a "Search guidance on this topic" button
  that runs a tailored search using the space types and equipment currently
  selected. The library is a subject-based entry point into the reference
  database and the search, not a set of standalone articles.
- **Reference manager:** filterable table of all references by title,
  organisation, access, and verification status.

### Honesty and copyright

- Most ASHRAE, NFPA, ASME, and ICC documents are **paywalled**. This tool
  links to the official source and summarises applicability; it does not
  reproduce copyrighted standard text and never bypasses paywalls.
- Clause descriptions are subject-matter summaries, not verbatim clause text.
- Where an edition could not be verified against the publisher, the reference
  is marked **NOT VERIFIED**. Where adoption is not confirmed for the selected
  jurisdiction, applicability is marked **unconfirmed**.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The whole site (notes search + Design Guidance tab). Single page. |
| `guidance-data.js` | Space types, equipment catalogue, jurisdictions, reference database, space/equipment profiles, topic library. |
| `guidance-ui.js` | Design Guidance UI and applicability engine. |
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
   `node --check guidance-data.js && node --check guidance-ui.js`
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
