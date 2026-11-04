/* Midterm Finder — app logic */
(() => {
  "use strict";

  const STUDENTS = window.STUDENTS || {};
  const COURSES = window.COURSES || {};
  const CATALOG = window.CATALOG || COURSES;
  const PROGRAMMES = window.PROGRAMMES || {};
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const input = $("#idInput");
  const counter = $("#counter");
  const results = $("#results");
  const form = $("#searchForm");
  const picker = $("#picker");
  const pickerSearch = $("#pickerSearch");
  const pickerList = $("#pickerList");
  const toast = $("#toast");

  const ICONS = {
    calendar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="16" rx="3.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10.5c0 5.5-8 11.5-8 11.5S4 16 4 10.5a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10.2" r="2.8"/></svg>',
    layers: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 3 7.5 12 12l9-4.5L12 3Z"/><path d="m3 12.5 9 4.5 9-4.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.01"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>',
  };

  const state = {
    id: "",
    confirmed: [],
    added: [],
    assumed: [],
    programme: null,
    pickerSlot: null,
    toastTimer: null,
  };

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toMinutes = (t) => {
    const [h, m] = String(t).split("-")[0].split(":").map(Number);
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

  const courseInfo = (code) => CATALOG[code] || COURSES[code] || { title: code };
  const courseCodeKey = (code) => {
    for (const [primary, c] of Object.entries(CATALOG)) {
      if (primary === code || (c.also || []).includes(code)) return primary;
    }
    return code;
  };
  const courseExam = (code) => {
    const primary = courseCodeKey(code);
    const c = courseInfo(primary);
    if (!c || !c.date || !c.time) return null;
    return {
      c: primary,
      sc: primary,
      d: c.date,
      t: c.time,
      r: (c.rooms || (c.room ? [c.room] : [])).join(", ") || "See schedule",
      s: "",
      added: true,
    };
  };
  const examKey = (e) => `${e.c}|${e.d}`;

  const storageKey = (id) => `mf:added:${id}`;
  function loadAdded(id) {
    try {
      const raw = localStorage.getItem(storageKey(id));
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((c) => CATALOG[courseCodeKey(c)]) : [];
    } catch {
      return [];
    }
  }
  function saveAdded(id, codes) {
    try {
      localStorage.setItem(storageKey(id), JSON.stringify(codes));
    } catch {
      /* private mode — ignore */
    }
  }

  const progKey = (id) => `mf:prog:${id}`;
  function loadProg(id) {
    try {
      const v = localStorage.getItem(progKey(id));
      return v && PROGRAMMES[v] ? v : null;
    } catch {
      return null;
    }
  }
  function saveProg(id, p) {
    try {
      if (p) localStorage.setItem(progKey(id), p);
      else localStorage.removeItem(progKey(id));
    } catch {
      /* private mode — ignore */
    }
  }
  function loadSlots(id) {
    try {
      const raw = localStorage.getItem(slotKey(id));
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
    } catch {
      return {};
    }
  }
  function saveSlots(id, slots) {
    try {
      localStorage.setItem(slotKey(id), JSON.stringify(slots));
    } catch {
      /* private mode — ignore */
    }
  }

  function detectProgramme(id, confirmed) {
    const override = loadProg(id);
    if (override && PROGRAMMES[override]) return override;
    if (!id || !id.startsWith("2026")) return null;
    const codes = new Set((confirmed || []).flatMap((e) => [e.c, e.sc]));
    const count = (arr) => arr.filter((c) => codes.has(c)).length;
    if (count(PROGRAMMES.csai?.core || []) >= 2) return "csai";
    if (count(PROGRAMMES.eng?.core || []) >= 3) return "eng";
    if (count(PROGRAMMES.csai_upper?.core || []) >= 2) return "csai_upper";
    if (count(PROGRAMMES.csai?.core || []) >= 1) return "csai";
    if (count(PROGRAMMES.eng?.core || []) >= 1) return "eng";
    if (count(PROGRAMMES.csai_upper?.core || []) >= 1) return "csai_upper";
    return null;
  }

  function expectedCount(id, programme) {
    if (!id.startsWith("2026")) return null;
    if (programme && PROGRAMMES[programme]) return PROGRAMMES[programme].expected || 6;
    return 6;
  }

  function scheduleFor(id) {
    const confirmed = sortedExams(STUDENTS[id] || []);
    const confirmedCodes = new Set(confirmed.flatMap((e) => [e.c, e.sc]));
    const addedCodes = loadAdded(id).filter((c) => !confirmedCodes.has(courseCodeKey(c)));
    const added = sortedExams(addedCodes.map(courseExam).filter(Boolean));
    const programme = detectProgramme(id, confirmed);
    const expected = expectedCount(id, programme);
    const codes = new Set([...confirmed, ...added].flatMap((e) => [e.c, e.sc]));
    const assumed = [];

    // Fill the programme's missing subjects so a first-year always sees the
    // complete timetable. Core courses are fixed by the programme plan; the
    // two option groups (English / ethics) default to the standard choice.
    // The student can swap any assumed option-group card for the other option.
    if (programme && PROGRAMMES[programme] && expected) {
      const overrides = loadSlots(id);
      let count = confirmed.length + added.length;
      const p = PROGRAMMES[programme];
      // 1) missing core courses
      for (const code of (p.core || [])) {
        if (count >= expected) break;
        if (!CATALOG[code] || codes.has(code)) continue;
        const exam = courseExam(code);
        if (!exam) continue;
        assumed.push({ ...exam, added: false, assumed: true, slot: null, slotLabel: null });
        codes.add(code);
        count++;
      }
      // 2) option groups
      for (const group of optionGroups(p)) {
        if (count >= expected) break;
        if ((group.options || []).some((c) => codes.has(c))) continue;
        let choice = overrides[group.id];
        if (!choice || !(group.options || []).includes(choice) || !CATALOG[choice]) {
          choice = group.default || (group.options || []).find((c) => CATALOG[c]);
        }
        if (!choice || codes.has(choice)) continue;
        const exam = courseExam(choice);
        if (!exam) continue;
        assumed.push({ ...exam, added: false, assumed: true, slot: group.id, slotLabel: group.label });
        codes.add(choice);
        count++;
      }
    }

    const all = sortedExams([...confirmed, ...added, ...assumed]);
    return { confirmed, added, assumed, all, programme, addedCodes };
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function copyLink() {
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => showToast("Link copied — send it to a friend")).catch(() => showToast(url));
    } else {
      showToast(url);
    }
  }

  /* ---------- rendering ---------- */
  function detectConflicts(exams) {
    const conflicts = new Set();
    let pairs = 0;
    for (let i = 0; i < exams.length; i++) {
      for (let j = i + 1; j < exams.length; j++) {
        if (exams[i].d !== exams[j].d) continue;
        const a1 = toMinutes(exams[i].t), a2 = toMinutes(exams[j].t);
        const endI = toMinutes(exams[i].t.split("-")[1]);
        const endJ = toMinutes(exams[j].t.split("-")[1]);
        if (a1 < endJ && endI > a2) {
          conflicts.add(examKey(exams[i]));
          conflicts.add(examKey(exams[j]));
          pairs++;
        }
      }
    }
    conflicts.pairs = pairs;
    return conflicts;
  }

  function examCard(ex, opts) {
    const c = courseInfo(ex.c);
    const code = ex.sc || ex.c;
    const key = examKey(ex);
    const isNext = opts.nextKey === key;
    const isConflict = opts.conflicts.has(key);
    const badges = [];
    if (isNext) badges.push('<span class="badge next">next up</span>');
    if (isConflict) badges.push('<span class="badge conflict">clash</span>');
    if (ex.assumed) badges.push('<span class="badge assumed">assumed</span>');
    else if (ex.added) badges.push('<span class="badge added">added by you</span>');
    if (ex.s) badges.push(`<span class="badge section">sec ${esc(ex.s)}</span>`);

    const when = fmtDate(ex.d);
    const rooms = ex.r || "See schedule";
    const roomNote = rooms.includes(",") ? '<span class="room-note">check your section</span>' : "";
    return `
      <article class="exam-card ${isNext ? "is-next" : ""} ${isConflict ? "is-conflict" : ""}"
               style="animation-delay:${Math.min(opts.index, 12) * 45}ms">
        <div class="card-top">
          <span class="course-code">${esc(code)}</span>
          <div class="badge-row">${badges.join("")}</div>
        </div>
        <h3 class="course-title">${esc(c.title || code)}</h3>
        <div class="detail-rows">
          <div class="detail">${ICONS.calendar}<span class="k">Date</span><span class="v">${when} <em>· ${esc(countdown(ex.d))}</em></span></div>
          <div class="detail">${ICONS.clock}<span class="k">Time</span><span class="v mono">${esc(ex.t)}</span></div>
          <div class="detail">${ICONS.pin}<span class="k">Room</span><span class="v mono">${esc(rooms)}</span></div>
        </div>
        ${roomNote}
        ${ex.assumed && ex.slot ? `<button class="change-btn" type="button" data-change="${esc(ex.slot)}" title="Change ${esc(code)}">${ICONS.pencil} Change ${esc(ex.slotLabel)}</button>` : ""}
        ${ex.added ? `<button class="remove-btn" type="button" data-remove="${esc(ex.c)}" title="Remove ${esc(code)}">Remove</button>` : ""}
      </article>`;
  }

  function optionGroups(p) {
    if (Array.isArray(p.optionGroups) && p.optionGroups.length) return p.optionGroups;
    return [{ id: "options", label: "Programme subjects", hint: "", options: p.options || [] }];
  }

  function assumptionNote(assumed) {
    if (!assumed.length) return "";
    const names = assumed.map((e) => `<b class="mono">${esc(e.c)}</b>`).join(" and ");
    const canChange = assumed.some((e) => e.slot);
    const hint = canChange
      ? " Not on your registration? Tap <b>Change</b> on the card — the room is the same for every section."
      : " These are fixed by your programme plan; if your registration differs, use <b>+ Add another course</b> below.";
    return `
      <div class="assumption-note">
        <span class="note-icon" aria-hidden="true">${ICONS.info}</span>
        <p><b>${assumed.length} subject${assumed.length > 1 ? "s" : ""} assumed from your programme plan:</b> ${names}.${hint}</p>
      </div>`;
  }

  function emptyState(id, reason) {
    const known = Object.keys(STUDENTS);
    const sample = known.slice(0, 3);
    const title = reason === "notfound" ? `No seating-chart entry for ${esc(id)}` : "Enter your 9-digit student ID";
    const body = reason === "notfound"
      ? `Your ID isn't on any of the published seating charts. That does not mean you have no exams — single-hall subjects are often missing from the charts. Build your timetable from the official schedule.`
      : `Your ID looks like <b>202612577</b>. Type all nine digits and your schedule appears instantly.`;
    const progPicker = reason === "notfound" && id && id.startsWith("2026")
      ? `<div class="prog-picker">
           <p class="prog-picker-title">Which programme are you in?</p>
           <p class="prog-picker-hint">First-year subjects are fixed by programme, so we can build your full 6-subject timetable.</p>
           <div class="prog-picker-actions">
             <button class="find-btn" type="button" data-prog="csai">Computational Science &amp; AI</button>
             <button class="ghost-btn" type="button" data-prog="eng">Engineering</button>
           </div>
         </div>`
      : "";
    return `
      <div class="empty">
        <div class="icon">${reason === "notfound" ? "🔎" : "🎓"}</div>
        <h3>${title}</h3>
        <p>${body}</p>
        ${progPicker}
        <div class="empty-actions">
          <button class="find-btn" type="button" data-open-picker>Browse all ${Object.keys(CATALOG).length} courses</button>
          ${sample.map((s) => `<button class="chip" data-id="${s}">${s}</button>`).join("")}
        </div>
      </div>`;
  }

  function render(id) {
    const { confirmed, added, assumed, all, programme, addedCodes } = scheduleFor(id);
    state.id = id;
    state.confirmed = confirmed;
    state.added = added;
    state.assumed = assumed;
    state.programme = programme;

    if (!all.length) {
      results.innerHTML = emptyState(id, "notfound");
      syncUrl();
      return;
    }

    const conflicts = detectConflicts(all);
    const future = all.filter((e) => daysUntil(e.d) >= 0);
    const next = future[0] || null;
    const nextKey = next ? examKey(next) : "";
    const days = new Set(all.map((e) => e.d));
    const rooms = new Set(all.map((e) => e.r));

    const pills = [
      `<span class="pill"><b>${all.length}</b> subject${all.length > 1 ? "s" : ""}</span>`,
      `<span class="pill"><b>${days.size}</b> day${days.size > 1 ? "s" : ""}</span>`,
      `<span class="pill"><b>${rooms.size}</b> room${rooms.size > 1 ? "s" : ""}</span>`,
    ];
    if (addedCodes.length) pills.push(`<span class="pill added"><b>${addedCodes.length}</b> added</span>`);
    if (assumed.length) pills.push(`<span class="pill assumed"><b>${assumed.length}</b> assumed</span>`);
    if (future.length) {
      pills.push(
        `<span class="pill next">Next: <b>${esc(next.sc || next.c)}</b> ${esc(fmtDate(next.d))} · ${esc(next.t)} · ${esc(next.r)}</span>`
      );
    }
    if (conflicts.pairs) pills.push(`<span class="pill warn"><b>${conflicts.pairs}</b> clash</span>`);

    const groups = [];
    for (const ex of all) {
      const g = groups.find((x) => x.d === ex.d);
      if (g) g.items.push(ex);
      else groups.push({ d: ex.d, items: [ex] });
    }

    const cards = groups
      .map(
        (g) => `
        <div class="day-header"><b>${esc(fmtLong(g.d))}</b> <span>${esc(countdown(g.d))} · ${g.items.length} exam${g.items.length > 1 ? "s" : ""}</span></div>
        ${g.items
          .map((ex) =>
            examCard(ex, {
              index: all.indexOf(ex),
              nextKey,
              conflicts,
            })
          )
          .join("")}`
      )
      .join("");

    results.innerHTML = `
      <div class="result-head">
        <div>
          <p class="result-kicker">${esc(programme ? PROGRAMMES[programme].label : "Fall 2026 midterm schedule")}</p>
          <h2 class="result-id">${esc(id)}</h2>
          <p class="result-sub">${esc(confirmed.length)} confirmed from seating charts${added.length ? ` · ${added.length} added by you` : ""}${assumed.length ? ` · ${assumed.length} assumed` : ""}</p>
        </div>
        <div class="summary-pills">${pills.join("")}</div>
      </div>
      ${conflicts.pairs ? `<div class="alert"><span>⚠️</span><span>Two of your exams overlap. Check with your instructor which one to attend.</span></div>` : ""}
      ${assumptionNote(assumed)}
      <div class="exam-grid">${cards}</div>
      ${!programme && id.startsWith("2026") ? `<div class="prog-picker"><p class="prog-picker-title">Want the complete 6-subject timetable?</p><p class="prog-picker-hint">Your ID only appears on ${all.length} seating chart${all.length > 1 ? "s" : ""}, so the rest can't be confirmed. Pick your programme and we'll fill the standard first-year subjects (marked assumed).</p><div class="prog-picker-actions"><button class="find-btn" type="button" data-prog="csai">Computational Science &amp; AI</button><button class="ghost-btn" type="button" data-prog="eng">Engineering</button></div></div>` : ""}
      <div class="schedule-tools">
        <button class="ghost-btn" type="button" data-open-picker>+ Add another course</button>
        <button class="ghost-btn" type="button" data-copy>Copy link</button>
        <button class="ghost-btn" type="button" data-print>Print</button>
      </div>`;

    results.scrollIntoView({ behavior: "smooth", block: "nearest" });
    syncUrl();
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    if (state.id) url.searchParams.set("id", state.id);
    else url.searchParams.delete("id");
    const added = loadAdded(state.id);
    if (added.length) url.searchParams.set("add", added.join(","));
    else url.searchParams.delete("add");
    history.replaceState(null, "", url);
  }

  /* ---------- add / remove ---------- */
  function addCourse(code) {
    const primary = courseCodeKey(code);
    if (!state.id) {
      showToast("Search your ID first, then add courses.");
      return;
    }
    if (state.pickerSlot) {
      const slot = state.pickerSlot;
      const slots = loadSlots(state.id);
      slots[slot] = primary;
      saveSlots(state.id, slots);
      state.pickerSlot = null;
      picker.close();
      render(state.id);
      showToast(`${primary} set as your ${slot === "english" ? "English" : "humanity"} subject`);
      return;
    }
    const codes = loadAdded(state.id).filter((c) => courseCodeKey(c) !== primary);
    codes.push(primary);
    saveAdded(state.id, codes);
    picker.close();
    render(state.id);
    showToast(`${primary} added to your timetable`);
  }

  function removeCourse(code) {
    const primary = courseCodeKey(code);
    const codes = loadAdded(state.id).filter((c) => courseCodeKey(c) !== primary);
    saveAdded(state.id, codes);
    render(state.id);
    showToast(`${primary} removed`);
  }

  /* ---------- course picker ---------- */
  function renderPicker(filter) {
    const q = (filter || "").trim().toLowerCase();
    const matches = ([code, c]) => !q || code.toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q);
    let rows;

    if (state.pickerSlot && state.programme) {
      const group = optionGroups(PROGRAMMES[state.programme]).find((g) => g.id === state.pickerSlot);
      rows = (group?.options || [])
        .filter((code) => CATALOG[code])
        .map((code) => [code, CATALOG[code]])
        .filter(matches);
    } else {
      const current = state.id ? new Set(scheduleFor(state.id).all.flatMap((e) => [e.c, e.sc])) : new Set();
      rows = Object.entries(CATALOG)
        .filter(([code, c]) => !current.has(code) && !(c.also || []).some((a) => current.has(a)))
        .filter(matches);
    }

    rows.sort((a, b) => (a[1].date === b[1].date ? a[1].time.localeCompare(b[1].time) : a[1].date < b[1].date ? -1 : 1));

    pickerList.innerHTML = rows.length
      ? rows
          .map(
            ([code, c]) => `
            <button class="picker-row" type="button" data-add="${esc(code)}">
              <span class="picker-code">${esc(code)}</span>
              <span class="picker-title">${esc(c.title)}</span>
              <span class="picker-meta">${esc(fmtDate(c.date))} · ${esc(c.time)}<br>${esc((c.rooms || []).join(", ") || "See schedule")}</span>
              <span class="picker-plus" aria-hidden="true">${ICONS.plus}</span>
            </button>`
          )
          .join("")
      : `<p class="picker-empty">No matching course. Try a code like <b>SCH 210</b> or a title like <b>ethics</b>.</p>`;
  }

  function openPicker(slot) {
    state.pickerSlot = slot || null;
    const group = slot && state.programme ? optionGroups(PROGRAMMES[state.programme]).find((g) => g.id === slot) : null;
    $("#pickerTitle").textContent = group ? `Choose your ${group.label.toLowerCase()}` : "Add a course";
    $("#pickerDesc").textContent = group
      ? group.hint || "Pick the subject that appears on your registration."
      : "Every course below is from the official midterm schedule. Pick any exam that is missing from your timetable.";
    pickerSearch.value = "";
    renderPicker("");
    if (!picker.open) picker.showModal();
    setTimeout(() => pickerSearch.focus(), 50);
  }

  /* ---------- catalog ---------- */
  let CATALOG_ROWS = [];
  let catalogDay = "all";

  function buildCatalog() {
    CATALOG_ROWS = Object.entries(CATALOG)
      .map(([code, c]) => ({
        code,
        title: c.title,
        date: c.date,
        time: c.time,
        rooms: (c.rooms || []).slice(),
        also: c.also || [],
        students: c.students,
      }))
      .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? -1 : 1));
    $("#catalogCount").textContent = CATALOG_ROWS.length;
    const days = [...new Set(CATALOG_ROWS.map((c) => c.date))];
    const filter = $("#dayFilter");
    filter.innerHTML = `<button class="day-chip active" data-day="all">All days</button>${days
      .map((d) => `<button class="day-chip" data-day="${d}">${esc(fmtDate(d))}</button>`)
      .join("")}`;
    filter.addEventListener("click", (e) => {
      const btn = e.target.closest(".day-chip");
      if (!btn) return;
      catalogDay = btn.dataset.day;
      $$(".day-chip", filter).forEach((b) => b.classList.toggle("active", b === btn));
      renderCatalog($("#catalogFilter").value);
    });
  }

  function renderCatalog(filter) {
    const q = (filter || "").trim().toLowerCase();
    const rows = CATALOG_ROWS.filter(
      (c) => (catalogDay === "all" || c.date === catalogDay) && (!q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
    );
    $("#catalogHint").textContent = `${rows.length} of ${CATALOG_ROWS.length} courses`;
    let lastDay = "";
    const html = [];
    for (const c of rows) {
      if (c.date !== lastDay) {
        lastDay = c.date;
        html.push(`<div class="cat-day"><b>${esc(fmtLong(c.date))}</b><span>${esc(countdown(c.date))}</span></div>`);
      }
      html.push(`
        <article class="cat-card">
          <div class="cat-top">
            <span class="course-code">${esc(c.code)}</span>
            ${c.students ? `<span class="cat-count">~${esc(c.students)} students</span>` : ""}
          </div>
          <h3>${esc(c.title)}${c.also.length ? ` <span class="muted">· ${esc(c.also.join(", "))}</span>` : ""}</h3>
          <dl>
            <div><dt>Time</dt><dd class="mono">${esc(c.time)}</dd></div>
            <div><dt>Rooms</dt><dd class="mono">${esc(c.rooms.join(", ") || "See schedule")}</dd></div>
          </dl>
        </article>`);
    }
    $("#catalogGrid").innerHTML = html.join("");
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
      results.innerHTML = emptyState(v, "format");
      return;
    }
    run(v);
  });

  function run(id) {
    render(id);
  }

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      addCourse(add.dataset.add);
      return;
    }
    const remove = e.target.closest("[data-remove]");
    if (remove) {
      removeCourse(remove.dataset.remove);
      return;
    }
    const change = e.target.closest("[data-change]");
    if (change) {
      openPicker(change.dataset.change);
      return;
    }
    const open = e.target.closest("[data-open-picker]");
    if (open) {
      openPicker();
      return;
    }
    if (e.target.closest("[data-copy]")) {
      copyLink();
      return;
    }
    if (e.target.closest("[data-print]")) {
      window.print();
      return;
    }
    const prog = e.target.closest("[data-prog]");
    if (prog) {
      saveProg(state.id || normalize(input.value), prog.dataset.prog);
      render(state.id || normalize(input.value));
      showToast("Programme saved — full timetable shown");
      return;
    }
  });

  pickerSearch.addEventListener("input", (e) => renderPicker(e.target.value));
  $("#pickerClose").addEventListener("click", () => picker.close());
  $("#pickerClear").addEventListener("click", () => {
    pickerSearch.value = "";
    renderPicker("");
    pickerSearch.focus();
  });
  picker.addEventListener("click", (e) => {
    if (e.target === picker) picker.close();
  });
  picker.addEventListener("close", () => {
    state.pickerSlot = null;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== input && !picker.open) {
      e.preventDefault();
      input.focus();
      input.select();
    }
    if (e.key === "Escape" && !picker.open && document.activeElement === input) {
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
  buildCatalog();
  renderCatalog("");
  const studentCount = Object.keys(STUDENTS).length;
  const examCount = Object.values(STUDENTS).reduce((n, l) => n + l.length, 0);
  $("#footStats").textContent = `${studentCount.toLocaleString()} students · ${examCount.toLocaleString()} exam records · ${CATALOG_ROWS.length} courses`;

  const params = new URL(window.location.href).searchParams;
  const preset = normalize(params.get("id") || "");
  const urlAdd = (params.get("add") || "").split(",").map((c) => c.trim()).filter(Boolean);
  if (preset) {
    if (urlAdd.length) {
      const codes = [...new Set([...loadAdded(preset), ...urlAdd.map(courseCodeKey)])];
      saveAdded(preset, codes);
    }
    input.value = preset;
    counter.textContent = `${preset.length}/9`;
    if (preset.length === 9) render(preset);
  } else {
    results.innerHTML = emptyState("", "format");
  }
})();
