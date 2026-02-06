const $ = (id) => document.getElementById(id);

const state = {
  goal: 108,
  history: {},
  notes: {},
  streak: 0,
  bestStreak: 0,
  lastDate: "",
  sessionStart: null,
  sessionElapsed: 0,
  sessionRunning: false,
  autoTimer: null,
  timerTick: null,
};

const STORAGE_KEY = "naam_jaap_counter_v1";

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const load = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.assign(state, data);
  } catch {
    // ignore corrupted storage
  }
};

const save = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    goal: state.goal,
    history: state.history,
    notes: state.notes,
    streak: state.streak,
    bestStreak: state.bestStreak,
    lastDate: state.lastDate,
  }));
};

const ensureToday = () => {
  const today = todayStr();
  if (state.lastDate === "") {
    state.lastDate = today;
    if (!state.history[today]) state.history[today] = 0;
    save();
    return;
  }

  if (state.lastDate !== today) {
    const yesterday = daysAgoStr(1);
    if ((state.history[yesterday] || 0) > 0) {
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
    } else {
      state.streak = 0;
    }
    state.lastDate = today;
    if (!state.history[today]) state.history[today] = 0;
    save();
  }
};

const formatNumber = (n) => n.toLocaleString();

const updateStats = () => {
  const today = todayStr();
  const todayCount = state.history[today] || 0;
  const weekTotal = Array.from({ length: 7 }, (_, i) => state.history[daysAgoStr(i)] || 0)
    .reduce((a, b) => a + b, 0);
  const allTime = Object.values(state.history).reduce((a, b) => a + b, 0);

  $("count").textContent = formatNumber(todayCount);
  $("stat-today").textContent = formatNumber(todayCount);
  $("stat-week").textContent = formatNumber(weekTotal);
  $("stat-streak").textContent = formatNumber(state.streak);
  $("stat-all").textContent = formatNumber(allTime);
  $("best-streak").textContent = formatNumber(state.bestStreak);

  updateGoal(todayCount);
  updateMilestones(allTime, todayCount);
  drawChart();
};

const updateGoal = (todayCount) => {
  const percent = Math.min(100, Math.round((todayCount / state.goal) * 100));
  $("goal").textContent = formatNumber(state.goal);
  $("goal-bar").style.width = `${percent}%`;
  $("goal-percent").textContent = `${percent}%`;
  const remaining = Math.max(0, state.goal - todayCount);
  $("goal-remaining").textContent = `${formatNumber(remaining)} remaining`;
};

const updateMilestones = (allTime, todayCount) => {
  const list = $("milestones");
  list.innerHTML = "";
  const milestones = [108, 216, 540, 1080, 5000, 10000];
  milestones.forEach((m) => {
    const li = document.createElement("li");
    const done = allTime >= m ? "Achieved" : `${formatNumber(m - allTime)} to go`;
    li.textContent = `${formatNumber(m)} total: ${done}`;
    list.appendChild(li);
  });
  const li = document.createElement("li");
  li.textContent = `Today focus: ${formatNumber(todayCount)} chants`;
  list.appendChild(li);
};

const increment = (amt) => {
  const today = todayStr();
  state.history[today] = (state.history[today] || 0) + amt;
  if (state.history[today] < 0) state.history[today] = 0;
  save();
  updateStats();
  feedback();
};

const feedback = () => {
  if ($("toggle-vibrate").checked && navigator.vibrate) {
    navigator.vibrate([10, 20, 10]);
  }
  if ($("toggle-sound").checked) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 520;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }
};

const drawChart = () => {
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = 120;
  ctx.clearRect(0, 0, w, h);

  const data = Array.from({ length: 7 }, (_, i) => state.history[daysAgoStr(6 - i)] || 0);
  const max = Math.max(10, ...data);
  const barWidth = w / data.length;

  data.forEach((val, i) => {
    const height = (val / max) * (h - 20);
    const x = i * barWidth + 10;
    const y = h - height - 10;
    ctx.fillStyle = "rgba(195, 90, 43, 0.6)";
    ctx.fillRect(x, y, barWidth - 20, height);
    ctx.fillStyle = "#6f6a64";
    ctx.font = "10px Spline Sans";
    ctx.fillText(val, x, y - 4);
  });
};

const updateTimer = () => {
  const elapsed = state.sessionRunning
    ? state.sessionElapsed + (Date.now() - state.sessionStart)
    : state.sessionElapsed;
  const totalSeconds = Math.floor(elapsed / 1000);
  const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const secs = String(totalSeconds % 60).padStart(2, "0");
  $("timer").textContent = `${hrs}:${mins}:${secs}`;

  const todayCount = state.history[todayStr()] || 0;
  const minutes = Math.max(1, totalSeconds / 60);
  $("pace").textContent = Math.round(todayCount / minutes);
};

const startTimer = () => {
  if (state.sessionRunning) return;
  state.sessionRunning = true;
  state.sessionStart = Date.now();
  if (!state.timerTick) {
    state.timerTick = setInterval(updateTimer, 500);
  }
};

const pauseTimer = () => {
  if (!state.sessionRunning) return;
  state.sessionElapsed += Date.now() - state.sessionStart;
  state.sessionRunning = false;
  updateTimer();
};

const stopTimer = () => {
  if (state.sessionRunning) {
    state.sessionElapsed += Date.now() - state.sessionStart;
  }
  state.sessionRunning = false;
  state.sessionElapsed = 0;
  updateTimer();
};

const toggleAuto = () => {
  const enabled = $("toggle-auto").checked;
  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
  }
  if (enabled) {
    const bpm = Number($("auto-pace").value);
    const interval = Math.max(150, Math.round(60000 / bpm));
    state.autoTimer = setInterval(() => increment(1), interval);
  }
};

const updateAutoLabel = () => {
  $("auto-pace-label").textContent = `${$("auto-pace").value} bpm`;
  if ($("toggle-auto").checked) toggleAuto();
};

const exportData = () => {
  const payload = {
    goal: state.goal,
    history: state.history,
    notes: state.notes,
    streak: state.streak,
    bestStreak: state.bestStreak,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `naam-jaap-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const resetDay = () => {
  const today = todayStr();
  state.history[today] = 0;
  save();
  updateStats();
};

const loadNotes = () => {
  const today = todayStr();
  $("notes").value = state.notes[today] || "";
};

const saveNotes = () => {
  const today = todayStr();
  state.notes[today] = $("notes").value;
  save();
};

const init = () => {
  load();
  ensureToday();
  $("goal-input").value = state.goal;
  loadNotes();
  updateStats();
  updateTimer();

  $("btn-add").addEventListener("click", () => increment(1));
  $("btn-add10").addEventListener("click", () => increment(10));
  $("btn-minus").addEventListener("click", () => increment(-1));

  $("btn-set-goal").addEventListener("click", () => {
    const val = Number($("goal-input").value);
    if (val > 0) state.goal = val;
    save();
    updateStats();
  });

  $("btn-start").addEventListener("click", startTimer);
  $("btn-pause").addEventListener("click", pauseTimer);
  $("btn-stop").addEventListener("click", stopTimer);

  $("toggle-auto").addEventListener("change", toggleAuto);
  $("auto-pace").addEventListener("input", updateAutoLabel);

  $("btn-export").addEventListener("click", exportData);
  $("btn-reset").addEventListener("click", resetDay);
  $("btn-reset-today").addEventListener("click", resetDay);

  $("btn-save-note").addEventListener("click", saveNotes);

  window.addEventListener("resize", drawChart);
};

init();
