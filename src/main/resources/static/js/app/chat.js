/*
 * 채팅: 공지(관리자·팀장급), 개인·단체 대화(공지·채팅 화면의 "개인" 탭), 광장 오른쪽 채팅 패널.
 *
 * 세 화면이 같은 부품을 씁니다.
 *  - 메시지 한 줄 HTML        chatMsgHtml()
 *  - 대화방(참여자 집합)      privateRooms() / roomKeyOf()
 *  - 연락처 이름·체크 목록    contactOf() / contactChecklistHtml() / checkedValues()
 *  - 전송 흐름(잠금·상태·결과) sendFlow()
 *  - Enter 전송               onEnterSend()
 * 말풍선 그리기는 bubbles.js 에 있습니다.
 */
var chatMe = "", chatSeen = 0, privateSeen = 0, chatMode = "notice", privateContacts = [], activePrivateRoom = "", activePrivateRecipients = [];
try { chatMe = localStorage.getItem("ops-me") || ""; chatSeen = +localStorage.getItem("ops-chat-seen") || 0; privateSeen = +localStorage.getItem("ops-private-seen") || 0; } catch (e) {}

/* ---- 공통 부품 ---- */
function fmtT(at) { var d = new Date(at); return (d.getMonth() + 1) + "/" + d.getDate() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
/** 메시지 한 줄. m = { mine, who, at, text, delId(공지 삭제 버튼에 쓸 문서 id, 선택) } */
function chatMsgHtml(m) {
  return '<div class="cmsg' + (m.mine ? " me" : "") + '"><div class="cbody"><b>' + esc(m.who) + "</b><time>" + fmtT(m.at) + "</time>" +
    (m.delId ? '<button type="button" class="cdel" data-id="' + esc(m.delId) + '">삭제</button>' : "") + "<p>" + esc(m.text) + "</p></div></div>";
}
function contactOf(username) { return privateContacts.filter(function (item) { return item.username === username; })[0] || null; }
function characterIdOfUser(username) {
  if (username === currentUser) return currentCharacterId;
  var c = contactOf(username);
  return c ? c.characterId : null;
}
function characterName(id) {
  var d = DATA.filter(function (item) { return jobId(item) === id; })[0];
  return d ? d.n : id;
}
function contactName(username) {
  if (username === currentUser) {
    var mine = DATA.filter(function (d) { return d.id === currentCharacterId; })[0];
    return (mine ? mine.n : currentUser) + " (나)";
  }
  var contact = contactOf(username);
  return contact ? contact.name + " (" + username + ")" : username;
}
/** 연락처 체크박스 목록. selected = { username: true } 인 항목은 체크된 채로 유지합니다. */
function contactChecklistHtml(selected) {
  selected = selected || {};
  return privateContacts.map(function (contact) {
    return '<label class="private-contact"><input type="checkbox" value="' + esc(contact.username) + '"' + (selected[contact.username] ? " checked" : "") + '><span>' + esc(contact.name) + " · " + esc(contact.username) + "</span></label>";
  }).join("") || '<p class="private-contact-empty">대화할 사용자가 없습니다.</p>';
}
function checkedValues(selector) {
  var out = [];
  document.querySelectorAll(selector + " input:checked").forEach(function (input) { out.push(input.value); });
  return out;
}
/** Enter 로 전송. 한글 조합 중에는 무시하고, opts.shiftNewline 이면 Shift+Enter 는 줄바꿈, opts.noRepeat 이면 키 반복은 무시합니다. */
function onEnterSend(el, send, opts) {
  opts = opts || {};
  el.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || event.isComposing || (opts.shiftNewline && event.shiftKey)) return;
    event.preventDefault();
    if (!(opts.noRepeat && event.repeat)) send();
  });
}
/**
 * 전송 흐름 한 벌: 빈 입력이면 무시 → (잠금) → c.run(text) → 성공이면 입력 비움·상태 지움, 실패면 c.fail 표시.
 * c = { input, status, lock:[요소], busy:{v:false}, run(text)->Promise, ok(result), fail(문구), done() }
 */
