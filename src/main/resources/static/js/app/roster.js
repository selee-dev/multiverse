/* 캐릭터 시트, 편집기, 업무(task), 명단 그리드 */
function syncAnnouncementPermission() {
  var index = currentCharacterId ? indexOfId(currentCharacterId) : -1;
  currentCanAnnounce = currentRole === "ADMIN" || (index >= 0 && ["팀장", "상무"].indexOf(ttl(DATA[index])) >= 0);
}
function jobEditor(d) {
  var seen = {}, chips = "";
  (REC[uOf(d)] || []).concat(COMMON).forEach(function (t) {
    if (seen[t]) return; seen[t] = 1;
    chips += '<button type="button" class="rec">' + t + "</button>";
  });
  return '<div class="jobedit" id="jobpanel" hidden><div class="mlabel">추천 직업명</div><div class="recs">' + chips + "</div>" +
    '<div class="jrow"><input id="jobin" type="text" maxlength="16" placeholder="직접 입력" aria-label="직업 이름">' +
    '<button type="button" class="jsave">저장</button><button type="button" class="jreset">기본값</button><button type="button" class="jcancel">취소</button></div>' +
    '<div class="jstatus" role="status"></div></div>';
}
function hideEditor() {
  var eds = document.querySelectorAll("#sheet .jobedit"), k;
  for (k = 0; k < eds.length; k++) { eds[k].hidden = true; eds[k].querySelector(".jstatus").textContent = ""; }
}
function showPanel(id) {
  var eds = document.querySelectorAll("#sheet .jobedit"), k, ed = document.getElementById(id);
  for (k = 0; k < eds.length; k++) if (eds[k].id !== id) eds[k].hidden = true;
  ed.hidden = !ed.hidden;
  return ed;
}
function updateJobViews(d) {
  var n = document.querySelector("#sheet .jobname");
  if (n && openIdx !== null && DATA[openIdx] === d) n.textContent = job(d);
  renderGrid();
}
function saveJob(i, val) {
  var d = DATA[i], id = jobId(d), v = (val || "").trim();
  var status = document.querySelector("#jobpanel .jstatus");
  var reset = !v || v === d.c;
  function apply() { if (reset) delete jobs[id]; else jobs[id] = v; }
  if (dbRef) {
    var ref = dbRef.doc("jobs/" + id);
    (reset ? ref.delete() : ref.set({ c: v })).then(function () {
      apply(); updateJobViews(d); hideEditor();
    }, function () {
      if (status) status.textContent = "저장하지 못했어요. 이 페이지를 편집할 수 있는 권한(Contributor 이상)이 필요할 수 있어요.";
    });
  } else {
    apply();
    try { localStorage.setItem("ops-jobs", JSON.stringify(jobs)); } catch (e) {}
    updateJobViews(d); hideEditor();
  }
}

