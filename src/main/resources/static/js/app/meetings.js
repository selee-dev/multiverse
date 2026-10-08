/* 프로젝트 외부 팀원 반영과 회의 화면 */
/* ---- 프로젝트 외부 팀원 반영 ---- */
function rebuildExternal(first) {
  var openId = openIdx !== null && DATA[openIdx] ? jobId(DATA[openIdx]) : null, old = {};
  extendData(); computeSeatNow();
  walkers.forEach(function (w) { old[w.id] = w; });
  walkers = DATA.map(function (d, i) { var w = old[jobId(d)]; if (w) { w.i = i; return w; } return newWalker(d, i); });
  spr = DATA.map(function (d) { return makeSprites(d); });
  if (state.side === "proj" && !PSLOTS.some(function (k) { return store.projects[k]; })) state.side = null;
  if (state.uni && (UNI[state.uni].hidden || !DATA.some(function (d) { return uOf(d) === state.uni; }))) state.uni = null;
  if (state.side && !DATA.some(function (d) { return UNI[uOf(d)].side === state.side; })) state.side = null;
  paintMap(); applyMoves(!!first); applySeats(!!first);
  document.getElementById("total").textContent = DATA.length;
  applySiteCopy();
  renderGrid(); syncIntruders(!!first); syncMeetings(!!first);
  if (state.view === "chat") { renderChatWho(); renderChat(); }
  if (openId !== null) { var ni = indexOfId(openId); if (ni < 0) closeSheet(); else openSheet(ni, null); }
}

/* ---- 회의 화면 ---- */
var mSel = {}, mEditId = "", armed = "";
function refreshForms() {
  var canAdmin = canEditJobs(), canShared = canManageSharedOperations(), fs = document.querySelectorAll(".pane .pform"), k, pane, announcementForm;
  for (k = 0; k < fs.length; k++) {
    pane = fs[k].closest(".pane");
    announcementForm = pane && pane.id === "chatpane" && fs[k].classList.contains("cform");
    fs[k].hidden = pane && ["meetpane", "projpane", "snackpane"].indexOf(pane.id) >= 0 ? !canShared : announcementForm ? !currentCanAnnounce : !canAdmin;
  }
}
function updatePickCount() { var n = Object.keys(mSel).length; document.getElementById("mpc").textContent = "(" + n + "명 / 최대 8명)"; }
function renderPick() {
  var h = "", today = todayStr();
  Object.keys(UNI).forEach(function (k) {
    var ms = DATA.filter(function (d) { return uOf(d) === k; });
    if (!ms.length) return;
    h += '<div class="pkgrp"><div class="mlabel">' + esc(UNI[k].realm) + '</div><div class="recs">';
    ms.forEach(function (d) {
      var id = jobId(d);
      h += '<button type="button" class="pk" data-id="' + esc(id) + '" aria-pressed="' + !!mSel[id] + '">' + esc(d.n) + (onLeave(d, today) ? " · " + offLabel(d) : "") + "</button>";
    });
    h += "</div></div>";
  });
  document.getElementById("mpick").innerHTML = h;
  updatePickCount();
}
function renderMeets() {
  var list = meetingList(), byId = {}, h = "", act = 0;
  DATA.forEach(function (d) { byId[jobId(d)] = d; });
  refreshForms();
  list.forEach(function (m) {
    var can = canManageGroup(m.m), names = m.m.filter(function (id) { return byId[id]; }).map(function (id) { return esc(byId[id].n); }), state2 = "대기";
    if (m.on) { act++; state2 = act > 3 ? "자리 없음" : "회의 중"; }
    h += '<article class="mcard' + (m.on && act <= 3 ? " on" : "") + '"><div class="mhead"><b>' + esc(m.t) + '</b><span class="mstate">' + state2 + "</span></div>" +
      '<p class="mnames">' + (names.length ? names.join(", ") : "참석자 없음") + " (" + names.length + "명)</p>" +
      (can ? '<div class="jrow"><button type="button" class="mtoggle" data-id="' + esc(m.id) + '">' + (m.on ? "회의 종료" : "회의 시작") + '</button><button type="button" class="medit" data-id="' + esc(m.id) + '">수정</button><button type="button" class="mdel' + (armed === m.id ? " arm" : "") + '" data-id="' + esc(m.id) + '">' + (armed === m.id ? "정말 삭제?" : "삭제") + "</button></div>" : "") + "</article>";
  });
  document.getElementById("mlist").innerHTML = h || '<p class="tempty">아직 만든 회의가 없어요.</p>';
  if (act > 3) document.getElementById("mstatus").textContent = "회의실 테이블은 3개라서 동시에 3개 회의까지 앉을 수 있어요. 나머지는 자리가 나길 기다려요.";
}
function resetMeetForm() { mSel = {}; mEditId = ""; document.getElementById("mname").value = ""; document.getElementById("msave").textContent = "회의 만들고 시작"; document.getElementById("mcancelbtn").hidden = true; renderPick(); }
function meetDone() { renderMeets(); syncMeetings(false); }
document.getElementById("meetpane").addEventListener("click", function (e) {
  var st = document.getElementById("mstatus"), b;
  if ((b = e.target.closest(".pk"))) {
    var id = b.dataset.id;
    if (mSel[id]) delete mSel[id];
    else if (Object.keys(mSel).length >= 8) { st.textContent = "한 테이블에는 8명까지 앉을 수 있어요."; return; }
    else mSel[id] = 1;
    st.textContent = ""; b.setAttribute("aria-pressed", String(!!mSel[id])); updatePickCount(); return;
  }
  if (e.target.closest("#mcancelbtn")) { resetMeetForm(); st.textContent = ""; return; }
  if (e.target.closest("#msave")) {
    var name = document.getElementById("mname").value.trim().slice(0, 30), ids = Object.keys(mSel);
    if (!name) { st.textContent = "회의 이름을 적어주세요."; return; }
    if (!ids.length) { st.textContent = "참석자를 한 명 이상 골라주세요."; return; }
    var prev = mEditId ? store.meetings[mEditId] : null;
    commit("meetings", mEditId || newId("m"), { t: name, m: ids, on: prev ? !!prev.on : true, at: prev ? (+prev.at || Date.now()) : Date.now() }, function () { st.textContent = ""; resetMeetForm(); meetDone(); }, "#mstatus");
    return;
  }
  if ((b = e.target.closest(".mtoggle"))) {
    var m = store.meetings[b.dataset.id]; if (!m) return;
    commit("meetings", b.dataset.id, { t: m.t, m: m.m, on: !m.on, at: m.at }, meetDone, "#mstatus"); return;
  }
  if ((b = e.target.closest(".medit"))) {
    var mm = store.meetings[b.dataset.id]; if (!mm) return;
    mEditId = b.dataset.id; mSel = {};
    (mm.m || []).forEach(function (x) { if (indexOfId(x) >= 0) mSel[x] = 1; });
    document.getElementById("mname").value = mm.t; document.getElementById("msave").textContent = "수정 저장"; document.getElementById("mcancelbtn").hidden = false;
    renderPick(); document.getElementById("mname").focus(); return;
  }
  if ((b = e.target.closest(".mdel"))) {
    if (armed === b.dataset.id) { armed = ""; if (mEditId === b.dataset.id) resetMeetForm(); commit("meetings", b.dataset.id, null, meetDone, "#mstatus"); }
    else { armed = b.dataset.id; renderMeets(); }
    return;
  }
  if (armed) { armed = ""; renderMeets(); }
});
document.getElementById("mname").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); document.getElementById("msave").click(); } });