function sendFlow(c) {
  var text = c.input.value.trim();
  if ((c.busy && c.busy.v) || !text) return;
  if (c.busy) { c.busy.v = true; (c.lock || []).forEach(function (el) { el.disabled = true; }); }
  function finish(ok, result) {
    if (c.busy) { c.busy.v = false; (c.lock || []).forEach(function (el) { el.disabled = false; }); }
    if (ok) { c.input.value = ""; c.input.style.height = ""; c.status.textContent = ""; if (c.ok) c.ok(result); }
    else c.status.textContent = c.fail;
    if (c.done) c.done();
    c.input.focus();
  }
  c.run(text).then(function (result) { finish(true, result); }, function () { finish(false); });
}

/* ---- 대화방: 개인 탭과 광장 패널이 같은 방 목록을 씁니다 ---- */
function privateMessageList() {
  return Object.keys(store.privateChats).map(function (id) { return store.privateChats[id]; })
    .filter(function (message) { return message && Array.isArray(message.participants) && typeof message.room === "string"; })
    .sort(function (a, b) { return (+a.at || 0) - (+b.at || 0); });
}
function othersOf(message) { return message.participants.filter(function (username) { return username !== currentUser; }); }
/** 대화방 키: 나를 뺀 참여자 계정을 정렬해 "|"로 이은 문자열. 빈 문자열은 공개(전체) 방입니다. */
function roomKeyOf(message) { return othersOf(message).sort().join("|"); }
/** 방별 { room, key, messages(시간순), last, lastIncoming(상대가 보낸 마지막 시각) } 목록. 방은 처음 등장한 순서입니다. */
function privateRooms() {
  var byRoom = {}, list = [];
  privateMessageList().forEach(function (m) {
    var r = byRoom[m.room];
    if (!r) { r = byRoom[m.room] = { room: m.room, key: roomKeyOf(m), messages: [], last: null, lastIncoming: 0 }; list.push(r); }
    r.messages.push(m); r.last = m;
    if (m.sender !== currentUser && (+m.at || 0) > r.lastIncoming) r.lastIncoming = +m.at;
  });
  return list;
}
function roomByKey(key) { return privateRooms().filter(function (r) { return r.key === key; })[0] || null; }

