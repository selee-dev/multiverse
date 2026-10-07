/* 방향키 이동, 위치 공유, 걷기 갱신(update) */
/* ---- 방향키 이동 · 위치 공유(pos) · 자동 이동 토글 · 건물 입장 ---- */
var autoMoveOn = false, posLoaded = false;
try { autoMoveOn = localStorage.getItem("ops-automove") === "on"; } catch (e) {}
var POS_LIVE_MS = 8000, POS_TTL_MS = 12 * 3600 * 1000, KEY_SPEED = 120, POS_SEND_MS = 400, SHOP_COOLDOWN_MS = 1500;
var keys = { up: false, down: false, left: false, right: false }, posSeen = {}, posSentAt = 0, nearShop = null, shopOpenAt = 0, shopNotice = "", shopNoticeAt = 0;
function ownWalker() { var i = currentCharacterIndex(); return i >= 0 ? walkers[i] || null : null; }
function posOf(w) {
  var p = store.pos && store.pos[w.id];
  return p && p.w === WORLD_THEME && typeof p.x === "number" && typeof p.y === "number" && Date.now() - (+p.t || 0) < POS_TTL_MS ? p : null;
}
function posLive(id) { var seen = posSeen[id]; return !!seen && Date.now() - seen.at < POS_LIVE_MS; }
function sendPos(w) {
  var doc = { x: Math.round(w.x), y: Math.round(w.y), t: Date.now(), w: WORLD_THEME };
  store.pos[w.id] = doc; w.posT = doc.t; posSentAt = doc.t; posSeen[w.id] = { t: doc.t, at: doc.t };
  if (dbRef) dbRef.sendPos(w.id, doc.x, doc.y, doc.w);   // WebSocket 위치 채널(DB 저장 없음)
  else { try { localStorage.setItem("ops-pos", JSON.stringify(store.pos)); } catch (e) {} }
}
function inSeatArea(w) {
  var h = w.hd, cx = w.x + CW / 2, cy = w.y + CH / 2;
  return !!h && h.kind === "person" && cx >= h.cx - 42 && cx <= h.cx + 42 && cy >= h.ry - 8 && cy <= h.ry + 66;
}
function keyMove(w, dt) {
  if (inActiveMeeting(DATA[w.i])) keys.up = keys.down = keys.left = keys.right = false;   // 회의 중에는 종료될 때까지 방향키 이동 차단
  var dx =(keys.right ? 1 : 0) - (keys.left ? 1 : 0), dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0), len, step, nx, ny, inSeat;
  if (!dx && !dy) {
    w.seatHold = false;
    if (w.keyOn) { w.keyOn = false; w.moving = false; sendPos(w); }
    return false;
  }
  if (w.seatHold) { w.moving = false; w.keyAt = Date.now(); return true; }
  if (!w.keyOn) w.inSeat = inSeatArea(w);
  len = Math.hypot(dx, dy); step = KEY_SPEED * Math.min(dt, 0.05);
  nx = Math.max(0, Math.min(MAP_W - CW, w.x + dx / len * step));
  ny = Math.max(0, Math.min(MAP_H - CH, w.y + dy / len * step));
  if (WORLD_THEME !== "plaza" || !plazaBlocked(nx, ny)) { w.x = nx; w.y = ny; }
  else if (!plazaBlocked(nx, w.y)) w.x = nx;
  else if (!plazaBlocked(w.x, ny)) w.y = ny;
  w.route = []; w.tx = w.x; w.ty = w.y; w.moving = true; w.anim += dt; w.keyOn = true; w.keyAt = Date.now();
  if (WORLD_THEME === "office" && w.mode === "desk") {
    inSeat = inSeatArea(w);
    if (inSeat && !w.inSeat) {
      w.x = w.hd.x; w.y = w.hd.y; w.tx = w.x; w.ty = w.y; w.moving = false; w.inSeat = true; w.seatHold = true;
      sendPos(w);
      return true;
    }
    w.inSeat = inSeat;
  }
  if (w.keyAt - posSentAt > POS_SEND_MS) sendPos(w);
  return true;
}
function followPos(w, p, dt) {
  var dx = p.x - w.x, dy = p.y - w.y, d = Math.hypot(dx, dy), step = 170 * dt;
  w.route = []; w.posT = p.t;
  if (d > 260 || d <= step) { w.x = p.x; w.y = p.y; w.moving = false; }
  else { w.x += dx / d * step; w.y += dy / d * step; w.moving = true; w.anim += dt; }
  w.tx = w.x; w.ty = w.y;
}
function openShop(shop) {
  var now = Date.now(), win;
  if (now - shopOpenAt < SHOP_COOLDOWN_MS) return;
  shopOpenAt = now;
  win = window.open(shop.url, "_blank", "noopener,noreferrer");
  if (!win) { shopNotice = "팝업이 차단되었어요. 팝업을 허용해 주세요"; shopNoticeAt = now; }
}
var KEYMAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
function typingTarget(t) { var n = t && t.tagName; return n === "INPUT" || n === "TEXTAREA" || n === "SELECT" || !!(t && t.isContentEditable); }
function worldActive() { var el = document.getElementById("world"); return !!el && !el.hidden; }
document.addEventListener("keydown", function (e) {
  var k = KEYMAP[e.key];
  if (e.ctrlKey || e.metaKey || e.altKey || typingTarget(e.target) || !worldActive()) return;
  if (k) { var me = ownWalker(); if (!me) return; if (!inActiveMeeting(DATA[me.i])) keys[k] = true; e.preventDefault(); return; }
  if (e.key === "Enter" && !e.repeat && nearShop && !/^(BUTTON|A)$/.test(e.target.tagName)) { e.preventDefault(); openShop(nearShop); }
});
// 마우스로 버튼을 클릭하면 포커스가 남아 입구 Enter가 무시되므로, 마우스 클릭(detail>0)이면 포커스를 해제한다 (키보드 조작은 유지)
document.addEventListener("click", function (e) {
  var b = e.target.closest && e.target.closest("button");
  if (b && e.detail > 0 && worldActive()) setTimeout(function () { if (document.activeElement === b) b.blur(); }, 0);
});
document.addEventListener("keyup", function (e) { var k = KEYMAP[e.key]; if (k) keys[k] = false; });
window.addEventListener("blur", function () { keys.up = keys.down = keys.left = keys.right = false; });
function update(dt) {
  var me = ownWalker();
  nearShop = WORLD_THEME === "plaza" && me ? plazaShopAt(me.x, me.y) : null;
  if (reduceMotion) {
    if (me) keyMove(me, dt);
    walkers.forEach(function (w) { var p = w !== me && posOf(w); if (p && posLive(w.id)) { jump(w, [p.x, p.y]); w.posT = p.t; } });
    return;
  }
  updateBossWalker(dt);
  walkers.forEach(function (w) {
    if (w.mode === "leave" || w.mode === "gone") { w.moving = false; return; }
    var mine = w === me, p = posOf(w);
    if (mine && keyMove(w, dt)) return;
    if (p && !mine && posLive(w.id)) { followPos(w, p, dt); return; }
    if (p && w.posT !== p.t && !(mine && Date.now() - (w.keyAt || 0) < 1500)) {
      w.posT = p.t;
      if (!autoMoveOn && (w.mode === "desk" || w.mode === "away")) jump(w, [p.x, p.y]);
    }
    if (mine && Date.now() - (w.keyAt || 0) < 3000) { w.moving = false; return; }
    if (!autoMoveOn) { w.route = []; w.moving = false; return; }
    if (w.route.length) {
      var p = w.route[0], rx = p[0] - w.x, ry = p[1] - w.y, rd = Math.hypot(rx, ry), rm = 70 * dt;
      if (rd <= rm) {
        w.x = p[0]; w.y = p[1]; w.route.shift();
        if (!w.route.length) { w.tx = w.x; w.ty = w.y; w.wait = 1.5 + Math.random() * 3; w.moving = false; }
      } else { w.x += rx / rd * rm; w.y += ry / rd * rm; w.moving = true; w.anim += dt; }
      return;
    }
    if (w.mode === "meet" || w.seat) { w.moving = false; return; }
    if (w.mode === "pc") { w.moving = false; return; }
    if (w.mode === "away") {
      w.moving = false;
      if (w.tag === "lunch" || w.tag === "away") return;
      if (w.wait > 0) { w.wait -= dt; if (w.wait <= 0) goTo(w, awayDest()); }
      else goTo(w, awayDest());
      return;
    }
    if (w.hd && shouldSitAtDesk(DATA[w.i])) {
      if (Math.abs(w.x - w.hd.x) > 1.5 || Math.abs(w.y - w.hd.y) > 1.5) goTo(w, [w.hd.x, w.hd.y]);
      else w.moving = false;
      return;
    }
    if (!w.a) { w.moving = false; return; }
    if (w.wait > 0) {
      w.wait -= dt; w.moving = false;
      if (w.wait <= 0) { if (WORLD_THEME === "plaza") { var ps = plazaSpot(); w.tx = ps[0]; w.ty = ps[1]; } else { w.tx = w.a.x0 + Math.random() * (w.a.x1 - w.a.x0); w.ty = w.a.y0 + Math.random() * (w.a.y1 - w.a.y0); } }
      return;
    }
    var dx = w.tx - w.x, dy = w.ty - w.y, dist = Math.hypot(dx, dy), mv = w.speed * dt;
    if (dist <= mv) { w.x = w.tx; w.y = w.ty; w.wait = 0.8 + Math.random() * 3.5; w.moving = false; return; }
    w.x += dx / dist * mv; w.y += dy / dist * mv; w.moving = true; w.anim += dt;
  });
  /* 담당자가 움직이는 방향을 기억해 두면, 침입자가 그 뒤를 따라가요 */
  walkers.forEach(function (w) {
    var mx = w.x - (w.lx == null ? w.x : w.lx), my = w.y - (w.ly == null ? w.y : w.ly), ml = Math.hypot(mx, my);
    if (ml > 0.05) { var hx0 = w.hx == null ? 1 : w.hx, hy0 = w.hy == null ? 0 : w.hy; hx0 += (mx / ml - hx0) * Math.min(1, dt * 4); hy0 += (my / ml - hy0) * Math.min(1, dt * 4); var hl = Math.hypot(hx0, hy0) || 1; w.hx = hx0 / hl; w.hy = hy0 / hl; }
    w.lx = w.x; w.ly = w.y;
  });
  var rank = {};
  intr.forEach(function (o) {
    if (o.die != null) { o.die -= dt; o.a = Math.max(0, o.die / 0.5); return; }
    if (o.a < 1) o.a = Math.min(1, o.a + dt * 2);
    var wi = indexOfId(o.pid), w = wi >= 0 ? walkers[wi] : null, r = rank[o.pid] = (rank[o.pid] == null ? 0 : rank[o.pid] + 1);
    if (!w) return;
    var hx = w.hx == null ? 1 : w.hx, hy = w.hy == null ? 0 : w.hy, side = (r % 2 ? 1 : -1) * 5;
    var tx = w.x + CW / 2 - IW / 2 - hx * (30 + r * 20) - hy * side, ty = w.y + CH - IH - 2 - hy * (12 + r * 10) + hx * side;
    var dx = tx - o.x, dy = ty - o.y, dist = Math.hypot(dx, dy), sp = Math.min(150, Math.max(o.speed, dist * 3)) * dt;
    if (dist <= sp) { o.x = tx; o.y = ty; } else { o.x += dx / dist * sp; o.y += dy / dist * sp; }
  });
  intr = intr.filter(function (o) { return o.die == null || o.die > 0; });
}

