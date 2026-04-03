/**
 * 关卡内容与生成逻辑（不计分，只引导完成）
 */

const WORD_POOL = [
  "阳光", "米饭", "公园", "老友", "报纸", "茶杯", "散步", "象棋",
  "银杏", "桂花", "春联", "灯笼", "蒲扇", "收音机", "缝纫机", "自行车",
  "豆腐", "青菜", "苹果", "红枣", "核桃", "芝麻", "蜂蜜", "面条",
  "雨伞", "围巾", "棉袄", "布鞋", "草帽", "竹篮", "木桌", "窗花",
];

const MELODY_PATTERNS = [
  { id: 0, name: "旋律甲", freqs: [523.25, 659.25, 783.99, 659.25, 523.25] },
  { id: 1, name: "旋律乙", freqs: [392, 493.88, 587.33, 493.88, 392] },
  { id: 2, name: "旋律丙", freqs: [440, 554.37, 659.25, 554.37, 440] },
  { id: 3, name: "旋律丁", freqs: [349.23, 440, 523.25, 440, 349.23] },
];

const QUIZ_ITEMS = [
  { type: "solar", q: "立春一般在公历哪两个月之间？", emoji: "🌱", choices: ["1–2 月", "2–3 月", "4–5 月", "6–7 月"], answer: 1 },
  { type: "solar", q: "冬至这天，北半球白天通常？", emoji: "❄️", choices: ["最长", "最短", "一样长", "不一定"], answer: 1 },
  { type: "proverb", q: "「瑞雪兆丰年」主要指？", emoji: "🌾", choices: ["雪很干净", "雪对来年庄稼好", "冬天很冷", "适合拍照"], answer: 1 },
  { type: "proverb", q: "「饭后百步走」下一句常说是？", emoji: "🚶", choices: ["活到九十九", "活到一百二", "胃会不舒服", "要慢慢走"], answer: 0 },
  { type: "object", q: "下面哪个更像老一辈家里常见的「粮票」？", emoji: "🎫", choices: ["塑料玩具卡", "印着斤两的纸质凭证", "银行卡", "公交卡"], answer: 1 },
  { type: "object", q: "「搪瓷杯」最突出的特点是？", emoji: "☕", choices: ["全是塑料", "金属外包一层瓷釉", "只能装冷水", "没有把手"], answer: 1 },
  { type: "solar", q: "农历八月十五附近，常过什么节？", emoji: "🌕", choices: ["端午", "中秋", "清明", "腊八"], answer: 1 },
  { type: "proverb", q: "「一年之计在于春」强调什么？", emoji: "🌸", choices: ["春天最贵", "早做打算、开好头", "只能春天干活", "春天多睡觉"], answer: 1 },
];

function getRngForGame(daySeed, gameIndex, salt) {
  return createRng((daySeed * 31 + gameIndex * 17 + salt) >>> 0);
}

function buildRememberGame(daySeed, gameIndex) {
  const rng = getRngForGame(daySeed, gameIndex, 1);
  const words = shuffle(WORD_POOL, rng).slice(0, 3);
  return { kind: "remember", words };
}

/** 辅助模式：回忆阶段分三题，每题四选一（一词 + 三干扰） */
function buildRememberRecallSteps(words, rng) {
  const pool = WORD_POOL.filter((w) => !words.includes(w));
  const steps = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const distractors = shuffle(pool, rng).slice(0, 3);
    const options = shuffle([w, ...distractors], rng);
    steps.push({ stepNum: i + 1, correct: w, options });
  }
  return steps;
}

/** 辅助模式：算一算四选一数字 */
function buildMathChoiceOptions(answer, rng) {
  const opts = new Set([answer]);
  let guard = 0;
  while (opts.size < 4 && guard < 80) {
    guard++;
    const spread = Math.max(4, Math.min(30, Math.floor(Math.abs(answer) * 0.2) + 5));
    const d = Math.floor(rng() * (spread * 2 + 1)) - spread;
    const v = answer + d;
    if (v >= 0) opts.add(v);
  }
  while (opts.size < 4) opts.add([...opts][0] + opts.size);
  return shuffle([...opts], rng);
}

