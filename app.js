/* Midterm Finder — app logic */
(() => {
  "use strict";

  const STUDENTS = window.STUDENTS || {};
  const COURSES = window.COURSES || {};
  const $ = (s) => document.querySelector(s);

  const input = $("#idInput");
  const counter = $("#counter");
  const results = $("#results");
  const form = $("#searchForm");

  const ICONS = {
    calendar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="16" rx="3.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10.5c0 5.5-8 11.5-8 11.5S4 16 4 10.5a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10.2" r="2.8"/></svg>',
    layers: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="m3 12.5 9 4.5 9-4.5"/></svg>',
  };

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const toMinutes = (t) => {
    const [h, m] = t.split("-")[0].split(":").map(Number);
    return h * 60 + m;
  };
  const parseDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const fmtDate = (iso, opts) =>
    parseDate(iso).toLocaleDateString("en-GB", opts || { weekday: "short", day: "numeric", month: "short" });
  const fmtLong = (iso) =>
    parseDate(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const daysUntil = (iso) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((parseDate(iso) - today) / 86400000);
  };
  const countdown = (iso) => {
    const d = daysUntil(iso);
    if (d < 0) return "past";
    if (d === 0) return "today";
    if (d === 1) return "tomorrow";
    return `in ${d} days`;
  };

  const sortedExams = (list) =>
    list.slice().sort((a, b) => (a.d === b.d ? toMinutes(a.t) - toMinutes(b.t) : a.d < b.d ? -1 : 1));

  /* ---------- rendering ---------- */
  function detectConflicts(exams) {
    const conflicts = new Set();
    for (let i = 0; i < exams.length; i++) {
      for (let j = i + 1; j < exams.length; j++) {
        if (exams[i].d !== exams[j].d) continue;
        const a1 = toMinutes(exams[i].t), a2 = toMinutes(exams[j].t);
        if (a1 < toMinutes(exams[j].t.split("-")[1]) && toMinutes(exams[i].t.split("-")[1]) > a2) {
          conflicts.add(exams[i].c + "|" + exams[j].c);
          conflicts.add(exams[j].c + "|" + exams[i].c);
        }
      }
    }
    return conflicts;
  }

  function examCard(ex, opts) {
    const c = COURSES[ex.c] || { title: ex.c };
    const isNext = opts.nextKey === ex.c + ex.d;
    const isConflict = opts.conflicts.has(ex.c + "|" + ex.d);
    const badges = [];
    if (isNext) badges.push('<span class="badge next">next up</span>');
    if (isConflict) badges.push('<span class="badge conflict">conflict</span>');
    if (ex.s) badges.push(`<span class="badge section">sec ${esc(ex.s)}</span>`);

    const when = `${fmtDate(ex.d)} · ${fmtLong(ex.d).split(",")[0]}`;
    return `
      <article class="exam-card ${isNext ? "is-next" : ""} ${isConflict ? "is-conflict" : ""}"
               style="animation-delay:${opts.index * 55}ms">
        <div class="card-top">
          <span class="course-code">${esc(ex.c)}</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${badges.join("")}</div>
        </div>
        <h3 class="course-title">${esc(c.title || ex.c)}</h3>
        <div class="detail-rows">
          <div class="detail">${ICONS.calendar}<span class="k">Date</span><span class="v">${when}</span></div>
          <div class="detail">${ICONS.clock}<span class="k">Time</span><span class="v mono">${esc(ex.t)}</span></div>
          <div class="detail">${ICONS.pin}<span class="k">Room</span><span class="v mono">${esc(ex.r)}</span></div>
          <div class="detail">${ICONS.layers}<span class="k">Days</span><span class="v">${countdown(ex.d)}</span></div>
        </div>
      </article>`;
  }

  function render(id) {
    const exams = sortedExams(STUDENTS[id] || []);
    if (!exams.length) {
      results.innerHTML = `
        <div class="empty">
          <div class="icon">🔎</div>
          <h3>No exams found for ${esc(id)}</h3>
          <p>That ID is not in any of the 16 published Fall 2026 seating charts.
             Double-check the digits, or scroll down to <b>All exams</b> for the full course-by-course schedule.</p>
        </div>`;
      return;
    }

    const conflicts = detectConflicts(exams);
    const future = exams.filter((e) => daysUntil(e.d) >= 0);
    const next = future[0] || exams[0];
    const days = new Set(exams.map((e) => e.d));
    const rooms = new Set(exams.map((e) => e.r));

    const pills = [
      `<span class="pill"><b>${exams.length}</b> exam${exams.length > 1 ? "s" : ""}</span>`,
      `<span class="pill"><b>${days.size}</b> day${days.size > 1 ? "s" : ""}</span>`,
      `<span class="pill"><b>${rooms.size}</b> room${rooms.size > 1 ? "s" : ""}</span>`,
    ];
    if (future.length) {
      pills.push(
        `<span class="pill next">Next: <b>${esc(next.c)}</b> ${esc(fmtDate(next.d))} · ${esc(next.t)} · ${esc(next.r)}</span>`
      );
    }
    if (conflicts.size) pills.push(`<span class="pill warn"><b>${conflicts.size / 2}</b> clash</span>`);

    // group by day
    const groups = [];
    for (const ex of exams) {
      const g = groups.find((x) => x.d === ex.d);
      if (g) g.items.push(ex);
      else groups.push({ d: ex.d, items: [ex] });
    }

    const cards = groups
      .map(
        (g) => `
        <div class="day-header"><b>${esc(fmtLong(g.d))}</b> <span>${esc(countdown(g.d))}</span></div>
        ${g.items
          .map((ex, i) =>
            examCard(ex, {
              index: exams.indexOf(ex),
              nextKey: next.c + next.d,
              conflicts: conflicts,
            })
          )
          .join("")}`
      )
      .join("");

    results.innerHTML = `
      <div class="result-head">
        <div>
          <h2 class="result-id">${esc(id)}</h2>
          <p class="result-sub">Fall 2026 midterm schedule · ${esc(exams.length)} exam${exams.length > 1 ? "s" : ""} across ${days.size} day${days.size > 1 ? "s" : ""}</p>
        </div>
        <div class="summary-pills">${pills.join("")}</div>
      </div>
      ${conflicts.size ? `<div class="alert"><span>⚠️</span><span>Two of your exams overlap. Check with your instructor which one to attend.</span></div>` : ""}
      <div class="exam-grid">${cards}</div>`;

    results.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------- catalog ---------- */
  function buildCatalog() {
    const roomsByCourse = {};
    for (const list of Object.values(STUDENTS)) {
      for (const e of list) {
        (roomsByCourse[e.c] = roomsByCourse[e.c] || new Set()).add(e.r);
      }
    }
    const entries = Object.entries(COURSES).sort((a, b) => (a[1].date === b[1].date ? a[1].time.localeCompare(b[1].time) : a[1].date < b[1].date ? -1 : 1));
    $("#catalogCount").textContent = entries.length;
    return entries.map(([code, c]) => ({
      code,
      title: c.title,
      date: c.date,
      time: c.time,
      rooms: c.room ? [c.room] : [...(roomsByCourse[code] || [])].sort(),
    }));
  }

  let CATALOG = [];
  function renderCatalog(filter) {
    const q = (filter || "").trim().toLowerCase();
    const rows = CATALOG.filter(
      (c) => !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    );
    $("#catalogHint").textContent = `${rows.length} of ${CATALOG.length} courses`;
    $("#catalogGrid").innerHTML = rows
      .map(
        (c) => `
        <article class="cat-card">
          <span class="course-code">${esc(c.code)}</span>
          <h3>${esc(c.title)}</h3>
          <dl>
            <div><dt>Date</dt><dd>${esc(fmtLong(c.date))}</dd></div>
            <div><dt>Time</dt><dd class="mono" style="font-family:var(--mono)">${esc(c.time)}</dd></div>
            <div><dt>Rooms</dt><dd style="font-family:var(--mono)">${esc(c.rooms.join(", ") || "—")}</dd></div>
          </dl>
        </article>`
      )
      .join("");
  }

  /* ---------- interaction ---------- */
  function normalize(v) {
    return v.replace(/\D/g, "").slice(0, 9);
  }

  input.addEventListener("input", () => {
    const v = normalize(input.value);
    if (v !== input.value) input.value = v;
    counter.textContent = `${v.length}/9`;
    if (v.length === 9) run(v);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = normalize(input.value);
    if (v.length !== 9) {
      input.focus();
      results.innerHTML = `<div class="empty"><div class="icon">⌨️</div><h3>Enter your 9-digit student ID</h3>
        <p>Your ID looks like <b>202612577</b>. Type all nine digits and your schedule appears instantly.</p></div>`;
      return;
    }
    run(v);
  });

  function run(id) {
    render(id);
    const url = new URL(window.location.href);
    url.searchParams.set("id", id);
    history.replaceState(null, "", url);
  }

  document.querySelectorAll(".chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      input.value = chip.dataset.id;
      counter.textContent = `${chip.dataset.id.length}/9`;
      run(chip.dataset.id);
    })
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
      input.select();
    }
    if (e.key === "Escape") {
      input.value = "";
      counter.textContent = "0/9";
      input.blur();
    }
  });

  $("#catalogBtn").addEventListener("click", () => {
    const cat = $("#catalog");
    cat.classList.toggle("hidden");
    if (!cat.classList.contains("hidden")) cat.scrollIntoView({ behavior: "smooth" });
  });

  $("#catalogFilter").addEventListener("input", (e) => renderCatalog(e.target.value));

  /* ---------- theme ---------- */
  const themeBtn = $("#themeBtn");
  const savedTheme = localStorage.getItem("midterm-theme");
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("midterm-theme", next);
  });

  /* ---------- boot ---------- */
  CATALOG = buildCatalog();
  renderCatalog("");
  const studentCount = Object.keys(STUDENTS).length;
  const examCount = Object.values(STUDENTS).reduce((n, l) => n + l.length, 0);
  $("#footStats").textContent = `${studentCount.toLocaleString()} students · ${examCount.toLocaleString()} exam records · ${CATALOG.length} courses`;

  const preset = new URL(window.location.href).searchParams.get("id");
  if (preset) {
    const v = normalize(preset);
    input.value = v;
    counter.textContent = `${v.length}/9`;
    if (v.length === 9) render(v);
  } else {
    results.innerHTML = `<div class="empty"><div class="icon">🎓</div><h3>Your Fall 2026 exams, in one search</h3>
      <p>Type your student ID above to see every midterm's <b>date</b>, <b>time</b> and <b>room</b> — pulled from the official seating charts.</p></div>`;
  }
})();
