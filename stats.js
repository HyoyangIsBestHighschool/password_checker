/**
 * stats.js — 통계 저장소
 *
 * Firebase Firestore 연결 시 Firestore, 없으면 localStorage 사용.
 */

const STATS_KEY    = 'pw-checker-stats';
const FIRESTORE_DOC = 'stats/global';

function hasFirestore() {
  return typeof firebase !== 'undefined' && firebase.firestore;
}

function emptyStats() {
  return {
    sessions: 0,
    totalChecks: 0,
    improvements: 0,
    totalDelta: 0,
    dist: [0, 0, 0, 0, 0],
    criteria: { len8:0, len15:0, upper:0, lower:0, digit:0, special:0, common:0, seq:0 },
    criteriaCnt: 0,
    lastUpdated: null,
  };
}

/**
 * Firestore/localStorage 양쪽 모두에서 발생할 수 있는
 * "criteria.len8" 식의 flat key 잔재를 criteria 객체로 복원.
 * 이전 버전 코드가 dot-notation 키를 최상위에 저장했을 경우 대응.
 */
function normalizeData(data) {
  const empty = emptyStats();
  const result = {
    ...empty,
    ...data,
    criteria: { ...empty.criteria, ...(data.criteria || {}) },
    dist: (data.dist && data.dist.length === 5) ? [...data.dist] : [...empty.dist],
  };

  // flat key 잔재 흡수: "criteria.len8" → result.criteria.len8
  const CRIT_KEYS = ['len8','len15','upper','lower','digit','special','common','seq'];
  for (const k of CRIT_KEYS) {
    const flat = `criteria.${k}`;
    if (data[flat] !== undefined) {
      result.criteria[k] = (result.criteria[k] || 0) + Number(data[flat]);
      delete result[flat]; // 저장 시 재오염 방지
    }
  }
  return result;
}

// ── 읽기 ─────────────────────────────────────────────────────────
async function statsLoad() {
  if (hasFirestore()) {
    try {
      const snap = await firebase.firestore().doc(FIRESTORE_DOC).get();
      return normalizeData(snap.exists ? snap.data() : {});
    } catch (e) {
      console.warn('Firestore 읽기 실패, localStorage 폴백:', e);
      // 의도적으로 localStorage로 fall-through
    }
  }
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return normalizeData(raw ? JSON.parse(raw) : {});
  } catch (e) {
    return emptyStats();
  }
}

// ── 쓰기 ─────────────────────────────────────────────────────────
async function statsSave(s) {
  s.lastUpdated = new Date().toISOString();
  if (hasFirestore()) {
    try {
      await firebase.firestore().doc(FIRESTORE_DOC).set(s);
      return;
    } catch (e) {
      console.warn('Firestore 쓰기 실패, localStorage 폴백:', e);
    }
  }
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch (e) {}
}

// ── 통합 업데이트 (읽기 → 수정 → 쓰기 한 번에) ───────────────────
// fields       : { totalChecks:1, criteriaCnt:1, 'criteria.len8':1, ... }
// distIndex    : 0~4 | null
// improveDelta : number | null
async function statsUpdate({ fields = {}, distIndex = null, improveDelta = null } = {}) {
  const s = await statsLoad();

  for (const [k, v] of Object.entries(fields)) {
    const parts = k.split('.');
    if (parts.length === 2) {
      if (!s[parts[0]] || typeof s[parts[0]] !== 'object') s[parts[0]] = {};
      s[parts[0]][parts[1]] = (s[parts[0]][parts[1]] || 0) + v;
    } else {
      s[k] = (s[k] || 0) + v;
    }
  }

  if (distIndex !== null) {
    if (!Array.isArray(s.dist) || s.dist.length !== 5) s.dist = [0,0,0,0,0];
    s.dist[distIndex] = (s.dist[distIndex] || 0) + 1;
  }

  if (improveDelta !== null) {
    s.improvements = (s.improvements || 0) + 1;
    s.totalDelta   = (s.totalDelta   || 0) + improveDelta;
  }

  await statsSave(s);
}

// ── 초기화 ───────────────────────────────────────────────────────
async function statsReset() {
  const empty = emptyStats();
  if (hasFirestore()) {
    try { await firebase.firestore().doc(FIRESTORE_DOC).set(empty); } catch (e) {}
  }
  try { localStorage.removeItem(STATS_KEY); } catch (e) {}
}

// ── DB 상태 표시 ─────────────────────────────────────────────────
function updateDbBadge() {
  const dot   = document.getElementById('dbDot');
  const label = document.getElementById('dbLabel');
  if (!dot || !label) return;
  if (hasFirestore()) {
    dot.style.background = '#1D9E75';
    label.textContent = 'Firebase Firestore 연결됨';
  } else {
    dot.style.background = '#EF9F27';
    label.textContent = '로컬 저장소 사용 중 (Firebase 미연결)';
  }
}