/* ---- 공지 ---- */
function chatList() {
  return Object.keys(store.chat).map(function (id) {
    var m = store.chat[id];
    return m && typeof m.p === "string" && typeof m.t === "string" ? { id: id, p: m.p, t: m.t.slice(0, 200), at: +m.at || 0 } : null;
  }).filter(Boolean).sort(function (a, b) { return a.at - b.at || a.id.localeCompare(b.id); }).slice(-100);
}
function updateBadge() {
  var b = document.getElementById("cbadge"), n = chatList().filter(function (m) { return m.at > chatSeen && m.p !== chatMe; }).length;
  b.textContent = n > 99 ? "99+" : n; b.hidden = !n || state.view === "chat";
  updatePrivateBadge();
}
function updatePrivateBadge() {
  var badge = document.getElementById("private-badge"), count = privateMessageList().filter(function (m) { return m.sender !== currentUser && (+m.at || 0) > privateSeen; }).length;
  if (!badge) return;
  badge.textContent = count > 99 ? "99+" : count;
  badge.hidden = !count || state.view !== "chat" || chatMode === "private";
}
function markPrivateSeen() {
  var messages = privateMessageList(), last = messages.length ? (+messages[messages.length - 1].at || 0) : 0;
  if (last > privateSeen) { privateSeen = last; try { localStorage.setItem("ops-private-seen", String(privateSeen)); } catch (e) {} }
  updatePrivateBadge();
}
function markSeen() {
  var l = chatList(), last = l.length ? l[l.length - 1].at : 0;
  if (last > chatSeen) { chatSeen = last; try { localStorage.setItem("ops-chat-seen", String(chatSeen)); } catch (e) {} }
  updateBadge();
}
function renderChatWho() {
  var who = document.getElementById("cwho"), h;
  if (currentRole === "ADMIN") { chatMe = "admin"; who.hidden = true; who.innerHTML = ""; return; }
  who.hidden = false;
  h = '<option value="">공지 작성 캐릭터</option>';
  DATA.forEach(function (d) {
    var id = jobId(d);
    if (currentRole !== "ADMIN" && id !== currentCharacterId) return;
    h += '<option value="' + esc(id) + '"' + (id === chatMe ? " selected" : "") + ">" + esc(d.n) + (ttl(d) ? " · " + esc(ttl(d)) : "") + "</option>";
  });
  document.getElementById("cwho").innerHTML = h;
  chatMe = currentCharacterId || "";
  if (chatMe && indexOfId(chatMe) < 0) chatMe = "";
  document.getElementById("cwho").value = chatMe;
}
function renderChat(forceBottom) {
  var el = document.getElementById("clist"), list = chatList(), byId = {}, h = "", can = currentCanAnnounce;
  var atBottom = forceBottom || el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  DATA.forEach(function (d) { byId[jobId(d)] = d; });
  refreshForms();
  list.forEach(function (m) {
    var d = byId[m.p];
    h += chatMsgHtml({
      mine: m.p === chatMe, who: d ? d.n : m.p === "admin" ? "관리자" : "공지", at: m.at, text: m.t,
      delId: can && (currentRole === "ADMIN" || m.p === currentCharacterId) ? m.id : ""
    });
  });
  el.innerHTML = h || '<p class="tempty">등록된 공지가 없어요.</p>';
  if (atBottom) el.scrollTop = el.scrollHeight;
}
function sendChat() {
  var inp = document.getElementById("cin"), st = document.getElementById("cstatus"), t = inp.value.trim().slice(0, 200);
  if (!currentCanAnnounce) { st.textContent = "팀장·상무급 캐릭터 또는 관리자만 공지를 등록할 수 있어요."; return; }
  if (currentRole === "ADMIN") chatMe = "admin";
  if (!chatMe) { st.textContent = "공지 작성 캐릭터가 없습니다."; return; }
  if (!t) return;
  st.textContent = "";
  commit("chat", newId("c"), { p: chatMe, t: t, at: Date.now() }, function () { inp.value = ""; renderChat(true); markSeen(); inp.focus(); }, "#cstatus");
}

