/* 간식 화면 */
/* ---- 간식 화면 ---- */
var sSel = [], sTeam = "", sEditId = "", sArm = "";
function addDays(s, n) { var p = s.split("-"), t = new Date(+p[0], +p[1] - 1, +p[2] + n); return t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2); }
function renderSnackForm() {
  var h = "", f = "", seen = {};
  Object.keys(UNI).forEach(function (k) {
    if (UNI[k].hidden) return;
    h += '<button type="button" class="sk-team" style="--c:' + UNI[k].color + '" data-u="' + k + '" aria-pressed="' + (sTeam === k) + '">' + esc(UNI[k].realm) + "</button>";
  });
  document.getElementById("steams").innerHTML = h;
  FOODS.concat(sSel).forEach(function (t) {
    if (seen[t]) return; seen[t] = 1;
    f += '<button type="button" class="sk-item" data-f="' + esc(t) + '" aria-pressed="' + (sSel.indexOf(t) >= 0) + '">' + esc(t) + "</button>";
  });
  document.getElementById("sfoods").innerHTML = f;
  document.getElementById("sfc").textContent = "(" + sSel.length + "개 / 최대 6개)";
}
function renderSnack() {
  var can = canManageSharedOperations(), t = todayStr(), h = "", ids = Object.keys(store.snacks);
  refreshForms();
  ids.sort(function (a, b) { return (store.snacks[a].from || "").localeCompare(store.snacks[b].from || ""); });
  ids.forEach(function (id) {
    var s = store.snacks[id];
    if (!s || !UNI[s.u]) return;
    var st = t < s.from ? "예정" : t > s.to ? "종료" : "진행 중", items = Array.isArray(s.items) ? s.items : [];
    h += '<article class="scard' + (st === "진행 중" ? " on" : "") + (st === "종료" ? " past" : "") + '"><div class="mhead"><b>' + esc(UNI[s.u].realm) + '</b><span class="sst">' + st + '</span></div>' +
      '<p class="mnames">' + md(s.from) + " ~ " + md(s.to) + '</p><div class="pmem">' + items.map(function (x) { return '<span class="mchip" style="padding-right:11px">' + esc(x) + "</span>"; }).join("") + "</div>" +
      (can ? '<div class="jrow"><button type="button" class="sedit" data-id="' + esc(id) + '">수정</button><button type="button" class="sdel' + (sArm === id ? " arm" : "") + '" data-id="' + esc(id) + '">' + (sArm === id ? "정말 삭제?" : "삭제") + "</button></div>" : "") + "</article>";
  });
  document.getElementById("slist").innerHTML = h || '<p class="tempty">아직 등록된 간식 당번이 없어요.</p>';
}
function resetSnackForm() {
  var t = todayStr();
  sSel = []; sTeam = ""; sEditId = "";
  document.getElementById("sfrom").value = t; document.getElementById("sto").value = addDays(t, 4);
  document.getElementById("sfree").value = ""; document.getElementById("ssave").textContent = "간식 당번 등록"; document.getElementById("scancel").hidden = true;
  renderSnackForm();
}
function snackAdd(text) {
  var v = String(text || "").trim().slice(0, 10), st = document.getElementById("sstatus");
  if (!v) return;
  if (sSel.indexOf(v) >= 0) { document.getElementById("sfree").value = ""; return; }
  if (sSel.length >= 6) { st.textContent = "먹을거리는 6개까지 고를 수 있어요."; return; }
  st.textContent = ""; sSel.push(v); document.getElementById("sfree").value = ""; renderSnackForm();
}
document.getElementById("snackpane").addEventListener("click", function (e) {
  var st = document.getElementById("sstatus"), b;
  if ((b = e.target.closest(".sk-team"))) { sTeam = b.dataset.u; renderSnackForm(); return; }
  if ((b = e.target.closest(".sk-item"))) {
    var f = b.dataset.f, k = sSel.indexOf(f);
    if (k >= 0) sSel.splice(k, 1); else snackAdd(f);
    st.textContent = k >= 0 ? "" : st.textContent; renderSnackForm(); return;
  }
  if (e.target.closest("#sfreeadd")) { snackAdd(document.getElementById("sfree").value); return; }
  if (e.target.closest("#scancel")) { resetSnackForm(); st.textContent = ""; return; }
  if (e.target.closest("#ssave")) {
    var from = document.getElementById("sfrom").value, to = document.getElementById("sto").value;
    if (!sTeam) { st.textContent = "담당팀을 골라주세요."; return; }
    if (!from) { st.textContent = "시작일을 정해주세요."; return; }
    if (!to) to = from;
    if (to < from) { var tmp = from; from = to; to = tmp; }
    if (!sSel.length) { st.textContent = "먹을거리를 한 가지 이상 골라주세요."; return; }
    commit("snacks", sEditId || newId("s"), { u: sTeam, from: from, to: to, items: sSel.slice() }, function () { st.textContent = ""; resetSnackForm(); renderSnack(); renderPortals(); }, "#sstatus");
    return;
  }
  if ((b = e.target.closest(".sedit"))) {
    var s = store.snacks[b.dataset.id]; if (!s) return;
    sEditId = b.dataset.id; sTeam = s.u; sSel = (s.items || []).slice();
    document.getElementById("sfrom").value = s.from; document.getElementById("sto").value = s.to;
    document.getElementById("ssave").textContent = "수정 저장"; document.getElementById("scancel").hidden = false; renderSnackForm(); return;
  }
  if ((b = e.target.closest(".sdel"))) {
    if (sArm === b.dataset.id) { sArm = ""; if (sEditId === b.dataset.id) resetSnackForm(); commit("snacks", b.dataset.id, null, function () { renderSnack(); renderPortals(); }, "#sstatus"); }
    else { sArm = b.dataset.id; renderSnack(); }
    return;
  }
  if (sArm) { sArm = ""; renderSnack(); }
});
document.getElementById("sfree").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); snackAdd(e.target.value); } });

