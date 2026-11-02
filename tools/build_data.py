"""Build the static dataset for the midterm schedule web app.

Reads the seating-chart PDFs, resolves each student's exam room from the
column they appear in, and writes data/students.json + data/courses.json.
"""
import pdfplumber, glob, os, re, json, sys

folder = r"D:\new mid"
outdir = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\omart\Documents\Default Project\midterm-lookup\data"
ROOM_RE = re.compile(r"^[A-Z]{0,2}\d{3}-[A-Z]\d?$")
ID_RE = re.compile(r"^\d{9}$")
SEC_RE = re.compile(r"^\((?:(\d{3})-)?(S\d{2})\)$")
MONTHS = {"JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
          "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12}
DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]

TITLES = {
    "CSAI 101": "Fundamentals of Programming",
    "CSAI 111": "Fundamentals of Programming",
    "CSAI 102": "Digital Logic and Computer Architecture",
    "CSAI 112": "Digital Logic and Computer Architecture",
    "CSAI 201": "Data Structures",
    "CSAI 202": "Introduction to Database Systems",
    "CSAI 205": "Fundamentals of Circuits and Electronics",
    "CSAI 252": "Introduction to Computer Networks",
    "CSCI 101": "Introduction to Computer Science",
    "DSAI 203": "Data Integration and Visualization",
    "ENGL 004": "Remedial English 3",
    "ENGR 102": "Introduction to Engineering Design",
    "ENGR 121": "Engineering Drawing",
    "MATH 101": "Calculus I",
    "MATH 103": "Calculus for Computational Science",
    "MATH 105": "Probability and Statistics",
    "CHEM 103": "Introduction to Chemistry for Engineers",
    "PHYS 105": "Intro to Classical Mechanics for Engineers",
    "SCH 210": "Social Issues",
}
# course -> (date, time) from the Midterm Exam Schedule (no seating PDF for SCH 210)
SCHEDULE = {
    "SCH 210": ("2026-11-08", "11:00-12:00", "F005-F"),
}
# lecture course -> lab-section course codes printed in the same seating chart
ALIASES = {
    "CSAI 101": ["CSAI 111"],
    "CSAI 102": ["CSAI 112"],
}


def col_of(x, anchors):
    idx = 0
    for i, a in enumerate(anchors):
        if x >= a - 6:
            idx = i
    return idx


def cluster(xs):
    out = []
    for x in sorted(xs):
        if out and x - out[-1][-1] < 6:
            out[-1].append(x)
        else:
            out.append([x])
    return [round(sum(c) / len(c), 1) for c in out]


def parse_when(hdr):
    m = re.search(r"([A-Z]{3})\s+(\d{1,2})(?:st|nd|rd|th)\s+([A-Z]{3})\s+(\d{2}:\d{2})-(\d{2}:\d{2})", hdr)
    if not m:
        return None
    day, dom, mon, t1, t2 = m.groups()
    return f"2026-{MONTHS[mon]:02d}-{int(dom):02d}", f"{t1}-{t2}", DAYS[[d[:3] for d in DAYS].index(day)]


students = {}
courses = {}

for f in sorted(glob.glob(os.path.join(folder, "*.pdf"))):
    name = os.path.basename(f)
    if name.startswith("Midterm_"):
        continue
    with pdfplumber.open(f) as pdf:
        pages = []
        for pno, page in enumerate(pdf.pages, 1):
            words = page.extract_words()
            anchors = cluster({round(w["x0"], 1) for w in words if ID_RE.match(w["text"])})
            rooms = [(w["text"], (w["x0"] + w["x1"]) / 2) for w in words if ROOM_RE.match(w["text"])]
            pages.append({"page": pno, "anchors": anchors, "rooms": rooms, "words": words})

        # header (course / date / time / total) on page 1
        hdr_line = None
        for ln in pdf.pages[0].extract_text_lines(layout=False, strip=True):
            if re.search(r"\d{3,4}\s*students", ln["text"]) and re.match(r"^[A-Z]{2,4}\s?\d{3}", ln["text"]):
                hdr_line = ln["text"].strip()
                break
        code = re.match(r"^([A-Z]{2,4}\s?\d{3})", hdr_line).group(1)
        when = parse_when(hdr_line)
        title = TITLES.get(code, code)
        courses[code] = {"title": title, "date": when[0], "day": when[2], "time": when[1]}
        if code in ALIASES:
            courses[code]["also"] = ALIASES[code]

        # room map per page (a page with room headers starts a new block)
        current = {}
        for pi in pages:
            if pi["rooms"]:
                current = {col_of(cx, pi["anchors"]): code_ for code_, cx in pi["rooms"]}
            pi["map"] = dict(current)

        for pi in pages:
            rows = {}
            for w in pi["words"]:
                rows.setdefault(round(w["top"]), []).append(w)
            for _, rws in rows.items():
                rws = sorted(rws, key=lambda w: w["x0"])
                for i, w in enumerate(rws):
                    if not ID_RE.match(w["text"]):
                        continue
                    sec = None
                    grp = None
                    for w2 in rws[i + 1:]:
                        m = SEC_RE.match(w2["text"])
                        if m:
                            grp = m.group(1)
                            sec = m.group(2)
                            break
                    room = pi["map"].get(col_of(w["x0"], pi["anchors"]))
                    if not room:
                        continue
                    # lab sections carry their own course code (CSAI 101 chart -> CSAI 111 students)
                    sc = f"{code.split()[0]} {grp}" if grp else code
                    students.setdefault(w["text"], []).append({
                        "c": code, "sc": sc, "d": when[0], "t": when[1], "r": room, "s": sec or "",
                    })

# SCH 210 has no published seating chart (all 4 sections share one room), so it cannot be
# derived from a roster. It is listed in the catalog, and attached per-student only for the
# IDs in manual.json (enrolments confirmed from the student's own course registration).
if "SCH 210" not in courses:
    d, t, r = SCHEDULE["SCH 210"]
    courses["SCH 210"] = {"title": TITLES["SCH 210"], "date": d, "day": "SUNDAY", "time": t, "room": r}
manual = {}
manual_path = os.path.join(outdir, "manual.json")
if os.path.exists(manual_path):
    manual = json.load(open(manual_path, encoding="utf-8"))
for sid, extra in manual.items():
    for code in extra:
        c = courses[code]
        students.setdefault(sid, []).append({"c": code, "sc": code, "d": c["date"], "t": c["time"], "r": c["room"], "s": ""})

os.makedirs(outdir, exist_ok=True)
for sid, lst in students.items():
    lst.sort(key=lambda e: (e["d"], e["t"]))
with open(os.path.join(outdir, "students.json"), "w", encoding="utf-8") as fh:
    json.dump(students, fh, ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(outdir, "courses.json"), "w", encoding="utf-8") as fh:
    json.dump(courses, fh, ensure_ascii=False, indent=1)
# JS-embedded copy so the site also works when opened straight from disk (file://)
with open(os.path.join(outdir, "students.js"), "w", encoding="utf-8") as fh:
    fh.write("window.STUDENTS=")
    json.dump(students, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\nwindow.COURSES=")
    json.dump(courses, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")

print("students:", len(students), " exams:", sum(len(v) for v in students.values()), " courses:", len(courses))
print("students.json KB:", round(os.path.getsize(os.path.join(outdir, "students.json")) / 1024, 1))
