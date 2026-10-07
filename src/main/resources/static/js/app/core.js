/* 공통 상태, 세계관 상수, 데이터·근태 계산, 문자열 도우미 */
/* 캐릭터 보드의 화면 상태, 데이터 렌더링, 편집 및 상호작용을 관리합니다. */
var WORLD_THEME = document.documentElement.getAttribute("data-world-theme") === "plaza" || document.documentElement.getAttribute("data-world-theme") === "battlefield" ? document.documentElement.getAttribute("data-world-theme") : "office";
var SIDE = {
  front: { name: "프론트" },
  back:  { name: "백오피스" },
  proj:  { name: "용병단" }
};
var UNI = {
  flead:     { side: "front", name: "프론트 팀장", realm: "프론트 팀장",   color: "var(--lead)", desc: "", hidden: true },
  order:     { side: "front", name: "주문", realm: "프론트 주문",     color: "var(--c-order)",     desc: "주문이 들어와 결제되고, 문의가 풀리는 구역" },
  member:    { side: "front", name: "회원", realm: "프론트 회원",   color: "var(--c-member)",    desc: "가입부터 등급, 마이페이지까지 회원 기록을 지키는 구역" },
  display:   { side: "front", name: "전시", realm: "프론트 전시",     color: "var(--c-display)",   desc: "고객이 처음 마주하는 화면과 상품 정보를 세우는 구역" },
  broadcast: { side: "front", name: "알림", realm: "프론트 알림",   color: "var(--c-broadcast)", desc: "방송 시간에 맞춰 알림과 검색이 제때 닿게 하는 구역" },
  curation:  { side: "front", name: "큐레이션", realm: "프론트 큐레이션", color: "var(--c-curation)",  desc: "기획전과 콘텐츠를 만들고 배포하는 구역" },
  fgen:      { side: "front", name: "프론트", realm: "프론트", color: "var(--muted)", desc: "소분류 없이 프론트에 속한 멤버" },
  blead:     { side: "back",  name: "백오피스 총괄", realm: "백오피스 총괄", color: "var(--lead)", desc: "", hidden: true },
  bord:      { side: "back",  name: "주문", realm: "백오피스 주문",     color: "var(--c-b1)", desc: "주문과 결제, 고객 응대, 제휴 연동을 뒤에서 받치는 구역" },
  bprod:     { side: "back",  name: "상품", realm: "백오피스 상품", color: "var(--c-b2)", desc: "상품 등록부터 방송, 프로모션, 입점사 관리까지 맡는 구역" },
  blog:      { side: "back",  name: "물류", realm: "백오피스 물류",     color: "var(--c-b3)", desc: "상품이 창고에서 고객 문 앞까지 가는 길을 잇는 구역" },
  bsettle:   { side: "back",  name: "정산", realm: "백오피스 정산",     color: "var(--c-b4)", desc: "정산과 매출 집계, 공급망, 공통 API와 보안을 지키는 구역" },
  bgen:      { side: "back",  name: "백오피스", realm: "백오피스", color: "var(--muted)", desc: "소분류 없이 백오피스에 속한 멤버" },
  p1:        { side: "proj",  name: "빈 용병 진영", realm: "빈 용병 진영", color: "var(--c-p1)", desc: "외부에서 합류한 프로젝트 팀의 공간", hidden: true },
  p2:        { side: "proj",  name: "빈 용병 진영", realm: "빈 용병 진영", color: "var(--c-p2)", desc: "외부에서 합류한 프로젝트 팀의 공간", hidden: true },
  p3:        { side: "proj",  name: "빈 용병 진영", realm: "빈 용병 진영", color: "var(--c-p3)", desc: "외부에서 합류한 프로젝트 팀의 공간", hidden: true }
};
var STAT_LABELS = ["장애대응", "쿼리", "소통", "속도", "꼼꼼함"];

/* DATA: 서버에 등록된 캐릭터만 담습니다. */
var DATA = [];

var state = { side: null, uni: null, q: "", sort: "lv" };
var lastFocus = null;
var openIdx = null;
var jobs = {};
var dbRef = null;
var currentUser = null;
var currentCharacterId = null;
var currentRole = null;
var currentCanAnnounce = false;
var mapSet = {}, mapFilt = false;
var moves = {}, leaves = {}, movesLoaded = false;
var canWrite = null;
try { var rawJobs = localStorage.getItem("ops-jobs"); if (rawJobs) jobs = JSON.parse(rawJobs) || {}; } catch (e) { jobs = {}; }

try { var rawMv = localStorage.getItem("ops-moves"); if (rawMv) moves = JSON.parse(rawMv) || {}; } catch (e) { moves = {}; }
try { var rawSt = localStorage.getItem("ops-status"); if (rawSt) leaves = JSON.parse(rawSt) || {}; } catch (e) { leaves = {}; }