function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { var a = seed; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function statOf(d) {
  var o = store.stats[jobId(d)];
  return o && Array.isArray(o.s) && o.s.length === 5 ? o.s.map(function (v) { return Math.max(0, Math.min(100, Math.round(+v || 0))); }) : d.s;
}
function healthOf(d) {
  var o = store.health[jobId(d)], value = o ? +o.value : 100;
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 100;
}
function batteryOf(d, now) {
  var base = healthOf(d), current = nowMin(now), leave = hmMin(cfg().oe), start = 9 * 60;
  if (current <= start || leave <= start) return base;
  if (current >= leave) return Math.round(base * 0.35);
  return Math.max(0, Math.round(base * (1 - ((current - start) / (leave - start)) * 0.65)));
}
function power(d) { return statOf(d).reduce(function (a, b) { return a + b; }, 0); }
function rarity(lv) { return lv >= 50 ? ["전설", "#f4c95d", "r-legend"] : lv >= 38 ? [WORLD_THEME === "office" ? "직원" : "영웅", "#e6e9f5", ""] : lv >= 26 ? ["희귀", "#8fa3d6", ""] : ["일반", "#6b7399", ""]; }

function spriteRects(d, step) {
  var r = rng(hash(d.bn || d.n)), out = [];
  function pick(a) { return a[Math.floor(r() * a.length)]; }
  function R(x, y, w, h, fill, op) { out.push([x, y, w, h, fill, op || 1]); }
  var f = d.g === "f", OUT = "currentColor", GOLD = "#f4c95d", SH = "#14172b";
  var skin = pick(["#f7d9bf", "#f0c8a4", "#e3b08a"]);
  var hair = pick(["#1c1a24", "#2d2320", "#4a3225"]);
  var style = Math.floor(r() * 3);
  var crown = ["상무", "이사", "팀장"].indexOf(ttl(d)) >= 0;
  var senior = ["상무", "이사", "팀장", "부장"].indexOf(ttl(d)) >= 0;
  var pants = f ? skin : "#2a3050";
  R(3, 19, 8, 1, "#000", 0.3);
  /* 뒷머리 */
  if (f) {
    if (style === 0) R(1, 2, 12, 10, hair);
    else if (style === 1) R(1, 2, 12, 7, hair);
    else { R(2, 2, 10, 4, hair); R(12, 4, 1, 6, hair); R(13, 6, 1, 3, hair); }
  }
  /* 다리 */
  R(4, 16, 2, 2, pants); R(8, 16, 2, 2, pants);
  if (step === 1) { R(4, 17, 3, 1, SH); R(8, 18, 3, 1, SH); }
  else if (step === 2) { R(4, 18, 3, 1, SH); R(8, 17, 3, 1, SH); }
  else { R(4, 18, 3, 1, SH); R(8, 18, 3, 1, SH); }
  /* 몸 */
  R(3, 12, 8, 4, OUT); R(2, 12, 1, 3, OUT); R(11, 12, 1, 3, OUT);
  R(10, 12, 1, 4, "#000", 0.18);
  R(2, 15, 1, 1, skin); R(11, 15, 1, 1, skin);
  R(6, 12, 2, 1, "#fff", 0.9);
  if (!f && senior) R(6, 13, 2, 2, "#1e2a4a");
  /* 얼굴 */
  R(2, 2, 10, 9, skin); R(3, 11, 8, 1, skin);
  if (!f) R(2, 10, 10, 1, "#000", 0.06);
  /* 머리카락 */
  R(3, 1, 8, 1, hair); R(2, 2, 10, 3, hair);
  if (!f && style === 2) { R(2, 5, 4, 1, hair); R(11, 5, 1, 1, hair); }
  if (!f && style === 0) { R(2, 5, 1, 3, hair); R(11, 5, 1, 3, hair); }
  if (!f && style === 1 && !crown) { R(4, 0, 1, 1, hair); R(6, 0, 2, 1, hair); R(9, 0, 1, 1, hair); }
  if (f && style < 2) { R(2, 5, 1, 5, hair); R(11, 5, 1, 5, hair); }
  if (f && style === 2) { R(2, 5, 1, 2, hair); }
  /* 눈·눈썹·입 */
  R(4, 5, 2, 1, hair); R(8, 5, 2, 1, hair);
  R(4, 6, 2, 3, "#1a1a2a"); R(8, 6, 2, 3, "#1a1a2a");
  R(4, 6, 1, 1, "#fff"); R(8, 6, 1, 1, "#fff");
  R(6, 10, 2, 1, f ? "#d0606c" : "#b07060");
  if (f) { R(3, 9, 1, 1, "#f29a9a", 0.8); R(10, 9, 1, 1, "#f29a9a", 0.8); }
  else R(3, 9, 1, 1, "#e08a70", 0.35), R(10, 9, 1, 1, "#e08a70", 0.35);
  if (crown) { R(3, 1, 8, 1, GOLD); R(3, 0, 1, 1, GOLD); R(6, 0, 2, 1, GOLD); R(10, 0, 1, 1, GOLD); }
  return out;
}

function sprite(d) {
  var o = "";
  spriteRects(d, 0).forEach(function (q) {
    o += '<rect x="' + q[0] + '" y="' + q[1] + '" width="' + q[2] + '" height="' + q[3] + '" fill="' + q[4] + '"' + (q[5] < 1 ? ' fill-opacity="' + q[5] + '"' : "") + "/>";
  });
  return '<svg viewBox="0 0 14 20" shape-rendering="crispEdges" aria-hidden="true">' + o + "</svg>";
}

function titleEditor(d) {
  var chips = "";
  RANKS.forEach(function (t) { chips += '<button type="button" class="trec">' + t + "</button>"; });
  return '<div class="jobedit" id="titlepanel" hidden><div class="mlabel">직급</div><div class="recs">' + chips + "</div>" +
    '<div class="jrow"><input id="titin" type="text" maxlength="8" placeholder="직접 입력 (예: 책임, 수석)" aria-label="직급 이름">' +
    '<button type="button" class="jsave tisave">저장</button><button type="button" class="tireset">원래 직급으로</button><button type="button" class="jcancel">취소</button></div>' +
    '<div class="jstatus" role="status"></div></div>';
}
function saveTitle(i, val) {
  var d = DATA[i], id = jobId(d), v = String(val || "").trim().slice(0, 8), reset = !v || v === d.t;
  commit("titles", id, reset ? null : { t: v }, function () { syncAnnouncementPermission(); refreshForms(); spr[i] = makeSprites(d); renderGrid(); openSheet(i, null); }, "#titlepanel .jstatus");
}
function nickEditor(d) {
  return '<div class="jobedit" id="nickpanel" hidden><div class="mlabel">닉네임</div>' +
    '<div class="jrow"><input id="nkin" type="text" maxlength="30" placeholder="닉네임 (7자 이상이면 두 줄로 보여요)" aria-label="닉네임" autocomplete="off">' +
    '<button type="button" class="jsave nksave">저장</button><button type="button" class="nkreset">원래 닉네임으로</button><button type="button" class="jcancel">취소</button></div>' +
    '<div class="jstatus" role="status"></div></div>';
}
function saveNick(i, val) {
  var d = DATA[i], id = jobId(d), v = String(val || "").trim().slice(0, 30), st = document.querySelector("#nickpanel .jstatus"), reset = !v || v === d.bn;
  if (!reset && DATA.some(function (m, j) { return j !== i && m.n === v; })) { if (st) st.textContent = "이미 있는 닉네임이에요."; return; }
  commit("nicks", id, reset ? null : { n: v }, function () { rebuildExternal(false); renderPick(); renderMeets(); if (state.view === "team") renderTeam(); }, "#nickpanel .jstatus");
}
function skillEditor(d) {
  return '<div class="jobedit" id="skillpanel" hidden><div class="mlabel">고유 스킬</div>' +
    '<div class="jrow"><input id="skk" type="text" maxlength="20" placeholder="스킬 이름 (예: 수신동의 관리)" aria-label="스킬 이름"></div>' +
    '<div class="jrow" style="margin-top:8px"><input id="skkd" type="text" maxlength="80" placeholder="스킬 설명 (선택)" aria-label="스킬 설명"></div>' +
    '<div class="jrow" style="margin-top:8px"><input id="skq" type="text" maxlength="40" placeholder="한마디 (선택)" aria-label="한마디"></div>' +
    '<div class="jrow" style="margin-top:8px"><button type="button" class="jsave sksave">저장</button><button type="button" class="skreset">원래대로</button><button type="button" class="jcancel">취소</button></div>' +
    '<div class="jstatus" role="status"></div></div>';
}
function saveSkill(i, reset) {
  var d = DATA[i], id = jobId(d), g = function (x) { return document.getElementById(x).value.trim(); };
  commit("skills", id, reset ? null : { k: g("skk").slice(0, 20), kd: g("skkd").slice(0, 80), q: g("skq").slice(0, 40) }, function () { renderGrid(); openSheet(i, null); }, "#skillpanel .jstatus");
}
function statEditor(d) {
  var h = "";
  statOf(d).forEach(function (v, j) {
    h += '<label class="stl"><span>' + STAT_LABELS[j] + '</span><input type="range" class="strng" min="0" max="100" step="1" data-j="' + j + '" value="' + v + '" aria-label="' + STAT_LABELS[j] + '"><b>' + v + "</b></label>";
  });
  return '<div class="jobedit" id="statpanel" hidden><div class="mlabel">스탯 조정 (0~100)</div>' + h +
    '<div class="jrow"><button type="button" class="jsave stsave">저장</button><button type="button" class="streset">기본값으로</button><button type="button" class="jcancel">취소</button></div>' +
    '<div class="jstatus" role="status"></div></div>';
}
function saveStats(i, arr) {
  var d = DATA[i], same = !arr || arr.every(function (v, j) { return v === d.s[j]; });
  commit("stats", jobId(d), same ? null : { s: arr }, function () { renderGrid(); openSheet(i, null); }, "#statpanel .jstatus");
}
function healthEditor(d) {
  return '<div class="jobedit" id="healthpanel" hidden><div class="mlabel">체력 (0~100)</div>' +
    '<div class="jrow"><input id="healthinput" type="number" min="0" max="100" step="1" value="' + healthOf(d) + '" aria-label="캐릭터 체력 (0~100)">' +
    '<button type="button" class="jsave hpsave">저장</button><button type="button" class="hpreset">기본값</button><button type="button" class="jcancel">취소</button></div>' +
    '<div class="jstatus" role="status"></div></div>';
}
function saveHealth(i, value) {
  var d = DATA[i], number = Number(value);
  if (value !== null && (!Number.isInteger(number) || number < 0 || number > 100)) {
    var status = document.querySelector("#healthpanel .jstatus");
    if (status) status.textContent = "체력은 0부터 100까지 정수로 입력해 주세요.";
    return;
  }
  commit("health", jobId(d), value === null || number === 100 ? null : { value: number }, function () { renderGrid(); openSheet(i, null); }, "#healthpanel .jstatus");
}
function presEditor(d) {
  var active = selectedPresence(d);
  return '<div class="jobedit" id="prespanel" hidden><div class="mlabel">상태 (업무중은 기본 상태 · 점심 60분, 휴식 30분 뒤 복귀)</div>' +
    '<div class="recs"><button type="button" class="pr" data-s="work" aria-pressed="' + (active === "work") + '">업무중</button><button type="button" class="pr" data-s="lunch" aria-pressed="' + (active === "lunch") + '">🍗 점심</button><button type="button" class="pr" data-s="break" aria-pressed="' + (active === "break") + '">☕ 휴식</button><button type="button" class="pr" data-s="away" aria-pressed="' + (active === "away") + '">자리비움</button><button type="button" class="otbtn" aria-pressed="' + (isOT(d) ? "true" : "false") + '">🌙 야근' + (isOT(d) ? " ✓" : "") + '</button></div>' +
    '<div class="jrow"><button type="button" class="jcancel panel-close" aria-label="닫기">✕</button></div><div class="jstatus" role="status"></div></div>';
}
function saveOT(i) {
  var d = DATA[i], on = !isOT(d);
  commit("ot", jobId(d), on ? { d: todayStr(), at: Date.now() } : null, function () { syncMeetings(false); renderGrid(); openSheet(i, null); }, "#prespanel .jstatus");
}
function savePres(i, st) {
  if (["work", "lunch", "break", "away"].indexOf(st) < 0) return;
  commit("pres", jobId(DATA[i]), { s: st, at: Date.now() }, function () { syncMeetings(false); openSheet(i, null); }, "#prespanel .jstatus");
}
function attEditor(d) {
  return '<div class="jobedit" id="attpanel" hidden><div class="mlabel">근태 (연차는 오늘 하루만 적용되고, 내일이면 자동으로 출근으로 돌아와요)</div>' +
    '<div class="recs"><button type="button" class="att" data-a="in" aria-pressed="true">출근</button><button type="button" class="att" data-a="off" aria-pressed="false">연차</button></div>' +
    '<div class="jrow"><button type="button" class="asave">저장</button><button type="button" class="jcancel">취소</button></div>' +
    '<div class="jstatus" role="status"></div></div>';
}
function moveEditor(d) {
  var cur = uOf(d), h = "";
  ["front", "back", "proj"].forEach(function (sd) {
    var b = "";
    Object.keys(UNI).forEach(function (k) {
      var u = UNI[k];
      if (u.hidden || u.side !== sd) return;
      b += '<button type="button" class="mv' + (k === cur ? " cur" : "") + '" data-u="' + k + '" title="' + esc(u.name) + '"' + (k === cur ? " disabled" : "") + ">" + esc(u.realm) + "</button>";
    });
    if (b) h += '<div class="mlabel">' + SIDE[sd].name + '</div><div class="recs">' + b + "</div>";
  });
  return '<div class="jobedit" id="movepanel" hidden><div class="mlabel">전출할 공간</div>' + h +
    '<div class="jrow"><button type="button" class="mreset">원래 구역으로</button><button type="button" class="jcancel">취소</button></div>' +
    '<div class="jstatus" role="status"></div></div>';
}
function seatEditor(d) {
  var cur = deskFor(d), occ = {}, h = "";
  DATA.forEach(function (m) { var sd = deskFor(m); if (sd) occ[sd.idx] = m; });
  SEATS.forEach(function (s) {
    if (s.kind !== "person") {
      h += '<button type="button" class="sw pc" disabled aria-label="임시 사용 PC ' + esc(s.n) + '"><span>PC</span><b>' + esc(s.n) + "</b></button>";
      return;
    }
    var o = occ[s.idx], isCur = !!cur && s.idx === cur.idx;
    var pos = (s.row + 1) + "-" + (s.col + 1), spoken = (s.row + 1) + "행 " + (s.col + 1) + "열";
    h += '<button type="button" class="sw' + (isCur ? " cur" : "") + (o ? " occupied" : " vac") + '" data-s="' + s.idx + '"' + (isCur || o ? " disabled" : "") + ' title="' + spoken + '" aria-label="' + (isCur ? "내 좌석, " : o ? "사용 중, " : "빈 자리, ") + spoken + '">' + (isCur ? "내 자리 " : o ? "점유 " : "") + pos + "</button>";
  });
  return '<div class="jobedit" id="seatpanel" hidden><div class="mlabel">빈 직원 좌석은 여기서 지정하고, FTP·ER 전용 PC는 지도에서 잠시 사용할 수 있어요</div><div class="recs">' + h + "</div>" +
    '<div class="jrow"><button type="button" class="sreset">자리 비우기</button><button type="button" class="jcancel panel-close" aria-label="닫기">✕</button></div>' +
    '<div class="jstatus" role="status"></div></div>';
}
/* 7열 시절에 저장된 좌석 번호를 8열 번호로 옮겨요(g:8 표시가 없는 문서만) */
function legacySeat(v) {
  if (!v || typeof v !== "object" || v.g === GRID) return v;
  function mv(n) { return typeof n === "number" && n >= 0 ? Math.floor(n / 7) * GRID + n % 7 : n; }
  var o = {}, k;
  for (k in v) o[k] = v[k];
  if (v.m && typeof v.m === "object") { o.m = {}; for (k in v.m) o.m[k] = mv(v.m[k]); }
  if (typeof v.s === "number") o.s = mv(v.s);
  if (typeof v.pc === "number") o.pc = mv(v.pc);
  return o;
}
function saveSeat(i, tIdx, keepSheet) {
  var d = DATA[i], cur = deskFor(d), target = typeof tIdx === "number" ? SEATS[tIdx] : null;
  if (!d || (tIdx !== null && (!target || target.kind !== "person")) || (cur && cur.idx === tIdx)) return;
  if (target && DATA.some(function (m) { var sd = deskFor(m); return m !== d && sd && sd.idx === target.idx; })) {
    var status = document.querySelector("#seatpanel .jstatus");
    if (status) status.textContent = "이미 다른 캐릭터가 선택한 자리예요.";
    else if (target.kind === "pc") window.alert("이 PC는 이미 다른 캐릭터가 사용 중입니다.");
    return;
  }
  if (target && WORLD_THEME === "office" && !window.confirm((target.row + 1) + "행 " + (target.col + 1) + "열 자리를 지정하시겠습니까?")) return;
  commit("seats", jobId(d), { override: true, g: GRID, s: target ? target.idx : null, pc: null }, function () { applySeats(false); syncIntruders(false); if (keepSheet !== false) openSheet(i, null); }, "#seatpanel .jstatus");
}
function resetSeat(i) {
  if (!deskFor(DATA[i])) { hideEditor(); return; }
  saveSeat(i, null);
}
function pcUseOf(d) {
  var seatState = store.seats[jobId(d)], index = seatState && seatState.pc;
  return typeof index === "number" && SEATS[index] && SEATS[index].kind === "pc" ? SEATS[index] : null;
}
function setPcUse(i, seatIdx) {
  var d = DATA[i], target = typeof seatIdx === "number" ? SEATS[seatIdx] : null, curPc = pcUseOf(d), assigned = deskFor(d), nextPc;
  if (!d || target && target.kind !== "pc") return;
  nextPc = target && curPc && curPc.idx === target.idx ? null : target;
  if (nextPc && DATA.some(function (m) { return m !== d && pcUseOf(m) && pcUseOf(m).idx === nextPc.idx; })) {
    window.alert(nextPc.n.toUpperCase() + " 전용 PC는 현재 다른 캐릭터가 사용 중입니다.");
    return;
  }
  if (nextPc && WORLD_THEME === "office" && !window.confirm(nextPc.n.toUpperCase() + " 전용 PC를 잠시 사용하시겠습니까?")) return;
  commit("seats", jobId(d), {
    override: true,
    g: GRID,
    s: assigned && assigned.kind === "person" ? assigned.idx : null,
    pc: nextPc ? nextPc.idx : null
  }, function () {
    applySeats(false);
    syncMeetings(false);
  }, null);
}
function attMode() { var b = document.querySelector("#attpanel .att[aria-pressed=true]"); return b ? b.dataset.a : "in"; }
function setAtt(a) {
  var bs = document.querySelectorAll("#attpanel .att"), k;
  for (k = 0; k < bs.length; k++) bs[k].setAttribute("aria-pressed", String(bs[k].dataset.a === a));
}
function syncAtt(d) { setAtt(onLeave(d) ? "off" : "in"); }
function denied(sel) {
  var st = document.querySelector(sel);
  if (st) st.textContent = "저장하지 못했어요. 이 페이지를 편집할 수 있는 권한(Contributor 이상)이 필요할 수 있어요.";
}
function saveLeave(i, on) {
  var d = DATA[i], id = jobId(d), from = todayStr(), to = from;
  if (on && leaves[id] && onLeave(d)) { openSheet(i, null); return; }
  function ok() { if (on) leaves[id] = { from: from, to: to }; else delete leaves[id]; renderGrid(); syncMeetings(false); openSheet(i, null); }
  if (dbRef) {
    var ref = dbRef.doc("status/" + id);
    (on ? ref.set({ from: from, to: to }) : ref.delete()).then(ok, function () { denied("#attpanel .jstatus"); });
  } else {
    ok();
    try { localStorage.setItem("ops-status", JSON.stringify(leaves)); } catch (e) {}
  }
}
function saveMove(i, unit) {
  var d = DATA[i], id = jobId(d), reset = !unit || unit === d.u;
  function ok() { if (reset) delete moves[id]; else moves[id] = unit; applyMoves(false); syncIntruders(false); renderPortals(); renderGrid(); openSheet(i, null); }
  if (dbRef) {
    var ref = dbRef.doc("moves/" + id);
    (reset ? ref.delete() : ref.set({ u: unit })).then(ok, function () { denied("#movepanel .jstatus"); });
  } else {
    ok();
    try { localStorage.setItem("ops-moves", JSON.stringify(moves)); } catch (e) {}
  }
}

function commit(col, id, data, ok, errSel) {
  function apply() { if (data == null) delete store[col][id]; else store[col][id] = data; if (ok) ok(); }
  if (dbRef) {
    var ref = dbRef.doc(col + "/" + id);
    (data == null ? ref.delete() : ref.set(data)).then(apply, function () { denied(errSel); });
  } else {
    apply();
    try { localStorage.setItem("ops-" + col, JSON.stringify(store[col])); } catch (e) {}
  }
}
function renderTasks() {
  var box = document.getElementById("tlist");
  if (!box || openIdx === null || !DATA[openIdx]) return;
  var today = todayStr(), items = tasksOf(DATA[openIdx]), open = items.filter(function (x) { return !taskDone(x, today); }), done = items.filter(function (x) { return taskDone(x, today); }), can = canEditCharacter(DATA[openIdx]), h = "";
  open.concat(done).forEach(function (x) {
    var fin = taskDone(x, today), due = typeof x.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.due) ? '<span class="tdue" title="마감 기한">~' + md(x.due) + "</span>" : "";
    h += '<li class="ti' + (fin ? " done" : "") + '"><label><input type="checkbox" class="tchk" data-t="' + esc(x.i) + '"' + (fin ? " checked" : "") + (can ? "" : " disabled") + "><span>" + esc(x.t) + "</span>" + due + "</label>" +
      (can ? '<button type="button" class="tdel" data-t="' + esc(x.i) + '" aria-label="업무 삭제">✕</button>' : "") + "</li>";
  });
  box.innerHTML = h || '<li class="tempty">등록된 업무가 없어요.</li>';
  document.getElementById("tcount").textContent = open.length ? "침입자 " + open.length + "마리" : (items.length ? "모두 처리했어요" : "");
}
function saveTasks(d, items, cb) {
  commit("tasks", jobId(d), items.length ? { items: items } : null, function () { renderTasks(); syncIntruders(false); renderGrid(); if (cb) cb(); }, "#tstatus");
}
var dueSaving = {};
function autoCompleteDue() {
  var today = todayStr();
  DATA.forEach(function (d) {
    var id = jobId(d), items, changed;
    if (dueSaving[id] || !canEditCharacter(d)) return;
    items = tasksOf(d);
    changed = items.some(function (x) { return !x.d && typeof x.due === "string" && x.due < today; });
    if (!changed) return;
    dueSaving[id] = true;
    saveTasks(d, items.map(function (x) { return !x.d && typeof x.due === "string" && x.due < today ? { i: x.i, t: x.t, d: true, due: x.due } : x; }), function () { delete dueSaving[id]; });
    setTimeout(function () { delete dueSaving[id]; }, 8000);
  });
}
function addTask(text) {
  var d = DATA[openIdx], t = String(text || "").trim().slice(0, 60), items = tasksOf(d), st = document.getElementById("tstatus");
  if (!t) { st.textContent = "업무 내용을 적어주세요."; return; }
  if (items.length >= 30) { st.textContent = "업무는 한 사람당 30개까지 적을 수 있어요. 끝난 업무를 지워주세요."; return; }
  st.textContent = "";
  var dueEl = document.getElementById("tdue"), due = dueEl && /^\d{4}-\d{2}-\d{2}$/.test(dueEl.value) ? dueEl.value : "", item = { i: newId("t"), t: t, d: false };
  if (due && due < todayStr()) { st.textContent = "마감 기한은 오늘 이후 날짜로 정해 주세요."; return; }
  if (due) item.due = due;
  saveTasks(d, items.concat([item]), function () { var inp = document.getElementById("tin"); if (inp) { inp.value = ""; inp.focus(); } if (dueEl) dueEl.value = ""; });
}
function toggleTask(tid, done) {
  var d = DATA[openIdx];
  var today = todayStr(), cleared = false, st = document.getElementById("tstatus");
  saveTasks(d, tasksOf(d).map(function (x) {
    if (x.i !== tid) return x;
    var next = { i: x.i, t: x.t, d: !!done };
    if (x.due && (done || x.due >= today)) next.due = x.due;
    else if (x.due) cleared = true;
    return next;
  }), function () { if (cleared && st) st.textContent = "기한이 지난 업무라 마감 기한을 지웠어요."; });
}
function delTask(tid) {
  var d = DATA[openIdx];
  saveTasks(d, tasksOf(d).filter(function (x) { return x.i !== tid; }));
}

