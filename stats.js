/**
 * stats.js — 통계 저장소
 *
 * Firebase가 연결되어 있으면 Firestore를 사용하고,
 * 없으면 localStorage에 저장합니다.
 *
 * ── Firebase 연동 방법 ──────────────────────────────────────────
 * 1. https://console.firebase.google.com 에서 프로젝트 생성
 * 2. Firestore Database 활성화 (테스트 모드로 시작)
 * 3. 프로젝트 설정 > 웹 앱 추가 > SDK 설정 복사
 * 4. firebase-config.js 파일을 아래 내용으로 작성:
 *
 *    const firebaseConfig = {
 *      apiKey: "...",
 *      authDomain: "...",
 *      projectId: "...",
 *      ...
 *    };
 *    firebase.initializeApp(firebaseConfig);
 *
 * 5. index.html의 Firebase 스크립트 주석 해제
 * ────────────────────────────────────────────────────────────────
 */

const STATS_KEY = 'pw-checker-stats';
const FIRESTORE_DOC = 'stats/global'; // Firestore 문서 경로

// Firestore 사용 가능 여부
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

// ── 읽기 ─────────────────────────────────────────────────────────
async function statsLoad() {
  if (hasFirestore()) {
    try {
      const doc = await firebase.firestore().doc(FIRESTORE_DOC).get();
      return doc.exists ? { ...emptyStats(), ...doc.data() } : emptyStats();
    } catch (e) {
      console.warn('Firestore 읽기 실패, localStorage 사용:', e);
    }
  }
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...emptyStats(), ...JSON.parse(raw) } : emptyStats();
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

// ── 원자적 업데이트 (Firestore increment 활용) ───────────────────
async function statsIncrement(fields) {
  if (hasFirestore()) {
    try {
      const inc = firebase.firestore.FieldValue.increment;
      const ref = firebase.firestore().doc(FIRESTORE_DOC);
      const update = {};
      for (const [k, v] of Object.entries(fields)) update[k] = inc(v);
      update.lastUpdated = new Date().toISOString();
      await ref.set(update, { merge: true });
      return;
    } catch (e) {
      console.warn('Firestore increment 실패:', e);
    }
  }
  // localStorage 폴백
  const s = await statsLoad();
  for (const [k, v] of Object.entries(fields)) {
    const parts = k.split('.');
    if (parts.length === 2) {
      if (!s[parts[0]]) s[parts[0]] = {};
      s[parts[0]][parts[1]] = (s[parts[0]][parts[1]] || 0) + v;
    } else {
      s[k] = (s[k] || 0) + v;
    }
  }
  await statsSave(s);
}

// ── 배열 업데이트 (dist는 Firestore에서 별도 처리) ───────────────
async function statsIncrementDist(index) {
  if (hasFirestore()) {
    try {
      const ref = firebase.firestore().doc(FIRESTORE_DOC);
      const doc = await ref.get();
      const dist = doc.exists && doc.data().dist ? [...doc.data().dist] : [0,0,0,0,0];
      dist[index] = (dist[index] || 0) + 1;
      await ref.set({ dist, lastUpdated: new Date().toISOString() }, { merge: true });
      return;
    } catch (e) {
      console.warn('Firestore dist 실패:', e);
    }
  }
  const s = await statsLoad();
  if (!s.dist) s.dist = [0,0,0,0,0];
  s.dist[index]++;
  await statsSave(s);
}

// ── 초기화 ───────────────────────────────────────────────────────
async function statsReset() {
  const empty = emptyStats();
  if (hasFirestore()) {
    try {
      await firebase.firestore().doc(FIRESTORE_DOC).set(empty);
    } catch (e) {}
  }
  try { localStorage.removeItem(STATS_KEY); } catch (e) {}
}

// ── DB 상태 표시 ─────────────────────────────────────────────────
function updateDbBadge() {
  const dot = document.getElementById('dbDot');
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
