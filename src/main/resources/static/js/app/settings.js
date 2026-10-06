/* 공용 설정, 사이트 문구, 사장님 방문, 테마 */
function fillCfg() { var c = cfg(); document.getElementById("cfgls").value = c.ls; document.getElementById("cfgle").value = c.le; document.getElementById("cfgoe").value = c.oe; document.getElementById("boss-visit").checked = c.bossVisit; syncBossVisitUI(); }
var COPY_FIELDS = [
  ["홈 소개", [["siteLead", "사이트 한 줄 소개"], ["siteDesc", "사이트 설명"]]],
  ["지도 안내", [["mapOffice", "사무실"], ["mapPlaza", "광장"], ["mapBattlefield", "전장"]]],
  ["직원·영웅 안내", [["teamOffice", "사무실"], ["teamBattlefield", "전장"], ["teamNoteOffice", "사무실 권한 안내"], ["teamNoteBattlefield", "전장 권한 안내"]]],
  ["회의·프로젝트·간식·공지", [["meetingOffice", "사무실 회의"], ["meetingPlaza", "광장 회의"], ["meetingBattlefield", "전장 회의"], ["projectOffice", "사무실 프로젝트 안내"], ["projectPlaza", "광장 프로젝트 안내"], ["projectOther", "전장 프로젝트 안내"], ["snackOffice", "사무실 간식 안내"], ["snackOther", "전장 간식 안내"], ["notice", "공지 안내"]]],
  ["하단 사용 안내", [["footerOne", "첫 번째 안내"], ["footerTwoOffice", "사무실 두 번째 안내"], ["footerTwoOther", "전장·광장 두 번째 안내"], ["footerThree", "세 번째 안내"]]]
];
var COPY_DEFAULTS = {
  siteLead: "모든 팀을 하나로 연결하는 올인원 가상 협업 공간, [ 메타데스크 ] 입니다.",
  siteDesc: "다양한 부서와 직무(도메인)를 매력적인 캐릭터와 유니버스로 시각화하여 더 즐겁고 직관적인 가상 오피스 환경을 제공합니다.",
  mapOffice: "64개 자리 중 62개는 직원 좌석이고, FTP·ER 전용 PC 2개는 잠시 사용할 수 있어요. PC 사용 중에도 지정 좌석과 닉네임은 유지됩니다. 본인 좌석을 클릭하면 돌아갑니다.",
  mapBattlefield: "영웅은 상태와 회의에 따라 전장과 각 유니버스를 오갑니다. 캐릭터 시트에서 상태·근태·업무를 관리하고, 회의가 끝나면 원래 활동 구역으로 돌아갑니다.",
  mapPlaza: "광장의 6개 쇼핑몰 건물을 방향키로 둘러보세요. 내 캐릭터는 방향키로 직접 움직이고, 건물 입구에서 Enter를 누르면 해당 사이트가 새 창으로 열립니다. 다른 캐릭터는 각 계정 소유자가 움직일 때만 이동합니다.",
  teamOffice: "계정 캐릭터는 회원가입 후 본인이 만들거나 관리자가 계정에 연결합니다. 이 화면에서 추가하는 명단 전용 직원은 지도와 명단에 표시됩니다. 닉네임과 대분류는 필수이며, 소분류·직급·직업은 선택 사항입니다. 명단 직원의 추가·제거와 계정 캐릭터 연결·삭제는 관리자만 할 수 있습니다.",
  teamBattlefield: "계정 캐릭터는 회원가입 후 본인이 만들거나 관리자가 계정에 연결합니다. 이 화면에서 추가하는 명단 전용 영웅은 지도와 명단에 표시됩니다. 닉네임과 대분류는 필수이며, 소분류·직급·직업은 선택 사항입니다. 명단 영웅의 추가·제거와 계정 캐릭터 연결·삭제는 관리자만 할 수 있습니다.",
  teamNoteOffice: "명단 직원의 추가·제거와 계정 캐릭터 연결·삭제는 관리자 권한이 필요합니다. 일반 사용자는 회원가입 후 본인 계정의 캐릭터를 만들 수 있습니다.",
  teamNoteBattlefield: "명단 영웅의 추가·제거와 계정 캐릭터 연결·삭제는 관리자 권한이 필요합니다. 일반 사용자는 회원가입 후 본인 계정의 캐릭터를 만들 수 있습니다.",
  meetingOffice: "회의를 시작하면 참석 직원이 사무실 오른쪽 회의실로 이동합니다. 회의실은 3개이며 회의 하나에 최대 8명까지 참석할 수 있습니다. 회의가 끝나면 원래 자리로 돌아가고, 연차 중인 직원은 참석할 수 없습니다.",
  meetingBattlefield: "회의를 시작하면 참석 영웅이 지도 아래쪽 작전 테이블로 이동합니다. 테이블은 3개이며 회의 하나에 최대 8명까지 참석할 수 있습니다. 회의가 끝나면 원래 자리로 돌아가고, 연차 중인 영웅은 참석할 수 없습니다.",
  meetingPlaza: "회의를 시작하면 참석 직원 목록이 관리됩니다. 광장 지도에는 회의 공간이 없어 참석자도 지도에서 이동하지 않습니다. 연차 중인 직원은 참석할 수 없습니다.",
  projectOffice: "프로젝트 팀을 만들고 기존 직원을 참여시킬 수 있습니다. 각 팀은 지도에 전용 구역을 가지며, 프로젝트 팀은 최대 3개까지 운영할 수 있습니다.",
  projectOther: "용병단을 만들고 기존 영웅을 참여시킬 수 있습니다. 각 팀은 지도에 전용 구역을 가지며, 용병단은 최대 3개까지 운영할 수 있습니다.",
  projectPlaza: "프로젝트 팀을 만들고 기존 직원을 참여시킬 수 있습니다. 광장 지도에는 팀 구역이 표시되지 않으며, 프로젝트 팀은 최대 3개까지 운영할 수 있습니다.",
  snackOffice: "간식 당번 기간과 담당 팀, 먹을거리를 등록하세요. 기간 중에는 팀 구역과 팀원 정보에 간식이 표시됩니다.",
  snackOther: "보급 담당 기간과 팀, 먹을거리를 등록하세요. 기간 중에는 각 유니버스 구역과 팀원 정보에 보급품이 표시됩니다.",
  notice: "공지는 모든 사용자에게 표시됩니다. 관리자 또는 직급이 팀장·상무인 캐릭터의 소유자만 작성할 수 있습니다.",
  footerOne: "캐릭터 시트에서 직급·직업·스킬·스탯·체력을 관리할 수 있습니다. 레벨은 5개 스탯의 합계로 계산됩니다.",
  footerTwoOffice: "업무·근무 상태·전출·좌석은 캐릭터 시트에서 관리합니다. FTP·ER 전용 PC를 임시로 사용해도 지정 좌석은 유지됩니다.",
  footerTwoOther: "업무·근무 상태·전출 정보는 캐릭터 시트에서 관리합니다. 회의가 끝나면 각자 원래 활동 구역으로 돌아갑니다.",
  footerThree: "회의·프로젝트 팀·간식 담당은 업무 메뉴에서, 공지와 개인·그룹 채팅은 공지·채팅 메뉴에서 이용할 수 있습니다."
};
function copyValue(key) {
  var saved = store.cfg.copy, value = saved && saved[key];
  return typeof value === "string" ? value : COPY_DEFAULTS[key];
}
function copyVariant(base) {
  return WORLD_THEME === "office" || (WORLD_THEME === "plaza" && base !== "map" && base !== "meeting") ? base + "Office" : base + (WORLD_THEME === "plaza" ? "Plaza" : "Battlefield");
}
function applySiteCopy() {
  var count = document.getElementById("total"), first = document.getElementById("lede-first"), second = document.getElementById("lede-second");
  if (first) first.textContent = copyValue("siteLead").replace(/\{count\}/g, count ? count.textContent : "0");
  if (second) second.textContent = copyValue("siteDesc");
  [["map-guide", copyVariant("map")], ["team-guide", copyVariant("team")], ["teamnote", copyVariant("teamNote")],
    ["meeting-guide", copyVariant("meeting")], ["project-guide", WORLD_THEME === "plaza" ? "projectPlaza" : WORLD_THEME === "office" ? "projectOffice" : "projectOther"],
    ["snack-guide", WORLD_THEME !== "battlefield" ? "snackOffice" : "snackOther"], ["notice-guide", "notice"],
    ["footer-guide-1", "footerOne"], ["footer-guide-2", WORLD_THEME === "office" ? "footerTwoOffice" : "footerTwoOther"],
    ["footer-guide-3", "footerThree"]].forEach(function (entry) {
    var element = document.getElementById(entry[0]);
    if (element) element.textContent = copyValue(entry[1]);
  });
}
function renderCopyEditor() {
  var panel = document.getElementById("copy-admin"), fields = document.getElementById("copy-admin-fields"), html = "";
  if (!panel || !fields) return;
  panel.hidden = currentRole !== "ADMIN";
  if (panel.hidden) return;
  COPY_FIELDS.forEach(function (group) {
    html += '<fieldset class="copy-admin-group"><legend>' + esc(group[0]) + "</legend>";
    group[1].forEach(function (field) {
      html += '<label class="copy-admin-field">' + esc(field[1]) + '<textarea data-copy-key="' + esc(field[0]) + '" maxlength="1500" rows="3">' + esc(copyValue(field[0])) + "</textarea></label>";
    });
    html += "</fieldset>";
  });
  fields.innerHTML = html;
}
document.getElementById("copy-admin-form").addEventListener("submit", function (event) {
  event.preventDefault();
  if (currentRole !== "ADMIN") return;
  var copy = {}, status = document.getElementById("copy-admin-status");
  document.querySelectorAll("#copy-admin-fields [data-copy-key]").forEach(function (field) { copy[field.dataset.copyKey] = field.value; });
  status.textContent = "저장 중...";
  commit("cfg", "copy", copy, function () {
    applySiteCopy();
    status.textContent = "안내 문구를 저장했습니다.";
    renderCopyEditor();
  }, "#copy-admin-status");
});
function saveBossVisit(enabled) {
  var next = cfg(); next.bossVisit = !!enabled;
  if (dbRef && dbRef.setBossVisit) {
    dbRef.setBossVisit(enabled).then(function () {
      store.cfg.main = next;
      fillCfg(); applySeats(false); syncMeetings(false); paintMap();
    }, function () { fillCfg(); denied("#cfgst"); });
  } else {
    commit("cfg", "main", next, function () { fillCfg(); applySeats(false); syncMeetings(false); paintMap(); }, "#cfgst");
  }
}
function updateOT() {
  var n = DATA.filter(function (d) { return isOT(d) && !onLeave(d); }).length, el = document.getElementById("otcount");
  if (el) el.textContent = n ? "🌙 오늘 야근 " + n + "명" : "";
}
["cfgls", "cfgle", "cfgoe"].forEach(function (id) {
  document.getElementById(id).addEventListener("change", function () {
    var current = cfg(), v = { ls: document.getElementById("cfgls").value, le: document.getElementById("cfgle").value, oe: document.getElementById("cfgoe").value, bossVisit: current.bossVisit }, st = document.getElementById("cfgst");
    st.textContent = "";
    if (hmMin(v.ls) === null || hmMin(v.le) === null || hmMin(v.oe) === null || hmMin(v.le) <= hmMin(v.ls)) { st.textContent = "시간을 다시 확인해 주세요 (점심 끝이 시작보다 늦어야 해요)."; fillCfg(); return; }
    commit("cfg", "main", v, function () { fillCfg(); syncMeetings(false); }, "#cfgst");
  });
});
document.getElementById("boss-visit").addEventListener("change", function () { saveBossVisit(this.checked); });
fillCfg();
setView("map");

