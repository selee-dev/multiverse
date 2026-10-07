/* 로그인, 회원가입, 캐릭터 등록, 로그아웃 화면과 세션 API를 연결합니다. */
(function () {
  "use strict";

  var gate = document.getElementById("auth-screen");
  var app = document.querySelector(".wrap");
  var status = document.getElementById("auth-status");
  var loginForm = document.getElementById("login-form");
  var registerForm = document.getElementById("register-form");
  var registerUsername = document.getElementById("register-username");
  var usernameStatus = document.getElementById("register-username-status");
  var characterForm = document.getElementById("character-form");
  var usernameCheck = 0;

  function request(path, body) {
    return fetch("api/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) throw new Error(payload.error || payload.message || "요청을 처리하지 못했습니다.");
        return payload;
      });
    });
  }

  function checkUsername(username) {
    var url = "api/register/username-available?username=" + encodeURIComponent(username);
    return fetch(url, { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) throw new Error("아이디 중복 여부를 확인하지 못했습니다.");
      return response.json();
    });
  }

  var bootTimer = setTimeout(function () { bootDone(); }, 6000);
  function bootDone() { clearTimeout(bootTimer); document.documentElement.classList.remove("booting"); }
  window.bootDone = bootDone;

  function showStatus(message, isError) {
    status.textContent = message || "";
    status.classList.toggle("error", !!isError);
  }

  function showStage(stage) {
    loginForm.hidden = stage !== "login";
    registerForm.hidden = stage !== "register";
    characterForm.hidden = stage !== "character";
    document.getElementById("auth-switch").hidden = stage === "character";
    var office = document.documentElement.getAttribute("data-world-theme") !== "battlefield";
    document.getElementById("auth-eyebrow").textContent = stage === "character" ? (office ? "CREATE EMPLOYEE" : "CREATE YOUR HERO") : "METADESK ACCESS";
    document.getElementById("auth-title").textContent = stage === "character" ? (office ? "직원을 등록하세요" : "영웅을 등록하세요") : "메타데스크로 돌아오세요";
    document.getElementById("auth-copy").textContent = stage === "character"
      ? "계정마다 캐릭터 하나를 만들 수 있어요. 캐릭터 시트는 본인과 관리자만 수정할 수 있습니다."
      : "아이디로 접속하고, 당신의 캐릭터로 메타데스크에 합류하세요.";
    showStatus(stage === "character" ? "계정이 만들어졌어요. 캐릭터 정보를 입력해 주세요." : "", false);
  }

  function enterApp(me) {
    gate.hidden = true;
    app.hidden = false;
    var label = document.getElementById("account-name");
    if (label) label.textContent = me.role === "ADMIN" ? me.user + " · 관리자" : me.user;
  }

  document.getElementById("auth-switch").addEventListener("click", function (event) {
    var button = event.target.closest("[data-auth-stage]");
    if (!button) return;
    showStage(button.dataset.authStage);
  });

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showStatus("로그인 중...", false);
    request("login", {
      username: document.getElementById("login-username").value,
      password: document.getElementById("login-password").value
    }).then(function () { window.location.reload(); }, function (error) { showStatus(error.message, true); });
  });

  registerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showStatus("계정을 만드는 중...", false);
    var username = registerUsername.value.trim();
    checkUsername(username).then(function (result) {
      if (!result.available) throw new Error("이미 사용 중이거나 사용할 수 없는 아이디입니다.");
      return request("register", {
        username: username,
        password: document.getElementById("register-password").value
      });
    }).then(function () { window.location.reload(); }, function (error) { showStatus(error.message, true); });
  });

  registerUsername.addEventListener("blur", function () {
    var username = registerUsername.value.trim(), token = ++usernameCheck;
    usernameStatus.textContent = "";
    usernameStatus.classList.remove("available", "error");
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) return;
    checkUsername(username).then(function (result) {
      if (token !== usernameCheck || username !== registerUsername.value.trim()) return;
      usernameStatus.textContent = result.available ? "사용할 수 있는 아이디입니다." : "이미 사용 중이거나 사용할 수 없는 아이디입니다.";
      usernameStatus.classList.add(result.available ? "available" : "error");
    }).catch(function () {});
  });

  var genderSelect = document.getElementById("character-gender");
  var lookPicker = window.Look.mount(document.getElementById("character-look"), null, genderSelect.value);
  genderSelect.addEventListener("change", function () { lookPicker.setGender(genderSelect.value); });

  characterForm.addEventListener("submit", function (event) {
    event.preventDefault();
    showStatus("캐릭터를 등록하는 중...", false);
    request("characters", {
      n: document.getElementById("character-name").value,
      g: genderSelect.value,
      u: document.getElementById("character-universe").value,
      l: lookPicker.get()
    }).then(function () { window.location.reload(); }, function (error) { showStatus(error.message, true); });
  });

  document.getElementById("logout-button").addEventListener("click", function () {
    fetch("api/logout", { method: "POST", credentials: "same-origin" }).then(function () { window.location.reload(); });
  });

  showStage("login");
  fetch("api/me", { credentials: "same-origin" })
    .then(function (response) { if (!response.ok) throw new Error("로그인 상태를 확인할 수 없습니다."); return response.json(); })
    .then(function (me) {
      if (!me.user) { bootDone(); return; }
      if (me.role !== "ADMIN" && !me.hasCharacter) {
        showStage("character"); bootDone();
        return;
      }
      enterApp(me);
    })
    .catch(function () { showStatus("서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.", true); bootDone(); });
})();