function buildListenGame(daySeed, gameIndex) {
  const rng = getRngForGame(daySeed, gameIndex, 2);
  const order = shuffle([0, 1, 2, 3], rng);
  const correct = order[0];
  return { kind: "listen", correctId: correct, order };
}

function buildMathGame(daySeed, gameIndex) {
  const rng = getRngForGame(daySeed, gameIndex, 3);
  const scenarios = [
    () => {
      const a = 3 + Math.floor(rng() * 8);
      const b = 2 + Math.floor(rng() * 9);
      const p = a * 2 + b * 3;
      return { text: `白菜 ${a} 元一斤，买了 2 斤；萝卜 ${b} 元一斤，买了 3 斤。一共多少元？`, answer: p };
    },
    () => {
      const total = 20 + Math.floor(rng() * 30);
      const spent = 5 + Math.floor(rng() * (total - 8));
      const change = total - spent;
      return { text: `付给摊主 ${total} 元，买菜花了 ${spent} 元，找零多少元？`, answer: change };
    },
    () => {
      const eggs = 8 + Math.floor(rng() * 5);
      const price = 6 + Math.floor(rng() * 4);
      return { text: `鸡蛋一板 ${price} 元，买了 ${eggs} 板。一共多少元？`, answer: eggs * price };
    },
    () => {
      const a = 12 + Math.floor(rng() * 15);
      const b = 8 + Math.floor(rng() * 12);
      return { text: `上午散步 ${a} 分钟，下午散步 ${b} 分钟。合计多少分钟？`, answer: a + b };
    },
  ];
  const pick = scenarios[Math.floor(rng() * scenarios.length)];
  return { kind: "math", ...pick() };
}

function buildQuizGame(daySeed, gameIndex) {
  const rng = getRngForGame(daySeed, gameIndex, 4);
  const item = QUIZ_ITEMS[Math.floor(rng() * QUIZ_ITEMS.length)];
  return { kind: "quiz", ...item };
}

function buildGamePayload(type, daySeed, indexInDay) {
  switch (type) {
    case "remember":
      return buildRememberGame(daySeed, indexInDay);
    case "listen":
      return buildListenGame(daySeed, indexInDay);
    case "math":
      return buildMathGame(daySeed, indexInDay);
    case "quiz":
      return buildQuizGame(daySeed, indexInDay);
    default:
      return buildMathGame(daySeed, indexInDay);
  }
}

/** Web Audio：播放约 3 秒旋律（必须先 resume，否则多数浏览器在「用户点击」前不会出声） */
function playMelody(patternId, onEnded) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) {
    onEnded && onEnded();
    return;
  }
  const ctx = new AC();
  const pat = MELODY_PATTERNS[patternId];
  const noteDur = 0.55;
  const gap = 0.08;

  function scheduleNotes() {
    let t = ctx.currentTime + 0.05;
    pat.freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + noteDur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + noteDur + 0.02);
      t += noteDur + gap;
    });
    const totalMs = (t - ctx.currentTime) * 1000 + 200;
    setTimeout(() => {
      ctx.close().catch(() => {});
      onEnded && onEnded();
    }, totalMs);
  }

  ctx
    .resume()
    .then(() => {
      scheduleNotes();
    })
    .catch(() => {
      ctx.close().catch(() => {});
      onEnded && onEnded();
    });
}

const GAME_LABELS = {
  remember: { title: "记一记", icon: "🧠", desc: "看词 10 秒，遮住后试着填一填。" },
  listen: { title: "听一听", icon: "🎵", desc: "听一小段旋律，选出刚才是哪一段。" },
  math: { title: "算一算", icon: "🔢", desc: "日常买菜小题目，随便算算。" },
  quiz: { title: "猜一猜", icon: "🌿", desc: "节气、老话、老物件，点选即可。" },
};