/* ---- 개인·단체 대화 탭 ---- */
function refreshPrivateContacts() {
  if (!dbRef) return;
  dbRef.privateChatContacts().then(function (contacts) { privateContacts = contacts || []; renderPrivateContacts(); renderPrivateChat(); renderPlazaRecipients(); renderPlazaLog(); }, function () {});
}
function renderPrivateContacts() {
  var list = document.getElementById("private-recipients"), selected = {};
  checkedValues("#private-recipients").forEach(function (username) { selected[username] = true; });
  list.innerHTML = contactChecklistHtml(selected);
}
function privateRoomTitle(message) { return othersOf(message).map(contactName).join(", "); }
function renderPrivateChat() {
  var rooms = privateRooms(), roomButtons = "", log = document.getElementById("private-log"), title = document.getElementById("private-title");
  rooms.slice().sort(function (a, b) { return (+b.last.at || 0) - (+a.last.at || 0); }).forEach(function (r) {
    roomButtons += '<button type="button" class="private-room" data-room="' + esc(r.room) + '" aria-current="' + (r.room === activePrivateRoom) + '">' + esc(privateRoomTitle(r.last)) + "<br><small>" + esc(r.last.text) + "</small></button>";
  });
  document.getElementById("private-rooms").innerHTML = roomButtons || '<p class="tempty">아직 대화가 없어요.</p>';
  var active = rooms.filter(function (r) { return activePrivateRoom && r.room === activePrivateRoom; })[0], messages = active ? active.messages : [];
  if (messages.length) {
    activePrivateRecipients = othersOf(active.last);
    title.textContent = privateRoomTitle(active.last);
  } else if (activePrivateRecipients.length) {
    title.textContent = activePrivateRecipients.map(contactName).join(", ");
  } else title.textContent = "대화 상대를 선택하세요";
  log.innerHTML = messages.map(function (message) {
    return chatMsgHtml({ mine: message.sender === currentUser, who: contactName(message.sender), at: message.at, text: message.text });
  }).join("") || '<p class="tempty">' + (activePrivateRecipients.length ? "첫 메시지를 보내보세요." : "대화 상대를 선택하세요.") + "</p>";
  log.scrollTop = log.scrollHeight;
  if (state.view === "chat" && chatMode === "private") markPrivateSeen(); else updatePrivateBadge();
}
function openPrivateConversation() {
  var recipients = checkedValues("#private-recipients"), existing;
  if (!recipients.length) { document.getElementById("private-status").textContent = "대화 상대를 한 명 이상 선택해 주세요."; return; }
  activePrivateRecipients = recipients;
  existing = roomByKey(recipients.slice().sort().join("|"));
  activePrivateRoom = existing ? existing.room : "";
  document.getElementById("private-status").textContent = "";
  renderPrivateChat();
  document.getElementById("private-input").focus();
}
function sendPrivateChat() {
  var input = document.getElementById("private-input"), status = document.getElementById("private-status");
  if (!dbRef || !activePrivateRecipients.length) { status.textContent = "대화 상대를 먼저 선택해 주세요."; return; }
  sendFlow({
    input: input, status: status,
    run: function (text) { return dbRef.sendPrivateMessage(activePrivateRecipients, text); },
    ok: function (message) { activePrivateRoom = message.room; renderPrivateChat(); },
    fail: "메시지를 보내지 못했습니다. 대화 상대와 연결을 확인해 주세요."
  });
}

