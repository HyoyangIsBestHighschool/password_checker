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
 *    const firebaseConfig = { apiKey: "...", ... };
 *    firebase.initializeApp(firebaseConfig);
 *
 * 5. index.html의 Firebase 스크립트 주석 해제
 * ────────────────────────────────────────────────────────────────
 */

const STATS_KEY = 'pw-checker-stats';
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

// ── 읽기 ─────────────────────────────────────────────────────────
async function statsLoad() {
  if (hasFirestore()) {
    try {
      const doc = await firebase.firestore().doc(FIRESTORE_DOC).get();
      if (doc.exists) {
        const data = doc.data();
        // criteria가 없거나 불완전할 경우 기본값으로 보완
        const empty = emptyStats();
        return {
          ...empty,
          ...data,
          criteria: { ...empty.criteria, ...(data.criteria || {}) },
          dist: data.dist && data.dist.length === 5 ? data.dist : empty.dist,
        };
      }
      return emptyStats();
    } catch (e) {
      console.warn('Firestore 읽기 실패, localStorage 사용:', e);
    }
  }
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return emptyStats();
    const data = JSON.parse(raw);
    const empty = emptyStats();
    return {
      ...empty,
      ...data,
      criteria: { ...empty.criteria, ...(data.criteria || {}) },
      dist: data.dist && data.dist.length === 5 ? data.dist : empty.dist,
    };
  } catch (e) {
    return emptyStats();
  }
}

// ── 쓰기 (전체 문서를 한 번에 저장 — race condition 방지) ─────────
async function statsSave(s) {
  s.lastUpdated = new Date().toISOString();
  if (hasFirestore()) {
    try {
      // set(doc, {merge:false}) 로 전체를 한 번에 덮어써서
      // 동시 write로 인한 필드 유실 방지
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

// ── 통계 업데이트 (읽기 → 수정 → 쓰기를 한 번에) ─────────────────
// 호출 인터페이스:
//   fields        : { totalChecks:1, criteriaCnt:1, 'criteria.len8':1, ... }
//   distIndex     : 0~4 (점수 분포 인덱스, 없으면 null)
//   improveDelta  : 숫자 (개선 저장 시, 없으면 null)
async function statsUpdate({ fields = {}, distIndex = null, improveDelta = null } = {}) {
  const s = await statsLoad();

  // 일반 필드 증가
  for (const [k, v] of Object.entries(fields)) {
    const parts = k.split('.');
    if (parts.length === 2) {
      if (!s[parts[0]]) s[parts[0]] = {};
      s[parts[0]][parts[1]] = (s[parts[0]][parts[1]] || 0) + v;
    } else {
      s[k] = (s[k] || 0) + v;
    }
  }

  // 점수 분포
  if (distIndex !== null) {
    if (!s.dist || s.dist.length !== 5) s.dist = [0,0,0,0,0];
    s.dist[distIndex] = (s.dist[distIndex] || 0) + 1;
  }

  // 개선 저장
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
