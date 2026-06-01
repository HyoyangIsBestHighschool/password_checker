// app.js — 비밀번호 검사기 메인 로직

const COMMON = ['password','123456','qwerty','abc123','111111','iloveyou','admin','welcome',
  'monkey','dragon','master','pass','login','12345678','password1','qwerty123',
  'letmein','sunshine','princess','football'];

const SEQ_NUM = '0123456789';
const SEQ_ABC = 'abcdefghijklmnopqrstuvwxyz';
const SEQ_KBD = ['qwertyuiop','asdfghjkl','zxcvbnm','qweasdzxc','1qaz2wsx'];

function hasSeq(pw, len = 4) {
  const p = pw.toLowerCase();
  for (let i = 0; i <= p.length - len; i++) {
    const s = p.slice(i, i + len);
    const rev = s.split('').reverse().join('');
    if (SEQ_NUM.includes(s) || SEQ_ABC.includes(s) ||
        SEQ_NUM.includes(rev) || SEQ_ABC.includes(rev)) return true;
    for (const k of SEQ_KBD) if (k.includes(s)) return true;
  }
  return false;
}

function analyze(pw) {
  const r = {
    len: pw.length,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasDigit: /[0-9]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
    isCommon: COMMON.includes(pw.toLowerCase()),
    hasSeq: hasSeq(pw),
  };
  r.charTypes = (r.hasUpper?1:0)+(r.hasLower?1:0)+(r.hasDigit?1:0)+(r.hasSpecial?1:0);
  let s = 0;
  if (r.len >= 8)  s += 15;
  if (r.len >= 12) s += 15;
  if (r.len >= 15) s += 10;
  if (r.len >= 20) s += 10;
  if (r.hasLower)  s += 5;
  if (r.hasUpper)  s += 10;
  if (r.hasDigit)  s += 10;
  if (r.hasSpecial)s += 15;
  if (r.charTypes >= 3) s += 5;
  if (r.charTypes >= 4) s += 5;
  if (r.isCommon) s = Math.min(s, 15);
  if (r.hasSeq)   s = Math.max(0, s - 20);
  r.score = Math.min(100, s);
  return r;
}

function levelInfo(score) {
  if (score < 25) return { label:'매우 취약', color:'#E24B4A', text:'#A32D2D' };
  if (score < 50) return { label:'취약',     color:'#EF9F27', text:'#633806' };
  if (score < 75) return { label:'보통',     color:'#378ADD', text:'#0C447C' };
  if (score < 90) return { label:'강함',     color:'#1D9E75', text:'#085041' };
  return               { label:'매우 강함', color:'#3B6D11', text:'#3B6D11' };
}

const CHECKS = [
  { id:'len8',    label:'최소 8자 이상',       sub:'NIST 최소',       pass: r => r.len >= 8,      tip:'비밀번호를 8자 이상으로 늘리세요.',                                            isWarn: false },
  { id:'len15',   label:'15자 이상',           sub:'NIST 권장',       pass: r => r.len >= 15,     tip:'15자 이상으로 늘리면 안전성이 크게 향상됩니다.',                              isWarn: false },
  { id:'upper',   label:'대문자 포함',         sub:'A–Z',             pass: r => r.hasUpper,      tip:'대문자(A–Z)를 하나 이상 추가하세요.',                                         isWarn: false },
  { id:'lower',   label:'소문자 포함',         sub:'a–z',             pass: r => r.hasLower,      tip:'소문자(a–z)를 하나 이상 추가하세요.',                                         isWarn: false },
  { id:'digit',   label:'숫자 포함',           sub:'0–9',             pass: r => r.hasDigit,      tip:'숫자(0–9)를 하나 이상 추가하세요.',                                           isWarn: false },
  { id:'special', label:'특수문자 포함',       sub:'!@#$ 등',         pass: r => r.hasSpecial,    tip:'!, @, #, $ 등 특수문자를 추가하세요.',                                        isWarn: false },
  { id:'common',  label:'흔한 비밀번호 아님',  sub:'OWASP 블랙리스트',pass: r => !r.isCommon,     tip:'이 비밀번호는 가장 많이 유출된 목록에 있습니다. 완전히 다른 비밀번호를 쓰세요.', isWarn: true  },
  { id:'seq',     label:'연속 문자열 없음',    sub:'1234, qwerty 등', pass: r => !r.hasSeq,       tip:'1234, abcd, qwerty 같은 연속 패턴을 제거하세요.',                             isWarn: true  },
];

const DIST_LABELS = ['매우 취약 (0–24)','취약 (25–49)','보통 (50–74)','강함 (75–89)','매우 강함 (90+)'];
const DIST_COLORS = ['#E24B4A','#EF9F27','#378ADD','#1D9E75','#3B6D11'];
const CRIT_COLORS = { len8:'#1D9E75',len15:'#1D9E75',upper:'#378ADD',lower:'#378ADD',digit:'#EF9F27',special:'#534AB7',common:'#E24B4A',seq:'#E24B4A' };