function visible() {
  var q = state.q.trim().toLowerCase();
  var list = DATA.filter(function (d) {
    if (state.side && UNI[uOf(d)].side !== state.side) return false;
    if (state.uni && uOf(d) !== state.uni) return false;
    if (!q) return true;
    return (d.n + " " + ttl(d) + " " + job(d) + " " + skl(d).k + " " + skl(d).kd + " " + UNI[uOf(d)].name + " " + SIDE[UNI[uOf(d)].side].name).toLowerCase().indexOf(q) >= 0;
  });
  list.sort(function (a, b) {
    if (state.sort === "name") return a.n.localeCompare(b.n, "ko");
    if (state.sort === "pow") return power(b) - power(a);
    return levelOf(b) - levelOf(a);
  });
  return list;
}

var FOODS = ["과자", "커피", "과일", "빵", "도넛", "아이스크림", "음료수", "김밥", "떡", "초콜릿"];
function snackNow() {
  var t = todayStr(), out = {};
  Object.keys(store.snacks).forEach(function (id) {
    var s = store.snacks[id];
    if (!s || !UNI[s.u] || UNI[s.u].hidden || typeof s.from !== "string" || typeof s.to !== "string" || s.from > t || t > s.to) return;
    var o = out[s.u] || (out[s.u] = { items: [], to: s.to });
    if (s.to > o.to) o.to = s.to;
    (Array.isArray(s.items) ? s.items : []).forEach(function (it) { it = String(it); if (o.items.indexOf(it) < 0 && o.items.length < 6) o.items.push(it); });
  });
  return out;
}

