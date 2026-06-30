// ============================================================
// ChemEng KMUTT Course Eligibility — Application Logic
// ============================================================

// CHANGE THIS before deploying. Note: on a static site, anyone who views
// the page source can read this. It is light access control, not real
// security. For real authentication, migrate to Supabase.
const ADMIN_PASSWORD = "chemeng2025";

const PASSING = ["A", "B+", "B", "C+", "C", "D+", "D"];   // D or above passes
const ALL_GRADES = ["A", "B+", "B", "C+", "C", "D+", "D", "F", "W"];

let DATA = null;          // loaded from curricula.json
let WORK = null;          // admin working copy
let editingCode = null;   // course code being edited in admin

let student = {
  name: "", id: "", curriculum: "", semester: "",
  currentGrades: {},   // { code: grade }
  priorGrades: {},     // { code: grade }
  result: null
};

// ============================================================
// LOAD DATA
// ============================================================
async function loadData() {
  try {
    const res = await fetch('curricula.json');
    DATA = await res.json();
  } catch (e) {
    alert("Could not load curricula.json. If testing locally, run a local server (see README).");
    console.error(e);
    return;
  }
  const saved = localStorage.getItem('curriculaEdits');
  WORK = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DATA));
  initDropdowns();
}

function initDropdowns() {
  // Admin curriculum select (admin still chooses which curriculum to edit)
  const ac = document.getElementById('adminCurriculum');
  ac.innerHTML = '';
  Object.values(WORK.curricula).forEach(c => ac.add(new Option(c.name, c.id)));

  // Semester selects
  const semSel = document.getElementById('currentSemester');
  semSel.innerHTML = '';
  DATA.semOrder.forEach(s => semSel.add(new Option(DATA.semLabels[s], s)));

  const ceSem = document.getElementById('ceSem');
  ceSem.innerHTML = '';
  DATA.semOrder.forEach(s => ceSem.add(new Option(DATA.semLabels[s], s)));

  // Grade dropdown for prior course modal
  const pg = document.getElementById('priorGradeSelect');
  pg.innerHTML = '';
  PASSING.forEach(g => pg.add(new Option(g, g)));
}

// ============================================================
// VIEW ROUTING
// ============================================================
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  // Show "Home" button in header on all pages except landing
  const back = document.getElementById('headerBack');
  if (back) back.style.display = (name === 'landing') ? 'none' : 'inline-flex';
  window.scrollTo(0, 0);
}

// ============================================================
// CURRICULUM AUTO-DETECT FROM ID
// ============================================================
// ============================================================
// CURRICULUM RESOLUTION FROM STUDENT ID
// Rule: 65/66 -> 6566 curriculum, 67 -> 67 curriculum,
//       68 or any newer year (69, 70, 71, ...) -> 68 curriculum
// ============================================================
function resolveCurriculum(id) {
  const prefix = id.substring(0, 2);
  if (!/^\d{2}$/.test(prefix)) return null;
  const yr = parseInt(prefix, 10);

  // Exact prefix match first
  for (const c of Object.values(DATA.curricula)) {
    if (c.idPrefixes && c.idPrefixes.includes(prefix)) return c;
  }
  // Catch-all: any curriculum that covers "this year and newer"
  let catchAll = null;
  for (const c of Object.values(DATA.curricula)) {
    if (c.minPrefixCatchAll != null && yr >= c.minPrefixCatchAll) {
      if (!catchAll || c.minPrefixCatchAll > catchAll.minPrefixCatchAll) catchAll = c;
    }
  }
  return catchAll;
}

function autoDetectCurriculum() {
  const id = document.getElementById('studentId').value.trim();
  const box = document.getElementById('detectedBox');
  const icon = document.getElementById('detectedIcon');
  const text = document.getElementById('detectedText');
  box.classList.remove('found', 'unknown');

  const prefix = id.substring(0, 2);
  if (id.length < 2 || !/^\d{2}$/.test(prefix)) {
    icon.textContent = '—';
    text.textContent = 'Enter your student ID above to detect your curriculum.';
    student.curriculum = '';
    return;
  }

  const matched = resolveCurriculum(id);
  if (matched) {
    student.curriculum = matched.id;
    box.classList.add('found');
    icon.textContent = prefix;
    text.textContent = matched.name;
  } else {
    student.curriculum = '';
    box.classList.add('unknown');
    icon.textContent = '!';
    text.textContent = `No curriculum is defined for IDs starting with ${prefix}. Please contact the department.`;
  }
}

