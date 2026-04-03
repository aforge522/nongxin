/**
 * 用当天日期做种子，保证同一天刷新关卡组合一致。
 */
function dateSeed() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y * 10000 + m * 100 + day;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed) {
  return mulberry32(seed >>> 0);
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDailyGames() {
  const types = ["remember", "listen", "math", "quiz"];
  const seed = dateSeed();
  const rng = createRng(seed);
  const shuffled = shuffle(types, rng);
  return shuffled.slice(0, 3);
}
