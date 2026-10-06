/* 광장 말풍선: 캐릭터별 표시 대상 계산(activeBubbles)과 캔버스 그리기(drawBubble). 대화 데이터는 chat.js 를 씁니다. */
var BUBBLE_MS = 8000;
/** 지금 말풍선으로 보여줄 캐릭터별 메시지. 개인 메시지는 서버가 참여자에게만 내려주므로 상대에게만 보입니다. */
function activeBubbles() {
  var now = Date.now(), out = {};
  Object.keys(store.say).forEach(function (id) { var s = store.say[id]; if (now - s.at < BUBBLE_MS) out[id] = { t: s.t, at: s.at, priv: false }; });
  Object.keys(store.privateChats).forEach(function (key) {
    var m = store.privateChats[key], id = m && now - (+m.at || 0) < BUBBLE_MS ? characterIdOfUser(m.sender) : null;
    if (id && (!out[id] || out[id].at < m.at)) out[id] = { t: String(m.text).slice(0, 100), at: +m.at, priv: true };
  });
  return out;
}
function wrapText(c, text, maxW, maxLines) {
  var lines = [], line = "", i, ch;
  for (i = 0; i < text.length; i++) {
    ch = text.charAt(i);
    if (ch === "\n") { lines.push(line); line = ""; if (lines.length === maxLines) { i++; break; } continue; }
    if (c.measureText(line + ch).width > maxW && line) { lines.push(line); line = ""; if (lines.length === maxLines) break; }
    line += ch;
  }
  if (lines.length < maxLines && line) lines.push(line);
  else if (i < text.length) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + "…";
  return lines;
}
function drawBubble(b, cx, bottom) {
  var lines, w = 0, h, x, y, k;
  mctx.save();
  mctx.font = "500 12px 'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
  lines = wrapText(mctx, b.t, 130, 3);
  lines.forEach(function (l) { w = Math.max(w, mctx.measureText(l).width); });
  w += 14; h = lines.length * 15 + 8; x = Math.round(cx - w / 2); y = Math.round(bottom - h - 6);
  mctx.globalAlpha = Math.min(1, (BUBBLE_MS - (Date.now() - b.at)) / 800);
  mctx.fillStyle = b.priv ? "#efe4ff" : "#fff"; mctx.strokeStyle = b.priv ? "#7a55c9" : "#444"; mctx.lineWidth = 1.5;
  mctx.beginPath();
  if (mctx.roundRect) mctx.roundRect(x, y, w, h, 7); else mctx.rect(x, y, w, h);
  mctx.fill(); mctx.stroke();
  mctx.beginPath(); mctx.moveTo(cx - 5, y + h); mctx.lineTo(cx, y + h + 6); mctx.lineTo(cx + 5, y + h); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.fillStyle = b.priv ? "#fff" : "#fff"; mctx.fillRect(cx - 4, y + h - 2, 8, 3);
  mctx.fillStyle = "#222"; mctx.textAlign = "center";
  for (k = 0; k < lines.length; k++) mctx.fillText(lines[k], cx, y + 17 + k * 15);
  mctx.restore();
}