// ============================================================
// STUDENT: LOAD COURSES FOR GRADE ENTRY
// ============================================================
function curr() { return DATA.curricula[student.curriculum]; }

function coursesInSem(semCode) {
  return curr().courses.filter(c => c.sem === semCode);
}

function loadCourses() {
  const name = document.getElementById('studentName').value.trim();
  const id = document.getElementById('studentId').value.trim();
  if (!name) { alert('Please enter your full name.'); return; }
  if (!id || id.length < 4) { alert('Please enter a valid student ID.'); return; }

  const matched = resolveCurriculum(id);
  if (!matched) {
    alert(`No curriculum is defined for IDs starting with ${id.substring(0,2)}. Please contact the department.`);
    return;
  }

  student.name = name;
  student.id = id;
  student.curriculum = matched.id;
  student.semester = document.getElementById('currentSemester').value;
  student.currentGrades = {};
  student.priorGrades = {};

  renderGradeEntry();
  showView('grades');
}

function renderGradeEntry() {
  const c = curr();
  document.getElementById('gradesSubtitle').textContent =
    `${student.name} · ${student.id} · ${c.shortName} · ${DATA.semLabels[student.semester]}`;

  const list = coursesInSem(student.semester);
  const el = document.getElementById('currentCoursesList');
  if (list.length === 0) {
    el.innerHTML = '<p class="hint">No courses defined for this semester. You can still add earlier courses below, or check the next semester directly.</p>';
  } else {
    el.innerHTML = list.map(co => `
      <div class="course-row">
        <div class="course-code-block">${co.code}</div>
        <div class="course-name-wrap">
          <div class="course-name">${co.name}</div>
          <div class="course-meta">${co.credits}</div>
        </div>
        <select class="grade-select" data-code="${co.code}" onchange="setCurrentGrade(this)">
          <option value="">—</option>
          ${ALL_GRADES.map(g => `<option value="${g}">${g}</option>`).join('')}
        </select>
      </div>`).join('');
  }
  renderPrior();
}

function setCurrentGrade(sel) {
  const code = sel.dataset.code;
  sel.classList.remove('filled', 'failed');
  if (sel.value) {
    student.currentGrades[code] = sel.value;
    if (sel.value === 'F' || sel.value === 'W') sel.classList.add('failed');
    else sel.classList.add('filled');
  } else {
    delete student.currentGrades[code];
  }
}

function renderPrior() {
  const el = document.getElementById('priorCoursesList');
  const entries = Object.entries(student.priorGrades);
  if (entries.length === 0) { el.innerHTML = '<p class="hint">No earlier courses added.</p>'; return; }
  const c = curr();
  el.innerHTML = entries.map(([code, g]) => {
    const co = c.courses.find(x => x.code === code);
    return `<div class="course-row">
      <div class="course-code-block">${code}</div>
      <div class="course-name-wrap"><div class="course-name">${co ? co.name : code}</div></div>
      <div style="display:flex; gap:8px; align-items:center">
        <span class="tag tag-grade">${g}</span>
        <button class="icon-btn danger" onclick="removePrior('${code}')">Remove</button>
      </div>
    </div>`;
  }).join('');
}

function openAddPrior() {
  const c = curr();
  const currentSemCodes = coursesInSem(student.semester).map(x => x.code);
  const avail = c.courses
    .filter(x => !currentSemCodes.includes(x.code) && !(x.code in student.priorGrades))
    .sort((a, b) => DATA.semOrder.indexOf(a.sem) - DATA.semOrder.indexOf(b.sem));
  const sel = document.getElementById('priorCourseSelect');
  sel.innerHTML = avail.map(x => `<option value="${x.code}">${x.code} — ${x.name}</option>`).join('');
  document.getElementById('modalPrior').classList.add('active');
}

function addPrior() {
  const code = document.getElementById('priorCourseSelect').value;
  const g = document.getElementById('priorGradeSelect').value;
  if (code && g) { student.priorGrades[code] = g; renderPrior(); closeModal('modalPrior'); }
}

function removePrior(code) { delete student.priorGrades[code]; renderPrior(); }

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ============================================================
// ELIGIBILITY ENGINE
// ============================================================
function passedSet() {
  const s = new Set();
  Object.entries(student.priorGrades).forEach(([c, g]) => { if (PASSING.includes(g)) s.add(c); });
  Object.entries(student.currentGrades).forEach(([c, g]) => { if (PASSING.includes(g)) s.add(c); });
  return s;
}

function nextSemCode() {
  const i = DATA.semOrder.indexOf(student.semester);
  if (i === -1 || i === DATA.semOrder.length - 1) return null;
  return DATA.semOrder[i + 1];
}

