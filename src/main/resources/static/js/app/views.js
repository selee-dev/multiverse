/* 화면 전환(setView), 주기 작업, 자동 이동 토글 */
function refreshPanes() {
  if (state.view === "team") renderTeam();
  if (state.view === "meet") renderMeets();
  if (state.view === "proj") renderProjects();
  if (state.view === "snack") renderSnack();
  if (state.view === "chat") { renderChat(); renderPrivateChat(); }
  if (openIdx !== null) renderTasks();
}
function setView(v) {
  state.view = v;
  var isMap = v === "map", isList = v === "list", pane = v === "meet" || v === "proj" || v === "snack" || v === "chat" || v === "team";
  document.getElementById("world").hidden = !isMap;
  document.getElementById("grid").hidden = !isList;
  document.getElementById("sort").hidden = !isList;
  document.getElementById("toolbar").hidden = pane;
  document.getElementById("portals").hidden = pane;
  document.getElementById("sides").hidden = pane;
  document.getElementById("meetpane").hidden = v !== "meet";
  document.getElementById("projpane").hidden = v !== "proj";
  document.getElementById("snackpane").hidden = v !== "snack";
  document.getElementById("chatpane").hidden = v !== "chat";
  document.getElementById("teampane").hidden = v !== "team";
  var bs = document.querySelectorAll("#views .nb"), i;
  for (i = 0; i < bs.length; i++) { bs[i].setAttribute("aria-pressed", String(bs[i].dataset.v === v)); if (bs[i].dataset.v === v && bs[i].scrollIntoView) { try { bs[i].scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {} } }
  if (isMap) startMap();
  if (v === "meet") { renderPick(); renderMeets(); }
  if (v === "proj") renderProjects();
  if (v === "team") renderTeam();
  if (v === "chat") {
    chatMode = "notice";
    document.getElementById("notice-pane").hidden = false;
    document.getElementById("private-pane").hidden = true;
    document.querySelectorAll("#chat-modes .chat-mode").forEach(function (tab) { tab.setAttribute("aria-selected", String(tab.dataset.chatMode === chatMode)); });
    refreshPrivateContacts(); renderChatWho(); renderChat(true); renderPrivateChat(); markSeen();
  }
  else updateBadge();
  if (v === "snack") { if (!document.getElementById("sfrom").value) resetSnackForm(); else renderSnackForm(); renderSnack(); }
}
document.getElementById("views").addEventListener("click", function (e) { var b = e.target.closest(".nb"); if (b) setView(b.dataset.v); });
syncIntruders(true); syncMeetings(true);
setInterval(function () { syncMeetings(false); }, 5000);
setInterval(function () { autoCompleteDue(); syncIntruders(false); renderGrid(); if (openIdx !== null) renderTasks(); }, 30000);
document.getElementById("autolunch").addEventListener("change", function () { syncMeetings(false); });
(function () {
  var box = document.getElementById("automove");
  if (!box) return;
  box.checked = autoMoveOn;
  box.addEventListener("change", function () {
    autoMoveOn = box.checked;
    try { localStorage.setItem("ops-automove", autoMoveOn ? "on" : "off"); } catch (e) {}
    walkers.forEach(function (w) {
      if (!autoMoveOn && w.route.length) jump(w, w.route[w.route.length - 1]);
      w.pkey = "";
    });
    syncMeetings(false);
  });
})();
