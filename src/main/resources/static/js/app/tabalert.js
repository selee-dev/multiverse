/* 탭이 안 보일 때 새 채팅이 오면 탭 제목에 (n)을 붙이고 아이콘에 빨간 점을 그려요 */
var tabUnread = 0, tabKnown = { n: null, p: null, s: null }, tabBaseTitle = document.title, tabIcons = {};
function tabIconUrl(dot) {
  if (tabIcons[dot]) return tabIcons[dot];
  try {
    var c = document.createElement("canvas"), x;
    c.width = c.height = 64; x = c.getContext("2d");
    x.fillStyle = "#1c2440"; x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#f4c95d"; x.font = "bold 36px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("M", 32, 35);
    if (dot) { x.fillStyle = "#e5484d"; x.beginPath(); x.arc(48, 16, 14, 0, Math.PI * 2); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 3; x.stroke(); }
    tabIcons[dot] = c.toDataURL("image/png");
  } catch (e) { tabIcons[dot] = ""; }
  return tabIcons[dot];
}
function renderTabAlert() {
  var link = document.querySelector('link[rel="icon"]'), url = tabIconUrl(tabUnread > 0);
  document.title = (tabUnread > 0 ? "(" + (tabUnread > 99 ? "99+" : tabUnread) + ") " : "") + tabBaseTitle;
  if (!url) return;
  if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
  link.type = "image/png"; link.href = url;
}
function tabAway() { return document.hidden || !document.hasFocus(); }
/** src: "n" 공지, "p" 개인·단체, "s" 광장 공개. 처음 불러온 메시지는 기준으로만 삼고, 그 뒤에 새로 온 남의 메시지만 셉니다. */
function tabIncoming(src) {
  var ids = [];
  if (src === "n") chatList().forEach(function (m) { if (m.p !== chatMe) ids.push(m.id); });
  else if (src === "p") privateMessageList().forEach(function (m) { if (m.sender !== currentUser) ids.push(m.id); });
  else Object.keys(store.saylog || {}).forEach(function (id) { if (store.saylog[id].p !== currentCharacterId) ids.push(id); });
  if (tabKnown[src] === null) { tabKnown[src] = {}; ids.forEach(function (id) { tabKnown[src][id] = 1; }); return; }
  ids.forEach(function (id) { if (!tabKnown[src][id]) { tabKnown[src][id] = 1; if (tabAway()) tabUnread++; } });
  renderTabAlert();
}
function tabClear() { if (tabUnread) { tabUnread = 0; renderTabAlert(); } }
document.addEventListener("visibilitychange", function () { if (!document.hidden) tabClear(); });
window.addEventListener("focus", tabClear);
renderTabAlert();