/* core.js가 로드 시점에 extendData()로 호출하므로 이 파일에 둬야 해요 */
function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { var a = seed; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var INVCAP = 14;
var PSLOTS = ["p1", "p2", "p3"];
var store = { tasks: {}, meetings: {}, projects: {}, titles: {}, snacks: {}, stats: {}, health: {}, chat: {}, privateChats: {}, say: {}, pres: {}, skills: {}, nicks: {}, cfg: {}, ot: {}, seats: {}, people: {}, pos: {} };
var intr = [], invCount = {};
Object.keys(store).forEach(function (c) { try { var raw = localStorage.getItem("ops-" + c); if (raw) { var o = JSON.parse(raw); store[c] = o && typeof o === "object" && !Array.isArray(o) ? o : {}; } } catch (e) { store[c] = {}; } });
function makeExt(m, k) {
  var r = rng(hash(m.id)), s = [], j;
  for (j = 0; j < 5; j++) s.push(58 + Math.floor(r() * 30));
  return { n: String(m.n).slice(0, 30), bn: String(m.n).slice(0, 30), g: m.g === "f" ? "f" : "m", t: String(m.t || "프로젝트원").slice(0, 10), u: k, c: "프로젝트 합류 멤버", lv: 18 + Math.floor(r() * 20), s: s, k: "외부 합류", kd: "외부에서 합류해 프로젝트를 함께 끌고 가는 팀원.", q: "프로젝트가 끝날 때까지 함께합니다.", id: m.id, ext: true };
}
function peopleList() {
  var m = store.people && store.people.main, l = m && Array.isArray(m.list) ? m.list : [];
  return l.filter(function (x) { return x && typeof x.id === "string" && typeof x.n === "string" && x.n; });
}
function makeMember(m) {
  var r = rng(hash(m.id)), s = [], j, u = UNI[m.u] && UNI[m.u].side !== "proj" ? m.u : "order";
  for (j = 0; j < 5; j++) s.push(58 + Math.floor(r() * 30));
  return { n: String(m.n).slice(0, 30), bn: String(m.n).slice(0, 30), g: m.g === "f" ? "f" : "m", t: String(m.t || "").slice(0, 8), u: u, c: String(m.c || "팀원").slice(0, 16), lv: 18 + Math.floor(r() * 20), s: s, k: "", kd: "", q: "", id: m.id, seat: typeof m.s === "number" ? m.s : null, mem: true, accountCharacter: !!m.accountCharacter };
}
function extendData() {
  DATA.length = 0;
  peopleList().forEach(function (m) { DATA.push(makeMember(m)); });
  PSLOTS.forEach(function (k) {
    var p = store.projects[k], u = UNI[k];
    if (p && typeof p.name === "string") {
      u.hidden = false; u.name = p.name; u.realm = p.name;
      (Array.isArray(p.members) ? p.members : []).forEach(function (m) { if (m && typeof m.id === "string" && typeof m.n === "string") DATA.push(makeExt(m, k)); });
    } else { u.hidden = true; u.name = "빈 용병 진영"; u.realm = "빈 용병 진영"; }
  });
  DATA.forEach(function (d) {
    var o = store.nicks && store.nicks[jobId(d)], v = o && typeof o.n === "string" ? o.n.trim() : "";
    if (d.bn == null) d.bn = d.n;
    d.n = v ? v.slice(0, 30) : d.bn;
  });
}
extendData();
function newId(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36); }
function tasksOf(d) {
  var t = store.tasks[jobId(d)];
  return t && Array.isArray(t.items) ? t.items.filter(function (x) { return x && typeof x.i === "string" && typeof x.t === "string"; }) : [];
}
function taskDone(x, today) { return !!x.d || (typeof x.due === "string" && x.due < (today || todayStr())); }
function openTasks(d) { var today = todayStr(); return tasksOf(d).filter(function (x) { return !taskDone(x, today); }); }
function uOf(d) { var m = moves[jobId(d)]; return m && UNI[m] && !UNI[m].hidden ? m : d.u; }
function todayStr() { var t = new Date(); return t.getFullYear() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2); }
function md(x) { var q = String(x).split("-"); return q.length === 3 ? (+q[1]) + "/" + (+q[2]) : x; }
function offLabel(d) { return d.off || "연차"; }
function onLeave(d, today) { if (d.off) return true; var l = leaves[jobId(d)], t = today || todayStr(); return !!(l && l.from <= t && t <= l.to); }
function hmMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; }
function cfg() {
  var c = store.cfg.main || {}, o = { ls: "12:00", le: "13:00", oe: "18:00", bossVisit: c.bossVisit === true };
  ["ls", "le", "oe"].forEach(function (k) { if (hmMin(c[k]) !== null) o[k] = c[k]; });
  if (hmMin(o.le) <= hmMin(o.ls)) { o.ls = "12:00"; o.le = "13:00"; }
  return o;
}
function bossVisitOn() { return !!(store.cfg.main && store.cfg.main.bossVisit === true); }
function nowMin(now) { var t = new Date(now || Date.now()); return t.getHours() * 60 + t.getMinutes(); }
function isOT(d) { var o = store.ot[jobId(d)]; return !!(o && o.d === todayStr()); }
function isGone(d, now) { return nowMin(now) >= hmMin(cfg().oe) && !isOT(d); }
function shouldSitAtDesk(d, now) {
  now = now || Date.now();
  if (WORLD_THEME !== "office") return false;
  if (WORLD_THEME === "office" && bossVisitOn()) return !onLeave(d) && !isGone(d, now) && (!presenceOf(d, now) || presenceOf(d, now) === "lunch") && !inActiveMeeting(d);
  var minute = nowMin(now), end = hmMin(cfg().oe);
  var working = !presenceOf(d, now) || presenceOf(d, now) === "lunch";
  return !!(working && minute >= 540 && (minute < end || isOT(d)));
}
function levelOf(d) { return Math.max(1, Math.min(99, Math.round(power(d) / 13))); }
function presenceOf(d, now) {
  now = now || Date.now();
  var p = store.pres[jobId(d)], al = document.getElementById("autolunch"), c = cfg(), m = nowMin(now);
  if (p && typeof p.at === "number" && now >= p.at - 60000) {
    if (p.s === "work" && now - p.at < 3600000) return "";
    if (p.s === "lunch" && now - p.at < 3600000) return "lunch";
    if (p.s === "break" && now - p.at < 1800000) return "break";
    if (p.s === "away") return "away";
  }
  return al && al.checked && m >= hmMin(c.ls) && m < hmMin(c.le) ? "lunch" : "";
}
function selectedPresence(d, now) {
  return presenceOf(d, now) || "work";
}
function presTag(d) {
  if (isGone(d)) return " · 퇴근";
  var p = presenceOf(d), t = isOT(d) ? " · 야근" : "";
  return t + (p === "lunch" ? " · 점심 중" : p === "break" ? " · 휴식 중" : p === "away" ? " · 자리비움" : "");
}
function attText(d) {
  if (d.off) return d.off;
  if (onLeave(d)) return "연차";
  return "출근" + presTag(d);
}
var COMMON = ["장애 해결사", "로그 탐정", "쿼리 마법사", "배포 지휘관", "문서 사서", "야근 수호자", "분위기 메이커", "팀의 방패"];
var REC = {
  flead: ["프론트 총사령관", "전략 참모", "질서의 수호자"],
  blead: ["백오피스 대원로", "전략 결단가", "큰 그림 설계자"],
  order: ["결제 수호기사", "CS 힐러", "PG 통역사", "환불 마법사", "정산 연금술사", "쿠폰 감별사", "주문 추적자"],
  member: ["인증 수호자", "동의 기록관", "회원 사서", "등급 연금술사", "포인트 회계관", "마이페이지 건축가", "탈퇴 정화사"],
  display: ["전시 설계사", "상품상세 화가", "배너 조율사", "캐시 요정", "가격 검수관", "이미지 대장장이", "카테고리 항해사"],
  broadcast: ["편성표 시계공", "알림 전령", "검색 탐험가", "넷메일 조련사", "방송 감시자", "동의어 사전사", "알림톡 포수"],
  curation: ["CMS 장인", "템플릿 마법사", "기획전 연출가", "추천 점성술사", "배포 의식관", "큐레이터"],
  bord: ["주문 추적자", "PG 통역사", "환불 마법사", "ARS 교환수", "제휴 외교관", "고객 사서", "결제 수호기사"],
  bprod: ["상품 감정사", "방송 조율사", "프로모션 설계자", "입점 안내인", "카탈로그 사서", "가격 검수관"],
  blog: ["물류 항해사", "배송 길잡이", "재고 파수꾼", "송장 추적자", "입고 감독관"],
  bsettle: ["정산 연금술사", "매출 분석관", "SCM 공급관", "API 관문지기", "보안 수호자", "마감의 문지기"]
};
function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function jobId(d) { return d.id || (d.id = "u" + hash(d.n).toString(36)); }
function job(d) { return jobs[jobId(d)] || d.c; }
function skl(d) {
  var o = store.skills && store.skills[jobId(d)];
  return o && typeof o === "object" ? { k: String(o.k || ""), kd: String(o.kd || ""), q: String(o.q || "") } : { k: d.k || "", kd: d.kd || "", q: d.q || "" };
}
function nameParts(n) {
  return [String(n)];
}
function nameHtml(n) { var p = nameParts(n); return p.length > 1 ? esc(p[0]) + "<br>" + esc(p[1]) : esc(p[0]); }
function nameLines(d, suffix) { var p = nameParts(d.n); suffix = suffix || ""; return p.length > 1 ? [p[0], p[1] + suffix] : [p[0] + suffix]; }
function tline(d) { var t = ttl(d); return t ? t + " · " : ""; }
function ttl(d) { var t = store.titles[jobId(d)]; return t && typeof t.t === "string" && t.t ? t.t : d.t; }
var RANKS = ["상무", "이사", "팀장", "부장", "차장", "과장", "대리", "주임", "사원"];
function canEditJobs() { return !dbRef || currentRole === "ADMIN"; }
function canManageSharedOperations() { return !dbRef || !!currentUser; }
function canEditCharacter(d) { return !dbRef || currentRole === "ADMIN" || !!(d && d.accountCharacter && d.id === currentCharacterId); }