function renderPortals() {
  var html = "", sn = snackNow();
  Object.keys(UNI).forEach(function (k) {
    var u = UNI[k];
    if (u.hidden || (state.side && u.side !== state.side)) return;
    var n = DATA.filter(function (d) { return uOf(d) === k; }).length;
    if (!n && state.uni !== k) return;
    html += '<button type="button" class="portal" data-u="' + k + '" style="--c:' + u.color + '" aria-pressed="' + (state.uni === k) + '">' +
      '<span class="realm">' + esc(SIDE[u.side].name) + '</span><span class="pname">' + esc(u.name) + '</span>' +
      '<span class="pdesc">' + esc(u.desc) + '</span>' + (sn[k] ? '<span class="snk">🍪 간식 당번 · ~' + md(sn[k].to) + " · " + esc(sn[k].items.join(", ")) + "</span>" : "") + '<span class="pcount">' + n + '명' + (invCount[k] ? '<span class="inv">침입 ' + invCount[k] + "</span>" : "") + "</span></button>";
  });
  document.getElementById("portals").innerHTML = html;
  document.getElementById("all").setAttribute("aria-pressed", String(!state.uni));
  renderSides();
  var lg = '<span class="lg"><i style="background:var(--lead);box-shadow:0 0 6px var(--lead)"></i><b class="lead-note">팀장·상무</b></span>';
  Object.keys(UNI).forEach(function (k) { var u = UNI[k]; if (!u.hidden && DATA.some(function (d) { return uOf(d) === k; })) lg += '<span class="lg"><i style="background:' + u.color + '"></i>' + esc(u.realm) + "</span>"; });
  document.getElementById("legend").innerHTML = lg;
}

