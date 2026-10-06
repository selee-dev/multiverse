/* 서버 연결(db-adapter)과 컬렉션 구독 */

if (window.claude && window.claude.use) {
  window.claude.use("user").then(function (u) {
    currentUser = u && u.info ? u.info.user : null;
    currentRole = u && u.info ? u.info.role : null;
    currentCharacterId = u && u.info ? u.info.characterId : null;
    currentCanAnnounce = currentRole === "ADMIN" || !!(u && u.info && u.info.canAnnounce);
    return u && u.can ? u.can("data.write") : null;
  }).then(function (v) { canWrite = v; refreshPanes(); renderGrid(); renderCopyEditor(); autoCompleteDue(); }, function () {});
  window.claude.use("db").then(function (db) {
    if (!db) { if (window.bootDone) window.bootDone(); return; }
    dbRef = db;
    db.privateChatContacts().then(function (contacts) { privateContacts = contacts || []; renderPrivateContacts(); renderPrivateChat(); renderPlazaRecipients(); renderPlazaLog(); }, function () {});
    db.collection("privateChats").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (doc) { var value = doc.data(); if (value && Array.isArray(value.participants)) m[doc.id] = value; });
      store.privateChats = m;
      if (state.view === "chat" && chatMode === "private") renderPrivateChat();
      else updatePrivateBadge();
      renderPlazaLog();
    }, function () {});
    db.collection("say").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (doc) { var v = doc.data(); if (v && typeof v.t === "string" && typeof v.at === "number") m[doc.id] = { t: v.t.slice(0, 100), at: v.at }; });
      store.say = m;
      renderPlazaLog();
    }, function () {});
    var loaded = { tasks: false, meetings: false, projects: false, chat: false, seats: false, people: false };
    db.collection("people").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && Array.isArray(v.list)) m[x.id] = { list: v.list.slice(0, 60) }; });
      store.people = m;
      var first = !loaded.people; loaded.people = true;
      rebuildExternal(first);
      if (first && window.bootDone) window.bootDone();
      if (state.view === "team") renderTeam();
      if (state.view === "meet") { renderPick(); renderMeets(); }
    }, function () {});
    db.collection("seats").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) {
        var v = legacySeat(x.data());
        if (v && v.m && typeof v.m === "object") m[x.id] = { m: v.m };
        else if (v && v.override === true && (v.s === null || typeof v.s === "number" && v.s >= 0 && v.s < SEATS.length && Math.floor(v.s) === v.s) && (v.pc == null || typeof v.pc === "number" && v.pc >= 0 && v.pc < SEATS.length && Math.floor(v.pc) === v.pc && SEATS[v.pc].kind === "pc")) m[x.id] = { override: true, s: v.s, pc: typeof v.pc === "number" ? v.pc : null };
      });
      store.seats = m;
      var first = !loaded.seats; loaded.seats = true;
      applySeats(first); syncIntruders(first);
      var sp = document.getElementById("seatpanel");
      if (openIdx !== null && (!sp || sp.hidden)) openSheet(openIdx, null);
    }, function () {});
    // 위치는 WebSocket 으로만 받습니다. snapshot 은 접속 직후 현재 위치 전체(age=마지막 갱신 후 경과 ms)입니다.
    function takePos(v, now) {
      if (!v || typeof v.id !== "string" || typeof v.x !== "number" || typeof v.y !== "number" || typeof v.t !== "number" || typeof v.w !== "string") return;
      var age = typeof v.age === "number" ? Math.max(0, v.age) : 0, seen = posSeen[v.id];
      store.pos[v.id] = { x: v.x, y: v.y, t: v.t, w: v.w };
      if (!seen || seen.t !== v.t) posSeen[v.id] = { t: v.t, at: age >= POS_LIVE_MS ? 0 : now - age };
    }
    db.onPos(function (msg) {
      var now = Date.now();
      if (msg.type === "snapshot" && Array.isArray(msg.list)) {
        msg.list.forEach(function (v) { takePos(v, now); });
        posLoaded = true;
      } else if (msg.type === "pos") takePos(msg, now);
    });
    db.collection("jobs").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && typeof v.c === "string") m[x.id] = v.c; });
      jobs = m;
      renderGrid();
      var n = document.querySelector("#sheet .jobname");
      if (n && openIdx !== null) n.textContent = job(DATA[openIdx]);
    }, function () { dbRef = null; });
    db.collection("moves").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && typeof v.u === "string" && UNI[v.u]) m[x.id] = v.u; });
      var first = !movesLoaded;
      movesLoaded = true; moves = m;
      applyMoves(first); syncIntruders(false); renderPortals(); renderGrid();
    }, function () {});
    db.collection("status").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && typeof v.from === "string" && typeof v.to === "string") m[x.id] = { from: v.from, to: v.to }; });
      leaves = m; renderGrid(); syncMeetings(false);
      var al = document.querySelector("#sheet .attline");
      if (al && openIdx !== null) { al.textContent = "근태 · " + attText(DATA[openIdx]); al.className = "attline" + (onLeave(DATA[openIdx]) ? " off" : ""); }
      if (state.view === "meet") renderPick();
    }, function () {});
    db.collection("tasks").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && Array.isArray(v.items)) m[x.id] = { items: v.items }; });
      store.tasks = m;
      var first = !loaded.tasks; loaded.tasks = true;
      syncIntruders(first); renderGrid(); if (openIdx !== null) renderTasks();
      autoCompleteDue();
    }, function () {});
    db.collection("chat").orderBy("at", "desc").limit(100).onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && typeof v.p === "string" && typeof v.t === "string") m[x.id] = { p: v.p, t: v.t.slice(0, 200), at: +v.at || 0 }; });
      store.chat = m; loaded.chat = true;
      if (state.view === "chat") { renderChat(); markSeen(); } else updateBadge();
    }, function () {});
    db.collection("cfg").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) {
        var v = x.data();
        if (x.id === "copy" && v && typeof v === "object") {
          var copy = {};
          COPY_FIELDS.forEach(function (group) { group[1].forEach(function (field) { if (typeof v[field[0]] === "string") copy[field[0]] = v[field[0]].slice(0, 1500); }); });
          m.copy = copy;
        } else if (v && typeof v === "object") m[x.id] = {
          ls: typeof v.ls === "string" ? v.ls : "12:00",
          le: typeof v.le === "string" ? v.le : "13:00",
          oe: typeof v.oe === "string" ? v.oe : "18:00",
          bossVisit: v.bossVisit === true
        };
      });
      store.cfg = m; fillCfg(); applySiteCopy(); renderCopyEditor(); applySeats(false); syncMeetings(false);
    }, function () {});
    db.collection("ot").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && typeof v.d === "string") m[x.id] = { d: v.d, at: +v.at || 0 }; });
      store.ot = m; syncMeetings(false); renderGrid();
    }, function () {});
    db.collection("pres").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && ["work", "lunch", "break", "away"].indexOf(v.s) >= 0 && typeof v.at === "number") m[x.id] = { s: v.s, at: v.at }; });
      store.pres = m; syncMeetings(false);
      var al = document.querySelector("#sheet .attline");
      if (al && openIdx !== null) {
        al.textContent = "근태 · " + attText(DATA[openIdx]);
        var active = selectedPresence(DATA[openIdx]);
        document.querySelectorAll("#prespanel .pr").forEach(function (button) {
          button.setAttribute("aria-pressed", button.getAttribute("data-s") === active ? "true" : "false");
        });
      }
    }, function () {});
    db.collection("stats").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && Array.isArray(v.s) && v.s.length === 5) m[x.id] = { s: v.s }; });
      store.stats = m; renderGrid();
      var ed = document.getElementById("statpanel");
      if (openIdx !== null && (!ed || ed.hidden)) openSheet(openIdx, null);
    }, function () {});
    db.collection("health").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && Number.isFinite(+v.value)) m[x.id] = { value: Math.max(0, Math.min(100, Math.round(+v.value))) }; });
      store.health = m; renderGrid();
      var ed = document.getElementById("healthpanel");
      if (openIdx !== null && (!ed || ed.hidden)) openSheet(openIdx, null);
    }, function () {});
    db.collection("nicks").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && typeof v.n === "string") m[x.id] = { n: v.n.slice(0, 30) }; });
      store.nicks = m; rebuildExternal(false); renderPick(); renderMeets();
      if (state.view === "team") renderTeam();
    }, function () {});
    db.collection("skills").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && typeof v === "object") m[x.id] = { k: String(v.k || "").slice(0, 20), kd: String(v.kd || "").slice(0, 80), q: String(v.q || "").slice(0, 40) }; });
      store.skills = m; renderGrid();
      var ed = document.getElementById("skillpanel");
      if (openIdx !== null && (!ed || ed.hidden)) openSheet(openIdx, null);
    }, function () {});
    db.collection("titles").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && typeof v.t === "string") m[x.id] = { t: v.t.slice(0, 8) }; });
      store.titles = m;
      syncAnnouncementPermission();
      spr = DATA.map(function (d) { return makeSprites(d); });
      renderGrid();
      refreshForms();
      if (state.view === "chat") renderChatWho();
      if (openIdx !== null) { var tn = document.querySelector("#sheet .smeta > span"); if (tn) openSheet(openIdx, null); }
    }, function () {});
    db.collection("snacks").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) {
        var v = x.data();
        if (v && typeof v.u === "string" && typeof v.from === "string" && typeof v.to === "string") m[x.id] = { u: v.u, from: v.from, to: v.to, items: Array.isArray(v.items) ? v.items.slice(0, 6).map(String) : [] };
      });
      store.snacks = m; renderPortals();
      if (state.view === "snack") renderSnack();
    }, function () {});
    db.collection("meetings").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) { var v = x.data(); if (v && typeof v.t === "string") m[x.id] = { t: v.t, m: Array.isArray(v.m) ? v.m : [], on: !!v.on, at: +v.at || 0 }; });
      store.meetings = m;
      var first = !loaded.meetings; loaded.meetings = true;
      syncMeetings(first); if (state.view === "meet") renderMeets();
    }, function () {});
    db.collection("projects").onSnapshot(function (snap) {
      var m = {};
      snap.docs.forEach(function (x) {
        var v = x.data();
        if (PSLOTS.indexOf(x.id) >= 0 && v && typeof v.name === "string") m[x.id] = { name: v.name.slice(0, 16), members: Array.isArray(v.members) ? v.members.slice(0, 20) : [] };
      });
      store.projects = m;
      var first = !loaded.projects; loaded.projects = true;
      rebuildExternal(first);
      if (state.view === "proj") renderProjects();
      if (state.view === "meet") { renderPick(); renderMeets(); }
    }, function () {});
  }, function () {});
}