let sessionHistory = [];
let firstResult = null;
let sessionRecorded = false;
let revDebounce = null;

// ── 탭 전환 ──────────────────────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', ['checker','stats'][i] === id));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  if (id === 'stats') { updateDbBadge(); renderStats(); }
}

// ── STEP 1: 분석 ─────────────────────────────────────────────────
async function doAnalyze() {
  const pw = document.getElementById('pwFirst').value;
  if (!pw) return;

  firstResult = analyze(pw);

  // 통계 저장 — 읽기/쓰기를 한 번에 처리해 race condition 방지
  const di = firstResult.score < 25 ? 0 : firstResult.score < 50 ? 1 :
             firstResult.score < 75 ? 2 : firstResult.score < 90 ? 3 : 4;
  const sessionFields = !sessionRecorded ? { sessions: 1 } : {};
  if (!sessionRecorded) sessionRecorded = true;
  const fields = { ...sessionFields, totalChecks: 1, criteriaCnt: 1 };
  if (firstResult.len >= 8)   fields['criteria.len8']    = 1;
  if (firstResult.len >= 15)  fields['criteria.len15']   = 1;
  if (firstResult.hasUpper)   fields['criteria.upper']   = 1;
  if (firstResult.hasLower)   fields['criteria.lower']   = 1;
  if (firstResult.hasDigit)   fields['criteria.digit']   = 1;
  if (firstResult.hasSpecial) fields['criteria.special'] = 1;
  if (!firstResult.isCommon)  fields['criteria.common']  = 1;
  if (!firstResult.hasSeq)    fields['criteria.seq']     = 1;
  await statsUpdate({ fields, distIndex: di });

  document.getElementById('step-input').style.display = 'none';
  document.getElementById('step-result').style.display = 'block';
  renderResult(firstResult);
}

// ── 결과 렌더 ────────────────────────────────────────────────────
function renderResult(r) {
  const lv = levelInfo(r.score);
  document.getElementById('meterFill').style.cssText =
    `width:${r.score}%;background:${lv.color}`;
  document.getElementById('scoreLabel').textContent = '점수: ' + r.score + '/100';
  const badge = document.getElementById('scoreBadge');
  badge.style.cssText = `display:inline-block;background:${lv.color}22;border:1px solid ${lv.color};color:${lv.text}`;
  badge.textContent = lv.label;

  let html = '', tips = [];
  for (const c of CHECKS) {
    const ok = c.pass(r);
    const cls = ok ? 'pass' : c.isWarn ? 'warn' : 'fail';
    const icon = ok ? 'ti-circle-check' : c.isWarn ? 'ti-alert-triangle' : 'ti-circle-x';
    html += `<div class="check-item ${cls}">
      <i class="ti ${icon} check-icon"></i>
      <div><div>${c.label}</div><div class="check-sub">${c.sub}</div></div>
    </div>`;
    if (!ok) tips.push(c.tip);
  }
  document.getElementById('checkGrid').innerHTML = html;

  const allPassed = tips.length === 0;
  document.getElementById('perfectBox').style.display  = allPassed ? 'block' : 'none';
  document.getElementById('improveBox').style.display  = allPassed ? 'none'  : 'block';
  document.getElementById('revisionArea').style.display = allPassed ? 'none' : 'block';

  if (!allPassed) {
    document.getElementById('improveList').innerHTML =
      tips.map(t => `<div class="improve-item"><i class="ti ti-arrow-right"></i><span>${t}</span></div>`).join('');
    document.getElementById('pwRevised').value = '';
    document.getElementById('revisionScoreRow').innerHTML = '';
    document.getElementById('btnSave').disabled = true;
  }
}

