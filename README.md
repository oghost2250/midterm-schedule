# Midterm Finder — Zewail City University

> Enter your student ID → get every Fall 2026 midterm's **date**, **time** and **room**.

A fast, dependency-free static site built from the official Fall 2026 midterm seating charts
published for Zewail City University (Zew'wail City, Egypt).

**Live site:** https://oghost2250.github.io/midterm-schedule/

---

## What it does

- **Instant lookup** — type your 9-digit student ID, press Enter, and see your full midterm schedule.
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
5. The result is validated by counting IDs per column against the per-room headcounts printed on the chart.

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
│   └── manual.json       # enrolments confirmed outside the seating charts
└── tools/
    └── build_data.py     # PDF → dataset extractor
```

## Notes & caveats

- Courses **SCH 210** (Social Issues) has **no published seating chart** — all four sections share one
  room, `F005-F`, on Sun 8 Nov, 11:00–12:00. It appears in the *All exams* catalog, and per-student
  only for IDs confirmed from the student's own registration (`data/manual.json`).
- Room codes are the university's seat-block format: building + room + block, e.g. `G011-B` = building G,
  room 011, block B.
- The dataset covers the **16 courses with published seating charts** (1,832 students, 7,177 exam records).
  If your ID is missing, it simply isn't in the published charts — check the digits, then use *All exams*.

## Built by

**Omar Tarek** — <o.tarek2250@gmail.com> · [@oghost2250](https://github.com/oghost2250)
