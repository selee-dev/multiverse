/* 지도 그림(사무실·광장·전장), 스프라이트, 좌석과 걷기 경로 */
/* ---- world map: 실제 좌석 배치도를 따른 사무실 ---- */
var MAP_W = 1200, MAP_H = 970, CW = 28, CH = 40, IW = 22, IH = 16;
var OX = 40, OY = 62, CELLW = 110, ROWH = 74, LOWER_Y = 700, LANE = 690;
var AX = 80 + 3.5 * 114 - CW / 2, EDGE = 940;
var mapEl = document.getElementById("map"), mctx = mapEl.getContext("2d");
mctx.imageSmoothingEnabled = false;
var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

var SEATS = [], SEATBY = {};
var GRID = 8;
for (var row = 0; row < GRID; row++) for (var col = 0; col < GRID; col++) {
  var idx = row * GRID + col, cx = 80 + col * 114, ry = 62 + row * ROWH;
  var kind = idx === 8 || idx === 9 ? "pc" : "person", nm = idx === 8 ? "ftp" : idx === 9 ? "ER" : "";
  var s = { idx: idx, cx: cx, ry: ry, x: cx - CW / 2, y: ry + 6, kind: kind, n: nm, col: col, row: row };
  SEATS.push(s);
}

/* 좌석 선택: store.seats.main.m = { 사람id: 좌석번호 } */
var LEAD = "#ff2bd6", SEATNOW = {};
function computeSeatNow() {
  var ov = store.seats && store.seats.main && store.seats.main.m && typeof store.seats.main.m === "object" ? store.seats.main.m : {}, taken = {}, visit = WORLD_THEME === "office" && bossVisitOn();
  SEATNOW = {};
  DATA.forEach(function (d) {
    var personal = store.seats[jobId(d)], s = personal && personal.override === true && typeof personal.s === "number" ? SEATS[personal.s] : null;
    if (personal && personal.override === true && s && s.kind === "person" && !taken[s.idx]) { taken[s.idx] = 1; SEATNOW[jobId(d)] = s; }
  });
  DATA.forEach(function (d) {
    var personal = store.seats[jobId(d)];
    if (personal && personal.override === true) return;
    if (visit && !shouldSitAtDesk(d)) return;
    var idx = ov[jobId(d)], s = typeof idx === "number" ? SEATS[idx] : null;
    if (s && s.kind === "person" && !taken[s.idx]) { taken[s.idx] = 1; SEATNOW[jobId(d)] = s; }
  });
  if (visit) DATA.forEach(function (d) {
    if (!shouldSitAtDesk(d) || SEATNOW[jobId(d)]) return;
    var seat = null;
    SEATS.forEach(function (candidate) { if (!seat && candidate.kind === "person" && !taken[candidate.idx]) seat = candidate; });
    if (seat) { taken[seat.idx] = 1; SEATNOW[jobId(d)] = seat; }
  });
}
computeSeatNow();

var REGIONS = {};
PSLOTS.forEach(function (u, i) { REGIONS[u] = { x: 40 + i * 296, y: 742, w: 288, h: 210 }; });
var MEET = { x: 948, y: 10, w: 240, h: 690 };
var TABLES = [0, 1, 2].map(function (i) { return { x: MEET.x + MEET.w / 2, y: 150 + i * 210 }; });
var TH = {
  dark:  { bg: "#0a0d1a", floor: "#10152e", carpet: "#151b3d", line: "#2a3254", muted: "#9299bb", text: "#eaedfb", ls: "#0a0d1a", lf: "#eaedfb", lg: "#a2a8bf", arrow: "#f4c95d", night: 0.42,
    office: { wood1: "#1d2340", wood2: "#20284a", seam: "#0a0d1a", glass: "#141c3a", sky2: "#232d57", win: "#f4c95d", frame: "#3a4470", neon: "#ff5fd2", rug1: "#2a2f63", rug2: "#6f7bd6", rug3: "#3a2a58", leaf1: "#2f8f5b", leaf2: "#4fc17f", sofa1: "#5b6cff", sofa2: "#ff8a5c", tableTop: "#7c86b3", bar1: "#2a3160", bar2: "#4b5599", stool: "#8a94c8" } },
  light: { bg: "#dfe3f3", floor: "#f6f7fd", carpet: "#e9ecf8", line: "#b9c1e0", muted: "#5a6490", text: "#1b2040", ls: "#f6f7fd", lf: "#1b2040", lg: "#5f6890", arrow: "#b87900", night: 0,
    office: { wood1: "#f2e6d4", wood2: "#ecddc6", seam: "#b89a74", glass: "#cfe3f5", sky2: "#a9c5e2", win: "#ffffff", frame: "#8a7b68", neon: "#e0359f", rug1: "#dbe3f7", rug2: "#5d78d6", rug3: "#f5d6cf", leaf1: "#3f9a63", leaf2: "#66c98a", sofa1: "#5b6cff", sofa2: "#ff8a5c", tableTop: "#c9b79b", bar1: "#d9c7a8", bar2: "#b89a74", stool: "#8a7b68" } }
};
var T = TH[document.documentElement.getAttribute("data-ops-theme")] || TH.dark;
var UC = {};
function resolveColor(v) {
  var m = /var\((--[\w-]+)\)/.exec(v);
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : v;
}
function ucol(u) { return UC[u] || (UC[u] = resolveColor(UNI[u].color)); }

function building(c, kind, cx, y, col) {
  var dk = "#0b0e1c", gold = "#f4c95d";
  function R(x, yy, w, h, f, a) { c.globalAlpha = a == null ? 1 : a; c.fillStyle = f; c.fillRect(cx + x, y + yy, w, h); }
  R(-18, 12, 36, 12, col); R(-14, 6, 28, 6, col); R(-2, -2, 2, 8, gold); R(0, -2, 10, 5, gold); R(-4, 16, 8, 8, dk);
  c.globalAlpha = 1;
}
function fit(c, t, w) {
  t = String(t);
  if (c.measureText(t).width <= w) return t;
  while (t.length > 1 && c.measureText(t + "…").width > w) t = t.slice(0, -1);
  return t + "…";
}

var SHD = {};
var bg = document.createElement("canvas");
bg.width = MAP_W; bg.height = MAP_H;
var MAP_SCALE = 1;
function fitMapResolution() {
  var rc = mapEl.getBoundingClientRect(), w;
  if (!rc.width) return;
  w = Math.max(600, Math.min(2400, Math.round(rc.width * (window.devicePixelRatio || 1))));
  if (w === mapEl.width) return;
  mapEl.width = w; mapEl.height = Math.round(w * MAP_H / MAP_W);
  bg.width = mapEl.width; bg.height = mapEl.height;
  MAP_SCALE = w / MAP_W;
  mctx.imageSmoothingEnabled = false;
  paintMap();
}
function paintFrame(c, g, col, key, empty) {
  var rr = rng(hash(key)), tx, ty, q, k = empty ? 0.45 : 1;
  for (ty = 0; ty < g.h; ty += 16) for (tx = 0; tx < g.w; tx += 16) {
    c.globalAlpha = (((tx + ty) / 16) % 2 ? 0.07 : 0.13) * k; c.fillStyle = col;
    c.fillRect(g.x + tx, g.y + ty, Math.min(16, g.w - tx), Math.min(16, g.h - ty));
  }
  c.globalAlpha = 0.28 * k; c.fillStyle = col; c.fillRect(g.x, g.y, g.w, 22);
  c.globalAlpha = empty ? 0.6 : 0.9; c.strokeStyle = col; c.lineWidth = 2;
  if (empty && c.setLineDash) c.setLineDash([6, 5]);
  c.strokeRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2);
  if (c.setLineDash) c.setLineDash([]);
  if (!empty) for (q = 0; q < 12; q++) { c.globalAlpha = 0.3; c.fillStyle = col; c.fillRect(g.x + 8 + Math.floor(rr() * (g.w - 20)), g.y + 62 + Math.floor(rr() * (g.h - 78)), 2, 2); }
  c.globalAlpha = 1;
}
function seatXY(col, row) { return [OX + col * CELLW + CELLW / 2, OY + row * ROWH]; }
var FIELD = { g1: "#5d9a4a", g2: "#559243", tuft: "#3f7a34", tuft2: "#7fbe66", dirt: "#a98358", dirt2: "#96724a", dirtD: "#6f5236", stone: "#a3a9b1", stoneD: "#6f7680",
  trunk: "#6b4426", pine1: "#2d6b3a", pine2: "#3f8f4f", pineD: "#1f4f2b", mount1: "#7c8fa6", mount2: "#a9bccf", snow: "#f2f6fb",
  wood: "#8b5e3c", woodD: "#5e3e26", woodL: "#b98a5a", thatch: "#cfae5c", thatch2: "#a98a3f", canvas: "#e8dcc0", hide: "#8a5a44", parch: "#ecdca8" };