/* ---- 광장 오른쪽 채팅 패널: 전체(말풍선) · 귓속말 · 단체방 ---- */
var plazaQuery = "", plazaTo = "", plazaSeen = {}, plazaSending = { v: false }, plazaStart = Date.now();
function plazaRoomName(key) {
  return key.split("|").map(function (u) { var c = contactOf(u); return c ? c.name : u; }).join(", ");
}
function renderPlazaRecipients() {
  var box = document.getElementById("plaza-to"), input = document.getElementById("plaza-input"), keys = {}, lastIn = {}, h;
  if (!box) return;
  privateContacts.forEach(function (c) { keys[c.username] = true; });
  privateRooms().forEach(function (r) { if (r.key) keys[r.key] = true; lastIn[r.key] = r.lastIncoming; });
  if (plazaTo) keys[plazaTo] = true;
  h = '<button type="button" data-to="" aria-pressed="' + !plazaTo + '">전체</button>' + Object.keys(keys).sort().filter(function (k) { var q = plazaQuery; return !q || k === plazaTo || (plazaRoomName(k) + " " + k).toLowerCase().indexOf(q) >= 0; }).map(function (k) {
    var unread = k !== plazaTo && (lastIn[k] || 0) > (plazaSeen[k] || plazaStart), group = k.indexOf("|") >= 0;
    return '<button type="button" data-to="' + esc(k) + '" class="' + (unread ? "unread" : "") + '" aria-pressed="' + (k === plazaTo) + '" title="' + esc(k.split("|").join(", ")) + '">' + (group ? "👥 " : "🔒 ") + esc(plazaRoomName(k)) + "</button>";
  }).join("") + '<button type="button" data-act="group" class="plaza-newgroup">＋ 단체방</button>';
  box.innerHTML = h;
  input.placeholder = (!plazaTo ? "말풍선 · 모두에게 보여요" : plazaTo.indexOf("|") >= 0 ? "단체방 · 참여자에게만 보여요" : "귓속말 · 상대에게만 보여요") + " (Enter 전송 · Shift+Enter 줄바꿈)";
  input.maxLength = plazaTo ? 500 : 100;
}
function renderPlazaGroupPicker() {
  document.getElementById("plaza-group-search").value = "";
  document.getElementById("plaza-group-list").innerHTML = contactChecklistHtml();
}
/** 선택한 대화방의 메시지만 보여줍니다. 전체는 공개 말풍선, 그 외는 같은 참여자들의 대화입니다. */
function renderPlazaLog() {
  var el = document.getElementById("plaza-log"), items = [], h, group = plazaTo.indexOf("|") >= 0, room;
  if (!el) return;
  if (!plazaTo) {
    var seen = {};
    Object.keys(store.saylog || {}).forEach(function (id) { var s = store.saylog[id]; seen[s.p + "|" + s.at] = 1; items.push({ at: s.at, who: characterName(s.p), text: s.t, mine: s.p === currentCharacterId }); });
    Object.keys(store.say).forEach(function (id) { var s = store.say[id]; if (!seen[id + "|" + s.at]) items.push({ at: s.at, who: characterName(id), text: s.t, mine: id === currentCharacterId }); });
  } else {
    room = roomByKey(plazaTo);
    (room ? room.messages : []).forEach(function (m) {
      items.push({ at: +m.at || 0, who: contactName(m.sender), text: m.text, mine: m.sender === currentUser });
    });
    plazaSeen[plazaTo] = Date.now();
  }
  items.sort(function (a, b) { return a.at - b.at; });
  h = items.slice(-50).map(function (i) { return chatMsgHtml(i); }).join("");
  el.innerHTML = h || '<p class="tempty">' + (plazaTo ? (group ? "단체방의 첫 메시지를 보내보세요." : "첫 메시지를 보내보세요.") : "아직 공개 대화가 없어요.") + "</p>";
  el.scrollTop = el.scrollHeight;
  renderPlazaRecipients();
}
function sendPlazaChat() {
  var input = document.getElementById("plaza-input"), status = document.getElementById("plaza-status"), to = plazaTo;
  if (plazaSending.v || !input.value.trim()) return;
  if (!dbRef) { status.textContent = "서버에 연결되지 않았어요."; return; }
  if (!to && !currentCharacterId) { status.textContent = "내 캐릭터가 있어야 말풍선을 띄울 수 있어요."; return; }
  sendFlow({
    input: input, status: status, lock: [input, document.getElementById("plaza-send")], busy: plazaSending,
    run: function (text) {
      if (to) return dbRef.sendPrivateMessage(to.split("|"), text.slice(0, 500));
      var doc = { t: text.slice(0, 100), at: Date.now() };
      var logId = currentCharacterId + "_" + doc.at.toString(36);
      store.say[currentCharacterId] = doc;
      store.saylog[logId] = { p: currentCharacterId, t: doc.t, at: doc.at };
      return Promise.all([dbRef.doc("say/" + currentCharacterId).set(doc), dbRef.doc("saylog/" + logId).set({ p: currentCharacterId, t: doc.t, at: doc.at })]);
    },
    fail: to ? "메시지를 보내지 못했습니다. 대화 상대를 확인해 주세요." : "메시지를 보내지 못했습니다.",
    done: renderPlazaLog
  });
}
function growPlazaInput() { var el = document.getElementById("plaza-input"); el.style.height = "auto"; el.style.height = Math.min(120, el.scrollHeight) + "px"; }
function setPlazaCollapsed(collapsed) {
  document.getElementById("plaza-chat").classList.toggle("collapsed", collapsed);
  document.getElementById("world").classList.toggle("chat-collapsed", collapsed);
  var t = document.getElementById("plaza-toggle");
  t.setAttribute("aria-expanded", String(!collapsed)); t.textContent = collapsed ? "펼치기 ▼" : "접기 ▲";
  try { localStorage.setItem("ops-chat-collapsed", collapsed ? "1" : "0"); } catch (e) {}
}