function setTheme(t, save) {
  t = t === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-ops-theme", t);
  if (save) { try { localStorage.setItem("ops-theme", t); } catch (e) {} }
  T = TH[t]; UC = {};
  var bs = document.querySelectorAll("#themebar .side"), k;
  for (k = 0; k < bs.length; k++) bs[k].setAttribute("aria-pressed", String(bs[k].dataset.t === t));
  spr = DATA.map(function (d) { return makeSprites(d); });
  paintMap();
}
function syncBossVisitUI() {
  var active = bossVisitOn(), control = document.getElementById("boss-visit-control"), checkbox = document.getElementById("boss-visit"), siren = document.getElementById("boss-siren");
  if (control) control.hidden = false;
  if (checkbox) checkbox.checked = active;
  if (siren) siren.hidden = !active;
}
function syncOfficeCopy() {
  var office = WORLD_THEME === "office", plaza = WORLD_THEME === "plaza", worldName = office ? "사무실" : plaza ? "광장" : "전장";
  var mapButton = document.querySelector('#views [data-v="map"] span'), worldSection = document.getElementById("world");
  var groups = document.querySelectorAll("#views .nlab"), group = groups[0], roster = document.querySelector('#views [data-v="list"] span'), team = document.querySelector('#views [data-v="team"] span'), teamTitle = document.querySelector("#teampane h2"), projectLabel = document.querySelector("#projpane .project-hero-label"), picker = document.getElementById("project-hero-pick"), map = document.getElementById("map"), world = document.getElementById("world");
  var projectTitle = document.querySelector("#projpane h2"), meetingTitle = document.querySelector("#meetpane h2"), snackTitle = document.querySelector("#snackpane h2");
  if (mapButton) mapButton.textContent = worldName;
  if (worldSection) worldSection.setAttribute("aria-label", worldName + " 지도");
  if (group) group.textContent = (office || plaza) ? "직원" : "영웅";
  if (groups[1]) groups[1].textContent = (office || plaza) ? "업무" : "군영";
  if (roster) roster.textContent = (office || plaza) ? "직원 명단" : "영웅 명부";
  if (team) team.textContent = (office || plaza) ? "직원 관리" : "영웅 모집";
  if (teamTitle) teamTitle.textContent = (office || plaza) ? "직원 관리" : "영웅 모집";
  if (projectLabel) projectLabel.textContent = (office || plaza) ? "기존 직원을 프로젝트팀에 합류시키기 (선택)" : "기존 영웅을 용병단에 합류시키기 (선택)";
  if (picker) picker.setAttribute("aria-label", (office || plaza) ? "프로젝트에 합류시킬 기존 직원" : "용병단에 합류시킬 기존 영웅");
  var projectNav = document.querySelector('#views [data-v="proj"] span'), meetingNav = document.querySelector('#views [data-v="meet"] span'), snackNav = document.querySelector('#views [data-v="snack"] span'), chatNav = document.querySelector('#views [data-v="chat"] span');
  if (projectNav) projectNav.textContent = (office || plaza) ? "프로젝트 팀" : "용병단";
  if (meetingNav) meetingNav.textContent = (office || plaza) ? "회의" : "작전 회의";
  if (snackNav) snackNav.textContent = (office || plaza) ? "간식" : "보급";
  if (chatNav) chatNav.textContent = (office || plaza) ? "공지·채팅" : "전령";
  if (projectTitle) projectTitle.textContent = (office || plaza) ? "프로젝트 팀" : "용병단";
  if (meetingTitle) meetingTitle.textContent = (office || plaza) ? "회의" : "작전 회의";
  if (snackTitle) snackTitle.textContent = (office || plaza) ? "간식 담당" : "보급 담당";
  if (world) world.setAttribute("aria-label", worldName + " 지도");
  applySiteCopy();
  if (map) map.setAttribute("aria-label", worldName + " 지도. " + document.getElementById("map-guide").textContent);
  syncBossVisitUI();
}
function setWorldTheme(theme, save) {
  WORLD_THEME = theme === "plaza" || theme === "battlefield" ? theme : "office";
  document.documentElement.setAttribute("data-world-theme", WORLD_THEME);
  if (save) { try { localStorage.setItem("ops-world-theme", WORLD_THEME); } catch (e) {} }
  var buttons = document.querySelectorAll("#world-themebar .side");
  buttons.forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.worldTheme === WORLD_THEME)); });
  syncOfficeCopy();
  spr = DATA.map(function (d) { return makeSprites(d); });
  UC = {};
  paintMap();
  walkers.forEach(function (walker) { walker.a = wanderOf(walker.u); });
  applySeats(false); syncMeetings(false);
  renderGrid();
  if (state.view === "proj") renderProjects();
  if (state.view === "team") renderTeam();
  if (openIdx !== null) openSheet(openIdx, null);
  if (bgm.playing) { stopBgm(); startBgm(); }
}
document.getElementById("themebar").addEventListener("click", function (e) { var b = e.target.closest(".side"); if (b) setTheme(b.dataset.t, true); });
document.getElementById("world-themebar").addEventListener("click", function (e) { var b = e.target.closest("[data-world-theme]"); if (b) setWorldTheme(b.dataset.worldTheme, true); });
document.getElementById("bgm-toggle").addEventListener("click", toggleBgm);
syncBgmButton();
setTheme(document.documentElement.getAttribute("data-ops-theme"), false);
setWorldTheme(document.documentElement.getAttribute("data-world-theme"), false);
