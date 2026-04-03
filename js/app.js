(function () {
  const STORAGE_STREAK = "brain_morning_streak_v1";
  const STORAGE_LAST = "brain_morning_last_day_v1";
  const STORAGE_DONE = "brain_morning_done_day_v1";
  const STORAGE_REMINDER = "brain_morning_reminder_v1";
  const STORAGE_ACCESS = "brain_morning_access_mode_v1";

  const el = (id) => document.getElementById(id);

  function getAccessMode() {
    return localStorage.getItem(STORAGE_ACCESS) === "assisted" ? "assisted" : "standard";
  }

  function setAccessMode(mode) {
    localStorage.setItem(STORAGE_ACCESS, mode === "assisted" ? "assisted" : "standard");
    document.body.classList.toggle("assisted-mode", mode === "assisted");
    syncModeButtons();
  }

  function syncModeButtons() {
    const m = getAccessMode();
    const std = el("mode-standard");
    const asst = el("mode-assisted");
    if (!std || !asst) return;
    std.classList.toggle("selected", m === "standard");
    std.setAttribute("aria-pressed", m === "standard" ? "true" : "false");
    asst.classList.toggle("selected", m === "assisted");
    asst.setAttribute("aria-pressed", m === "assisted" ? "true" : "false");
  }

  function cancelSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function speak(text) {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      const v = voices.find((x) => x.lang && (x.lang.startsWith("zh") || /Chinese|中文|Cantonese/i.test(x.name)));
      if (v) u.voice = v;
    };
    pick();
    if (!u.voice) {
      window.speechSynthesis.addEventListener("voiceschanged", pick, { once: true });
    }
    window.speechSynthesis.speak(u);
  }

  function speakIfAssisted(text) {
    if (getAccessMode() === "assisted") speak(text);
  }

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDay(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function dayDiff(a, b) {
    return Math.round((a - b) / 86400000);
  }

  function loadStreak() {
    try {
      const raw = localStorage.getItem(STORAGE_STREAK);
      const last = localStorage.getItem(STORAGE_LAST);
      const t = todayStr();
      if (!raw || !last) return { streak: 0, last: null };
      let streak = parseInt(raw, 10) || 0;
      const lastDate = parseDay(last);
      const today = parseDay(t);
      const diff = dayDiff(today, lastDate);
      if (diff === 0) return { streak, last };
      if (diff === 1) return { streak, last };
      if (diff > 1) return { streak: 0, last };
      return { streak: 0, last };
    } catch {
      return { streak: 0, last: null };
    }
  }

  function saveStreakAfterComplete() {
    const t = todayStr();
    const last = localStorage.getItem(STORAGE_LAST);
    let streak = parseInt(localStorage.getItem(STORAGE_STREAK) || "0", 10) || 0;
    if (last === t) {
      return streak;
    }
    if (!last) {
      streak = 1;
    } else {
      const diff = dayDiff(parseDay(t), parseDay(last));
      if (diff === 0) return streak;
      if (diff === 1) streak += 1;
      else streak = 1;
    }
    localStorage.setItem(STORAGE_STREAK, String(streak));
    localStorage.setItem(STORAGE_LAST, t);
    return streak;
  }

  function isDoneToday() {
    return localStorage.getItem(STORAGE_DONE) === todayStr();
  }

  function markDoneToday() {
    localStorage.setItem(STORAGE_DONE, todayStr());
  }

  let currentGames = [];
  let stepIndex = 0;
  let daySeed = dateSeed();

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    el(id).classList.add("active");
  }

  function updateHomeStreak() {
    const { streak } = loadStreak();
    el("streak-days").textContent = String(streak);
    const hint = el("home-hint");
    if (isDoneToday()) {
      hint.textContent = "今天已经完成啦，明天再来动动脑～";
      el("btn-start").textContent = "再看一遍今日关卡（练习）";
    } else {
      hint.textContent = "";
      el("btn-start").textContent = "开始今日脑力操";
    }
  }

  function renderProgress() {
    const pct = ((stepIndex + 1) / 3) * 100;
    el("progress-fill").style.width = pct + "%";
    el("level-tag").textContent = `第 ${stepIndex + 1} / 3 关`;
  }

  function mountRemember(payload, onNext) {
    const root = el("game-root");
    const meta = GAME_LABELS.remember;
    const words = payload.words;
    const assisted = getAccessMode() === "assisted";

    if (assisted) {
      let phase = "memorize";
      const memId = "mem-words";

      function renderRecallSteps() {
        const rngRecall = createRng((dateSeed() * 17 + stepIndex * 7 + 99) >>> 0);
        const steps = buildRememberRecallSteps(words, rngRecall);
        let si = 0;

        function renderOneStep() {
          const s = steps[si];
          root.innerHTML = `
            <h3 class="game-title">${meta.icon} ${meta.title}</h3>
            <p class="game-desc assisted-desc">第 ${s.stepNum} 题：下面哪一个刚才出现过？点一下。</p>
            <div id="recall-opts"></div>
            <button type="button" class="btn btn-primary" id="recall-replay">再听一遍题目</button>
          `;
          const hint = `第 ${s.stepNum} 题。下面哪一个刚才出现过？`;
          speak(hint);
          const opts = el("recall-opts");
          s.options.forEach((opt) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "btn btn-choice";
            b.textContent = opt;
            b.addEventListener("click", () => {
              speak(opt);
              si += 1;
              if (si >= steps.length) onNext();
              else renderOneStep();
            });
            opts.appendChild(b);
          });
          el("recall-replay").addEventListener("click", () => speak(hint));
        }
        renderOneStep();
      }

      function render() {
        if (phase === "memorize") {
          root.innerHTML = `
            <h3 class="game-title">${meta.icon} ${meta.title}</h3>
            <p class="game-desc assisted-desc">听一听这三个词，十秒后再选。</p>
            <p class="timer-badge" id="mem-timer">还剩 10 秒</p>
            <div class="memorize-box" id="${memId}">${words.join("　")}</div>
            <button type="button" class="btn btn-primary btn-xl" id="mem-skip">我记好了，提前开始</button>
          `;
          setTimeout(() => {
            speak(`请记住下面三个词：${words.join("，")}。`);
          }, 300);
          let left = 10;
          const timerEl = el("mem-timer");
          const tick = setInterval(() => {
            left -= 1;
            if (timerEl) timerEl.textContent = left <= 0 ? "到啦" : `还剩 ${left} 秒`;
            if (left <= 0) {
              clearInterval(tick);
              phase = "recall";
              render();
            }
          }, 1000);
          el("mem-skip").addEventListener("click", () => {
            clearInterval(tick);
            phase = "recall";
            render();
          });
        } else {
          renderRecallSteps();
        }
      }
      render();
      return;
    }

    let phase = "memorize";
    const memId = "mem-words";

    function render() {
      if (phase === "memorize") {
        root.innerHTML = `
          <h3 class="game-title">${meta.icon} ${meta.title}</h3>
          <p class="game-desc">${meta.desc}</p>
          <p class="timer-badge" id="mem-timer">还剩 10 秒</p>
          <div class="memorize-box" id="${memId}">${words.join("　")}</div>
          <button type="button" class="btn btn-primary btn-xl" id="mem-skip">我记好了，提前开始</button>
        `;
        let left = 10;
        const timerEl = el("mem-timer");
        const tick = setInterval(() => {
          left -= 1;
          if (timerEl) timerEl.textContent = left <= 0 ? "到啦" : `还剩 ${left} 秒`;
          if (left <= 0) {
            clearInterval(tick);
            phase = "recall";
            render();
          }
        }, 1000);
        el("mem-skip").addEventListener("click", () => {
          clearInterval(tick);
          phase = "recall";
          render();
        });
      } else {
        root.innerHTML = `
          <h3 class="game-title">${meta.icon} ${meta.title}</h3>
          <p class="game-desc">请回忆刚才的 3 个词，顺序不限，填字即可。</p>
          <div class="word-inputs" id="word-inputs"></div>
          <button type="button" class="btn btn-primary btn-xl" id="btn-next-remember">填好了，下一关</button>
        `;
        const box = el("word-inputs");
        words.forEach((_, i) => {
          const inp = document.createElement("input");
          inp.type = "text";
          inp.placeholder = `第 ${i + 1} 个词`;
          inp.autocomplete = "off";
          inp.setAttribute("enterkeyhint", "next");
          box.appendChild(inp);
        });
        box.querySelector("input").focus();
        el("btn-next-remember").addEventListener("click", () => onNext());
      }
    }
    render();
  }

  function mountListen(payload, onNext) {
    const root = el("game-root");
    const meta = GAME_LABELS.listen;
    const order = payload.order;
    const assisted = getAccessMode() === "assisted";
    let canSelect = false;
    root.innerHTML = `
      <h3 class="game-title">${meta.icon} ${meta.title}</h3>
      <p class="game-desc">${assisted ? "先听旋律，再点选。可以多点几次听一听。" : meta.desc}</p>
      <div class="play-again-wrap">
        <button type="button" class="btn btn-primary" id="btn-play-melody">${assisted ? "再播一遍题目旋律" : "点击播放旋律（约 3 秒）"}</button>
      </div>
      <p class="audio-hint" id="listen-hint">先听一遍，再选答案。</p>
      <div id="listen-choices"></div>
      <button type="button" class="btn btn-primary btn-xl" id="btn-next-listen" disabled>选好了，下一关</button>
    `;
    if (assisted) {
      speak("听一听。请先听旋律，再在下面选一个一样的。");
    }
    const choiceRoot = el("listen-choices");
    order.forEach((pid, idx) => {
      const p = MELODY_PATTERNS[pid];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-choice";
      b.textContent = assisted ? `第 ${idx + 1} 个：${p.name}` : p.name;
      b.dataset.id = String(pid);
      b.addEventListener("click", () => {
        if (!canSelect) return;
        playMelody(pid);
        if (assisted) speak(`${p.name}`);
        choiceRoot.querySelectorAll(".btn-choice").forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        el("btn-next-listen").disabled = false;
      });
      choiceRoot.appendChild(b);
    });

    function playOnce() {
      canSelect = false;
      el("listen-hint").textContent = "正在播放…";
      if (assisted) speak("正在播放题目旋律。");
      playMelody(payload.correctId, () => {
        canSelect = true;
        el("listen-hint").textContent = assisted
          ? "下面哪个和刚才一样？点一下，再按下一关。"
          : "下面哪个是刚才的旋律？点一下再按下一关。";
        if (assisted) speak("下面哪个和刚才一样？选好按下一关。");
      });
    }

    el("btn-play-melody").addEventListener("click", playOnce);
    el("btn-next-listen").addEventListener("click", () => onNext());
    playOnce();
  }

  function mountMath(payload, onNext) {
    const root = el("game-root");
    const meta = GAME_LABELS.math;
    const assisted = getAccessMode() === "assisted";

    if (assisted) {
      const rng = createRng((dateSeed() * 41 + stepIndex * 3 + 11) >>> 0);
      const options = buildMathChoiceOptions(payload.answer, rng);
      root.innerHTML = `
        <h3 class="game-title">${meta.icon} ${meta.title}</h3>
        <p class="game-desc assisted-desc">听题后，点选一个数字。</p>
        <p class="math-q" id="math-q-text">${payload.text}</p>
        <div id="math-choices"></div>
        <button type="button" class="btn btn-primary" id="math-replay">再听一遍题目</button>
        <button type="button" class="btn btn-primary btn-xl" id="btn-next-math" disabled>选好了，下一关</button>
      `;
      const speakQ = () => speak(`算一算。${payload.text}`);
      setTimeout(speakQ, 400);
      const mc = el("math-choices");
      options.forEach((num) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-choice";
        b.textContent = String(num);
        b.addEventListener("click", () => {
          speak(String(num));
          mc.querySelectorAll(".btn-choice").forEach((x) => x.classList.remove("selected"));
          b.classList.add("selected");
          el("btn-next-math").disabled = false;
        });
        mc.appendChild(b);
      });
      el("math-replay").addEventListener("click", speakQ);
      el("btn-next-math").addEventListener("click", () => onNext());
      return;
    }

    root.innerHTML = `
      <h3 class="game-title">${meta.icon} ${meta.title}</h3>
      <p class="game-desc">${meta.desc}</p>
      <p class="math-q">${payload.text}</p>
      <div class="math-input-row">
        <label for="math-ans">您的答案</label>
        <input type="number" inputmode="numeric" id="math-ans" placeholder="填个数" />
      </div>
      <button type="button" class="btn btn-primary btn-xl" id="btn-next-math">填好了，下一关</button>
    `;
    el("math-ans").addEventListener("keydown", (e) => {
      if (e.key === "Enter") el("btn-next-math").click();
    });
    el("btn-next-math").addEventListener("click", () => onNext());
    setTimeout(() => el("math-ans").focus(), 100);
  }

  function mountQuiz(payload, onNext) {
    const root = el("game-root");
    const meta = GAME_LABELS.quiz;
    const assisted = getAccessMode() === "assisted";
    root.innerHTML = `
      <h3 class="game-title">${meta.icon} ${meta.title}</h3>
      <p class="game-desc">${assisted ? "听问题，再点下面答案。" : meta.desc}</p>
      <div class="quiz-img" aria-hidden="true">${payload.emoji}</div>
      <p class="quiz-q">${payload.q}</p>
      <div id="quiz-choices"></div>
      <button type="button" class="btn btn-primary" id="quiz-replay">再听一遍题目</button>
      <button type="button" class="btn btn-primary btn-xl" id="btn-next-quiz" disabled>选好了，下一关</button>
    `;
    const readQ = () => {
      speak(`猜一猜。${payload.q}`);
    };
    if (assisted) {
      setTimeout(readQ, 400);
    }
    const cr = el("quiz-choices");
    payload.choices.forEach((text, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-choice";
      b.textContent = assisted ? `${idx + 1}：${text}` : text;
      b.addEventListener("click", () => {
        if (assisted) speak(`${text}`);
        cr.querySelectorAll(".btn-choice").forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        el("btn-next-quiz").disabled = false;
      });
      cr.appendChild(b);
    });
    el("quiz-replay").addEventListener("click", readQ);
    el("btn-next-quiz").addEventListener("click", () => onNext());
  }

  function runStep() {
    renderProgress();
    const g = currentGames[stepIndex];
    const onNext = () => {
      stepIndex += 1;
      if (stepIndex >= 3) finishFlow();
      else runStep();
    };
    if (g.kind === "remember") mountRemember(g, onNext);
    else if (g.kind === "listen") mountListen(g, onNext);
    else if (g.kind === "math") mountMath(g, onNext);
    else mountQuiz(g, onNext);
  }

  function startPlay() {
    cancelSpeech();
    const types = pickDailyGames();
    daySeed = dateSeed();
    currentGames = types.map((t, i) => buildGamePayload(t, daySeed, i));
    stepIndex = 0;
    showScreen("screen-play");
    runStep();
  }

  function finishFlow() {
    const streak = saveStreakAfterComplete();
    markDoneToday();
    el("streak-done-num").textContent = String(streak);
    showScreen("screen-done");
    el("share-fallback").hidden = true;
    speakIfAssisted(`太棒了，今天三关都完成啦。已连续打卡 ${streak} 天。`);
  }

  function shareText() {
    const n = el("streak-done-num").textContent;
    return `爸今天又打卡了！每日早起脑力操已连续 ${n} 天～`;
  }

  async function doShare() {
    const text = shareText();
    const fb = el("share-fallback");
    if (navigator.share) {
      try {
        await navigator.share({ title: "每日早起脑力操", text });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      fb.textContent = "已复制分享文案，可以粘贴发给家人：" + text;
      fb.hidden = false;
    } catch {
      fb.textContent = text;
      fb.hidden = false;
    }
  }

  function setupReminder() {
    const toggle = el("reminder-toggle");
    const status = el("reminder-status");
    toggle.checked = localStorage.getItem(STORAGE_REMINDER) === "1";

    function setStatus(msg) {
      status.textContent = msg;
    }

    async function tryNotifyPermission() {
      if (!("Notification" in window)) {
        setStatus("当前浏览器不支持系统提醒，可把本页加到手机主屏幕常来。");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setStatus("已允许通知。若浏览器支持，早上会尽量提醒您（需保持或安装为应用时更稳定）。");
        scheduleRoughReminder();
      } else {
        setStatus("未开启通知也没关系，养成习惯每天打开即可。");
      }
    }

    function scheduleRoughReminder() {
      try {
        const now = new Date();
        const next = new Date(now);
        next.setHours(7, 30, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        const ms = next - now;
        setTimeout(() => {
          if (localStorage.getItem(STORAGE_REMINDER) !== "1") return;
          if (Notification.permission === "granted") {
            new Notification("每日早起脑力操", {
              body: "早上好，来动动脑吧～点开链接完成今日三关。",
              tag: "brain-morning-daily",
            });
          }
        }, ms);
      } catch (_) {}
    }

    toggle.addEventListener("change", () => {
      if (toggle.checked) {
        localStorage.setItem(STORAGE_REMINDER, "1");
        tryNotifyPermission();
      } else {
        localStorage.setItem(STORAGE_REMINDER, "0");
        setStatus("");
      }
    });

    if (toggle.checked && "Notification" in window && Notification.permission === "granted") {
      scheduleRoughReminder();
      setStatus("提醒已开启（本页若一直打开，会在约 7:30 尝试提醒一次）。");
    }
  }

  el("btn-start").addEventListener("click", startPlay);
  el("btn-home").addEventListener("click", () => {
    cancelSpeech();
    updateHomeStreak();
    showScreen("screen-home");
  });
  el("btn-share").addEventListener("click", doShare);

  el("mode-standard").addEventListener("click", () => setAccessMode("standard"));
  el("mode-assisted").addEventListener("click", () => setAccessMode("assisted"));

  document.body.classList.toggle("assisted-mode", getAccessMode() === "assisted");
  syncModeButtons();

  updateHomeStreak();
  setupReminder();
})();