var FIRES = [], TORCHES = [];
function pine(c, x, by, h) {
  var F = FIELD, w = Math.round(h * 0.62), k;
  c.fillStyle = F.trunk; c.fillRect(x - 2, by - 6, 4, 6);
  for (k = 0; k < 3; k++) {
    var ty = by - 6 - k * h * 0.26, ww = w - k * w * 0.26;
    c.fillStyle = k % 2 ? F.pine2 : F.pine1;
    c.beginPath(); c.moveTo(x, ty - h * 0.42); c.lineTo(x + ww / 2, ty); c.lineTo(x - ww / 2, ty); c.closePath(); c.fill();
  }
  c.fillStyle = F.pineD; c.globalAlpha = 0.35; c.fillRect(x + 1, by - 8, 2, 4); c.globalAlpha = 1;
}
function tent(c, cx, by, w, h, col) {
  var F = FIELD;
  c.fillStyle = col; c.beginPath(); c.moveTo(cx, by - h); c.lineTo(cx + w / 2, by); c.lineTo(cx - w / 2, by); c.closePath(); c.fill();
  c.fillStyle = "#000"; c.globalAlpha = 0.22; c.beginPath(); c.moveTo(cx, by - h); c.lineTo(cx + w / 2, by); c.lineTo(cx + 2, by); c.closePath(); c.fill(); c.globalAlpha = 1;
  c.fillStyle = F.woodD; c.beginPath(); c.moveTo(cx, by - h * 0.55); c.lineTo(cx + w * 0.13, by); c.lineTo(cx - w * 0.13, by); c.closePath(); c.fill();
  c.fillStyle = F.woodD; c.fillRect(cx - 1, by - h - 8, 2, 9);
  c.fillStyle = "#e5283c"; c.fillRect(cx + 1, by - h - 8, 8, 5);
}
function banner(c, x, y, col) {
  var F = FIELD;
  c.fillStyle = F.woodD; c.fillRect(x, y, 3, 48); c.fillStyle = F.woodL; c.fillRect(x - 1, y - 2, 5, 3);
  c.fillStyle = col; c.fillRect(x + 3, y + 2, 20, 18); c.beginPath(); c.moveTo(x + 3, y + 20); c.lineTo(x + 13, y + 26); c.lineTo(x + 23, y + 20); c.closePath(); c.fill();
  c.fillStyle = "#f4c95d"; c.fillRect(x + 10, y + 7, 6, 6);
}
function rock(c, x, y, w, h) {
  var F = FIELD;
  c.fillStyle = F.stoneD; c.fillRect(x, y + h * 0.3, w, h * 0.7); c.fillStyle = F.stone; c.fillRect(x + 2, y, w - 6, h * 0.6); c.fillStyle = "#fff"; c.globalAlpha = 0.25; c.fillRect(x + 4, y + 1, w * 0.3, 2); c.globalAlpha = 1;
}
function crate(c, x, y, s) {
  var F = FIELD;
  c.fillStyle = F.wood; c.fillRect(x, y, s, s); c.strokeStyle = F.woodD; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, s - 2, s - 2);
  c.beginPath(); c.moveTo(x + 2, y + 2); c.lineTo(x + s - 2, y + s - 2); c.moveTo(x + s - 2, y + 2); c.lineTo(x + 2, y + s - 2); c.stroke();
}
function dummy(c, x, y) {
  var F = FIELD;
  c.fillStyle = F.woodD; c.fillRect(x - 2, y - 10, 4, 34); c.fillRect(x - 14, y, 28, 4);
  c.fillStyle = F.thatch; c.fillRect(x - 9, y - 22, 18, 22); c.fillStyle = F.thatch2; c.fillRect(x - 9, y - 12, 18, 3);
  c.fillStyle = F.canvas; c.fillRect(x - 6, y - 32, 12, 10); c.fillStyle = "#e5283c"; c.fillRect(x - 3, y - 29, 6, 2);
  c.fillStyle = F.woodD; c.fillRect(x - 6, y + 24, 12, 3);
}
function campfireBase(c, x, y) {
  var F = FIELD, a;
  for (a = 0; a < 6.28; a += 0.8) { c.fillStyle = F.stoneD; c.fillRect(Math.round(x + Math.cos(a) * 13) - 3, Math.round(y + Math.sin(a) * 6) - 2, 6, 5); c.fillStyle = F.stone; c.fillRect(Math.round(x + Math.cos(a) * 13) - 3, Math.round(y + Math.sin(a) * 6) - 2, 6, 2); }
  c.fillStyle = "#2a1a10"; c.fillRect(x - 10, y - 2, 20, 4); c.fillStyle = F.woodD; c.fillRect(x - 8, y - 4, 16, 3);
  c.fillStyle = F.wood; c.fillRect(x - 24, y + 10, 12, 5); c.fillRect(x + 12, y + 10, 12, 5);
}
function dirtPatch(c, rr, x, y, w, h) {
  var F = FIELD, k;
  c.fillStyle = F.dirt; c.fillRect(x, y, w, h); c.fillStyle = F.dirt2;
  for (k = 0; k < w * h / 240; k++) c.fillRect(x + Math.floor(rr() * (w - 3)), y + Math.floor(rr() * (h - 2)), 3, 2);
  c.fillStyle = F.dirtD; c.globalAlpha = 0.45; c.fillRect(x, y, w, 2); c.fillRect(x, y + h - 2, w, 2); c.globalAlpha = 1;
}
var PLAZA_SHOPS = [
  { id: "hns", n: "홈앤쇼핑", url: "https://m.hnsmall.com", x: 60, y: 50, top: true, color: "#e8503a" },
  { id: "w", n: "W쇼핑", url: "https://www.w-shopping.co.kr/index", x: 450, y: 50, top: true, color: "#8a4fd0" },
  { id: "skstoa", n: "SK스토아", url: "https://m.skstoa.com/index", x: 840, y: 50, top: true, color: "#f0852a" },
  { id: "kt", n: "KT알파쇼핑", url: "https://m.kshop.co.kr", x: 60, y: 740, top: false, color: "#d8393f" },
  { id: "nt", n: "쇼핑엔T", url: "https://www.shoppingntmall.com/", x: 450, y: 740, top: false, color: "#2f86d6" },
  { id: "cware", n: "커머스웨어", url: "https://login.mailplug.com/auth/login?host_domain=cware.co.kr", x: 840, y: 740, top: false, color: "#2aa876" }
];
PLAZA_SHOPS.forEach(function (s) {
  s.w = 300; s.h = 180;
  s.door = { x: s.x + s.w / 2 - 36, y: s.top ? s.y + s.h : s.y - 44, w: 72, h: 44 };
});
var PLAZA_WALK = { x0: 40, x1: 1130, y0: 290, y1: 650 };
var PLAZA_FOUNT = { x: 600, y: 485, rx: 150, ry: 78 };
var PLAZA_PROPS = (function () {
  var list = [], pr = rng(20261007);
  function add(t, x, y, extra) { var p = { t: t, x: x, y: y }; Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; }); list.push(p); }
  [[60, 330, 40], [60, 640, 38], [1140, 330, 40], [1140, 640, 38], [330, 405, 42], [870, 405, 42], [330, 600, 42], [870, 600, 42], [405, 262, 34], [795, 262, 34], [405, 722, 34], [795, 722, 34]].forEach(function (a, i) {
    add("tree", a[0], a[1], { r: a[2], bloom: i % 3 === 0, seed: Math.floor(pr() * 1000) });
  });
  [[430, 345], [770, 345], [430, 630], [770, 630]].forEach(function (a) { add("bench", a[0], a[1], {}); });
  [[470, 300], [730, 300], [470, 670], [730, 670], [270, 485], [930, 485]].forEach(function (a) { add("lamp", a[0], a[1], {}); });
  PLAZA_SHOPS.forEach(function (s) {
    var cy = s.top ? s.door.y + 34 : s.door.y + 12, cx = s.x + s.w / 2;
    add("planter", cx - 74, cy, { color: s.color }); add("planter", cx + 74, cy, { color: s.color });
  });
  add("statue", 150, 485, {});
  add("umbrella", 1050, 485, { color: "#e8503a" });
  add("umbrella", 1050, 560, { color: "#2f86d6" });
  list.sort(function (a, b) { return a.y - b.y; });
  return list;
})();
function plazaSolid(p) {
  switch (p.t) {
    case "tree": return { rx: 13, ry: 8 };
    case "bench": return { rx: 38, ry: 9 };
    case "lamp": return { rx: 6, ry: 4 };
    case "planter": return { rx: 28, ry: 10 };
    case "statue": return { rx: 40, ry: 12 };
    case "umbrella": return { rx: 30, ry: 12 };
  }
  return null;
}
function plazaBlocked(x, y) {
  var fx = x + CW / 2, fy = y + CH, i, s, p, q, F = PLAZA_FOUNT;
  for (i = 0; i < PLAZA_SHOPS.length; i++) { s = PLAZA_SHOPS[i]; if (fx > s.x && fx < s.x + s.w && fy > s.y + 20 && fy < s.y + s.h) return true; }
  if (Math.pow((fx - F.x) / (F.rx - 4), 2) + Math.pow((fy - F.y) / (F.ry - 2), 2) < 1) return true;
  for (i = 0; i < PLAZA_PROPS.length; i++) {
    p = PLAZA_PROPS[i]; q = plazaSolid(p);
    if (q && Math.pow((fx - p.x) / q.rx, 2) + Math.pow((fy - p.y) / q.ry, 2) < 1) return true;
  }
  return false;
}
function plazaSpot() {
  var k, p;
  for (k = 0; k < 12; k++) { p = randIn(PLAZA_WALK); if (!plazaBlocked(p[0], p[1])) return p; }
  return p;
}
function plazaShopAt(x, y) {
  var fx = x + CW / 2, fy = y + CH, i, s, d;
  for (i = 0; i < PLAZA_SHOPS.length; i++) { s = PLAZA_SHOPS[i]; d = s.door; if (fx >= d.x - 10 && fx <= d.x + d.w + 10 && fy >= d.y - 6 && fy <= d.y + d.h + 6) return s; }
  return null;
}
function plazaRR(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function plazaShade(c, x, y, rx, ry, a) { c.globalAlpha = a; c.fillStyle = "#0b1a10"; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
function paintPlazaMap(c) {
  var dark = T === TH.dark, font = "'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif", pr = rng(20261008), x, y, k;
  var pal = dark
    ? { grass: "#24523a", grass2: "#2a5c41", t1: "#323a4b", t2: "#2c3443", ring: "#3d4659", edge: "#171c28", body: "#e9e6de", glass: ["#4d7a96", "#2f526b"], stone: "#8b94a6" }
    : { grass: "#8ccb9b", grass2: "#82c392", t1: "#f1ecdf", t2: "#e8e2d3", ring: "#fbf8ef", edge: "#b9b29f", body: "#fffdf8", glass: ["#bfe6f5", "#8fc7de"], stone: "#cfc8b8" };
  c.fillStyle = pal.grass; c.fillRect(0, 0, MAP_W, MAP_H);
  for (y = 0; y < MAP_H; y += 36) { c.fillStyle = pal.grass2; c.fillRect(0, y, MAP_W, 18); }
  c.fillStyle = dark ? "#3a7a55" : "#a5dbb2";
  for (k = 0; k < 260; k++) c.fillRect(Math.floor(pr() * MAP_W), Math.floor(pr() * MAP_H), 2, 4);

  /* 광장 포장 */
  c.save(); plazaRR(c, 24, 236, 1152, 500, 30); c.clip();
  for (y = 236; y < 736; y += 40) for (x = 24; x < 1176; x += 40) { c.fillStyle = ((x - 24) / 40 + (y - 236) / 40) % 2 ? pal.t1 : pal.t2; c.fillRect(x, y, 40, 40); }
  c.globalAlpha = dark ? 0.25 : 0.55; c.fillStyle = pal.ring;
  c.beginPath(); c.ellipse(PLAZA_FOUNT.x, PLAZA_FOUNT.y, 250, 138, 0, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1; c.strokeStyle = dark ? "#4a5468" : "#d9d1bd"; c.lineWidth = 3; c.setLineDash([10, 8]);
  c.beginPath(); c.ellipse(PLAZA_FOUNT.x, PLAZA_FOUNT.y, 250, 138, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  PLAZA_SHOPS.forEach(function (s) {
    var d = s.door, g = c.createLinearGradient(0, s.top ? d.y : d.y + d.h, 0, s.top ? d.y + 120 : d.y - 76);
    g.addColorStop(0, s.color + "55"); g.addColorStop(1, s.color + "00");
    c.fillStyle = g; c.fillRect(d.x - 20, s.top ? d.y : d.y - 76, d.w + 40, 120);
  });
  c.restore();
  c.strokeStyle = pal.edge; c.lineWidth = 3; plazaRR(c, 24, 236, 1152, 500, 30); c.stroke();

  /* 건물 */
  PLAZA_SHOPS.forEach(function (s) {
    var d = s.door, cx = s.x + s.w / 2, sy = s.top ? s.y : s.y + s.h - 50, wy = s.top ? s.y + 66 : s.y + 40, dy = s.top ? s.y + s.h - 70 : s.y, g, i;
    plazaShade(c, cx + 10, s.y + s.h + (s.top ? 8 : -6), s.w / 2 + 10, 12, 0.22);
    c.fillStyle = pal.body; plazaRR(c, s.x, s.y, s.w, s.h, 18); c.fill();
    c.lineWidth = 3; c.strokeStyle = pal.edge; c.stroke();
    c.fillStyle = s.color; c.save(); plazaRR(c, s.x, s.y, s.w, s.h, 18); c.clip(); c.fillRect(s.x, sy, s.w, 50); c.restore();
    c.fillStyle = "#ffffff30"; c.fillRect(s.x, sy, s.w, 6);
    c.font = "700 24px " + font; c.textAlign = "center"; c.fillStyle = "rgba(0,0,0,.18)"; c.fillText(s.n, cx, sy + 35);
    c.fillStyle = "#fff"; c.fillText(s.n, cx, sy + 34);
    for (i = 0; i < 3; i++) {
      var gx = s.x + 22 + i * 90 - (i === 1 ? 0 : 0), gw = 76, gh = 54;
      if (Math.abs(gx + gw / 2 - cx) < 50) continue;
      g = c.createLinearGradient(0, wy, 0, wy + gh); g.addColorStop(0, pal.glass[0]); g.addColorStop(1, pal.glass[1]);
      c.fillStyle = g; plazaRR(c, gx, wy, gw, gh, 8); c.fill();
      c.strokeStyle = pal.edge; c.lineWidth = 2; c.stroke();
      c.fillStyle = "#ffffff55"; c.beginPath(); c.moveTo(gx + 10, wy + gh - 4); c.lineTo(gx + 26, wy + 4); c.lineTo(gx + 36, wy + 4); c.lineTo(gx + 20, wy + gh - 4); c.closePath(); c.fill();
    }
    /* 어닝 + 문 */
    var ay = s.top ? dy - 14 : dy + 70;
    c.fillStyle = "#1f2530"; plazaRR(c, cx - 28, dy, 56, 70, 10); c.fill();
    g = c.createLinearGradient(0, dy, 0, dy + 70); g.addColorStop(0, "#9bd4ea"); g.addColorStop(1, "#5a97b3");
    c.fillStyle = g; plazaRR(c, cx - 24, dy + 4, 48, 62, 8); c.fill();
    c.fillStyle = "#ffffff55"; c.fillRect(cx - 2, dy + 4, 4, 62);
    c.fillStyle = "#f2c14e"; c.fillRect(cx - 8, dy + 38, 3, 10); c.fillRect(cx + 5, dy + 38, 3, 10);
    for (i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#ffffff" : s.color; c.fillRect(cx - 40 + i * 10, ay, 10, 14); }
    c.fillStyle = s.color; c.beginPath(); c.arc(cx - 40 + 5, ay + 14, 5, 0, Math.PI); c.fill();
    c.globalAlpha = 0.45; c.fillStyle = s.color; plazaRR(c, d.x + 6, s.top ? d.y + 14 : d.y + 4, d.w - 12, 26, 8); c.fill(); c.globalAlpha = 1;
  });
  c.textAlign = "left";

  /* 조형물 */
  PLAZA_PROPS.forEach(function (p) {
    var i, a;
    if (p.t === "tree") {
      var r = p.r, tr = rng(p.seed);
      plazaShade(c, p.x + 10, p.y + 2, r * 0.9, r * 0.32, dark ? 0.35 : 0.22);
      c.fillStyle = dark ? "#4a3a2c" : "#7a5a3c"; c.fillRect(p.x - 5, p.y - 24, 10, 26);
      c.fillStyle = dark ? "#1f5a3a" : "#3f9a5f"; c.beginPath(); c.arc(p.x, p.y - r * 1.1, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = dark ? "#287048" : "#52b36f"; c.beginPath(); c.arc(p.x - r * 0.4, p.y - r * 0.85, r * 0.72, 0, Math.PI * 2); c.arc(p.x + r * 0.45, p.y - r * 0.9, r * 0.66, 0, Math.PI * 2); c.fill();
      c.fillStyle = dark ? "#34885a" : "#78cc8b"; c.beginPath(); c.arc(p.x - r * 0.3, p.y - r * 1.3, r * 0.42, 0, Math.PI * 2); c.fill();
      if (p.bloom) for (i = 0; i < 16; i++) { a = tr() * Math.PI * 2; c.fillStyle = i % 2 ? "#ff9fc0" : "#ffd36a"; c.fillRect(Math.round(p.x + Math.cos(a) * r * 0.8 * tr()), Math.round(p.y - r * 1.1 + Math.sin(a) * r * 0.8 * tr()), 4, 4); }
    } else if (p.t === "bench") {
      plazaShade(c, p.x + 4, p.y + 12, 40, 6, 0.2);
      c.fillStyle = "#3b3f4a"; c.fillRect(p.x - 32, p.y - 2, 5, 14); c.fillRect(p.x + 27, p.y - 2, 5, 14);
      c.fillStyle = "#b9824f"; for (i = 0; i < 3; i++) c.fillRect(p.x - 37, p.y - 16 + i * 6, 74, 5);
      c.fillStyle = "#8f6038"; c.fillRect(p.x - 37, p.y - 16, 74, 2);
    } else if (p.t === "lamp") {
      plazaShade(c, p.x + 6, p.y + 2, 12, 4, 0.25);
      c.fillStyle = dark ? "#9aa3b8" : "#3d4452"; c.fillRect(p.x - 2, p.y - 58, 4, 58); c.fillRect(p.x - 6, p.y - 4, 12, 5);
      c.fillStyle = "#fff3b8"; c.beginPath(); c.arc(p.x, p.y - 62, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = dark ? "#9aa3b8" : "#3d4452"; c.lineWidth = 2; c.stroke();
    } else if (p.t === "planter") {
      plazaShade(c, p.x + 4, p.y + 10, 30, 6, 0.2);
      c.fillStyle = dark ? "#5a4636" : "#c98a5a"; plazaRR(c, p.x - 26, p.y - 4, 52, 16, 5); c.fill();
      c.fillStyle = dark ? "#2a7a4a" : "#4caf6e"; c.beginPath(); c.ellipse(p.x, p.y - 4, 26, 10, 0, 0, Math.PI * 2); c.fill();
      for (i = 0; i < 9; i++) { c.fillStyle = i % 3 === 0 ? "#ff9fc0" : i % 3 === 1 ? p.color : "#ffe08a"; c.fillRect(p.x - 22 + i * 5, p.y - 12 + (i * 7 % 6), 4, 4); }
    } else if (p.t === "statue") {
      plazaShade(c, p.x + 8, p.y + 14, 46, 10, 0.25);
      c.fillStyle = dark ? "#6a7388" : "#d5cebd"; plazaRR(c, p.x - 40, p.y - 6, 80, 22, 6); c.fill();
      c.fillStyle = dark ? "#59627a" : "#bdb5a2"; c.fillRect(p.x - 40, p.y + 10, 80, 6);
      c.lineWidth = 9; c.strokeStyle = "#2ec4b6"; c.beginPath(); c.ellipse(p.x, p.y - 58, 26, 46, 0, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 5; c.strokeStyle = "#ffbe3d"; c.beginPath(); c.ellipse(p.x, p.y - 58, 14, 30, 0.6, 0, Math.PI * 2); c.stroke();
      c.fillStyle = "#ff5d8f"; c.beginPath(); c.arc(p.x, p.y - 58, 7, 0, Math.PI * 2); c.fill();
    } else if (p.t === "umbrella") {
      plazaShade(c, p.x + 8, p.y + 12, 46, 10, 0.2);
      c.fillStyle = dark ? "#4b5366" : "#f4f1e8"; c.beginPath(); c.ellipse(p.x, p.y, 28, 11, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#555e70"; c.fillRect(p.x - 2, p.y - 60, 4, 62);
      for (i = 0; i < 6; i++) {
        c.fillStyle = i % 2 ? "#ffffff" : p.color;
        c.beginPath(); c.moveTo(p.x, p.y - 66); c.lineTo(p.x - 48 + i * 16, p.y - 40); c.lineTo(p.x - 32 + i * 16, p.y - 40); c.closePath(); c.fill();
      }
      c.fillStyle = dark ? "#6a7388" : "#d9d3c5"; c.fillRect(p.x - 40, p.y + 4, 10, 8); c.fillRect(p.x + 30, p.y + 4, 10, 8);
    }
  });
  plazaShade(c, PLAZA_FOUNT.x + 14, PLAZA_FOUNT.y + 10, PLAZA_FOUNT.rx + 6, PLAZA_FOUNT.ry + 6, 0.2);
  c.globalAlpha = 1; c.textAlign = "left";
}
function drawPlazaLive() {
  var t = lastT / 1000, F = PLAZA_FOUNT, x = F.x, y = F.y, dark = T === TH.dark, i, k, p, a, g, len, tx, ty, cx, cy;
  mctx.save();
  mctx.globalAlpha = 1; mctx.fillStyle = dark ? "#7d8799" : "#e4ddcc"; mctx.beginPath(); mctx.ellipse(x, y, F.rx, F.ry, 0, 0, Math.PI * 2); mctx.fill();
  mctx.fillStyle = dark ? "#656f82" : "#c9c1ae"; mctx.beginPath(); mctx.ellipse(x, y + 4, F.rx - 8, F.ry - 6, 0, 0, Math.PI * 2); mctx.fill();
  g = mctx.createRadialGradient(x - 40, y - 20, 10, x, y, F.rx);
  g.addColorStop(0, dark ? "#4f8fb0" : "#a3e2f3"); g.addColorStop(1, dark ? "#2b6283" : "#4eb0d6");
  mctx.fillStyle = g; mctx.beginPath(); mctx.ellipse(x, y + 4, F.rx - 16, F.ry - 14, 0, 0, Math.PI * 2); mctx.fill();
  for (k = 0; k < 3; k++) {
    p = (t * 0.45 + k / 3) % 1;
    mctx.globalAlpha = (1 - p) * 0.7; mctx.strokeStyle = "#ffffff"; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.ellipse(x, y + 8, 30 + (F.rx - 56) * p, 14 + (F.ry - 32) * p, 0, 0, Math.PI * 2); mctx.stroke();
  }
  mctx.globalAlpha = 1;
  mctx.fillStyle = dark ? "#8d97aa" : "#ddd6c4"; mctx.beginPath(); mctx.ellipse(x, y - 14, 64, 32, 0, 0, Math.PI * 2); mctx.fill();
  mctx.fillStyle = dark ? "#5d6a80" : "#b7af9b"; mctx.beginPath(); mctx.ellipse(x, y - 10, 56, 26, 0, 0, Math.PI * 2); mctx.fill();
  mctx.fillStyle = dark ? "#5aa0c2" : "#8fdcf0"; mctx.beginPath(); mctx.ellipse(x, y - 10, 50, 22, 0, 0, Math.PI * 2); mctx.fill();
  mctx.fillStyle = dark ? "#aab3c4" : "#e9e3d3"; mctx.fillRect(x - 8, y - 58, 16, 46);
  mctx.beginPath(); mctx.ellipse(x, y - 56, 28, 12, 0, 0, Math.PI * 2); mctx.fill();
  mctx.fillStyle = dark ? "#5aa0c2" : "#8fdcf0"; mctx.beginPath(); mctx.ellipse(x, y - 58, 22, 8, 0, 0, Math.PI * 2); mctx.fill();
  mctx.lineCap = "round";
  for (i = 0; i < 8; i++) {
    a = i * Math.PI / 4; len = 70;
    tx = x + Math.cos(a) * len; ty = y - 10 + Math.sin(a) * len * 0.5;
    mctx.globalAlpha = 0.85; mctx.strokeStyle = "#eaf9ff"; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.moveTo(x, y - 62); mctx.quadraticCurveTo((x + tx) / 2, y - 96, tx, ty); mctx.stroke();
    p = (t * 0.8 + i * 0.125) % 1; cx = x + (tx - x) * p; cy = (y - 62) + (ty - (y - 62)) * p - Math.sin(p * Math.PI) * 34;
    mctx.globalAlpha = 1; mctx.fillStyle = "#ffffff"; mctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 4, 4);
  }
  mctx.globalAlpha = 0.9; mctx.strokeStyle = "#ffffff"; mctx.lineWidth = 3;
  mctx.beginPath(); mctx.moveTo(x, y - 62); mctx.lineTo(x, y - 62 - 34 - Math.sin(t * 5) * 6); mctx.stroke();
  /* 가로등 빛 */
  PLAZA_PROPS.forEach(function (q) {
    if (q.t !== "lamp") return;
    var fl = 0.9 + 0.1 * Math.sin(t * 2 + q.x), r = dark ? 130 : 70, gl = mctx.createRadialGradient(q.x, q.y - 62, 4, q.x, q.y - 62, r);
    gl.addColorStop(0, "rgba(255,236,160," + (dark ? 0.55 : 0.22) * fl + ")"); gl.addColorStop(1, "rgba(255,236,160,0)");
    mctx.globalAlpha = 1; mctx.fillStyle = gl; mctx.fillRect(q.x - r, q.y - 62 - r, r * 2, r * 2);
  });
  mctx.restore();
}
function paintOfficeMap(c) {
  var x, y, k, m = MEET, rooms = [];
  c.fillStyle = "#211d1a"; c.fillRect(0, 0, MAP_W, MAP_H);
  c.fillStyle = "#34302c"; c.fillRect(16, 10, 928, 690);
  for (y = 10; y < 700; y += 40) {
    c.fillStyle = y % 80 ? "#38332f" : "#3b3632"; c.fillRect(16, y, 928, 39);
    c.strokeStyle = "#302b28"; c.lineWidth = 1; c.beginPath(); c.moveTo(16, y + 39); c.lineTo(944, y + 39); c.stroke();
    for (x = 16 + (y % 80 ? 0 : 58); x < 944; x += 116) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 39); c.stroke(); }
  }
  c.fillStyle = "#242a2a"; c.fillRect(16, 10, 928, 34); c.fillRect(16, 668, 928, 32);
  c.fillStyle = "#586360"; c.fillRect(26, 16, 908, 3); c.fillRect(26, 674, 908, 3);
  for (x = 38; x < 920; x += 112) {
    c.fillStyle = "#1a2425"; c.fillRect(x, 20, 94, 19);
    c.fillStyle = "#5b8586"; c.fillRect(x + 3, 22, 88, 14);
    c.fillStyle = "#d7e5d9"; c.globalAlpha = 0.24; c.fillRect(x + 6, 23, 37, 2); c.globalAlpha = 1;
  }
  c.fillStyle = "#282522"; c.fillRect(30, 48, 900, 618);
  c.fillStyle = "#45403b"; c.fillRect(34, 52, 892, 610);
  c.fillStyle = "#403a35"; c.globalAlpha = 0.65;
  for (x = 34; x < 926; x += 60) c.fillRect(x, 52, 1, 610);
  c.globalAlpha = 1;
  c.fillStyle = "#282522";
  SEATS.forEach(function (s) {
    var left = s.cx - 45, top = s.ry + 4;
    c.fillRect(left, top, 90, 4);
    c.fillRect(left, top, 3, 30);
    c.fillRect(left + 87, top, 3, 30);
    if (s.kind === "person") { c.fillStyle = "#77736d"; c.fillRect(s.cx - 10, s.ry + 65, 20, 6); c.fillRect(s.cx - 2, s.ry + 71, 4, 6); }
    c.fillStyle = "#282522";
  });
  c.fillStyle = "#292d2c"; c.fillRect(m.x, m.y, m.w, m.h);
  c.fillStyle = "#141a1b"; c.fillRect(m.x + 3, m.y + 3, m.w - 6, m.h - 6);
  c.strokeStyle = "#8d9994"; c.lineWidth = 2;
  for (k = 0; k < 3; k++) {
    var room = { x: m.x + 8, y: 64 + k * 210, w: m.w - 16, h: 186 };
    rooms.push(room);
    c.fillStyle = "#4b504e"; c.fillRect(room.x, room.y, room.w, room.h);
    c.strokeRect(room.x + 1, room.y + 1, room.w - 2, room.h - 2);
    c.fillStyle = "#262c2d"; c.fillRect(room.x + 5, room.y + 5, room.w - 10, room.h - 10);
    c.fillStyle = "#78908f"; c.fillRect(room.x + 12, room.y + 8, room.w - 24, 3);
    c.fillStyle = "#192122"; c.fillRect(room.x + room.w - 38, room.y + room.h - 5, 26, 8);
    c.fillStyle = "#d7ded7"; c.font = "700 10px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; c.textAlign = "left";
    c.fillText("회의실 0" + (k + 1), room.x + 12, room.y + 26);
    var table = TABLES[k];
    c.fillStyle = "#c9c2b7";
    c.fillRect(table.x - 47, table.y - 8, 14, 16); c.fillRect(table.x + 33, table.y - 8, 14, 16);
    c.fillRect(table.x - 8, table.y - 32, 16, 12); c.fillRect(table.x - 8, table.y + 20, 16, 12);
  }
  c.fillStyle = "#201d1a"; c.fillRect(16, 716, 928, 242);
  c.fillStyle = "#3d3732"; c.fillRect(24, 724, 912, 226);
  c.strokeStyle = "#77736d"; c.lineWidth = 2; c.strokeRect(24, 724, 912, 226);
  c.fillStyle = "#e5e1da"; c.font = "700 13px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; c.textAlign = "left";
  c.fillText("프로젝트 팀 워크존", 34, 737);
  Object.keys(REGIONS).forEach(function (u) {
    var g = REGIONS[u], color = ucol(u), empty = UNI[u].hidden;
    c.fillStyle = empty ? "#33302d" : "#4b4540"; c.fillRect(g.x, g.y, g.w, g.h);
    c.strokeStyle = empty ? "#76736d" : color; c.lineWidth = 2; c.strokeRect(g.x + 1, g.y + 1, g.w - 2, g.h - 2);
    c.fillStyle = color; c.fillRect(g.x + 8, g.y + 10, g.w - 16, 4);
    c.fillStyle = "#e0ddd6"; c.font = "700 11px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; c.textAlign = "center";
    c.fillText(empty ? "비어 있음" : fit(c, UNI[u].realm, g.w - 12), g.x + g.w / 2, g.y + 34);
  });
  c.fillStyle = "#e5e1da"; c.font = "700 13px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; c.textAlign = "left";
  c.fillText("사무실", 32, 64); c.textAlign = "left";
}
function paintMap() {
  var c = bg.getContext("2d"), F = FIELD, tx, ty, i, k, rr = rng(7), late = [], m = MEET, fx = 16, fy = 10, fw = 928, fh = 690;
  c.setTransform(MAP_SCALE, 0, 0, MAP_SCALE, 0, 0); c.imageSmoothingEnabled = false; c.globalAlpha = 1;
  FIRES = []; TORCHES = [];
  if (WORLD_THEME === "office") { paintOfficeMap(c); return; }
  if (WORLD_THEME === "plaza") { paintPlazaMap(c); return; }
  c.fillStyle = T.bg; c.fillRect(0, 0, MAP_W, MAP_H);
  /* 전장 바닥: 풀밭 */
  for (ty = fy; ty < fy + fh; ty += 22) for (tx = fx; tx < fx + fw; tx += 22) { c.fillStyle = ((tx - fx) / 22 + (ty - fy) / 22) % 2 ? F.g1 : F.g2; c.fillRect(tx, ty, 22, Math.min(22, fy + fh - ty)); }
  for (i = 0; i < 480; i++) {
    var gx = fx + 6 + Math.floor(rr() * (fw - 12)), gy = fy + 70 + Math.floor(rr() * (fh - 74));
    c.fillStyle = rr() < 0.5 ? F.tuft : F.tuft2; c.fillRect(gx, gy, 2, 4); c.fillRect(gx + 3, gy + 1, 2, 3); c.fillRect(gx - 3, gy + 1, 2, 3);
  }
  /* 흙길: 막사로 가는 길, 야영지로 내려가는 길 */
  dirtPatch(c, rr, 640, 335, 304, 34); dirtPatch(c, rr, 430, 440, 44, 260);
  /* 중앙 결투장 */
  c.fillStyle = F.dirt; c.beginPath(); c.ellipse(450, 330, 200, 115, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = F.dirt2; for (k = 0; k < 160; k++) { var ax = 450 + (rr() - 0.5) * 380, ay = 330 + (rr() - 0.5) * 210; if (Math.pow((ax - 450) / 195, 2) + Math.pow((ay - 330) / 110, 2) < 1) c.fillRect(Math.round(ax), Math.round(ay), 3, 2); }
  for (k = 0; k < 6.28; k += 0.1) { var sx = Math.round(450 + Math.cos(k) * 203), sy = Math.round(330 + Math.sin(k) * 118); c.fillStyle = F.stoneD; c.fillRect(sx - 3, sy - 2, 7, 6); c.fillStyle = F.stone; c.fillRect(sx - 3, sy - 2, 7, 3); }
  c.strokeStyle = F.dirtD; c.globalAlpha = 0.5; c.lineWidth = 2; c.beginPath(); c.ellipse(450, 330, 120, 68, 0, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(450, 262); c.lineTo(450, 398); c.moveTo(330, 330); c.lineTo(570, 330); c.stroke(); c.globalAlpha = 1;
  /* 먼 산과 숲 */
  for (i = 0; i < 14; i++) {
    var mx = fx + i * 68 - 10, mh = 22 + ((i * 5 + 2) % 4) * 6;
    c.fillStyle = F.mount1; c.beginPath(); c.moveTo(mx, fy + 56); c.lineTo(mx + 38, fy + 56 - mh); c.lineTo(mx + 76, fy + 56); c.closePath(); c.fill();
    c.fillStyle = F.snow; c.beginPath(); c.moveTo(mx + 38, fy + 56 - mh); c.lineTo(mx + 47, fy + 56 - mh + 9); c.lineTo(mx + 29, fy + 56 - mh + 9); c.closePath(); c.fill();
  }
  c.fillStyle = F.pineD; c.fillRect(fx, fy + 52, fw, 14);
  for (i = 0; i < 22; i++) pine(c, fx + 20 + i * 42, fy + 66 + (i % 2) * 4, 36 + (i * 7 % 3) * 8);
  for (i = 0; i < 7; i++) { pine(c, fx + 14, 140 + i * 72, 40); pine(c, fx + fw - 108, 130 + i * 78, 38); }
  /* 깃발, 훈련 허수아비, 바위, 보급품 */
  banner(c, 96, 96, "#d33a3a"); banner(c, 800, 96, "#3a7bd5"); banner(c, 292, 232, "#8a5ad6"); banner(c, 640, 232, "#e0a020");
  dummy(c, 52, 250); dummy(c, 52, 340); dummy(c, 52, 430);
  [[120, 500, 22, 16], [780, 480, 26, 18], [610, 570, 18, 12], [170, 150, 20, 14], [860, 250, 22, 16]].forEach(function (q) { rock(c, q[0], q[1], q[2], q[3]); });
  /* 야영지 (아래쪽): 모닥불, 천막, 보급 */
  campfireBase(c, 250, 640); FIRES.push([250, 640, 1.3]);
  tent(c, 110, 690, 96, 64, "#b8452f"); tent(c, 390, 688, 84, 56, "#3f6fb0");
  crate(c, 560, 664, 22); crate(c, 584, 668, 18); crate(c, 566, 646, 16);
  for (k = 0; k < 4; k++) { c.fillStyle = F.woodD; c.fillRect(640 + k * 12, 650, 2, 40); c.fillStyle = F.stone; c.fillRect(639 + k * 12, 646, 4, 6); }
  c.fillStyle = F.wood; c.fillRect(632, 672, 56, 4); c.fillRect(632, 686, 56, 4);
  for (k = 0; k < 3; k++) { c.fillStyle = F.wood; c.fillRect(730 + k * 26, 660, 20, 26); c.fillStyle = F.woodD; c.fillRect(730 + k * 26, 666, 20, 3); c.fillRect(730 + k * 26, 678, 20, 3); }
  c.fillStyle = F.woodD; for (k = 0; k < 18; k++) { c.fillRect(fx + 6 + k * 50, 694, 3, 8); }
  c.fillRect(fx + 4, 696, fw - 8, 3);
  /* 작전 막사 (움막) */
  for (ty = m.y; ty < m.y + m.h; ty += 16) { c.fillStyle = ((ty - m.y) / 16) % 2 ? "#6b4a2e" : "#74512f"; c.fillRect(m.x, ty, m.w, 16); c.fillStyle = "#3f2a1a"; c.fillRect(m.x, ty, m.w, 1); }
  c.fillStyle = F.hide; c.fillRect(m.x + 26, m.y + 116, m.w - 52, m.h - 160);
  c.fillStyle = "#6d4432"; for (k = 0; k < 40; k++) c.fillRect(m.x + 30 + Math.floor(rr() * (m.w - 66)), m.y + 120 + Math.floor(rr() * (m.h - 168)), 4, 2);
  c.strokeStyle = F.woodD; c.lineWidth = 2; if (c.setLineDash) c.setLineDash([5, 4]); c.strokeRect(m.x + 26, m.y + 116, m.w - 52, m.h - 160); if (c.setLineDash) c.setLineDash([]);
  c.fillStyle = F.thatch; c.fillRect(m.x, m.y, m.w, 46);
  for (k = 0; k < m.w; k += 8) { c.fillStyle = F.thatch2; c.fillRect(m.x + k, m.y + 4 + (k % 16 ? 0 : 6), 2, 30); }
  c.fillStyle = F.thatch; for (k = 0; k < m.w; k += 12) { c.beginPath(); c.moveTo(m.x + k, m.y + 46); c.lineTo(m.x + k + 12, m.y + 46); c.lineTo(m.x + k + 6, m.y + 56); c.closePath(); c.fill(); }
  c.fillStyle = F.woodD; c.fillRect(m.x, m.y + 44, m.w, 4);
  c.fillStyle = F.parch; c.fillRect(m.x + 44, m.y + 66, m.w - 88, 46); c.strokeStyle = F.woodD; c.lineWidth = 2; c.strokeRect(m.x + 44, m.y + 66, m.w - 88, 46);
  c.strokeStyle = "#8a2a20"; c.lineWidth = 2; c.beginPath(); c.moveTo(m.x + 58, m.y + 100); c.lineTo(m.x + 90, m.y + 82); c.lineTo(m.x + 120, m.y + 96); c.lineTo(m.x + 170, m.y + 76); c.stroke();
  c.fillStyle = "#8a2a20"; c.fillRect(m.x + 166, m.y + 72, 8, 8); c.fillStyle = "#2a5a9a"; c.fillRect(m.x + 86, m.y + 78, 6, 6);
  [140, 350, 560].forEach(function (ty2) { [m.x + 12, m.x + m.w - 12].forEach(function (tx2) {
    c.fillStyle = F.woodD; c.fillRect(tx2 - 2, ty2, 4, 30); c.fillStyle = F.woodL; c.fillRect(tx2 - 5, ty2 - 3, 10, 4); TORCHES.push([tx2, ty2 - 4]);
  }); });
  c.fillStyle = F.woodD; c.fillRect(m.x, m.y, 8, m.h); c.fillRect(m.x + m.w - 8, m.y, 8, m.h); c.fillRect(m.x, m.y + m.h - 8, m.w, 8);
  c.fillStyle = F.wood; for (k = 0; k < m.h; k += 20) { c.fillRect(m.x + 1, m.y + k + 2, 6, 16); c.fillRect(m.x + m.w - 7, m.y + k + 2, 6, 16); }
  late.push(function () {
    c.font = "700 12px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; c.textAlign = "center";
    c.fillStyle = "#2a1a10"; c.fillRect(m.x + m.w / 2 - 40, m.y + 14, 80, 20); c.fillStyle = "#f4dfa8"; c.fillText("작전 막사", m.x + m.w / 2, m.y + 28);
    c.textAlign = "left";
  });
  /* 용병 진영 (프로젝트 팀) */
  c.fillStyle = "#5a4630"; c.fillRect(16, 716, 928, 242);
  for (k = 0; k < 200; k++) { c.fillStyle = k % 2 ? F.dirt2 : F.dirt; c.fillRect(20 + Math.floor(rr() * 920), 720 + Math.floor(rr() * 234), 4, 2); }
  Object.keys(REGIONS).forEach(function (u) {
    var g = REGIONS[u], col = ucol(u), empty = UNI[u].hidden, sx;
    c.fillStyle = F.dirt; c.fillRect(g.x, g.y, g.w, g.h);
    for (k = 0; k < 40; k++) { c.fillStyle = F.dirt2; c.fillRect(g.x + 4 + Math.floor(rr() * (g.w - 10)), g.y + 24 + Math.floor(rr() * (g.h - 30)), 4, 2); }
    if (!empty) { c.globalAlpha = 0.2; c.fillStyle = col; c.fillRect(g.x, g.y, g.w, g.h); c.globalAlpha = 1; }
    for (sx = g.x + 2; sx < g.x + g.w - 6; sx += 10) { c.fillStyle = F.woodD; c.fillRect(sx, g.y - 7, 6, 10); c.fillStyle = F.woodL; c.fillRect(sx, g.y - 7, 6, 2); c.fillRect(sx, g.y + g.h - 3, 6, 6); }
    c.fillStyle = F.woodD; c.fillRect(g.x, g.y, g.w, 22); c.fillRect(g.x, g.y + g.h - 3, g.w, 3); c.fillRect(g.x, g.y, 3, g.h); c.fillRect(g.x + g.w - 3, g.y, 3, g.h);
    if (empty) { c.fillStyle = "#000"; c.globalAlpha = 0.18; c.fillRect(g.x, g.y + 22, g.w, g.h - 22); c.globalAlpha = 1; tent(c, g.x + g.w / 2, g.y + g.h / 2 + 14, 70, 46, "#8f8a80"); }
    else { tent(c, g.x + g.w / 2, g.y + 66, 62, 40, col); campfireBase(c, g.x + g.w - 40, g.y + g.h - 24); FIRES.push([g.x + g.w - 40, g.y + g.h - 24, 0.8]); banner(c, g.x + 16, g.y + 24, col); }
    late.push(function () {
      c.font = "700 12px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; c.textAlign = "center";
      if (empty) { c.fillStyle = "#f4dfa8"; c.fillText("빈 용병 진영", g.x + g.w / 2, g.y + 15); c.font = "500 11px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; c.fillStyle = "#f2e6c8"; c.fillText("‘용병단’ 탭에서", g.x + g.w / 2, g.y + g.h - 44); c.fillText("용병단을 꾸릴 수 있어요", g.x + g.w / 2, g.y + g.h - 28); }
      else { c.fillStyle = "#f4dfa8"; c.fillText(fit(c, UNI[u].realm, g.w - 14), g.x + g.w / 2, g.y + 15); }
      c.textAlign = "left";
    });
  });
  /* 밤 분위기 (다크 모드) */
  if (T.night) { c.globalAlpha = T.night; c.fillStyle = "#0a1233"; c.fillRect(0, 0, MAP_W, MAP_H); c.globalAlpha = 1; }
  /* 글자 */
  c.font = "700 13px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif"; c.textBaseline = "alphabetic";
  c.fillStyle = F.woodD; c.fillRect(24, 48, 70, 22); c.fillStyle = F.woodL; c.fillRect(24, 48, 70, 3); c.fillStyle = "#f4dfa8"; c.fillText("⚔ 전장", 34, 64);
  c.fillStyle = "#f4dfa8"; c.fillText("용병 진영", 32, 732);
  late.forEach(function (fn) { fn(); });
  c.globalAlpha = 1;
}
function flame(x, y, s) {
  var t = lastT / 110 + x * 0.3, h = 7 * s + Math.sin(t) * 2 * s + Math.sin(t * 2.3) * 1.5 * s;
  mctx.fillStyle = "#ff7a1a"; mctx.fillRect(Math.round(x - 3 * s), Math.round(y - h), Math.round(6 * s), Math.round(h));
  mctx.fillStyle = "#ffc13b"; mctx.fillRect(Math.round(x - 2 * s), Math.round(y - h * 0.7), Math.round(4 * s), Math.round(h * 0.7));
  mctx.fillStyle = "#fff2b0"; mctx.fillRect(Math.round(x - s), Math.round(y - h * 0.35), Math.round(2 * s), Math.round(h * 0.35));
}
function fireGlow(x, y, r, a) {
  var g = mctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, "rgba(255,170,60," + a + ")"); g.addColorStop(1, "rgba(255,170,60,0)");
  mctx.fillStyle = g; mctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function drumstick(x, y) {
  x = Math.round(x); y = Math.round(y);
  mctx.fillStyle = "#6b3410"; mctx.fillRect(x + 2, y, 8, 7); mctx.fillRect(x + 1, y + 1, 10, 5);
  mctx.fillStyle = "#c9782c"; mctx.fillRect(x + 3, y + 1, 6, 4); mctx.fillStyle = "#eaa54e"; mctx.fillRect(x + 4, y + 1, 3, 1);
  mctx.fillStyle = "#f5efe0"; mctx.fillRect(x - 4, y + 4, 6, 2); mctx.fillRect(x - 5, y + 3, 2, 2); mctx.fillRect(x - 5, y + 6, 2, 2);
}
function drawFires() {
  if (LUNCH.n > 0 && WORLD_THEME === "battlefield") {
    var fl0 = 0.85 + 0.15 * Math.sin(lastT / 120), lx = LUNCH.cx, ly = LUNCH.cy;
    mctx.globalAlpha = 1; fireGlow(lx, ly - 6, 120, (T.night ? 0.5 : 0.28) * fl0);
    mctx.fillStyle = "#3a2414"; mctx.fillRect(lx - 16, ly - 3, 32, 6); mctx.fillStyle = "#5e3e26"; mctx.fillRect(lx - 12, ly - 7, 24, 5);
    mctx.fillStyle = "#a3a9b1"; for (var q = 0; q < 8; q++) mctx.fillRect(Math.round(lx + Math.cos(q * 0.785) * 22) - 3, Math.round(ly + Math.sin(q * 0.785) * 10) - 2, 6, 4);
    flame(lx, ly, 2.2);
  }
  var night = T.night ? 1 : 0.35, fl = 0.85 + 0.15 * Math.sin(lastT / 140);
  FIRES.forEach(function (f) { mctx.globalAlpha = 1; fireGlow(f[0], f[1] - 6, 70 * f[2], 0.42 * night * fl); flame(f[0], f[1] - 2, f[2]); });
  TORCHES.forEach(function (t) { mctx.globalAlpha = 1; fireGlow(t[0], t[1] - 4, 46, 0.4 * night * fl); flame(t[0], t[1] + 1, 0.7); });
  mctx.globalAlpha = 1;
}
paintMap();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintMap);

function grayOf(hex) {
  var m = /^#([0-9a-f]{6})$/i.exec(hex), m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (m3) m = [0, m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3]];
  if (!m) return hex;
  var n = parseInt(m[1], 16), r = n >> 16 & 255, g = n >> 8 & 255, bl = n & 255;
  var y = Math.round((0.3 * r + 0.59 * g + 0.11 * bl) * 0.82 + 22), h = ("0" + y.toString(16)).slice(-2);
  return "#" + h + h + h;
}
function makeSprites(d) {
  var out = ucol(uOf(d));
  return [false, true].map(function (gray) {
    return [0, 1, 2].map(function (st) {
      var cv = document.createElement("canvas"), x;
      cv.width = CW; cv.height = CH; x = cv.getContext("2d");
      spriteRects(d, st).forEach(function (q) {
        var col = q[4] === "currentColor" ? out : q[4];
        x.globalAlpha = q[5]; x.fillStyle = gray ? grayOf(col) : col; x.fillRect(q[0] * 2, q[1] * 2, q[2] * 2, q[3] * 2);
      });
      return cv;
    });
  });
}
var spr = DATA.map(function (d) { return makeSprites(d); });

/* 빨간 침입자 (11x8 도트를 2배로) */
var INV_A = ["..X.....X..", "...X...X...", "..XXXXXXX..", ".XXoXXXoXX.", "XXXXXXXXXXX", "X.XXXXXXX.X", "X.X.....X.X", "...XX.XX..."];
var INV_B = INV_A.slice(0, 6).concat(["X..X...X..X", ".X..X.X..X."]);
var INVS = [INV_A, INV_B].map(function (rows) {
  var cv = document.createElement("canvas"), x;
  cv.width = IW; cv.height = IH; x = cv.getContext("2d");
  rows.forEach(function (row, ry) {
    for (var cx = 0; cx < 11; cx++) {
      var ch = row.charAt(cx);
      if (ch === ".") continue;
      x.fillStyle = ch === "o" ? "#3a0710" : "#ff2d44";
      x.fillRect(cx * 2, ry * 2, 2, 2);
    }
  });
  return cv;
});

/* 먹을거리 도트 아이콘 (8x8 x2) */
var FOOD_ART = {
  cookie: { p: { b: "#c98b4a", d: "#6b3f1d" }, r: ["..bbbb..", ".bbdbbb.", "bbbbbdbb", "bdbbbbbb", "bbbdbbdb", "bbbbbbbb", ".bbdbbb.", "..bbbb.."] },
  coffee: { p: { w: "#f2f2f2", c: "#5a3a22", s: "#cfd6e6" }, r: ["..s..s..", ".s..s...", "wwwwww..", "wccccww.", "wccccw.w", "wwwwww.w", ".wwww.w.", "........"] },
  apple: { p: { r: "#e5483c", g: "#5fbf5a" }, r: ["....g...", "...g.g..", ".rrrgrr.", "rrrrrrrr", "rrrrrrrr", "rrrrrrrr", ".rrrrrr.", "..rr.rr."] },
  bread: { p: { y: "#e6b35c", d: "#a8702e" }, r: ["..dddd..", ".dyyyyd.", "dyyyyyyd", "dyyyyyyd", "dyyyyyyd", "dyyyyyyd", ".dyyyyd.", "..dddd.."] },
  donut: { p: { y: "#e6b35c", p: "#f08ccf" }, r: ["..yyyy..", ".yppppy.", "yppyyppy", "ypy..ypy", "yppyyppy", ".yppppy.", "..yyyy..", "........"] },
  ice: { p: { p: "#f08ccf", w: "#fff4f8", y: "#e6b35c" }, r: ["..pppp..", ".pppppp.", ".pppwpp.", "..pppp..", "..yyyy..", "...yy...", "...yy...", "....y..."] },
  drink: { p: { o: "#ff9f43", w: "#f2f2f2", s: "#cfd6e6" }, r: ["....ss..", "....s...", ".oooooo.", ".owwwwo.", ".owwwwo.", ".oooooo.", ".oooooo.", ".oooooo."] },
  rice: { p: { w: "#f2f2f2", n: "#22242e" }, r: ["...ww...", "..wwww..", ".wwwwww.", "wwwnnwww", "wwwnnwww", "wwwwwwww", ".wwwwww.", "........"] },
  candy: { p: { b: "#6ea8ff", r: "#e5483c" }, r: ["........", "b.rrrr.b", "bbrrrrbb", "b.rrrr.b", "........", "........", "........", "........"] }
};
var FOOD_CV = {};
function foodKind(t) {
  t = String(t);
  if (/커피|라떼|차$|티$|아메/.test(t)) return "coffee";
  if (/도넛|도너츠/.test(t)) return "donut";
  if (/아이스|빙수|젤라/.test(t)) return "ice";
  if (/과자|쿠키|비스킷|초코|칩|스낵/.test(t)) return "cookie";
  if (/과일|사과|귤|바나나|딸기|포도|수박|오렌지|토마토/.test(t)) return "apple";
  if (/빵|케이크|샌드|베이글|마카롱|와플/.test(t)) return "bread";
  if (/음료|주스|콜라|사이다|물|우유/.test(t)) return "drink";
  if (/김밥|주먹밥|떡|밥/.test(t)) return "rice";
  return "candy";
}
function foodIcon(t) {
  var k = foodKind(t);
  if (!FOOD_CV[k]) {
    var a = FOOD_ART[k], cv = document.createElement("canvas"), x;
    cv.width = 16; cv.height = 16; x = cv.getContext("2d");
    a.r.forEach(function (row, ry) { for (var cx = 0; cx < 8; cx++) { var ch = row.charAt(cx); if (ch === ".") continue; x.fillStyle = a.p[ch]; x.fillRect(cx * 2, ry * 2, 2, 2); } });
    FOOD_CV[k] = cv;
  }
  return FOOD_CV[k];
}
function snackHit(ev) {
  var pt = mapPoint(ev), sn = WORLD_THEME === "plaza" ? {} : snackNow(), hit = null;
  Object.keys(sn).forEach(function (u) {
    var g = REGIONS[u]; if (!g) return;
    var n = sn[u].items.length;
    if ((pt[0] >= g.x + 6 && pt[0] <= g.x + 40 && pt[1] >= g.y + 25 && pt[1] <= g.y + 40) || (pt[0] >= g.x + 8 && pt[0] <= g.x + 8 + 18 * n && pt[1] >= g.y + g.h - 24 && pt[1] <= g.y + g.h - 4)) hit = { u: u, info: sn[u] };
  });
  return hit;
}

function areaOf(u) { var g = REGIONS[u]; return { x0: g.x + 10, x1: g.x + g.w - 10 - CW, y0: g.y + 62, y1: g.y + g.h - 10 - CH }; }
function iAreaOf(u) { var g = REGIONS[u]; return { x0: g.x + 10, x1: g.x + g.w - 10 - IW, y0: g.y + 62, y1: g.y + g.h - 10 - IH }; }
var OFFICE = { x0: 90, x1: 860, y0: 90, y1: 590 };
var bossWalker = null;
function bossWalkArea() {
  if (WORLD_THEME === "office") return { x0: 80, x1: 820, y0: 78, y1: 560 };
  if (WORLD_THEME === "plaza") return { x0: 60, x1: 1040, y0: 260, y1: 600 };
  return { x0: 70, x1: 850, y0: 82, y1: 570 };
}
function ensureBossWalker() {
  if (!bossVisitOn()) { bossWalker = null; return null; }
  if (!bossWalker || bossWalker.theme !== WORLD_THEME) {
    var area = bossWalkArea(), x = area.x0 + Math.random() * (area.x1 - area.x0 - 100), y = area.y0 + Math.random() * (area.y1 - area.y0 - 168);
    bossWalker = { theme: WORLD_THEME, x: x, y: y, tx: x, ty: y, wait: 0.4, speed: 28, anim: 0, moving: false, dir: 1 };
  }
  return bossWalker;
}
function updateBossWalker(dt) {
  var b = ensureBossWalker(), area, dx, dy, dist, step;
  if (!b) return;
  area = bossWalkArea();
  if (b.wait > 0) {
    b.wait -= dt;
    b.moving = false;
    if (b.wait <= 0) {
      b.tx = area.x0 + Math.random() * (area.x1 - area.x0 - 100);
      b.ty = area.y0 + Math.random() * (area.y1 - area.y0 - 168);
    }
    return;
  }
  dx = b.tx - b.x; dy = b.ty - b.y; dist = Math.hypot(dx, dy); step = b.speed * dt;
  if (dist <= step) {
    b.x = b.tx; b.y = b.ty; b.wait = 0.8 + Math.random() * 2.4; b.moving = false;
    return;
  }
  b.dir = dx < 0 ? -1 : 1;
  b.x += dx / dist * step; b.y += dy / dist * step; b.moving = true; b.anim += dt;
}
function wanderOf(u) { return WORLD_THEME === "plaza" ? PLAZA_WALK : REGIONS[u] ? areaOf(u) : OFFICE; }
function randIn(a) { return [a.x0 + Math.random() * (a.x1 - a.x0), a.y0 + Math.random() * (a.y1 - a.y0)]; }
function deskFor(d) { return SEATNOW[jobId(d)] || null; }
function applySeats(initial) {
  computeSeatNow();
  walkers.forEach(function (w) {
    var d = DATA[w.i], nh = deskFor(d), sp, dest;
    if (nh === w.hd) return;
    w.hd = nh;
    if (w.mode === "leave") { sp = leaveSpot(w); w.route = []; w.moving = false; w.x = sp[0]; w.y = sp[1]; w.tx = w.x; w.ty = w.y; return; }
    if (w.mode === "gone" || w.mode === "away" || w.mode === "pc" || w.seat) return;
    dest = homeDest(w);
    if (initial || reduceMotion) jump(w, dest); else goTo(w, dest);
  });
}
var STAND = {};
function newWalker(d, i) {
  var u = uOf(d), hd = deskFor(d), a = wanderOf(u), p = hd && shouldSitAtDesk(d) ? [hd.x, hd.y] : a ? (WORLD_THEME === "plaza" ? plazaSpot() : randIn(a)) : (STAND[d.n] || [OX, OY]);
  return { i: i, id: jobId(d), u: u, a: a, hd: hd, x: p[0], y: p[1], tx: p[0], ty: p[1], wait: Math.random() * 2, speed: 16 + Math.random() * 12, anim: 0, moving: false, route: [], seat: null, mode: "desk", tag: "", pkey: "" };
}
var walkers = DATA.map(function (d, i) { return newWalker(d, i); });
function homeDest(w) { return w.hd && shouldSitAtDesk(DATA[w.i]) ? [w.hd.x, w.hd.y] : w.a ? (WORLD_THEME === "plaza" ? plazaSpot() : randIn(w.a)) : (STAND[DATA[w.i].n] || [w.x, w.y]); }
function leaveSpot(w) { return w.hd ? [w.hd.cx - CW / 2, w.hd.ry + 66] : (STAND[DATA[w.i].n] || [w.x, w.y]); }
function isSitting(w) { return !w.route.length && !w.seat && (w.mode === "desk" || (w.mode === "away" && w.tag === "lunch" && WORLD_THEME !== "battlefield")) && w.hd && shouldSitAtDesk(DATA[w.i]) && Math.abs(w.x - w.hd.x) < 1.5 && Math.abs(w.y - w.hd.y) < 1.5; }
function isUsingPc(w) { return w.mode === "pc" && !!w.pc && !w.route.length; }
function rowOfY(y) { return Math.max(0, Math.min(GRID - 1, Math.floor((y - OY) / ROWH))); }
function wtop(r) { return OY + r * ROWH + 66; }
function zoneOf(x, y) { return x >= EDGE - 10 ? "meet" : (y >= LOWER_Y ? "low" : "off"); }
function goTo(w, dest) {
  var pts = [], zf = zoneOf(w.x, w.y), zt = zoneOf(dest[0], dest[1]), wc, wh;
  if (WORLD_THEME === "plaza") { w.route = [dest]; w.wait = 0; w.moving = true; return; }
  if (zf === "off") {
    wc = wtop(rowOfY(w.y)); pts.push([w.x, wc]);
    if (zt === "off") { pts.push([AX, wc]); wh = wtop(rowOfY(dest[1])); if (wh !== wc) pts.push([AX, wh]); pts.push([dest[0], wh]); }
    else if (zt === "meet") pts.push([EDGE, wc]);
    else { pts.push([AX, wc]); pts.push([AX, LANE]); }
  } else if (zf === "low") {
    if (zt === "off") { wh = wtop(rowOfY(dest[1])); pts.push([AX, LANE]); pts.push([AX, wh]); pts.push([dest[0], wh]); }
    else if (zt === "meet") pts.push([EDGE - 20, LANE]);
  } else {
    if (zt === "off") { wh = wtop(rowOfY(dest[1])); pts.push([EDGE, wh]); pts.push([dest[0], wh]); }
    else if (zt === "low") pts.push([EDGE, LANE]);
  }
  pts.push(dest);
  w.route = pts; w.wait = 0; w.moving = true;
}
var LUNCH = { cx: 450, cy: 330, n: 0 };
function lunchSpot(k, n) {
  var rx = Math.min(150, 46 + n * 9), ry = rx * 0.55, a = 2 * Math.PI * k / n - Math.PI / 2;
  return [LUNCH.cx + Math.cos(a) * rx - CW / 2, LUNCH.cy + Math.sin(a) * ry - CH + 14];
}
function awayDest() { if (WORLD_THEME === "plaza") return plazaSpot(); return [OX + Math.random() * (8 * CELLW - CW), wtop(Math.floor(Math.random() * GRID))]; }
function jump(w, p) { w.x = p[0]; w.y = p[1]; w.tx = w.x; w.ty = w.y; w.route = []; w.moving = false; w.wait = Math.random() * 2; }
function applyMoves(initial) {
  walkers.forEach(function (w) {
    var d = DATA[w.i], nu = uOf(d);
    if (w.u === nu) return;
    w.u = nu; w.a = wanderOf(nu); w.hd = deskFor(d); spr[w.i] = makeSprites(d);
    if (w.seat) return;
    var dest = homeDest(w);
    if (initial || reduceMotion) jump(w, dest); else goTo(w, dest);
  });
}

