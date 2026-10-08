/* 프로젝트 화면 */
/* ---- 프로젝트 화면 ---- */
var renaming = {}, pArm = "", pNewHeroes = {};
function renderProjectHeroPick() {
  var box = document.getElementById("project-hero-pick");
  if (!box) return;
  var heroes = DATA.filter(function (d) { return !d.ext; });
  box.innerHTML = heroes.map(function (d) {
    var id = jobId(d);
    return '<button type="button" class="pk" data-hero-id="' + esc(id) + '" aria-pressed="' + !!pNewHeroes[id] + '">' + esc(d.n) + '</button>';
  }).join("") || '<span class="tempty">' + (WORLD_THEME === "office" ? "아직 등록된 직원이 없습니다." : "아직 등록된 영웅이 없습니다.") + "</span>";
}
function keepForm(root, fn) {
  var vals = {}, act = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null, els = root.querySelectorAll("[data-k]"), k;
  for (k = 0; k < els.length; k++) vals[els[k].dataset.k] = els[k].value;
  fn();
  els = root.querySelectorAll("[data-k]");
  for (k = 0; k < els.length; k++) if (vals[els[k].dataset.k] != null && els[k].dataset.k.indexOf("rn:") !== 0) els[k].value = vals[els[k].dataset.k];
  if (act) { var e2 = root.querySelector('[data-k="' + act + '"]'); if (e2) e2.focus(); }
}
function renderProjects() {
  var root = document.getElementById("plist"), can = canManageSharedOperations();
  refreshForms();
  renderProjectHeroPick();
  keepForm(root, function () {
    var h = "";
    PSLOTS.forEach(function (k) {
      var p = store.projects[k];
      if (!p || typeof p.name !== "string") return;
      var mem = Array.isArray(p.members) ? p.members : [];
      h += '<article class="pcard" style="--c:' + UNI[k].color + '"><div class="phead">';
      if (renaming[k]) h += '<input class="pin" type="text" data-k="rn:' + k + '" maxlength="16" aria-label="프로젝트 이름" value="' + esc(p.name) + '"><button type="button" class="prensave" data-p="' + k + '">저장</button><button type="button" class="prencancel" data-p="' + k + '">취소</button>';
      else h += "<h3>" + esc(p.name) + "</h3>" + (can ? '<button type="button" class="mini prename" data-p="' + k + '">이름 바꾸기</button>' : "");
      h += '</div><div class="pmem">';
      mem.forEach(function (m) {
        h += '<span class="mchip">' + esc(m.n) + (m.t ? " · " + esc(m.t) : "") + (can ? '<button type="button" class="prm" data-p="' + k + '" data-id="' + esc(m.id) + '" aria-label="' + esc(m.n) + ' 명단에서 빼기">✕</button>' : "") + "</span>";
      });
      h += (mem.length ? "" : '<span class="tempty">아직 명단이 비어 있어요.</span>') + "</div>";
      if (can) h += '<div class="jrow"><select class="pin" data-k="ph:' + k + '" aria-label="프로젝트에 추가할 직원">' + heroOptions(mem) + '</select><button type="button" class="pmadd" data-p="' + k + '">명단에 추가</button></div>' +
        '<div class="jrow"><button type="button" class="pdel' + (pArm === k ? " arm" : "") + '" data-p="' + k + '">' + (pArm === k ? "정말 삭제? 공간과 명단이 함께 사라져요" : "프로젝트 삭제") + "</button></div>";
      h += "</article>";
    });
    root.innerHTML = h || '<p class="tempty">아직 프로젝트 팀이 없어요. 위에서 이름을 적고 만들어보세요.</p>';
  });
}
/* 기존 직원(캐릭터)의 업무는 프로젝트에서 빼거나 지워도 남겨요 */
function dropExtTasks(id) { if (store.tasks[id] && !DATA.some(function (d) { return d.id === id && !d.ext; })) commit("tasks", id, null, null, "#pstatus"); }
function afterProjects() { rebuildExternal(false); renderProjects(); renderPick(); renderMeets(); }
function projDoc(k, patch) { var p = store.projects[k]; return { name: patch.name != null ? patch.name : p.name, members: patch.members != null ? patch.members : (p.members || []) }; }
/* 프로젝트 인원은 현재 등록된 직원 명단에서만 고를 수 있어요 */
function heroOptions(mem) {
  var inTeam = {};
  mem.forEach(function (m) { inTeam[m.id] = true; });
  var opts = DATA.filter(function (d) { return !d.ext && !inTeam[d.id]; }).map(function (d) { return '<option value="' + esc(jobId(d)) + '">' + esc(d.n) + "</option>"; });
  return opts.length ? '<option value="">직원 선택</option>' + opts.join("") : '<option value="">추가할 직원이 없어요</option>';
}
function addMember(k) {
  var sel = document.querySelector('[data-k="ph:' + k + '"]'), st = document.getElementById("pstatus"), mem = store.projects[k].members || [];
  var d = sel && sel.value ? DATA.filter(function (x) { return !x.ext && jobId(x) === sel.value; })[0] : null;
  if (!d) { st.textContent = "추가할 직원을 목록에서 골라주세요."; if (sel) sel.focus(); return; }
  if (mem.some(function (m) { return m.id === d.id; })) { st.textContent = "이미 이 프로젝트에 있는 직원이에요."; return; }
  if (mem.length >= 20) { st.textContent = "한 프로젝트에는 20명까지 넣을 수 있어요."; return; }
  st.textContent = "";
  commit("projects", k, projDoc(k, { members: mem.concat([{ id: d.id, n: d.n, t: ttl(d), g: d.g, h: true }]) }), function () { afterProjects(); }, "#pstatus");
}
function renameProject(k) {
  var inp = document.querySelector('[data-k="rn:' + k + '"]'), st = document.getElementById("pstatus"), n = inp ? inp.value.trim().slice(0, 16) : "";
  if (!n) { st.textContent = "프로젝트 이름을 적어주세요."; return; }
  commit("projects", k, projDoc(k, { name: n }), function () { delete renaming[k]; st.textContent = ""; afterProjects(); }, "#pstatus");
}
function createProject() {
  var inp = document.getElementById("pname"), st = document.getElementById("pstatus"), n = inp.value.trim().slice(0, 16), slot = null;
  PSLOTS.forEach(function (k) { if (!slot && !store.projects[k]) slot = k; });
  if (!n) { st.textContent = "프로젝트 이름을 적어주세요."; return; }
  if (!slot) { st.textContent = "프로젝트 팀은 3개까지 만들 수 있어요. 끝난 팀을 삭제하면 자리가 생겨요."; return; }
  var members = Object.keys(pNewHeroes).map(function (id) {
    return DATA.filter(function (d) { return jobId(d) === id; })[0];
  }).filter(Boolean).map(function (d) { return { id: d.id, n: d.n, t: ttl(d), g: d.g, h: true }; });
  commit("projects", slot, { name: n, members: members }, function () { inp.value = ""; pNewHeroes = {}; st.textContent = ""; afterProjects(); }, "#pstatus");
}
document.getElementById("projpane").addEventListener("click", function (e) {
  var b, st = document.getElementById("pstatus");
  if (e.target.closest("#padd")) { createProject(); return; }
  if ((b = e.target.closest("[data-hero-id]"))) {
    if (pNewHeroes[b.dataset.heroId]) delete pNewHeroes[b.dataset.heroId]; else pNewHeroes[b.dataset.heroId] = true;
    b.setAttribute("aria-pressed", String(!!pNewHeroes[b.dataset.heroId]));
    return;
  }
  if ((b = e.target.closest(".prename"))) { renaming[b.dataset.p] = true; renderProjects(); var ri = document.querySelector('[data-k="rn:' + b.dataset.p + '"]'); if (ri) { ri.focus(); ri.select(); } return; }
  if ((b = e.target.closest(".prencancel"))) { delete renaming[b.dataset.p]; renderProjects(); return; }
  if ((b = e.target.closest(".prensave"))) { renameProject(b.dataset.p); return; }
  if ((b = e.target.closest(".pmadd"))) { addMember(b.dataset.p); return; }
  if ((b = e.target.closest(".prm"))) {
    var k = b.dataset.p, id = b.dataset.id, mem = (store.projects[k].members || []).filter(function (m) { return m.id !== id; });
    commit("projects", k, projDoc(k, { members: mem }), function () { dropExtTasks(id); afterProjects(); }, "#pstatus"); return;
  }
  if ((b = e.target.closest(".pdel"))) {
    var pk = b.dataset.p;
    if (pArm === pk) {
      var ids = (store.projects[pk].members || []).map(function (m) { return m.id; });
      pArm = ""; delete renaming[pk];
      commit("projects", pk, null, function () { ids.forEach(dropExtTasks); afterProjects(); }, "#pstatus");
    } else { pArm = pk; renderProjects(); }
    return;
  }
  if (pArm) { pArm = ""; renderProjects(); }
  st.textContent = st.textContent;
});
document.getElementById("projpane").addEventListener("keydown", function (e) {
  if (e.key !== "Enter") return;
  var k = e.target.dataset ? e.target.dataset.k : "", id = e.target.id;
  if (id === "pname") { e.preventDefault(); createProject(); }
  else if (k && k.indexOf("rn:") === 0) { e.preventDefault(); renameProject(k.slice(3)); }
});

