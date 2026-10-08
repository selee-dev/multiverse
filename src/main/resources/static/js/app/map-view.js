/* 지도 그리기 루프(draw/frame)와 클릭 판정 */
var hover = null, hoverInv = null;
function label(t, cx, y, gray) {
  var ls = Array.isArray(t) ? t : [t], k;
  mctx.font = "500 11px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; mctx.textAlign = "center";
  for (k = 0; k < ls.length; k++) {
    var yy = y - (ls.length - 1 - k) * 13;
    var text = fit(mctx, ls[k], 120);
    mctx.lineWidth = 3; mctx.strokeStyle = T.ls; mctx.strokeText(text, cx, yy);
    mctx.fillStyle = gray ? T.lg : T.lf; mctx.fillText(text, cx, yy);
  }
  mctx.textAlign = "left";
}
function presenceBadge(text, cx, top) {
  mctx.save();
  mctx.font = "700 10px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
  var width = mctx.measureText(text).width + 12, height = 16, left = cx - width / 2, radius = 5;
  mctx.beginPath();
  mctx.moveTo(left + radius, top);
  mctx.arcTo(left + width, top, left + width, top + height, radius);
  mctx.arcTo(left + width, top + height, left, top + height, radius);
  mctx.arcTo(left, top + height, left, top, radius);
  mctx.arcTo(left, top, left + width, top, radius);
  mctx.closePath();
  mctx.fillStyle = "#a85b08";
  mctx.fill();
  mctx.fillStyle = "#fff";
  mctx.textAlign = "center";
  mctx.textBaseline = "middle";
  mctx.fillText(text, cx, top + height / 2);
  mctx.restore();
}
function arrow(ax, ay) {
  mctx.fillStyle = T.arrow;
  mctx.fillRect(ax - 3, ay, 7, 1); mctx.fillRect(ax - 2, ay + 1, 5, 1); mctx.fillRect(ax - 1, ay + 2, 3, 1); mctx.fillRect(ax, ay + 3, 1, 1);
}
function regionDim(u) { return state.side && UNI[u].side !== state.side ? 0.6 : (state.uni && state.uni !== u ? 0.45 : 0); }
function mapOn(d) { return !mapFilt || mapSet[jobId(d)]; }
function shade(hex, k) {
  var key = hex + k, m = /^#([0-9a-f]{6})$/i.exec(hex), n;
  if (SHD[key]) return SHD[key];
  if (!m) return hex;
  n = parseInt(m[1], 16);
  return (SHD[key] = "rgb(" + Math.round((n >> 16 & 255) * k) + "," + Math.round((n >> 8 & 255) * k) + "," + Math.round((n & 255) * k) + ")");
}
function otBadge(x, y) {
  mctx.fillStyle = "#3b2a6b"; mctx.fillRect(x, y, 28, 14);
  mctx.strokeStyle = "#b79cff"; mctx.lineWidth = 1; mctx.strokeRect(x + 0.5, y + 0.5, 27, 13);
  mctx.font = "700 10px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; mctx.textAlign = "left"; mctx.fillStyle = "#e6dcff"; mctx.fillText("야근", x + 4, y + 11);
}
function drawHealthBattery(x, y, d, characterHeight) {
  var value = batteryOf(d), px = Math.round(x + CW / 2 - 10), py = Math.round(y + (characterHeight || CH) + 1);
  mctx.save();
  mctx.globalAlpha = 0.96;
  mctx.fillStyle = "#111629"; mctx.fillRect(px, py, 20, 8);
  mctx.strokeStyle = "#e7ebfa"; mctx.lineWidth = 1; mctx.strokeRect(px + 0.5, py + 0.5, 19, 7);
  mctx.fillStyle = "#e7ebfa"; mctx.fillRect(px + 20, py + 2, 2, 4);
  mctx.fillStyle = value > 60 ? "#4fc17f" : value > 25 ? "#f4c95d" : "#ff7088";
  if (value) mctx.fillRect(px + 2, py + 2, Math.round(15 * value / 100), 4);
  mctx.restore();
}
function drawMonitor(s, lit) {
  var office = WORLD_THEME === "office";
  mctx.fillStyle = office ? "#22201e" : "#5b638f"; mctx.fillRect(s.cx - 18, s.ry + 12, 36, 21);
  mctx.fillStyle = lit ? (office ? "#4c9b91" : "#2a8ea3") : (office ? "#151819" : "#141830"); mctx.fillRect(s.cx - 16, s.ry + 14, 32, 17);
  mctx.fillStyle = office ? "#4c4944" : "#5b638f"; mctx.fillRect(s.cx - 3, s.ry + 33, 6, 4);
}
function drawDesk(s, tint, lit) {
  var x = s.cx - 42, y = s.ry + 38;
  if (WORLD_THEME === "office") {
    x = s.cx - 34;
    mctx.fillStyle = "#211a16"; mctx.fillRect(x + 3, y + 8, 62, 19);
    mctx.fillStyle = "#f3f1eb"; mctx.fillRect(x, y, 68, 9);
    mctx.fillStyle = "#ffffff"; mctx.fillRect(x + 1, y + 1, 66, 6);
    mctx.fillStyle = "#c8c5be"; mctx.fillRect(x, y + 8, 68, 2);
    mctx.fillStyle = "#8b8176"; mctx.fillRect(x + 5, y + 10, 3, 18); mctx.fillRect(x + 60, y + 10, 3, 18);
    return;
  }
  mctx.fillStyle = shade(tint, 0.45); mctx.fillRect(x, y + 10, 84, 20);
  mctx.fillStyle = shade(tint, 0.82); mctx.fillRect(x, y, 84, 10);
  mctx.fillStyle = tint; mctx.fillRect(x, y, 84, 2); mctx.fillRect(x, y + 28, 84, 2);
  mctx.fillStyle = "#7c86b3"; mctx.fillRect(s.cx - 10, s.ry + 44, 20, 3);
}
function drawBossVisitor() {
  var boss = ensureBossWalker(), step = boss && boss.moving ? Math.sin(boss.anim * 9) * 4 : 0, bob = boss && boss.moving ? Math.abs(Math.sin(boss.anim * 9)) * 2 : 0;
  if (!boss) return;
  mctx.save();
  mctx.translate(Math.round(boss.x), Math.round(boss.y - bob));
  mctx.globalAlpha = 1;
  mctx.fillStyle = "#0008";
  mctx.beginPath(); mctx.ellipse(50, 158, 38, 7, 0, 0, Math.PI * 2); mctx.fill();
  if (WORLD_THEME !== "battlefield") {
    var jacket = mctx.createLinearGradient(22, 48, 78, 126);
    jacket.addColorStop(0, "#344858"); jacket.addColorStop(0.52, "#202e3b"); jacket.addColorStop(1, "#17232f");
    mctx.fillStyle = "#20232a"; mctx.fillRect(31, 116 + step, 15, 31); mctx.fillRect(54, 116 - step, 15, 31);
    mctx.fillStyle = "#11151a"; mctx.fillRect(26, 144 + step, 23, 8); mctx.fillRect(51, 144 - step, 24, 8);
    mctx.fillStyle = jacket; mctx.beginPath(); mctx.moveTo(26, 57); mctx.quadraticCurveTo(31, 47, 42, 45); mctx.lineTo(58, 45); mctx.quadraticCurveTo(71, 47, 76, 58); mctx.lineTo(71, 119); mctx.quadraticCurveTo(50, 125, 29, 119); mctx.closePath(); mctx.fill();
    mctx.fillStyle = "#edf0ee"; mctx.beginPath(); mctx.moveTo(42, 46); mctx.lineTo(58, 46); mctx.lineTo(62, 82); mctx.lineTo(50, 96); mctx.lineTo(38, 82); mctx.closePath(); mctx.fill();
    mctx.fillStyle = "#9d4655"; mctx.beginPath(); mctx.moveTo(47, 49); mctx.lineTo(53, 49); mctx.lineTo(59, 87); mctx.lineTo(50, 100); mctx.lineTo(41, 87); mctx.closePath(); mctx.fill();
    mctx.fillStyle = "#d4b18f"; mctx.fillRect(41, 30, 19, 19); mctx.beginPath(); mctx.ellipse(50, 30, 16, 19, 0, 0, Math.PI * 2); mctx.fill();
    mctx.fillStyle = jacket; mctx.beginPath(); mctx.moveTo(35, 28); mctx.quadraticCurveTo(32, 7, 51, 7); mctx.quadraticCurveTo(69, 7, 66, 29); mctx.lineTo(59, 22); mctx.lineTo(40, 22); mctx.closePath(); mctx.fill();
    mctx.fillStyle = "#15202a"; mctx.fillRect(38, 27, 10, 6); mctx.fillRect(52, 27, 10, 6);
    mctx.strokeStyle = "#b8d0d5"; mctx.lineWidth = 2; mctx.strokeRect(38, 26, 11, 7); mctx.strokeRect(51, 26, 11, 7); mctx.beginPath(); mctx.moveTo(49, 29); mctx.lineTo(51, 29); mctx.stroke();
    mctx.fillStyle = "#775342"; mctx.fillRect(39, 37, 22, 4); mctx.fillStyle = "#8b5f4e"; mctx.fillRect(45, 39, 12, 3);
    mctx.fillStyle = "#d4b18f"; mctx.fillRect(17, 60 - step, 12, 43); mctx.fillRect(72, 60 + step, 12, 43);
    mctx.fillStyle = jacket; mctx.fillRect(17, 54 - step, 12, 34); mctx.fillRect(72, 54 + step, 12, 34);
    mctx.fillStyle = "#d4b18f"; mctx.fillRect(17, 101 - step, 12, 9); mctx.fillRect(72, 101 + step, 12, 9);
    mctx.fillStyle = "#d8bd83"; mctx.fillRect(62, 69, 6, 3); mctx.fillRect(32, 69, 5, 3);
    mctx.fillStyle = "#20232a"; mctx.fillRect(35, 119, 4, 18); mctx.fillRect(57, 119, 4, 18);
  } else {
    mctx.fillStyle = "#33251e"; mctx.fillRect(27, 116 + step, 18, 32); mctx.fillRect(54, 116 - step, 18, 32);
    mctx.fillStyle = "#d8b48b"; mctx.fillRect(22, 144 + step, 26, 9); mctx.fillRect(51, 144 - step, 27, 9);
    mctx.fillStyle = "#7e392d"; mctx.fillRect(20, 60, 60, 62); mctx.fillStyle = "#c18a59"; mctx.fillRect(30, 52, 43, 16);
    mctx.fillStyle = "#c18a59"; mctx.fillRect(37, 23, 28, 29); mctx.fillStyle = "#b87a4e"; mctx.fillRect(32, 33, 6, 14);
    mctx.fillStyle = "#4a3020"; mctx.fillRect(28, 14, 11, 22); mctx.fillRect(63, 14, 11, 22); mctx.fillRect(36, 12, 30, 10);
    mctx.fillStyle = "#211b19"; mctx.fillRect(40, 32, 7, 5); mctx.fillRect(55, 32, 7, 5);
    mctx.fillStyle = "#d8b48b"; mctx.fillRect(16, 65, 12, 47); mctx.fillRect(72, 65, 12, 47);
    mctx.fillStyle = "#53463c"; mctx.fillRect(42, 69, 17, 9); mctx.fillStyle = "#c8aa68"; mctx.fillRect(47, 70, 7, 5);
    mctx.fillStyle = "#8d7656"; mctx.fillRect(8, 44, 5, 73); mctx.fillRect(5, 40, 12, 8);
  }
  mctx.fillStyle = "#17151b"; mctx.fillRect(17, 169, 66, 14);
  mctx.fillStyle = "#ffffff"; mctx.font = "bold 9px sans-serif"; mctx.textAlign = "center"; mctx.fillText("사장님", 50, 179);
  mctx.restore();
}
function draw() {
  mctx.setTransform(MAP_SCALE, 0, 0, MAP_SCALE, 0, 0);
  mctx.globalAlpha = 1; mctx.drawImage(bg, 0, 0, MAP_W, MAP_H);
  if (WORLD_THEME === "plaza") drawPlazaLive();
  drawFires();
  if (WORLD_THEME !== "plaza") Object.keys(REGIONS).forEach(function (u) {
    var dim = regionDim(u);
    if (dim) { var g = REGIONS[u]; mctx.globalAlpha = dim; mctx.fillStyle = T.bg; mctx.fillRect(g.x, g.y, g.w, g.h); }
  });
  if (WORLD_THEME !== "plaza") Object.keys(invCount).forEach(function (u) {
    var g = REGIONS[u], t, w2;
    if (!g || !invCount[u]) return;
    t = "침입 " + invCount[u];
    mctx.font = "700 10px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; mctx.textAlign = "left";
    w2 = Math.ceil(mctx.measureText(t).width) + 12;
    mctx.globalAlpha = regionDim(u) ? 0.4 : 1;
    mctx.fillStyle = "#e5283c"; mctx.fillRect(g.x + g.w - 6 - w2, g.y + 25, w2, 15);
    mctx.fillStyle = "#fff"; mctx.fillText(t, g.x + g.w - 6 - w2 + 6, g.y + 36);
  });
  mctx.globalAlpha = 1;
  var sn = WORLD_THEME === "plaza" ? {} : snackNow();
  Object.keys(sn).forEach(function (u) {
    var g = REGIONS[u]; if (!g) return;
    mctx.globalAlpha = regionDim(u) ? 0.4 : 1;
    mctx.font = "700 10px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; mctx.textAlign = "left";
    mctx.fillStyle = "#f4c95d"; mctx.fillRect(g.x + 6, g.y + 25, 34, 15);
    mctx.fillStyle = "#1a1408"; mctx.fillText("간식", g.x + 12, g.y + 36);
    sn[u].items.forEach(function (it, k) { mctx.drawImage(foodIcon(it), g.x + 8 + k * 18, g.y + g.h - 24); });
  });
  mctx.globalAlpha = 1;
  if (WORLD_THEME !== "plaza") TABLES.forEach(function (tb, k) {
    var info = seatInfo[k];
    mctx.fillStyle = info ? "#a37a4a" : "#5b4530";
    mctx.beginPath(); mctx.ellipse(tb.x, tb.y, 28, 17, 0, 0, Math.PI * 2); mctx.fill();
    mctx.lineWidth = 2; mctx.strokeStyle = info ? "#f4c95d" : "#3a2c1e"; mctx.stroke();
    mctx.font = "500 11px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
    label(info ? fit(mctx, info.t, 112) : WORLD_THEME === "office" ? "빈 회의실" : "빈 작전 탁자", tb.x, tb.y + 82, !info);
  });
  var showNames = document.getElementById("names").checked, today = todayStr(), owner = {}, pcOwner = {};
  walkers.forEach(function (w) { if (w.hd) owner[w.hd.idx] = w; });
  walkers.forEach(function (w) { if (isUsingPc(w)) pcOwner[w.pc.idx] = w; });
  SEATS.forEach(function (s) {
    if (WORLD_THEME !== "office") return;
    var w = s.kind === "pc" ? pcOwner[s.idx] : owner[s.idx], d = w ? DATA[w.i] : null, sit = w ? (s.kind === "pc" ? isUsingPc(w) : isSitting(w)) : false, on = d ? mapOn(d) : true, off = d ? onLeave(d, today) : false;
    var tint = d ? ucol(uOf(d)) : "#5b638f", nm = d ? jobId(d) : "";
    mctx.globalAlpha = on ? 1 : 0.28;
    if (d && on && (uOf(d) === "flead" || uOf(d) === "blead")) {
      var pulse = reduceMotion ? 0.8 : 0.55 + 0.45 * Math.sin(lastT / 380);
      mctx.save(); mctx.globalAlpha = (0.35 + 0.45 * pulse) * (off ? 0.5 : 1); mctx.strokeStyle = LEAD; mctx.lineWidth = 2; mctx.shadowColor = LEAD; mctx.shadowBlur = 18;
      mctx.strokeRect(s.cx - 46, s.ry + 4, 92, 68); mctx.restore();
    }
    mctx.fillStyle = WORLD_THEME === "office" ? "#d7d0c4" : "#1e2340"; mctx.fillRect(s.cx - 16, s.ry + 14, 32, 26);
    drawMonitor(s, s.kind === "pc" || sit);
    if (sit) mctx.drawImage(spr[w.i][off ? 1 : 0][0], 0, 0, CW, 32, s.x, s.y, CW, 32);
    drawDesk(s, tint, s.kind === "pc");
    if (d && sn[uOf(d)] && !off) { var its = sn[uOf(d)].items; if (its.length) mctx.drawImage(foodIcon(its[s.idx % its.length]), s.cx + 24, s.ry + 44); }
    if (d && pidCount[nm]) {
      var t = "침입 " + pidCount[nm];
      mctx.font = "700 10px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; mctx.textAlign = "left";
      mctx.fillStyle = "#e5283c"; mctx.fillRect(s.cx - 40, s.ry + 51, 38, 14);
      mctx.fillStyle = "#fff"; mctx.fillText(t, s.cx - 36, s.ry + 61);
    }
    if (sit && on && d && isOT(d)) otBadge(s.cx + 18, s.ry + 2);
    if (sit && on && w && w.mode === "away" && w.tag === "lunch") mctx.drawImage(foodIcon("밥"), s.x + CW - 8, s.y + 8 + Math.round(Math.sin(lastT / 260 + w.i) * 3));
    if (sit && on && w && w.mode === "away" && w.tag === "lunch") presenceBadge("점심", s.cx, s.y - (nameLines(d, off ? " · " + offLabel(d) : "").length * 13 + 20));
    if (!d && s.kind !== "person") label(s.n, s.cx, s.ry + 9, true);
    else if (d && on && (showNames || hover === w || w.mode === "pc")) label(nameLines(d, off ? " · " + offLabel(d) : ""), s.cx, s.y - 4, off);
    if (sit && on && d) drawHealthBattery(s.x, s.y, d, 32);
    if (sit && on && hover === w) arrow(s.cx, s.y - 20);
  });
  var bubbles = activeBubbles();
  walkers.forEach(function (w) {
    var seat = isUsingPc(w) ? w.pc : isSitting(w) ? w.hd : null;
    if (!seat || !bubbles[w.id] || !mapOn(DATA[w.i])) return;
    mctx.globalAlpha = 1; drawBubble(bubbles[w.id], seat.cx, seat.y - nameLines(DATA[w.i], "").length * 13 - 8);
  });
  walkers.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (w) {
    if (isSitting(w) || isUsingPc(w)) return;
    var d = DATA[w.i], on = mapOn(d), off = onLeave(d, today), gn = w.mode === "gone";
    var ph = Math.floor(w.anim * 5), fr = w.moving ? (ph % 2 ? 1 : 2) : 0, bob = w.moving && ph % 2 ? 2 : 0;
    var x = Math.round(w.x), y = Math.round(w.y) - bob, sitting = w.seat && !w.route.length && Math.abs(w.x - w.seat.x) < 2 && Math.abs(w.y - w.seat.y) < 2;
    mctx.globalAlpha = on ? (gn ? 0.4 : 1) : 0.22;
    if (sitting) mctx.drawImage(spr[w.i][off ? 1 : 0][0], 0, 0, CW, 32, x, y, CW, 32);
    else mctx.drawImage(spr[w.i][off ? 1 : 0][fr], x, y);
    if (on) drawHealthBattery(x, y, d);
    if (w.mode === "away" && w.tag === "lunch") {
      if (WORLD_THEME !== "battlefield") mctx.drawImage(foodIcon("밥"), x + CW - 8, y + 8 + Math.round(Math.sin(lastT / 260 + w.i) * 3));
      else if (!w.route.length) drumstick(x + CW - 5, y + 12 + (Math.sin(lastT / 170 + w.i * 1.7) > 0.3 ? -3 : 0));
      else drumstick(x + 8, y - 26);
    } else if (w.mode === "away" && w.tag === "break") mctx.drawImage(foodIcon("커피"), x + 4, y - 32);
    var name = nameLines(d, off ? " · " + offLabel(d) : (gn ? " · 퇴근" : ""));
    var presenceText = w.mode === "away" ? (w.tag === "lunch" ? "점심" : w.tag === "break" ? "휴식" : "자리비움") : "";
    var showWalkerName = showNames || hover === w || w.mode === "away";
    if (WORLD_THEME === "office" && w.hd && w.mode === "away") showWalkerName = hover === w;
    if (on && showWalkerName) label(name, x + CW / 2, y - 4, off || gn);
    if (on && w.mode === "away") {
      presenceBadge(presenceText, x + CW / 2, y - (name.length * 13 + 20));
    }
    if (on && hover === w) arrow(x + CW / 2, y - (presenceText ? name.length * 13 + 25 : 20));
    if (on && isOT(d) && !off) otBadge(x + CW - 2, y - 2);
    if (on && bubbles[w.id]) { mctx.globalAlpha = 1; drawBubble(bubbles[w.id], x + CW / 2, y - (showWalkerName ? name.length * 13 + 8 : 6) - (presenceText ? 20 : 0)); }
  });
  var meW = ownWalker();
  if (meW && nearShop) {
    var hintOn = shopNotice && Date.now() - shopNoticeAt < 4000;
    mctx.globalAlpha = 1;
    label(hintOn ? shopNotice : "Enter ▶ " + nearShop.n + " 열기", Math.round(meW.x) + CW / 2, Math.round(meW.y) - 22, false);
  }
  var cnt = {};
  intr.forEach(function (o) {
    cnt[o.pid] = (cnt[o.pid] || 0) + 1;
    o.shown = cnt[o.pid] <= INVCAP;
    if (!o.shown) return;
    var x = Math.round(o.x), y = Math.round(o.y);
    mctx.globalAlpha = o.a * (mapFilt && !mapSet[o.pid] ? 0.25 : 1);
    mctx.drawImage(INVS[(Math.floor(lastT / 320) + o.k) % 2], x, y);
    if (hoverInv === o) { mctx.globalAlpha = 1; arrow(x + IW / 2, y - 6); }
  });
  drawBossVisitor();
  mctx.globalAlpha = 1;
}

