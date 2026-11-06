# Midterm Finder — Zewail City University

> Enter your student ID → get every Fall 2026 midterm's **date**, **time** and **room**.

A fast, dependency-free static site built from the official Fall 2026 midterm seating charts
published for Zewail City University (Zew'wail City, Egypt).

**Live site:** https://oghost2250.github.io/midterm-schedule/

---

## What it does

- **Instant lookup** — type your 9-digit student ID, press Enter, and see your full midterm schedule.
- **Complete first-year timetable** — for 2026 first-years the programme's two open slots (English and
  ethics/social issues) are auto-filled from the standard programme plan, so all **6 subjects** show at
  once. Assumed cards are marked **assumed** and can be corrected in one tap (e.g. `ENGL 003` → `ENGL 004`,
  `SCH 210` → `SCH 263`); the correction is saved for that student ID.
- **Exam cards** — course code, course title, section, date, time, room, and a live "in N days" countdown.
- **Conflict detection** — overlapping exams are flagged automatically.
- **All exams** — browse the complete course-by-course schedule for the whole midterm window.
- **Works offline** — the dataset is embedded as a plain JS file, so the site also runs from a local
  copy without a server (`file://`).

## Tech

| Layer | Choice | Why |
|---|---|---|
| Front-end | Plain HTML / CSS / JS, zero dependencies | No build step, no npm, loads instantly, nothing to break |
| Data | `data/students.js` (`window.STUDENTS` / `window.COURSES`) | Works from `file://` and from GitHub Pages without CORS issues |
| Hosting | GitHub Pages | Free, HTTPS, one-command deploys |
| Design | Glassmorphism over an animated aurora mesh, dark + light themes | Looks good in a lecture hall on a phone |

## Data pipeline

The dataset is generated from the official seating-chart PDFs:

1. Each PDF page is parsed with **pdfplumber** to recover every word **with its x-coordinate**.
2. On the first page of a chart, the header line gives the course, date, time and total student count;
   the line below it lists the **room codes**, and each room code is mapped to the seating **column**
   underneath it by comparing *centres* (not left edges).
3. Each 9-digit student ID is assigned to the room of the column it appears in; the bracketed label
   next to it gives the section (e.g. `S04`).
4. Pages that repeat a room header start a new block; pages without one continue the previous block.
5. **Attendance-sheet PDFs** (e.g. `CSAI_252_Midterm_Attendance_Sheet_2.pdf`) use a prose table instead of a
   grid, so they get their own parser: the `Room <CODE> (N students)` header names the room, and every
   9-digit ID on that page belongs to it. An attendance sheet supersedes any older chart for the same course.
6. The result is validated by counting IDs per column against the per-room headcounts printed on the chart.

`data/programmes.json` defines each first-year programme (`core`, `expected`, `optionGroups` with a
`default` and allowed `options`). When it exists, the build script uses it verbatim; otherwise it falls back
to the built-in defaults in `tools/build_data.py`.

Regenerate the dataset:

```bash
python tools/build_data.py "C:/path/to/folder/containing/the/PDFs" ./data
```

Output: `data/students.json` (source of truth), `data/courses.json`, `data/students.js` (embedded copy).

## Project layout

```
midterm-lookup/
├── index.html            # the app
├── styles.css            # theme, layout, animations
├── app.js                # lookup, rendering, catalog, themes
├── data/
│   ├── students.js       # embedded dataset used by the site
│   ├── students.json     # same data, plain JSON
│   ├── courses.json      # course → title / date / time
│   ├── catalog.json      # full official Fall 2026 midterm schedule
│   ├── programmes.json   # first-year programme cores + option groups
│   └── manual.json       # enrolments confirmed outside the seating charts
└── tools/
    └── build_data.py     # PDF → dataset extractor
```

## Notes & caveats

- **No per-student chart for the humanities.** `ENGL 003`, `SCH 210` and `SCH 263` are single-hall subjects
  with no published seating chart, so the site cannot know which one a specific student takes. For 2026
  first-years it shows the programme defaults (`ENGL 003` + `SCH 210`) and labels them **assumed**; tap
  **Change** on the card if your registration says `ENGL 004` or `SCH 263`. Everyone can also add any course
  with **+ Add another course**.
- **Engineering first-years** already have six core courses, so no humanities are auto-added.
- `CSAI 252` uses the 28-page attendance sheet (`CSAI_252_Midterm_Attendance_Sheet_2.pdf`, 528 students across
  `G006-B`, `G011-B`, `G019-B`, `G025-B`), which supersedes the older 3-room chart.
- Room codes are the university's seat-block format: building + room + block, e.g. `G011-B` = building G,
  room 011, block B.
- The dataset covers the **16 courses with published seating charts** (1,836 students, 7,188 exam records).
  If your ID is missing, it simply isn't in the published charts — check the digits, then use *All exams*.

## Built by

**Omar Tarek** — <o.tarek2250@gmail.com> · [@oghost2250](https://github.com/oghost2250)

© 2026 Omar Tarek. Licensed under the [MIT License](./LICENSE).