function checkEligibility() {
  const next = nextSemCode();
  if (!next) { alert("This is the final semester — no next semester to plan."); return; }

  const passed = passedSet();
  const nextCourses = coursesInSem(next);
  const nextCodes = new Set(nextCourses.map(c => c.code));

  const results = nextCourses.map(course => {
    const missingPre = course.pre.filter(p => !passed.has(p));
    // Co-req satisfied if already passed OR being taken this same next semester
    const missingCo = course.co.filter(p => !passed.has(p) && !nextCodes.has(p));
    const coTogether = course.co.filter(p => !passed.has(p) && nextCodes.has(p));

    let status, reasons = [];
    if (missingPre.length) {
      status = 'not-eligible';
      reasons.push(`Need to pass first: ${missingPre.join(', ')}`);
    } else if (missingCo.length) {
      status = 'not-eligible';
      reasons.push(`Missing co-requisite: ${missingCo.join(', ')}`);
    } else if (coTogether.length) {
      status = 'warning';
      reasons.push(`Must register together with: ${coTogether.join(', ')}`);
    } else {
      status = 'eligible';
      reasons.push(course.pre.length ? `Prerequisites met (${course.pre.join(', ')})` : 'No prerequisites');
    }
    return { course, status, reasons };
  });

  student.result = { next, results };
  renderResults();
  showView('results');
}

function renderResults() {
  const { next, results } = student.result;
  const c = curr();
  document.getElementById('resultsSubtitle').textContent =
    `${student.name} · ${student.id} · Planning for ${DATA.semLabels[next]}`;
  document.getElementById('nextSemTitle').textContent = DATA.semLabels[next];

  // Credit calculations
  const expectedCredits = DATA.semCredits[next] || 0;
  const expectedCount = results.length;
  const eligibleResults = results.filter(r => r.status === 'eligible' || r.status === 'warning');
  const eligibleCredits = eligibleResults.reduce((sum, r) => sum + (r.course.creditValue || 0), 0);

  document.getElementById('expectedCredits').innerHTML = `${expectedCredits}<span class="unit">credits</span>`;
  document.getElementById('expectedSub').textContent = `${expectedCount} course${expectedCount !== 1 ? 's' : ''} scheduled this semester`;
  document.getElementById('eligibleCredits').innerHTML = `${eligibleCredits}<span class="unit">credits</span>`;
  document.getElementById('eligibleSub').textContent = `${eligibleResults.length} of ${expectedCount} course${expectedCount !== 1 ? 's' : ''} available to you`;

  const ok = results.filter(r => r.status === 'eligible').length;
  const warn = results.filter(r => r.status === 'warning').length;
  const no = results.filter(r => r.status === 'not-eligible').length;
  document.getElementById('eligSummary').innerHTML = `
    <div class="stat ok"><div class="stat-label">Eligible</div><div class="stat-num">${ok}</div></div>
    <div class="stat warn"><div class="stat-label">Conditional</div><div class="stat-num">${warn}</div></div>
    <div class="stat no"><div class="stat-label">Locked</div><div class="stat-num">${no}</div></div>`;

  const label = { eligible: 'Eligible', warning: 'Conditional', 'not-eligible': 'Locked' };
  document.getElementById('eligList').innerHTML = results.map(r => `
    <div class="elig-card ${r.status}">
      <div class="elig-marker"></div>
      <div class="elig-body">
        <div class="elig-title"><span class="code">${r.course.code}</span>${r.course.name}</div>
        <div class="elig-reason">${r.reasons.join(' · ')}</div>
        <div class="elig-credits">${r.course.credits}</div>
      </div>
      <div class="elig-status ${r.status}">${label[r.status]}</div>
    </div>`).join('');
}