function renderSides() {
  var opts = [[null, "전체"], ["front", SIDE.front.name], ["back", SIDE.back.name]], html = "";
  if (PSLOTS.some(function (k) { return store.projects[k]; })) opts.push(["proj", SIDE.proj.name]);
  opts.forEach(function (o) {
    var n = o[0] ? DATA.filter(function (d) { return UNI[uOf(d)].side === o[0]; }).length : DATA.length;
    if (o[0] && !n && state.side !== o[0]) return;
    html += '<button type="button" class="side" data-s="' + (o[0] || "") + '" aria-pressed="' + (state.side === o[0]) + '">' + o[1] + "<b>" + n + "명</b></button>";
  });
  document.getElementById("sides").innerHTML = html;
}

function renderGrid() {
  var list = visible(), html = "";
  mapSet = {}; list.forEach(function (d) { mapSet[jobId(d)] = 1; }); mapFilt = list.length !== DATA.length;
  var today = todayStr();
  list.forEach(function (d) {
    var u = UNI[uOf(d)], level = levelOf(d), rr = rarity(level), p = power(d), off = onLeave(d, today), nt = openTasks(d).length;
    html += '<button type="button" class="card ' + rr[2] + (off ? " off" : "") + '" data-i="' + DATA.indexOf(d) + '" style="--c:' + u.color + ";--rar:" + rr[1] + '">' +
      '<div class="art' + (off ? " off" : "") + '" style="color:' + u.color + '">' + sprite(d) + '<span class="lv">Lv.' + level + '</span><span class="rar">' + rr[0] + "</span>" + (off ? '<span class="leavetag">' + esc(offLabel(d)) + "</span>" : "") + (nt ? '<span class="tbadge">침입 ' + nt + "</span>" : "") + "</div>" +
      '<div class="cname">' + nameHtml(d.n) + '</div><div class="cclass">' + esc(tline(d)) + esc(job(d)) + "</div>" +
      '<div class="pow"><span>전투력</span><span class="bar"><i style="width:' + Math.round(p / 5) + '%"></i></span><span>' + p + "</span></div></button>";
  });
  document.getElementById("grid").innerHTML = html || '<div class="empty">' + (WORLD_THEME === "office" ? "찾는 직원이 없어요. 검색어를 바꿔보세요." : "찾는 영웅이 없어요. 검색어를 바꿔보세요.") + "</div>";
  document.getElementById("count").textContent = list.length + " / " + DATA.length + "명";
}