/* ---- 이벤트 연결 ---- */
document.getElementById("plaza-to").addEventListener("click", function (event) {
  var b = event.target.closest("button"), picker = document.getElementById("plaza-group");
  if (!b) return;
  if (b.dataset.act === "group") {
    picker.hidden = !picker.hidden;
    if (!picker.hidden) renderPlazaGroupPicker();
    return;
  }
  plazaTo = b.dataset.to; picker.hidden = true;
  if (plazaTo) plazaSeen[plazaTo] = Date.now();
  renderPlazaRecipients(); renderPlazaLog(); document.getElementById("plaza-input").focus();
});
document.getElementById("plaza-group-make").addEventListener("click", function () {
  var picked = checkedValues("#plaza-group-list"), status = document.getElementById("plaza-status");
  if (picked.length < 2) { status.textContent = "단체방은 두 명 이상 선택해 주세요."; return; }
  status.textContent = ""; plazaTo = picked.sort().join("|"); plazaSeen[plazaTo] = Date.now();
  document.getElementById("plaza-group").hidden = true;
  renderPlazaRecipients(); renderPlazaLog(); document.getElementById("plaza-input").focus();
});
document.getElementById("plaza-search").addEventListener("input", function (event) { plazaQuery = event.target.value.trim().toLowerCase(); renderPlazaRecipients(); });
document.getElementById("plaza-group-search").addEventListener("input", function (event) {
  var q = event.target.value.trim().toLowerCase();
  document.querySelectorAll("#plaza-group-list .private-contact").forEach(function (label) { label.style.display = !q || label.textContent.toLowerCase().indexOf(q) >= 0 ? "" : "none"; });
});
document.getElementById("plaza-toggle").addEventListener("click", function () { setPlazaCollapsed(!document.getElementById("plaza-chat").classList.contains("collapsed")); });
try { if (localStorage.getItem("ops-chat-collapsed") === "1") setPlazaCollapsed(true); } catch (e) {}
document.getElementById("plaza-send").addEventListener("click", sendPlazaChat);
document.getElementById("plaza-input").addEventListener("input", growPlazaInput);
onEnterSend(document.getElementById("plaza-input"), sendPlazaChat, { shiftNewline: true, noRepeat: true });

document.getElementById("chat-modes").addEventListener("click", function (event) {
  var button = event.target.closest("[data-chat-mode]");
  if (!button) return;
  chatMode = button.dataset.chatMode;
  document.getElementById("notice-pane").hidden = chatMode !== "notice";
  document.getElementById("private-pane").hidden = chatMode !== "private";
  document.querySelectorAll("#chat-modes .chat-mode").forEach(function (tab) { tab.setAttribute("aria-selected", String(tab === button)); });
  if (chatMode === "private") { refreshPrivateContacts(); renderPrivateChat(); markPrivateSeen(); }
  else { renderChat(); markSeen(); }
});
document.getElementById("private-open").addEventListener("click", openPrivateConversation);
document.getElementById("private-rooms").addEventListener("click", function (event) {
  var button = event.target.closest("[data-room]");
  if (!button) return;
  activePrivateRoom = button.dataset.room; renderPrivateChat(); document.getElementById("private-input").focus();
});
document.getElementById("private-send").addEventListener("click", sendPrivateChat);
onEnterSend(document.getElementById("private-input"), sendPrivateChat);
document.getElementById("cwho").addEventListener("change", function (event) { chatMe = event.target.value; renderChat(); });
document.getElementById("csend").addEventListener("click", sendChat);
onEnterSend(document.getElementById("cin"), sendChat);
document.getElementById("clist").addEventListener("click", function (event) {
  var button = event.target.closest(".cdel");
  if (button) commit("chat", button.dataset.id, null, function () { renderChat(); updateBadge(); }, "#cstatus");
});
