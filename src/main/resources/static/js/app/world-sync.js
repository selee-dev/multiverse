/* 침입자와 회의 좌석 동기화 */
/* ---- 침입자: 팀원이 맡은 미완료 업무 하나당 한 마리, 담당자 뒤를 졸졸 따라다녀요 ---- */
var pidCount = {};
function boxFor(pid) {
  var i = indexOfId(pid), wk;
  if (i < 0 || !(wk = walkers[i])) return null;
  if (wk.hd) return { x0: wk.hd.cx - 50, x1: wk.hd.cx + 50 - IW, y0: wk.hd.ry + 54, y1: wk.hd.ry + 88 };
  return wk.a ? (REGIONS[wk.u] ? iAreaOf(wk.u) : { x0: wk.a.x0, x1: wk.a.x1 + CW - IW, y0: wk.a.y0, y1: wk.a.y1 + CH - IH }) : null;
}
function syncIntruders(initial) {
  var want = {}, byKey = {}, counts = {}, pc = {};
  DATA.forEach(function (d) {
    var id = jobId(d), u = uOf(d);
    openTasks(d).forEach(function (t) { want[id + ":" + t.i] = { pid: id, u: u, text: t.t }; counts[u] = (counts[u] || 0) + 1; pc[id] = (pc[id] || 0) + 1; });
  });
  intr.forEach(function (o) { byKey[o.key] = o; });
  Object.keys(want).forEach(function (key) {
    var w = want[key], o = byKey[key], bx = boxFor(w.pid), bk = bx ? [bx.x0, bx.x1, bx.y0, bx.y1].join() : "";
    if (!bx) return;
    if (o) {
      o.die = null; o.text = w.text; o.pid = w.pid; o.u = w.u; o.box = bx;
      if (o.bk !== bk) { var q = randIn(bx); o.bk = bk; o.x = q[0]; o.y = q[1]; o.tx = q[0]; o.ty = q[1]; }
    } else {
      var p = randIn(bx);
      intr.push({ key: key, pid: w.pid, text: w.text, u: w.u, box: bx, bk: bk, x: p[0], y: p[1], tx: p[0], ty: p[1], wait: Math.random() * 1.5, speed: 14 + Math.random() * 12, a: initial || reduceMotion ? 1 : 0, die: null, k: Math.random() < 0.5 ? 0 : 1, shown: true });
    }
  });
  intr.forEach(function (o) { if (!want[o.key] && o.die == null) o.die = 0.5; });
  if (reduceMotion) intr = intr.filter(function (o) { return o.die == null; });
  invCount = counts; pidCount = pc;
  renderPortals();
}

/* ---- 회의: 회의실 테이블에 둘러앉기 ---- */
var seatInfo = {};
function meetingList() {
  return Object.keys(store.meetings).map(function (id) {
    var m = store.meetings[id];
    return m && typeof m.t === "string" ? { id: id, t: m.t, m: Array.isArray(m.m) ? m.m.filter(function (x) { return typeof x === "string"; }) : [], on: !!m.on, at: +m.at || 0 } : null;
  }).filter(Boolean).sort(function (a, b) { return a.at - b.at; });
}
function inActiveMeeting(d) {
  var id = jobId(d);
  return meetingList().some(function (m) { return m.on && m.m.indexOf(id) >= 0; });
}
function computeSeats() {
  var byId = {}, taken = {}, out = {}, today = todayStr();
  DATA.forEach(function (d) { byId[jobId(d)] = d; });
  seatInfo = {};
  meetingList().filter(function (m) { return m.on; }).slice(0, 3).forEach(function (m, k) {
    var ids = [];
    m.m.forEach(function (id) { var d = byId[id]; if (d && !taken[id] && !onLeave(d, today) && !isGone(d, Date.now()) && ids.length < 8) { taken[id] = 1; ids.push(id); } });
    var c = TABLES[k], n = ids.length;
    ids.forEach(function (id, j) {
      var th = -Math.PI / 2 + 2 * Math.PI * j / n;
      out[id] = { k: k, x: Math.round(c.x + 46 * Math.cos(th) - CW / 2), y: Math.round(c.y + 34 * Math.sin(th) - 20) };
    });
    seatInfo[k] = { t: m.t, n: n };
  });
  return out;
}
function syncMeetings(initial) {
  var seats = WORLD_THEME === "plaza" ? {} : computeSeats(), today = todayStr(), now = Date.now(), lunchers = [];
  if (WORLD_THEME === "battlefield") walkers.forEach(function (w) { var d0 = DATA[w.i]; if (!seats[w.id] && !onLeave(d0, today) && !isGone(d0, now) && presenceOf(d0, now) === "lunch") lunchers.push(w.id); });
  lunchers.sort(); LUNCH.n = lunchers.length;
  walkers.forEach(function (w) {
    var d = DATA[w.i], s = seats[w.id], pc = pcUseOf(d), mode, tag = "", key, quick = initial || !autoMoveOn || w.mode === "gone", sp, h, t2, prev = w.mode, hold = posOf(w);
    if (onLeave(d, today)) mode = "leave";
    else if (isGone(d, now)) mode = "gone";
    else if (s) mode = "meet";
    else if (WORLD_THEME === "office" && pc) mode = "pc";
    else { tag = presenceOf(d, now); mode = tag ? "away" : "desk"; }
    key = WORLD_THEME + ":" + mode + ":" + (mode === "meet" ? s.k + ":" + s.x + ":" + s.y : mode === "pc" ? pc.idx : "") + tag + (shouldSitAtDesk(d, now) ? ":working" : ":off-desk") + (mode === "away" && tag === "lunch" ? ":" + lunchers.indexOf(w.id) + "/" + lunchers.length : "");
    if (w.pkey === key) return;
    var prevKey = w.pkey; w.pkey = key; w.mode = mode; w.tag = tag; w.seat = mode === "meet" ? s : null; w.pc = mode === "pc" ? pc : null;
    if (!autoMoveOn && hold && (mode === "desk" || mode === "away")) { if (prev === "meet" || prev === "pc") jump(w, [hold.x, hold.y]); return; }
    if (mode === "gone") { w.route = []; w.moving = false; w.seat = null; }
    else if (mode === "leave") { sp = leaveSpot(w); w.route = []; w.moving = false; w.x = sp[0]; w.y = sp[1]; w.tx = w.x; w.ty = w.y; }
    else if (mode === "meet") { if (quick) jump(w, [s.x, s.y]); else goTo(w, [s.x, s.y]); }
    else if (mode === "pc") { t2 = [pc.x, pc.y]; if (quick) jump(w, t2); else goTo(w, t2); }
    else if (mode === "away" && tag === "lunch" && WORLD_THEME !== "battlefield") {
      /* 사무실: 자리로 돌아가 앉기, 광장: 전장에서 모여 있던 위치였다면 흩어지고 아니면 그 자리 유지 */
      if (WORLD_THEME === "office" && w.hd && shouldSitAtDesk(d, now)) { h = homeDest(w); if (quick) jump(w, h); else goTo(w, h); }
      else if (/^battlefield:/.test(String(prevKey))) { h = homeDest(w); jump(w, h); }
      else { w.route = []; w.moving = false; }
    }
    else if (mode === "away") { t2 = tag === "lunch" && WORLD_THEME === "battlefield" ? lunchSpot(lunchers.indexOf(w.id), lunchers.length) : awayDest(); if (quick) jump(w, t2); else goTo(w, t2); }
    else { h = homeDest(w); if (quick) jump(w, h); else goTo(w, h); }
  });
  if (typeof updateOT === "function") updateOT();
}