function openSheet(i, opener) {
  var d = DATA[i], u = UNI[uOf(d)], level = levelOf(d), rr = rarity(level), off = onLeave(d), sheet = document.getElementById("sheet"), canEdit = canEditCharacter(d);
  if (opener) lastFocus = opener;
  var stats = "";
  statOf(d).forEach(function (v, j) { stats += '<div class="stat"><span>' + STAT_LABELS[j] + '</span><span class="bar"><i style="width:' + v + '%"></i></span><b>' + v + "</b></div>"; });
  var mates = "";
  DATA.forEach(function (m, j) { if (uOf(m) === uOf(d) && j !== i) mates += '<button type="button" data-i="' + j + '">' + esc(m.n) + "</button>"; });
  sheet.style.setProperty("--c", u.color);
  sheet.innerHTML =
    '<button type="button" class="close" aria-label="닫기">✕</button>' +
    '<div><div class="art' + (off ? " off" : "") + '" style="color:' + u.color + '">' + sprite(d) + '<span class="lv">Lv.' + level + '</span><span class="rar" style="--rar:' + rr[1] + '">' + rr[0] + "</span>" + (off ? '<span class="leavetag">' + esc(offLabel(d)) + "</span>" : "") + "</div></div>" +
    "<div>" +
    '<h2 class="sname" id="sname">' + nameHtml(d.n) + "</h2>" +
    '<div class="smeta"><span>' + esc(tline(d)) + '<b class="jobname">' + esc(job(d)) + "</b> · " + esc(u.realm) + "</span>" +
    "</div>" +
    (canEdit ? '<div class="sedit" role="group" aria-label="캐릭터 편집">' +
      '<div class="eg"><span class="egl">프로필</span><button type="button" class="mini editnick">닉네임</button><button type="button" class="mini editjob">직업</button><button type="button" class="mini edittitle">직급</button><button type="button" class="mini editskill">스킬</button><button type="button" class="mini editstat">스탯</button><button type="button" class="mini edithp">체력</button></div>' +
      '<div class="eg"><span class="egl">근무</span>' + (d.off ? "" : '<button type="button" class="mini editatt">근태</button>') + '<button type="button" class="mini editpres">상태</button><button type="button" class="mini editseat">자리</button></div>' +
      (d.ext ? "" : '<div class="eg"><span class="egl">소속</span><button type="button" class="mini editmove">전출</button></div>') + "</div>" : "") +
    '<div class="attline' + (off ? " off" : "") + '">근태 · ' + esc(attText(d)) + "</div>" +
    (snackNow()[uOf(d)] ? '<div class="snkline">🍪 우리 팀 간식 당번 · ~' + md(snackNow()[uOf(d)].to) + " · " + esc(snackNow()[uOf(d)].items.join(", ")) + "</div>" : "") +
    (canEdit ? jobEditor(d) + nickEditor(d) + titleEditor(d) + skillEditor(d) + statEditor(d) + healthEditor(d) + presEditor(d) + attEditor(d) + (d.ext ? "" : moveEditor(d)) + seatEditor(d) : "") +
    '<div class="tasks"><div class="mlabel">맡은 업무<b id="tcount"></b></div><ul class="tlist" id="tlist"></ul>' +
    (canEdit ? '<div class="jrow"><input id="tin" type="text" maxlength="60" placeholder="업무 추가 (Enter)" aria-label="업무 내용"><input id="tdue" class="tdue-in" type="date" min="' + todayStr() + '" aria-label="마감 기한 (선택)" title="마감 기한 (선택)"><button type="button" class="tadd">추가</button></div>' : "") +
    '<div class="jstatus" id="tstatus" role="status"></div></div>' +
    '<div class="stats">' + stats + "</div>" +
    (skl(d).k ? '<div class="skill"><div class="sl">고유 스킬</div><div class="sk">' + esc(skl(d).k) + "</div>" + (skl(d).kd ? "<p>" + esc(skl(d).kd) + "</p>" : "") + "</div>" : "") +
    (skl(d).q ? '<p class="quote">“' + esc(skl(d).q) + "”</p>" : "") +
    (mates ? '<div class="mlabel">같은 유니버스 동료</div><div class="mates">' + mates + "</div>" : "") +
    "</div>";
  var veil = document.getElementById("veil");
  openIdx = i;
  renderTasks();
  veil.hidden = false;
  document.documentElement.style.overflow = "hidden";
  sheet.querySelector(".close").focus();
}
function closeSheet() {
  openIdx = null;
  document.getElementById("veil").hidden = true;
  document.documentElement.style.overflow = "";
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

document.getElementById("portals").addEventListener("click", function (e) {
  var b = e.target.closest(".portal"); if (!b) return;
  state.uni = state.uni === b.dataset.u ? null : b.dataset.u;
  renderPortals(); renderGrid();
});
document.getElementById("sides").addEventListener("click", function (e) {
  var b = e.target.closest(".side"); if (!b) return;
  state.side = b.dataset.s || null;
  if (state.uni && state.side && UNI[state.uni].side !== state.side) state.uni = null;
  renderPortals(); renderGrid();
});
document.getElementById("all").addEventListener("click", function () { state.uni = null; renderPortals(); renderGrid(); });
document.getElementById("q").addEventListener("input", function (e) { state.q = e.target.value; renderGrid(); });
document.getElementById("sort").addEventListener("change", function (e) { state.sort = e.target.value; renderGrid(); });
document.getElementById("grid").addEventListener("click", function (e) {
  var c = e.target.closest(".card"); if (c) openSheet(+c.dataset.i, c);
});
document.getElementById("veil").addEventListener("click", function (e) {
  if (e.target.id === "veil" || e.target.closest(".close")) { closeSheet(); return; }
  var inp = document.getElementById("jobin");
  if (e.target.closest(".editjob")) {
    var ed = showPanel("jobpanel");
    if (!ed.hidden) {
      inp.value = job(DATA[openIdx]);
      ed.querySelector(".jstatus").textContent = dbRef ? "" : "지금은 이 화면에서만 바뀌고, 다른 팀원에게는 보이지 않아요.";
      inp.focus(); inp.select();
    }
    return;
  }
  if (e.target.closest(".edittitle")) { var tp = showPanel("titlepanel"); if (!tp.hidden) { var ti = document.getElementById("titin"); ti.value = ttl(DATA[openIdx]); ti.focus(); ti.select(); } return; }
  var trc = e.target.closest(".trec"); if (trc) { document.getElementById("titin").value = trc.textContent; return; }
  if (e.target.closest(".tisave")) { saveTitle(openIdx, document.getElementById("titin").value); return; }
  if (e.target.closest(".tireset")) { saveTitle(openIdx, ""); return; }
  if (e.target.closest(".editnick")) { var np = showPanel("nickpanel"); if (!np.hidden) { var ni2 = document.getElementById("nkin"); ni2.value = DATA[openIdx].n; ni2.focus(); ni2.select(); } return; }
  if (e.target.closest(".nksave")) { saveNick(openIdx, document.getElementById("nkin").value); return; }
  if (e.target.closest(".nkreset")) { saveNick(openIdx, ""); return; }
  if (e.target.closest(".editskill")) { var sp = showPanel("skillpanel"); if (!sp.hidden) { var sk = skl(DATA[openIdx]); document.getElementById("skk").value = sk.k; document.getElementById("skkd").value = sk.kd; document.getElementById("skq").value = sk.q; document.getElementById("skk").focus(); } return; }
  if (e.target.closest(".sksave")) { saveSkill(openIdx, false); return; }
  if (e.target.closest(".skreset")) { saveSkill(openIdx, true); return; }
  if (e.target.closest(".editstat")) { showPanel("statpanel"); return; }
  if (e.target.closest(".edithp")) { var hp = showPanel("healthpanel"); if (!hp.hidden) { document.getElementById("healthinput").value = healthOf(DATA[openIdx]); document.getElementById("healthinput").focus(); } return; }
  if (e.target.closest(".editpres")) { showPanel("prespanel"); return; }
  if (e.target.closest(".otbtn")) { saveOT(openIdx); return; }
  var prb = e.target.closest(".pr"); if (prb) { savePres(openIdx, prb.dataset.s); return; }
  if (e.target.closest(".stsave")) {
    var rs = document.querySelectorAll("#statpanel .strng"), arr = [], k2;
    for (k2 = 0; k2 < rs.length; k2++) arr.push(+rs[k2].value);
    saveStats(openIdx, arr); return;
  }
  if (e.target.closest(".streset")) { saveStats(openIdx, null); return; }
  if (e.target.closest(".hpsave")) { saveHealth(openIdx, document.getElementById("healthinput").value); return; }
  if (e.target.closest(".hpreset")) { saveHealth(openIdx, null); return; }
  if (e.target.closest(".editatt")) { var ep = showPanel("attpanel"); if (!ep.hidden) syncAtt(DATA[openIdx]); return; }
  if (e.target.closest(".editmove")) { showPanel("movepanel"); return; }
  if (e.target.closest(".editseat")) { showPanel("seatpanel"); return; }
  var swb = e.target.closest(".sw"); if (swb) { if (!swb.disabled) saveSeat(openIdx, +swb.dataset.s); return; }
  if (e.target.closest(".sreset")) { resetSeat(openIdx); return; }
  var ab = e.target.closest(".att");
  if (ab) { setAtt(ab.dataset.a); return; }
  if (e.target.closest(".asave")) { saveLeave(openIdx, attMode() === "off"); return; }
  var mvb = e.target.closest(".mv");
  if (mvb && !mvb.disabled) { saveMove(openIdx, mvb.dataset.u); return; }
  if (e.target.closest(".mreset")) { saveMove(openIdx, ""); return; }
  var rc = e.target.closest(".rec");
  if (rc) { inp.value = rc.textContent; inp.focus(); return; }
  if (e.target.closest(".jsave")) { saveJob(openIdx, inp.value); return; }
  if (e.target.closest(".jreset")) { saveJob(openIdx, ""); return; }
  if (e.target.closest(".jcancel")) { hideEditor(); return; }
  if (e.target.closest(".tadd")) { addTask(document.getElementById("tin").value); return; }
  var tdl = e.target.closest(".tdel"); if (tdl) { delTask(tdl.dataset.t); return; }
  var m = e.target.closest(".mates button"); if (m) openSheet(+m.dataset.i, null);
});
document.getElementById("veil").addEventListener("input", function (e) {
  if (e.target.classList && e.target.classList.contains("strng")) e.target.nextElementSibling.textContent = e.target.value;
});
document.getElementById("veil").addEventListener("change", function (e) {
  if (e.target.classList && e.target.classList.contains("tchk") && openIdx !== null) toggleTask(e.target.dataset.t, e.target.checked);
});
document.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && e.target.id === "jobin" && openIdx !== null) { e.preventDefault(); saveJob(openIdx, e.target.value); return; }
  if (e.key === "Enter" && !e.isComposing && e.target.id === "nkin" && openIdx !== null) { e.preventDefault(); saveNick(openIdx, e.target.value); return; }
  if (e.key === "Enter" && !e.isComposing && (e.target.id === "skk" || e.target.id === "skkd" || e.target.id === "skq") && openIdx !== null) { e.preventDefault(); saveSkill(openIdx, false); return; }
  if (e.key === "Enter" && e.target.id === "titin" && openIdx !== null) { e.preventDefault(); saveTitle(openIdx, e.target.value); return; }
  if (e.key === "Enter" && e.target.id === "tin" && openIdx !== null) { e.preventDefault(); addTask(e.target.value); return; }
  if (e.key === "Escape" && !document.getElementById("veil").hidden) closeSheet();
});

document.getElementById("total").textContent = DATA.length;
renderPortals();
renderGrid();

