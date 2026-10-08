/*
 * 서버(Spring) 저장소 어댑터
 *
 * 원래 app 스크립트(js/app/*.js)는 Claude Artifact 런타임의 window.claude.use("db") / use("user") 로 공유 DB 를 썼습니다.
 * 이 파일이 같은 모양의 객체를 만들어서, 그 스크립트를 거의 고치지 않고 Spring REST API 에 연결합니다.
 *
 *   use("user") -> { can(permission) }               GET  api/me
 *   use("db")   -> collection(name).onSnapshot(cb)    GET  api/docs 로 처음 한 번 전체를 받고,
 *                                                     이후에는 SSE 로 오는 변경분(doc/private)만 반영
 *                                                     (seq 누락 시에만 전체 재조회, SSE 불가 시 폴링)
 *                  doc("컬렉션/id").set(data)         PUT  api/doc/{컬렉션}/{id}
 *                  doc("컬렉션/id").delete()          DELETE api/doc/{컬렉션}/{id}
 *                  sendPos / onPos                   WebSocket ws/pos (위치 전용, DB 저장 없음)
 *
 * 서버에 연결되지 않으면(예: 파일로 직접 열기) null 을 돌려주어 js/app 이 localStorage 모드로 동작합니다.
 */
(function () {
  "use strict";
  var API = "api", POLL_MS = 5000;
  var cache = {}, last = {}, listeners = [], ready = null, timer = null, me = null, eventSource = null;
  var lastSeq = null, pulling = null, pullAgain = false;

  function req(method, url, body) {
    var opt = { method: method, headers: {}, credentials: "same-origin" };
    if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    return fetch(url, opt).then(function (r) {
      if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
      return r.status === 204 ? null : r.json();
    });
  }

  function snapshotOf(col, q) {
    var m = cache[col] || {}, docs = Object.keys(m).map(function (id) { return { id: id, data: function () { return m[id]; } }; });
    if (q && q.field) {
      docs.sort(function (a, b) {
        var x = a.data()[q.field], y = b.data()[q.field], c = x < y ? -1 : x > y ? 1 : 0;
        return q.dir === "desc" ? -c : c;
      });
    }
    if (q && q.max) docs = docs.slice(0, q.max);
    return { docs: docs };
  }

  function notify(col) {
    listeners.forEach(function (l) { if (l.col === col) { try { l.cb(snapshotOf(col, l.q)); } catch (e) { if (window.console) console.error(e); } } });
  }

  function pullOnce() {
    return Promise.all([req("GET", API + "/docs"), req("GET", API + "/chats/private")]).then(function (result) {
      var all = result[0], privateMessages = result[1] || [], privateDocs = {};
      Object.keys(all).forEach(function (col) {
        var s = JSON.stringify(all[col]);
        if (s !== last[col]) { last[col] = s; cache[col] = all[col]; notify(col); }
      });
      privateMessages.forEach(function (message) { if (message && message.id) privateDocs[message.id] = message; });
      var privateSnapshot = JSON.stringify(privateDocs);
      if (privateSnapshot !== last.privateChats) {
        last.privateChats = privateSnapshot;
        cache.privateChats = privateDocs;
        notify("privateChats");
      }
    });
  }

  function finishPull() {
    pulling = null;
    if (pullAgain) { pullAgain = false; pull().catch(function () {}); }
  }

  /* 전체 재조회. 진행 중이면 합치고, 그 사이 새 요청이 있었으면 끝난 뒤 한 번 더 조회합니다. */
  function pull() {
    if (pulling) { pullAgain = true; return pulling; }
    pulling = pullOnce().then(finishPull, function (e) { finishPull(); throw e; });
    return pulling;
  }

  /* 문서 하나의 변경을 캐시에 반영합니다. 내용이 같으면 리스너를 호출하지 않습니다. */
  function applyDoc(op, col, id, body) {
    var m = cache[col] || (cache[col] = {});
    if (op === "delete") {
      if (!(id in m)) return;
      delete m[id];
    } else {
      if (id in m && JSON.stringify(m[id]) === JSON.stringify(body)) return;
      m[id] = body;
    }
    last[col] = JSON.stringify(m);
    notify(col);
  }

  function applyPrivate(message) {
    if (!message || !message.id) return;
    var m = cache.privateChats || (cache.privateChats = {});
    if (m[message.id]) return;
    m[message.id] = message;
    last.privateChats = JSON.stringify(m);
    notify("privateChats");
  }

  /* seq 가 연속이면 true. 빠졌으면 전체 재조회를 걸고 false 를 돌려줍니다. */
  function trackSeq(seq) {
    var ok = lastSeq === null || seq === lastSeq + 1;
    lastSeq = seq;
    if (!ok) pull().catch(function () {});
    return ok;
  }

  function parse(e) { try { return JSON.parse(e.data); } catch (x) { return null; } }

  function startPolling() {
    if (timer) return;
    timer = setInterval(function () { if (!document.hidden) pull().catch(function () {}); }, POLL_MS);
  }
  function stopPolling() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && timer) pull().catch(function () {}); });

  function startSse() {
    if (!window.EventSource) {
      startPolling();
      return;
    }
    if (eventSource) return;
    eventSource = new EventSource(API + "/events");
    eventSource.addEventListener("connected", function (e) {
      var d = parse(e);
      lastSeq = d && typeof d.seq === "number" ? d.seq : null;
      pull().catch(function () {});   // 연결(재연결) 사이에 놓친 변경을 한 번 맞춥니다
      stopPolling();
    });
    eventSource.addEventListener("doc", function (e) {
      var d = parse(e);
      if (!d || typeof d.seq !== "number") return;
      if (trackSeq(d.seq)) applyDoc(d.op, d.col, d.id, d.body);
    });
    eventSource.addEventListener("private", function (e) {
      var d = parse(e);
      if (!d || typeof d.seq !== "number") return;
      if (trackSeq(d.seq)) applyPrivate(d.message);
    });
    eventSource.addEventListener("seq", function (e) {
      var d = parse(e);
      if (d && typeof d.seq === "number") trackSeq(d.seq);
    });
    eventSource.addEventListener("refresh", function (e) {
      var d = parse(e);
      if (d && typeof d.seq === "number") lastSeq = d.seq;
      pull().catch(function () {});
    });
    // 브라우저가 자동으로 재연결하므로 닫지 않습니다. 완전히 닫힌 경우에만 폴링으로 전환합니다.
    eventSource.onerror = function () {
      if (eventSource && eventSource.readyState === 2) {
        eventSource = null;
        startPolling();
      }
    };
  }

  function query(col, q) {
    return {
      orderBy: function (f, d) { return query(col, { field: f, dir: d || "asc", max: q && q.max }); },
      limit: function (n) { return query(col, { field: q && q.field, dir: q && q.dir, max: n }); },
      onSnapshot: function (cb) {
        var l = { col: col, cb: cb, q: q };
        listeners.push(l);
        setTimeout(function () { cb(snapshotOf(col, q)); }, 0);   // 처음 한 번은 현재 데이터를 바로 전달
        return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
      }
    };
  }

  /* ---- 위치 채널(WebSocket). 위치는 서버 메모리에만 있고 DB/SSE 를 거치지 않습니다. ---- */
  var posSocket = null, posTimer = null, posDelay = 1000, posListeners = [];
  function posUrl() {
    var u = new URL("ws/pos", location.href);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    return u.href;
  }
  function connectPos() {
    if (posSocket || !window.WebSocket) return;
    var ws;
    try { ws = new WebSocket(posUrl()); } catch (e) { return; }
    posSocket = ws;
    ws.onopen = function () { posDelay = 1000; };
    ws.onmessage = function (e) {
      var d = parse(e);
      if (!d) return;
      posListeners.forEach(function (cb) { try { cb(d); } catch (x) { if (window.console) console.error(x); } });
    };
    ws.onclose = function () {
      if (posSocket === ws) posSocket = null;
      clearTimeout(posTimer);
      posTimer = setTimeout(connectPos, posDelay);
      posDelay = Math.min(posDelay * 2, 15000);
    };
    ws.onerror = function () { try { ws.close(); } catch (x) {} };
  }

  var db = {
    collection: function (col) { return query(col, null); },
    /* 위치 수신: cb({type:"snapshot", list:[{id,x,y,t,w,age}]}) 또는 cb({type:"pos", id,x,y,t,w,age}) */
    onPos: function (cb) { posListeners.push(cb); connectPos(); },
    sendPos: function (id, x, y, w, e) {
      var msg = { id: id, x: x, y: y, w: w };
      if (e) msg.e = e;
      if (posSocket && posSocket.readyState === 1) posSocket.send(JSON.stringify(msg));
    },
    adminAccounts: function () { return req("GET", API + "/admin/accounts"); },
    approveAccount: function (username) { return req("POST", API + "/admin/accounts/" + encodeURIComponent(username) + "/approve"); },
    rejectAccount: function (username) { return req("DELETE", API + "/admin/accounts/" + encodeURIComponent(username)); },
    createAdminCharacter: function (payload) {
      return req("POST", API + "/admin/characters", payload).then(function (character) {
        return pull().then(function () { return character; });
      });
    },
    privateChatContacts: function () { return req("GET", API + "/chats/private/contacts"); },
    setBossVisit: function (enabled) {
      return req("POST", API + "/boss-visit", { enabled: !!enabled }).then(function () {
        return pull();
      });
    },
    sendPrivateMessage: function (recipients, text) {
      return req("POST", API + "/chats/private", { recipients: recipients, text: text }).then(function (message) {
        applyPrivate(message);
        return message;
      });
    },
    deleteCharacter: function (id) {
      return req("DELETE", API + "/characters/" + encodeURIComponent(id)).then(function () { return pull(); });
    },
    doc: function (path) {
      var p = path.split("/"), col = p[0], id = p[1], url = API + "/doc/" + encodeURIComponent(col) + "/" + encodeURIComponent(id);
      // people 은 서버가 캐릭터 목록과 병합해 내려주므로 전체 재조회, 나머지는 로컬 캐시에 바로 반영합니다.
      function done(op, data) {
        if (col === "people") return pull().catch(function () {});
        applyDoc(op, col, id, data);
      }
      return {
        set: function (data) { return req("PUT", url, data).then(function () { done("set", data); }); },
        delete: function () { return req("DELETE", url).then(function () { done("delete"); }); }
      };
    }
  };

  function connect() {
    if (!ready) {
      ready = Promise.all([req("GET", API + "/me"), req("GET", API + "/docs"), req("GET", API + "/chats/private")]).then(function (r) {
        me = r[0];
        Object.keys(r[1]).forEach(function (c) { cache[c] = r[1][c]; last[c] = JSON.stringify(r[1][c]); });
        cache.privateChats = {};
        (r[2] || []).forEach(function (message) { if (message && message.id) cache.privateChats[message.id] = message; });
        last.privateChats = JSON.stringify(cache.privateChats);
        startSse();
        return true;
      }, function () { return false; });
    }
    return ready;
  }

  window.claude = {
    use: function (name) {
      return connect().then(function (ok) {
        if (!ok) return null;
        if (name === "db") return db;
        if (name === "user") return { can: function () { return Promise.resolve(!!(me && me.canWrite)); }, info: me };
        return null;
      });
    }
  };
})();
