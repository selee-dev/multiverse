/* 멤버(팀) 화면과 관리자 캐릭터 연결 */
/* ---- 멤버 화면: 관리자가 명단과 계정 캐릭터를 관리해요 ---- */
var SIDES = [["front", "프론트"], ["back", "백오피스"]];
var adminAccountsLoaded = false;
function renderAdminCharacterAccounts() {
  var form = document.getElementById("admin-character-form");
  if (!form || !dbRef || currentRole !== "ADMIN" || adminAccountsLoaded) return;
  adminAccountsLoaded = true;
  dbRef.adminAccounts().then(function (accounts) {
    var select = document.getElementById("admin-character-account"), list = accounts || [];
    var pending = list.filter(function (account) { return account.status === "PENDING"; });
    document.getElementById("admin-pending").innerHTML = pending.map(function (account) {
      return '<span class="jrow sacts"><b>' + esc(account.username) + '</b><button type="button" class="admin-approve" data-user="' + esc(account.username) + '">승인</button><button type="button" class="admin-reject sdel" data-user="' + esc(account.username) + '">거절</button></span>';
    }).join("") || '<span class="tempty">승인 대기 중인 가입이 없습니다.</span>';
    select.innerHTML = list.filter(function (account) { return account.status !== "PENDING"; }).map(function (account) {
      return '<option value="' + esc(account.username) + '">' + esc(account.username) + " · 캐릭터 " + account.characterCount + "개</option>";
    }).join("") || '<option value="">계정이 없습니다</option>';
  }, function () {
    adminAccountsLoaded = false;
    document.getElementById("admin-character-status").textContent = "계정 목록을 불러오지 못했습니다.";
  });
}
function decideAccount(button, approve) {
  var status = document.getElementById("admin-character-status"), user = button.dataset.user;
  (approve ? dbRef.approveAccount(user) : dbRef.rejectAccount(user)).then(function () {
    status.textContent = user + (approve ? " 가입을 승인했습니다." : " 가입을 거절했습니다."); adminAccountsLoaded = false; renderAdminCharacterAccounts();
  }, function () { status.textContent = "처리하지 못했습니다."; });
}
function createAdminCharacter() {
  var account = document.getElementById("admin-character-account").value;
  var nameInput = document.getElementById("admin-character-name");
  var status = document.getElementById("admin-character-status");
  var name = nameInput.value.trim();
  if (!account) { status.textContent = "계정을 선택해 주세요."; return; }
  if (!name) { status.textContent = "캐릭터 이름을 입력해 주세요."; nameInput.focus(); return; }
  status.textContent = "";
  dbRef.createAdminCharacter({ username: account, n: name, g: "m", u: document.getElementById("admin-character-universe").value }).then(function () {
    nameInput.value = ""; status.textContent = "캐릭터를 계정에 연결했습니다."; adminAccountsLoaded = false; afterPeople();
  }, function () { status.textContent = "캐릭터를 생성하지 못했습니다."; });
}
function subUnis(side) { return Object.keys(UNI).filter(function (k) { var u = UNI[k]; return u.side === side && !u.hidden && k !== "fgen" && k !== "bgen"; }); }
function fillSub() {
  var sd = document.getElementById("tmside").value, sub = document.getElementById("tmsub"), h = '<option value="">소분류 (선택 안 함)</option>';
  subUnis(sd).forEach(function (k) { h += '<option value="' + k + '">' + esc(UNI[k].name) + "</option>"; });
  sub.innerHTML = h;
}
function pickedUni() { var sd = document.getElementById("tmside").value, sub = document.getElementById("tmsub").value; return sub && UNI[sub] && UNI[sub].side === sd ? sub : (sd === "back" ? "bgen" : "fgen"); }
function renderTeam() {
  var can = canEditJobs(), sdEl = document.getElementById("tmside"), ps = sdEl.value, sb = document.getElementById("tmsub").value, h = "";
  refreshForms();
  renderAdminCharacterAccounts();
  document.getElementById("teamnote").hidden = can;
  if (!sdEl.options.length) sdEl.innerHTML = SIDES.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("");
  if (ps) sdEl.value = ps;
  fillSub();
  if (sb && document.getElementById("tmsub").querySelector('option[value="' + sb + '"]')) document.getElementById("tmsub").value = sb;
  var mems = DATA.filter(function (d) { return !d.ext; });
  mems.forEach(function (d) {
    var id = jobId(d), action = d.accountCharacter ? "캐릭터 삭제" : "명단에서 제외";
    h += '<span class="mchip" style="padding-right:' + (can && d.mem ? 4 : 11) + 'px">' + esc(d.n) + (ttl(d) ? " · " + esc(ttl(d)) : "") + " · " + esc(UNI[uOf(d)].realm) +
      (can && d.mem ? '<button type="button" class="tmdel" data-id="' + esc(id) + '" aria-label="' + esc(d.n) + " " + action + '" title="' + action + '"><span class="icon-x" aria-hidden="true"></span></button>' : "") + "</span>";
  });
  document.getElementById("teamlist").innerHTML = h;
  document.getElementById("teamcount").textContent = "(" + mems.length + "명)";
}
function afterPeople() { rebuildExternal(false); renderTeam(); renderPick(); renderMeets(); }
function addPerson() {
  var st = document.getElementById("teamstatus"), n = document.getElementById("tmname").value.trim().slice(0, 30), list = peopleList();
  if (!n) { st.textContent = "닉네임을 적어주세요."; return; }
  if (DATA.some(function (d) { return d.n === n; })) { st.textContent = "이미 있는 닉네임이에요. 다른 닉네임을 적어주세요."; return; }
  if (list.length >= 40) { st.textContent = "멤버는 40명까지 추가할 수 있어요."; return; }
  st.textContent = "";
  list = list.concat([{ id: newId("p"), n: n, g: document.getElementById("tmg").value === "f" ? "f" : "m", t: document.getElementById("tmtitle").value.trim().slice(0, 8), u: pickedUni(), c: document.getElementById("tmjob").value.trim().slice(0, 16) }]);
  commit("people", "main", { list: list }, function () {
    ["tmname", "tmtitle", "tmjob"].forEach(function (id) { document.getElementById(id).value = ""; });
    afterPeople(); document.getElementById("tmname").focus();
  }, "#teamstatus");
}
function removePerson(id) {
  var member = DATA.find(function (d) { return d.id === id; });
  if (member && member.accountCharacter && dbRef && currentRole === "ADMIN") {
    dbRef.deleteCharacter(id).then(function () { afterPeople(); }, function () {
      var status = document.getElementById("teamstatus");
      if (status) status.textContent = "캐릭터를 삭제하지 못했어요.";
    });
    return;
  }
  var list = peopleList().filter(function (x) { return x.id !== id; });
  commit("people", "main", list.length ? { list: list } : null, function () {
    if (store.tasks[id]) commit("tasks", id, null, null, "#teamstatus");
    afterPeople();
  }, "#teamstatus");
}
document.getElementById("teampane").addEventListener("click", function (e) {
  var b = e.target.closest(".tmdel");
  if (e.target.closest("#admin-character-create")) { createAdminCharacter(); return; }
  var decide = e.target.closest(".admin-approve, .admin-reject");
  if (decide) { decideAccount(decide, decide.classList.contains("admin-approve")); return; }
  if (e.target.closest("#tmadd")) { addPerson(); return; }
  if (b) {
    var member = DATA.find(function (d) { return d.id === b.dataset.id; });
    var message = member && member.accountCharacter
      ? member.n + " 캐릭터를 완전히 삭제할까요?"
      : member.n + " 멤버를 명단에서 제외할까요?";
    if (window.confirm(message)) removePerson(b.dataset.id);
    return;
  }
});
document.getElementById("tmside").addEventListener("change", fillSub);
document.getElementById("tmname").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); addPerson(); } });