var lastT = 0, running = false;
function frame(t) {
  if (document.getElementById("world").hidden) { running = false; return; }
  var dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  update(dt); draw();
  requestAnimationFrame(frame);
}
if (window.ResizeObserver) new ResizeObserver(fitMapResolution).observe(document.getElementById("worldbox"));
window.addEventListener("resize", fitMapResolution);
function startMap() { if (running) return; running = true; lastT = performance.now(); requestAnimationFrame(frame); }

function mapPoint(ev) {
  var rc = mapEl.getBoundingClientRect(), k = MAP_W / rc.width;
  return [(ev.clientX - rc.left) * k, (ev.clientY - rc.top) * k];
}
function mapCommandAt(point) {
  if (WORLD_THEME === "plaza") return null;
  if (point[0] >= MEET.x && point[0] <= MEET.x + MEET.w && point[1] >= MEET.y && point[1] <= MEET.y + 58) return "meet";
  if (point[0] >= 16 && point[0] <= 944 && point[1] >= 716 && point[1] <= 958) return "proj";
  return null;
}
function pcSeatAt(px, py) {
  if (WORLD_THEME !== "office") return null;
  for (var i = 0; i < SEATS.length; i++) {
    var s = SEATS[i];
    if (s.kind === "pc" && px >= s.cx - 42 && px <= s.cx + 42 && py >= s.ry - 8 && py <= s.ry + 66) return s;
  }
  return null;
}
function currentCharacterIndex() {
  var i = currentCharacterId ? indexOfId(currentCharacterId) : -1;
  return i >= 0 && DATA[i].accountCharacter ? i : -1;
}
function assignedSeatAt(px, py) {
  if (WORLD_THEME !== "office") return null;
  var i = currentCharacterIndex(), d = i >= 0 ? DATA[i] : null, assigned = d && pcUseOf(d) ? deskFor(d) : null;
  if (!assigned || assigned.kind !== "person" || px < assigned.cx - 42 || px > assigned.cx + 42 || py < assigned.ry - 8 || py > assigned.ry + 66) return null;
  return { index: i, seat: assigned };
}
function pcUserAt(seat) {
  for (var i = 0; i < DATA.length; i++) {
    var user = pcUseOf(DATA[i]);
    if (user && user.idx === seat.idx) return DATA[i];
  }
  return null;
}
function hitTest(ev) {
  var pt = mapPoint(ev), px = pt[0], py = pt[1], hit = null;
  walkers.forEach(function (w) {
    var d = DATA[w.i], x0, x1, y0, y1;
    if (!mapOn(d)) return;
    if (isSitting(w)) { x0 = w.hd.cx - 42; x1 = w.hd.cx + 42; y0 = w.y - 14; y1 = w.y + 54; }
    else { x0 = w.x - 2; x1 = w.x + CW + 2; y0 = w.y - 4; y1 = w.y + (w.seat && !w.route.length ? 32 : CH); }
    if (px >= x0 && px <= x1 && py >= y0 && py <= y1 && (!hit || w.y > hit.y)) hit = w;
  });
  if (!hit) hit = seatOwnerAt(px, py);
  return hit;
}
/* 빈 자리(퇴근·점심·회의·연차로 캐릭터가 없는 자리)를 눌러도 그 자리 주인의 시트가 열려요 */
function seatOwnerAt(px, py) {
  var found = null;
  SEATS.forEach(function (s) {
    if (px < s.cx - 42 || px > s.cx + 42 || py < s.ry - 8 || py > s.ry + 66) return;
    walkers.forEach(function (w) { if (w.hd && w.hd.idx === s.idx && mapOn(DATA[w.i])) found = w; });
  });
  return found;
}
function hitInv(ev) {
  var pt = mapPoint(ev), hit = null;
  intr.forEach(function (o) {
    if (o.shown && o.die == null && pt[0] >= o.x - 2 && pt[0] <= o.x + IW + 2 && pt[1] >= o.y - 2 && pt[1] <= o.y + IH + 2) hit = o;
  });
  return hit;
}
function indexOfId(id) { for (var k = 0; k < DATA.length; k++) if (jobId(DATA[k]) === id) return k; return -1; }
mapEl.addEventListener("mousemove", function (ev) {
  var point = mapPoint(ev), command = mapCommandAt(point), pc = pcSeatAt(point[0], point[1]), returnSeat = !pc && assignedSeatAt(point[0], point[1]), hi0 = pc || command || returnSeat ? null : hitInv(ev), h = pc || command || returnSeat || hi0 ? null : hitTest(ev), tip = document.getElementById("tip"), br = document.getElementById("worldbox").getBoundingClientRect(), hi = hi0;
  hover = h; hoverInv = hi; mapEl.style.cursor = h || hi ? "pointer" : "default";
  if (command) {
    mapEl.style.cursor = "pointer";
    tip.innerHTML = command === "meet"
      ? (WORLD_THEME === "plaza" ? "<b>광장 회의 천막</b> · 눌러서 회의를 만들어요" : WORLD_THEME === "office" ? "<b>회의실</b> · 눌러서 회의를 만들어요" : "<b>작전 막사</b> · 눌러서 회의를 만들어요")
      : (WORLD_THEME === "plaza" ? "<b>프로젝트 구역</b> · 눌러서 프로젝트 팀을 만들어요" : WORLD_THEME === "office" ? "<b>프로젝트 구역</b> · 눌러서 팀을 만들어요" : "<b>용병 진영</b> · 눌러서 프로젝트 팀을 만들어요");
  } else if (pc) {
    var pcUser = pcUserAt(pc), activeIndex = currentCharacterIndex(), activePc = activeIndex >= 0 && pcUseOf(DATA[activeIndex]);
    var isOwnPc = activePc && activePc.idx === pc.idx;
    mapEl.style.cursor = "pointer";
    tip.innerHTML = "<b>" + esc(pc.n.toUpperCase()) + " 전용 PC</b>" + (isOwnPc ? "<br>다시 클릭하면 원래 자리로 돌아가요" : pcUser ? "<br>사용 중 · " + nameHtml(pcUser.n) : "<br>클릭하여 잠시 사용해요");
  } else if (returnSeat) {
    mapEl.style.cursor = "pointer";
    tip.innerHTML = "<b>내 지정 좌석</b> · 클릭하여 원래 자리로 돌아가요";
  } else if (h) {
    var d = DATA[h.i], sk = snackNow()[uOf(d)];
    tip.innerHTML = "<b>" + nameHtml(d.n) + "</b>" + (ttl(d) ? " · " + esc(ttl(d)) : "") + "<br>" + esc(job(d)) + (onLeave(d) ? "<br>" + esc(offLabel(d)) : "") + (h.seat && !h.route.length ? "<br>회의 중" : "") + (h.mode === "away" ? "<br>" + (h.tag === "lunch" ? "점심 중" : h.tag === "break" ? "휴식 중" : "자리비움") : "") + (openTasks(d).length ? "<br>맡은 업무 " + openTasks(d).length + "건" : "") + (sk ? "<br>간식 당번" + (sk.items.length ? " · " + esc(sk.items.join(", ")) : "") : "");
  } else if (hi) {
    var pi = indexOfId(hi.pid);
    tip.innerHTML = "<b>침입자</b> · " + esc(hi.text) + "<br>담당 " + (pi >= 0 ? esc(DATA[pi].n) : "") + " · 누르면 업무 목록이 열려요";
  } else {
    var sh = snackHit(ev);
    if (!sh) { tip.hidden = true; return; }
    mapEl.style.cursor = "pointer";
    tip.innerHTML = "<b>간식 당번</b> · " + esc(UNI[sh.u].realm) + " (~" + md(sh.info.to) + ")" + (sh.info.items.length ? "<br>" + esc(sh.info.items.join(", ")) : "");
  }
  tip.style.left = (ev.clientX - br.left) + "px"; tip.style.top = (ev.clientY - br.top - 10) + "px";
  tip.hidden = false;
});
mapEl.addEventListener("mouseleave", function () { hover = null; hoverInv = null; document.getElementById("tip").hidden = true; });
mapEl.addEventListener("click", function (ev) {
  var point = mapPoint(ev), command = mapCommandAt(point);
  if (command) {
    setView(command);
    var input = document.getElementById(command === "meet" ? "mname" : "pname");
    if (input) input.focus();
    return;
  }
  var pc = pcSeatAt(point[0], point[1]);
  if (pc) {
    var characterIndex = currentCharacterIndex();
    if (characterIndex < 0) {
      window.alert("이 PC를 사용하려면 로그인 계정에 연결된 캐릭터가 필요합니다.");
      return;
    }
    setPcUse(characterIndex, pc.idx);
    return;
  }
  var returnSeat = assignedSeatAt(point[0], point[1]);
  if (returnSeat) {
    setPcUse(returnSeat.index, null);
    return;
  }
  var hi = hitInv(ev), pi = hi ? indexOfId(hi.pid) : -1;
  if (pi >= 0) { openSheet(pi, mapEl); return; }
  var h = hitTest(ev);
  if (h) openSheet(h.i, mapEl);
});

