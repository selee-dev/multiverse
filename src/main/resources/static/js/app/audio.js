/* 배경 음악(BGM) */
var bgm = { context: null, gain: null, timer: null, step: 0, playing: false, enabled: true };
try { bgm.enabled = localStorage.getItem("ops-bgm") !== "off"; } catch (e) {}
function bgmButton() { return document.getElementById("bgm-toggle"); }
function syncBgmButton() {
  var button = bgmButton(); if (!button) return;
  button.setAttribute("aria-pressed", String(bgm.enabled));
  button.textContent = bgm.enabled ? "BGM 켜짐" : "BGM 꺼짐";
}
function bgmTick() {
  if (!bgm.context || !bgm.gain || !bgm.playing) return;
  var battlefield = [196, 247, 294, 330, 247, 220, 262, 330], plaza = [262, 330, 392, 330, 294, 349, 440, 349];
  var notes = WORLD_THEME === "plaza" ? plaza : battlefield, frequency = notes[bgm.step % notes.length], now = bgm.context.currentTime;
  var oscillator = bgm.context.createOscillator(), volume = bgm.context.createGain();
  oscillator.type = WORLD_THEME === "plaza" ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);
  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.exponentialRampToValueAtTime(0.035, now + 0.06);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
  oscillator.connect(volume); volume.connect(bgm.gain); oscillator.start(now); oscillator.stop(now + 0.82);
  bgm.step++;
}
function startBgm() {
  if (!bgm.enabled) return;
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  if (!bgm.context) { bgm.context = new AudioContext(); bgm.gain = bgm.context.createGain(); bgm.gain.gain.value = 0.7; bgm.gain.connect(bgm.context.destination); }
  if (bgm.context.state === "suspended") bgm.context.resume();
  if (bgm.playing) return;
  bgm.playing = true; bgm.step = 0; bgmTick(); bgm.timer = setInterval(bgmTick, 820);
}
function stopBgm() {
  bgm.playing = false;
  if (bgm.timer) { clearInterval(bgm.timer); bgm.timer = null; }
}
function toggleBgm() {
  bgm.enabled = !bgm.enabled;
  try { localStorage.setItem("ops-bgm", bgm.enabled ? "on" : "off"); } catch (e) {}
  if (bgm.enabled) startBgm(); else stopBgm();
  syncBgmButton();
}
function armBgm() { if (bgm.enabled) startBgm(); }
document.addEventListener("pointerdown", armBgm, { once: true });
document.addEventListener("keydown", armBgm, { once: true });