// ============================================================
// PDF EXPORT
// ============================================================
function generatePDF() {
  if (typeof window.jspdf === 'undefined') {
    alert("The PDF library is still loading or was blocked by your network. Please check your internet connection and try again in a moment.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { next, results } = student.result;
  const c = curr();
  const W = 210;
  let y = 16;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('ChemEng KMUTT — Course Eligibility Report', W/2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110);
  doc.text("Department of Chemical Engineering, King Mongkut's University of Technology Thonburi", W/2, y, { align: 'center' });
  y += 7;
  doc.setDrawColor(200); doc.line(15, y, W-15, y); y += 8;

  doc.setTextColor(0); doc.setFontSize(10);
  const row = (lk, lv, rk, rv) => {
    doc.setFont('helvetica', 'bold'); doc.text(lk, 15, y);
    doc.setFont('helvetica', 'normal'); doc.text(String(lv), 50, y);
    if (rk) { doc.setFont('helvetica', 'bold'); doc.text(rk, 120, y); doc.setFont('helvetica', 'normal'); doc.text(String(rv), 150, y); }
    y += 6;
  };
  row('Name:', student.name, 'Student ID:', student.id);
  row('Curriculum:', c.shortName, 'Report Date:', new Date().toLocaleDateString('en-GB'));
  row('Completed:', DATA.semLabels[student.semester], 'Planning:', DATA.semLabels[next]);
  y += 3;

  // Credit summary box
  const expectedCredits = DATA.semCredits[next] || 0;
  const eligibleResults = results.filter(r => r.status === 'eligible' || r.status === 'warning');
  const eligibleCredits = eligibleResults.reduce((s, r) => s + (r.course.creditValue || 0), 0);
  doc.setFillColor(245, 241, 234); doc.rect(15, y-2, W-30, 14, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0);
  doc.text(`Curriculum expects: ${expectedCredits} credits`, 20, y+6);
  doc.setTextColor(194, 65, 12);
  doc.text(`You could register: ${eligibleCredits} credits`, 120, y+6);
  doc.setTextColor(0);
  y += 18;

  // Grades just completed
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(`Grades — ${DATA.semLabels[student.semester]}`, 15, y); y += 6;
  doc.setFontSize(9);
  coursesInSem(student.semester).forEach(co => {
    const g = student.currentGrades[co.code] || '—';
    doc.setFont('helvetica', 'normal'); doc.text(`${co.code}  ${co.name}`, 18, y);
    doc.setFont('helvetica', 'bold'); doc.text(g, 192, y, { align: 'right' });
    y += 5;
    if (y > 250) { doc.addPage(); y = 18; }
  });
  y += 4;

  // Eligibility
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(`Eligibility — ${DATA.semLabels[next]}`, 15, y); y += 6;
  doc.setFontSize(9);
  const label = { eligible: 'ELIGIBLE', warning: 'CONDITIONAL', 'not-eligible': 'LOCKED' };
  const colors = { eligible: [15, 107, 74], warning: [146, 64, 14], 'not-eligible': [155, 28, 28] };
  results.forEach(r => {
    if (y > 255) { doc.addPage(); y = 18; }
    const [rr, gg, bb] = colors[r.status];
    doc.setFillColor(rr, gg, bb); doc.rect(15, y-3.5, 1.6, 5.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text(`${r.course.code}  ${r.course.name}`, 19, y);
    doc.setTextColor(rr, gg, bb); doc.text(label[r.status], 192, y, { align: 'right' });
    y += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(90); doc.setFontSize(8);
    doc.splitTextToSize(r.reasons.join(' / '), 168).forEach(ln => { doc.text(ln, 19, y); y += 4; });
    doc.setFontSize(9); doc.setTextColor(0); y += 2;
  });

  // Signatures
  if (y > 250) { doc.addPage(); y = 30; } else { y += 12; }
  doc.setDrawColor(150);
  doc.line(20, y, 90, y); doc.line(120, y, 190, y);
  y += 5; doc.setFontSize(9); doc.setTextColor(110);
  doc.text('Student Signature', 55, y, { align: 'center' });
  doc.text('Advisor Signature', 155, y, { align: 'center' });

  doc.setFontSize(8); doc.setTextColor(140);
  doc.text('Generated by ChemEng KMUTT Course Eligibility Tool · Designed by Dr. Jatupon Chaiwasu', W/2, 290, { align: 'center' });

  const safeName = student.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`eligibility_${safeName}_${next}.pdf`);
}

// ============================================================
// ADMIN
// ============================================================
function adminLogin() {
  const p = document.getElementById('adminPass').value;
  if (p === ADMIN_PASSWORD) {
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('adminPass').value = '';
    renderAdmin();
    showView('admin');
  } else {
    document.getElementById('loginError').style.display = 'block';
  }
}

function adminCurr() { return WORK.curricula[document.getElementById('adminCurriculum').value]; }

function renderAdmin() {
  const c = adminCurr();
  if (!c) return;
  const container = document.getElementById('adminContent');
  let html = '';
  DATA.semOrder.forEach(sem => {
    const courses = c.courses.filter(x => x.sem === sem);
    if (courses.length === 0) return;
    const semCredits = courses.reduce((s, x) => s + (x.creditValue || 0), 0);
    html += `<div class="admin-sem-group">
      <div class="admin-sem-title"><span>${DATA.semLabels[sem]}</span><span class="cr">${semCredits} cr · ${courses.length} courses</span></div>`;
    courses.forEach(co => {
      const preStr = co.pre.length ? co.pre.join(', ') : 'none';
      const coStr = co.co.length ? co.co.join(', ') : 'none';
      html += `<div class="admin-course">
        <div class="admin-course-code">${co.code}</div>
        <div>
          <div class="admin-course-name">${co.name} <span style="color:var(--muted); font-weight:400">· ${co.credits}</span></div>
          <div class="admin-course-reqs"><span class="req-label">Pre:</span> ${preStr} &nbsp;·&nbsp; <span class="req-label">Co:</span> ${coStr}</div>
        </div>
        <div class="admin-course-actions">
          <button class="icon-btn" onclick="openCourseEditor('${co.code}')">Edit</button>
          <button class="icon-btn danger" onclick="deleteCourse('${co.code}')">Delete</button>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  container.innerHTML = html;
}

function openCourseEditor(code) {
  const c = adminCurr();
  editingCode = code || null;
  const co = code ? c.courses.find(x => x.code === code) : null;

  document.getElementById('courseModalTitle').textContent = code ? `Edit ${code}` : 'Add Course';
  document.getElementById('ceCode').value = co ? co.code : '';
  document.getElementById('ceCode').disabled = !!code;
  document.getElementById('ceName').value = co ? co.name : '';
  document.getElementById('ceCredits').value = co ? co.credits : '3(3-0-6)';
  document.getElementById('ceSem').value = co ? co.sem : 'S1';

  const others = c.courses.filter(x => x.code !== code)
    .sort((a, b) => DATA.semOrder.indexOf(a.sem) - DATA.semOrder.indexOf(b.sem));
  const preSet = new Set(co ? co.pre : []);
  const coSet = new Set(co ? co.co : []);

  const mk = (list, set) => list.map(x =>
    `<label class="checkbox-row"><input type="checkbox" value="${x.code}" ${set.has(x.code) ? 'checked' : ''}><span><strong>${x.code}</strong>${x.name}</span></label>`
  ).join('') || '<p class="hint" style="padding:8px">No other courses yet.</p>';

  document.getElementById('cePreList').innerHTML = mk(others, preSet);
  document.getElementById('ceCoList').innerHTML = mk(others, coSet);
  document.getElementById('modalCourse').classList.add('active');
}

function parseCreditValue(s) {
  const m = String(s).match(/^\s*(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function saveCourse() {
  const c = adminCurr();
  const code = document.getElementById('ceCode').value.trim();
  const name = document.getElementById('ceName').value.trim();
  const credits = document.getElementById('ceCredits').value.trim() || '0';
  const sem = document.getElementById('ceSem').value;
  if (!code || !name) { alert('Code and name are required.'); return; }
  if (!editingCode && c.courses.find(x => x.code === code)) { alert(`${code} already exists.`); return; }

  const pre = Array.from(document.querySelectorAll('#cePreList input:checked')).map(i => i.value);
  const co = Array.from(document.querySelectorAll('#ceCoList input:checked')).map(i => i.value);
  const obj = { code, name, credits, creditValue: parseCreditValue(credits), sem, pre, co };

  if (editingCode) {
    const idx = c.courses.findIndex(x => x.code === editingCode);
    c.courses[idx] = obj;
  } else {
    c.courses.push(obj);
  }
  saveLocal(); renderAdmin(); closeModal('modalCourse');
}

function deleteCourse(code) {
  if (!confirm(`Delete ${code}? It will also be removed from other courses' prerequisites and co-requisites.`)) return;
  const c = adminCurr();
  c.courses = c.courses.filter(x => x.code !== code);
  c.courses.forEach(x => {
    x.pre = x.pre.filter(p => p !== code);
    x.co = x.co.filter(p => p !== code);
  });
  saveLocal(); renderAdmin();
}

function saveLocal() { localStorage.setItem('curriculaEdits', JSON.stringify(WORK)); }

function downloadData() {
  const blob = new Blob([JSON.stringify(WORK, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'curricula.json'; a.click();
  URL.revokeObjectURL(url);
}

function resetData() {
  if (!confirm("Discard all local edits and reload the published curricula?")) return;
  localStorage.removeItem('curriculaEdits');
  WORK = JSON.parse(JSON.stringify(DATA));
  initDropdowns();
  renderAdmin();
}

// ============================================================
// INIT
// ============================================================
loadData();
