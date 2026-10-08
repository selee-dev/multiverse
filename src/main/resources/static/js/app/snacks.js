/* 간식 화면 */
/* ---- 간식 화면 ---- */
var sTeam = "", sEditId = "", sArm = "";
function renderSnackForm() {
  var rows = { front: "", back: "" };
  Object.keys(UNI).forEach(function (k) {
    var u = UNI[k];
    if (u.hidden || !rows.hasOwnProperty(u.side)) return;
    rows[u.side] += '<button type="button" class="sk-team" style="--c:' + u.color + '" data-u="' + k + '" aria-pressed="' + (sTeam === k) + '">' + esc(u.realm) + "</button>";
  });
  document.getElementById("steams").innerHTML = '<div class="recs">' + rows.front + '</div><div class="recs">' + rows.back + "</div>";
}
function renderSnack() {
  var can = canManageSharedOperations(), t = todayStr(), h = "", ids = Object.keys(store.snacks);
  refreshForms();
  ids.sort(function (a, b) { return (store.snacks[a].from || "").localeCompare(store.snacks[b].from || ""); });
  ids.forEach(function (id) {
    var s = store.snacks[id];
    if (!s || !UNI[s.u]) return;
    var st = t < s.from ? "예정" : t > s.to ? "종료" : "진행 중";
    h += '<article class="scard' + (st === "진행 중" ? " on" : "") + (st === "종료" ? " past" : "") + '"><div class="mhead"><b>' + esc(UNI[s.u].realm) + '</b><span class="sst">' + st + '</span></div>' +
      '<p class="mnames">' + md(s.from) + " ~ " + md(s.to) + '</p>' +
      (can ? '<div class="jrow sacts"><button type="button" class="sedit" data-id="' + esc(id) + '">수정</button><button type="button" class="sdel' + (sArm === id ? " arm" : "") + '" data-id="' + esc(id) + '">' + (sArm === id ? "정말 삭제?" : "삭제") + "</button></div>" : "") + "</article>";
  });
  document.getElementById("slist").innerHTML = h || '<p class="tempty">아직 등록된 간식 당번이 없어요.</p>';
}
function resetSnackForm() {
  var p = todayStr().split("-"), ym = p[0] + "-" + p[1];
  sTeam = ""; sEditId = "";
  document.getElementById("sfrom").value = ym + "-01"; document.getElementById("sto").value = ym + "-" + ("0" + new Date(+p[0], +p[1], 0).getDate()).slice(-2);
  document.getElementById("ssave").textContent = "간식 당번 등록"; document.getElementById("scancel").hidden = true;
  renderSnackForm();
}
document.getElementById("snackpane").addEventListener("click", function (e) {
  var st = document.getElementById("sstatus"), b;
  if ((b = e.target.closest(".sk-team"))) { sTeam = b.dataset.u; renderSnackForm(); return; }
  if (e.target.closest("#scancel")) { resetSnackForm(); st.textContent = ""; return; }
  if (e.target.closest("#ssave")) {
    var from = document.getElementById("sfrom").value, to = document.getElementById("sto").value;
    if (!sTeam) { st.textContent = "담당팀을 골라주세요."; return; }
    if (!from) { st.textContent = "시작일을 정해주세요."; return; }
    if (!to) to = from;
    if (to < from) { var tmp = from; from = to; to = tmp; }
    commit("snacks", sEditId || newId("s"), { u: sTeam, from: from, to: to }, function () { st.textContent = ""; resetSnackForm(); renderSnack(); renderPortals(); }, "#sstatus");
    return;
  }
  if ((b = e.target.closest(".sedit"))) {
    var s = store.snacks[b.dataset.id]; if (!s) return;
    sEditId = b.dataset.id; sTeam = s.u;
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