// ── STEP 3: 저장 ─────────────────────────────────────────────────
async function doSave() {
  const pw = document.getElementById('pwRevised').value;
  if (!pw || !firstResult) return;

  const r = analyze(pw);
  const delta = r.score - firstResult.score;
  const lv = levelInfo(r.score);

  await statsUpdate({ improveDelta: delta });

  const roundNum = sessionHistory.length + 1;
  const passedCount = CHECKS.filter(c => c.pass(r)).length;
  const failedCount = CHECKS.length - passedCount;
  sessionHistory.unshift({ round: roundNum, score: r.score, delta, lv, passed: passedCount, failed: failedCount });
  if (sessionHistory.length > 10) sessionHistory.pop();
  renderHistory();

  // 결과를 수정된 비밀번호 기준으로 갱신
  firstResult = r;
  renderResult(r);

  // 토스트
  if (delta !== 0) {
    const msg = delta > 0 ? `점수가 ${delta}점 향상되었습니다!` : `점수가 ${Math.abs(delta)}점 하락했습니다.`;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="ti ti-${delta > 0 ? 'circle-check' : 'alert-triangle'}"></i> 저장 완료! ${msg}`;
    document.getElementById('revisionArea').prepend(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

// ── 리셋 ─────────────────────────────────────────────────────────
function doReset() {
  firstResult = null;
  document.getElementById('pwFirst').value = '';
  document.getElementById('btnAnalyze').disabled = true;
  document.getElementById('step-input').style.display = 'block';
  document.getElementById('step-result').style.display = 'none';
}

// ── 히스토리 렌더 ────────────────────────────────────────────────
function renderHistory() {
  if (sessionHistory.length === 0) {
    document.getElementById('historyList').innerHTML =
      '<div class="empty-state">아직 저장된 기록이 없습니다</div>';
    return;
  }
  document.getElementById('historyList').innerHTML =
    '<div class="history">' +
    sessionHistory.map(h => {
      const ds = h.delta > 0
        ? `<span style="color:#1D9E75">+${h.delta}점</span>`
        : h.delta < 0
        ? `<span style="color:#E24B4A">${h.delta}점</span>`
        : `<span style="color:#8a8a80">±0</span>`;
      return `<div class="h-item">
        <div class="h-top">
          <span class="h-round">${h.round}회차</span>
          <div class="h-bar"><div class="h-bar-fill" style="width:${h.score}%;background:${h.lv.color}"></div></div>
          <span class="h-score" style="color:${h.lv.color}">${h.score}점</span>
          <span class="h-delta">${ds}</span>
        </div>
        <div class="h-bottom">
          <span>✅ 충족 ${h.passed}개</span>
          <span>❌ 미충족 ${h.failed}개</span>
          <span>${h.lv.label}</span>
        </div>
      </div>`;
    }).join('') + '</div>';
}

// ── 통계 렌더 ────────────────────────────────────────────────────
async function renderStats() {
  const s = await statsLoad();
  document.getElementById('s-sessions').textContent    = s.sessions || 0;
  document.getElementById('s-checks').textContent      = s.totalChecks || 0;
  document.getElementById('s-improvements').textContent = s.improvements || 0;
  const avg = s.improvements > 0 ? Math.round(s.totalDelta / s.improvements) : 0;
  document.getElementById('s-avgDelta').textContent    = (avg > 0 ? '+' : '') + avg;
  document.getElementById('lastUpdate').textContent    =
    s.lastUpdated ? '업데이트: ' + new Date(s.lastUpdated).toLocaleString('ko-KR') : '데이터 없음';

  const dist = s.dist || [0,0,0,0,0];
  const dTotal = dist.reduce((a, b) => a + b, 0) || 1;
  document.getElementById('distChart').innerHTML = dist.map((v, i) =>
    `<div class="dist-row">
      <span class="dist-label">${DIST_LABELS[i]}</span>
      <div class="dist-track"><div class="dist-fill" style="width:${Math.round(v/dTotal*100)}%;background:${DIST_COLORS[i]}"></div></div>
      <span class="dist-cnt">${v}</span>
    </div>`).join('');

  const cr = s.criteria || {};
  const cn = s.criteriaCnt || 1;
  const lbls = { len8:'최소 8자 이상', len15:'15자 이상', upper:'대문자 포함', lower:'소문자 포함',
                 digit:'숫자 포함', special:'특수문자 포함', common:'흔한 비밀번호 아님', seq:'연속 문자열 없음' };
  document.getElementById('criteriaChart').innerHTML = Object.entries(lbls).map(([k, label]) => {
    const pct = s.criteriaCnt > 0 ? Math.round((cr[k] || 0) / cn * 100) : 0;
    return `<div class="bar-row">
      <span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${CRIT_COLORS[k]}"></div></div>
      <span class="bar-pct">${pct}%</span>
    </div>`;
  }).join('');
}

async function resetStats() {
  if (!confirm('통계를 초기화할까요?')) return;
  await statsReset();
  renderStats();
}

// ── 이벤트 바인딩 ────────────────────────────────────────────────
document.getElementById('pwFirst').addEventListener('input', function () {
  document.getElementById('btnAnalyze').disabled = this.value.length === 0;
});
document.getElementById('pwFirst').addEventListener('keydown', e => {
  if (e.key === 'Enter') doAnalyze();
});
document.getElementById('pwRevised').addEventListener('input', function () {
  clearTimeout(revDebounce);
  const val = this.value;
  revDebounce = setTimeout(() => {
    if (!val) {
      document.getElementById('revisionScoreRow').innerHTML = '';
      document.getElementById('btnSave').disabled = true;
      return;
    }
    const r = analyze(val), lv = levelInfo(r.score);
    const delta = r.score - firstResult.score;
    const ds = delta > 0
      ? `<span style="color:#1D9E75;font-weight:600">+${delta}점 향상</span>`
      : delta < 0
      ? `<span style="color:#E24B4A;font-weight:600">${delta}점 하락</span>`
      : `<span style="color:#8a8a80">변화 없음</span>`;
    document.getElementById('revisionScoreRow').innerHTML =
      `<span style="color:${lv.color};font-weight:600">${r.score}점</span>
       <span style="color:#8a8a80">(${lv.label})</span>&nbsp;${ds}`;
    document.getElementById('btnSave').disabled = false;
  }, 150);
});
