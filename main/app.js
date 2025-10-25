import { TOKENS_BASE, TOKENS_ALT } from './tokens.js';

const el = {
  video: document.getElementById('video'),
  overlay: document.getElementById('overlay'),
  layerChip: document.getElementById('layerText'),
  fpsChip: document.getElementById('fpsIndicator'),
  statusText: document.getElementById('statusText'),
  statusDot: document.querySelector('.status-dot'),
  outputText: document.getElementById('outputText')
};

function renderLegend(){
  // iOS 키보드가 이미 HTML에 있으므로 이 함수는 더 이상 필요하지 않음
  console.log('키보드 레이아웃은 HTML에서 관리됩니다');
}
renderLegend();

let landmarker=null, running=false, lastT=performance.now();
let fps=0;

const ctx = el.overlay.getContext('2d');

let textBuf=[], stats={tap:0, erase:0, layer:0, space:0};
let layer=false, confirmAccum=0;
let dwellProb=new Array(26).fill(0);
let debugInfo = { lastHit: -1, lastSpeed: 0, lastDwellProb: 0 };
let touchState = { wasTouching: false, readyToEmit: false, lastHit: -1 };
let backspaceState = { wasClosed: false, readyToBackspace: false };
let spaceState = { 
  wasClosed: false, 
  readyToSpace: false, 
  lastSpaceTime: 0,
  spaceExecuted: false  // 한 번의 사이클에서 스페이스바 실행 여부
};

// 합장 상태 관리
let prayerState = {
  isPraying: false,
  prayerStartTime: 0,
  prayerDuration: 3000, // 3초
  prayerProgress: 0,
  prayerTimer: null,
  lastDetectionTime: 0,
  detectionThreshold: 200, // 200ms 동안 지속되어야 합장으로 인식
  lastInterruptionTime: 0,
  interruptionThreshold: 500, // 500ms 동안 감지되지 않으면 중단
  consecutiveDetections: 0, // 연속 감지 횟수
  consecutiveMisses: 0 // 연속 미감지 횟수
};

function setCanvasSize(){
  const r = el.video.getBoundingClientRect();
  el.overlay.width = Math.floor(r.width * devicePixelRatio);
  el.overlay.height = Math.floor(r.height * devicePixelRatio);
  el.overlay.style.width = r.width+'px';
  el.overlay.style.height = r.height+'px';
}
new ResizeObserver(setCanvasSize).observe(document.body);

function renderText(){
  const text = textBuf.join('');
  if(el.outputText) {
    if(text) {
      // 입력된 텍스트가 있으면 표시
      el.outputText.textContent = text;
      el.outputText.style.opacity = '1';
      el.outputText.style.color = 'white';
      // 텍스트가 있을 때 커서 표시
      el.outputText.classList.remove('no-cursor');
      
      // 입력 시 시각적 피드백
      el.outputText.style.color = '#007aff';
      el.outputText.style.transform = 'scale(1.05)';
      setTimeout(() => {
        el.outputText.style.color = 'white';
        el.outputText.style.transform = 'scale(1)';
      }, 200);
    } else {
      // 입력된 텍스트가 없으면 기본 메시지 표시
      el.outputText.textContent = '손을 카메라에 보여주세요';
      el.outputText.style.opacity = '0.7';
      el.outputText.style.color = 'rgba(255, 255, 255, 0.7)';
      // 기본 메시지일 때 커서 숨기기
      el.outputText.classList.add('no-cursor');
    }
  }
  console.log(`📝 텍스트 렌더링: "${text}"`);
}

function drawDebugInfo(leftHand, rightHand){
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(5, 5, 350, 250);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  
  let y = 25;
  ctx.fillText(`손 감지: 왼손 ${leftHand ? '✓' : '✗'}, 오른손 ${rightHand ? '✓' : '✗'}`, 15, y);
  y += 25;
  
  if(leftHand) {
    const isLeftClosed = isHandClosed(leftHand);
    ctx.fillText(`왼손 상태: ${isLeftClosed ? '쥐어짐 (백스페이스)' : '펼침 (입력모드)'}`, 15, y);
    y += 25;
  }
  
  if(rightHand) {
    // 안정적인 속도 계산
    let speed = 0;
    if(rightHand[8] && rightHand[7] && rightHand[8].x !== undefined && rightHand[7].x !== undefined) {
      speed = Math.hypot((rightHand[8].x-rightHand[7].x)*el.overlay.width,(rightHand[8].y-rightHand[7].y)*el.overlay.height);
    } else if(rightHand[7] && rightHand[5] && rightHand[7].x !== undefined && rightHand[5].x !== undefined) {
      speed = Math.hypot((rightHand[7].x-rightHand[5].x)*el.overlay.width,(rightHand[7].y-rightHand[5].y)*el.overlay.height);
    }
    ctx.fillText(`오른손 속도: ${speed.toFixed(1)}px`, 15, y);
    y += 25;
  }
  
  ctx.fillText(`터치 상태: ${debugInfo.lastHit >= 0 ? `버튼 ${debugInfo.lastHit + 1} (${TOKENS_BASE[debugInfo.lastHit]})` : '없음'}`, 15, y);
  y += 25;
  ctx.fillText(`Dwell 확률: ${debugInfo.lastDwellProb.toFixed(2)}`, 15, y);
  y += 25;
  ctx.fillText(`입력된 텍스트: "${textBuf.join('')}"`, 15, y);
  y += 25;
  ctx.fillText(`레이어: ${layer ? '대문자' : '소문자'}`, 15, y);
  y += 25;
  ctx.fillText(`모드: ${leftHand ? '입력모드' : rightHand ? '버튼모드' : '대기중'}`, 15, y);
  y += 25;
  ctx.fillText(`합장 상태: ${prayerState.isPraying ? `진행중 (${Math.round(prayerState.prayerProgress * 100)}%)` : '대기중'}`, 15, y);
  y += 25;
  ctx.fillText(`합장 감지: 연속 ${prayerState.consecutiveDetections}회, 미감지 ${prayerState.consecutiveMisses}회`, 15, y);
}

function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }
function mid(a,b){ return {x:(a.x+b.x)/2, y:(a.y+b.y)/2}; }

function regionsFromLeft(left){
  const W = el.overlay.width, H = el.overlay.height;
  const P = left.map(p=>({x:(1-p.x)*W, y:p.y*H})); // X축 반전 적용
  const R=[];
  
  // 손바닥 중심점과 크기 계산
  const palmCenter = mid(P[0], mid(P[5],P[17]));
  const palmRadius = Math.max(30, dist(P[5],P[17])*0.3); // 더 큰 반지름
  
  // 손 전체 영역을 더 넓게 활용하여 키 배치
  
  // 엄지 영역 - 1-3번
  R.push({c:{x:P[1].x, y:P[1].y}, r:palmRadius*0.8});     // 1: 엄지 시작점 (q)
  R.push({c:{x:P[2].x, y:P[2].y}, r:palmRadius*0.8});     // 2: 엄지 첫번째 관절 (w)
  R.push({c:{x:P[3].x, y:P[3].y}, r:palmRadius*0.8});     // 3: 엄지 두번째 관절 (e)
  
  // 검지 영역 - 4-6번
  R.push({c:{x:P[4].x, y:P[4].y}, r:palmRadius*0.8});     // 4: 엄지 끝 (r)
  R.push({c:{x:P[5].x, y:P[5].y}, r:palmRadius*0.8});     // 5: 검지 시작점 (t)
  R.push({c:{x:P[6].x, y:P[6].y}, r:palmRadius*0.8});     // 6: 검지 첫번째 관절 (y)
  
  // 중지 영역 - 7-9번
  R.push({c:{x:P[7].x, y:P[7].y}, r:palmRadius*0.8});     // 7: 검지 두번째 관절 (u)
  R.push({c:{x:P[8].x, y:P[8].y}, r:palmRadius*0.8});     // 8: 검지 끝 (i)
  R.push({c:{x:P[9].x, y:P[9].y}, r:palmRadius*0.8});     // 9: 중지 시작점 (o)
  
  // 약지 영역 - 10-12번
  R.push({c:{x:P[10].x, y:P[10].y}, r:palmRadius*0.8});   // 10: 중지 첫번째 관절 (p)
  R.push({c:{x:P[11].x, y:P[11].y}, r:palmRadius*0.8});   // 11: 중지 두번째 관절 (a)
  R.push({c:{x:P[12].x, y:P[12].y}, r:palmRadius*0.8});   // 12: 중지 끝 (s)
  
  // 새끼손가락 영역 - 13-15번
  R.push({c:{x:P[13].x, y:P[13].y}, r:palmRadius*0.8});   // 13: 약지 시작점 (d)
  R.push({c:{x:P[14].x, y:P[14].y}, r:palmRadius*0.8});   // 14: 약지 첫번째 관절 (f)
  R.push({c:{x:P[15].x, y:P[15].y}, r:palmRadius*0.8});   // 15: 약지 두번째 관절 (g)
  
  // 손바닥 영역 - 16-21번
  R.push({c:{x:P[16].x, y:P[16].y}, r:palmRadius*0.8});   // 16: 약지 끝 (h)
  R.push({c:{x:P[17].x, y:P[17].y}, r:palmRadius*0.8});   // 17: 새끼손가락 시작점 (j)
  R.push({c:{x:P[18].x, y:P[18].y}, r:palmRadius*0.8});   // 18: 새끼손가락 첫번째 관절 (k)
  R.push({c:{x:P[19].x, y:P[19].y}, r:palmRadius*0.8});   // 19: 새끼손가락 두번째 관절 (l)
  R.push({c:{x:P[20].x, y:P[20].y}, r:palmRadius*0.8});   // 20: 새끼손가락 끝 (z)
  R.push({c:{x:P[0].x, y:P[0].y}, r:palmRadius*0.8});     // 21: 손목 (x)
  
  // 손바닥 중앙 영역에 추가 키 배치 - 22-26번 (겹치지 않도록 넓게 분산)
  const palmTop = mid(P[5], P[9]);
  const palmBottom = mid(P[0], P[17]);
  const palmLeft = mid(P[5], P[17]);
  const palmRight = mid(P[9], P[13]);
  
  // 손바닥 영역을 더 넓게 확장하여 버튼 배치
  const widePalmRadius = palmRadius * 1.5;
  
  // 손바닥 중심에서 더 멀리 떨어진 위치에 배치
  const palmTopExtended = {
    x: palmCenter.x + (palmTop.x - palmCenter.x) * 1.5,
    y: palmCenter.y + (palmTop.y - palmCenter.y) * 1.5
  };
  const palmBottomExtended = {
    x: palmCenter.x + (palmBottom.x - palmCenter.x) * 1.5,
    y: palmCenter.y + (palmBottom.y - palmCenter.y) * 1.5
  };
  const palmLeftExtended = {
    x: palmCenter.x + (palmLeft.x - palmCenter.x) * 1.5,
    y: palmCenter.y + (palmLeft.y - palmCenter.y) * 1.5
  };
  const palmRightExtended = {
    x: palmCenter.x + (palmRight.x - palmCenter.x) * 1.5,
    y: palmCenter.y + (palmRight.y - palmCenter.y) * 1.5
  };
  
  R.push({c:palmTopExtended, r:palmRadius*0.8});                   // 22: 손바닥 상단 (c)
  R.push({c:palmBottomExtended, r:palmRadius*0.8});               // 23: 손바닥 하단 (v)
  R.push({c:palmLeftExtended, r:palmRadius*0.8});                // 24: 손바닥 좌측 (b)
  R.push({c:palmRightExtended, r:palmRadius*0.8});               // 25: 손바닥 우측 (n)
  R.push({c:palmCenter, r:palmRadius*0.8});               // 26: 손바닥 중앙 (m)
  
  return R;
}

function isThumbToPalm(hand){
  const W = el.overlay.width, H = el.overlay.height;
  const P = hand.map(p=>({x:(1-p.x)*W, y:p.y*H})); // X축 반전 적용
  return dist(P[4], P[9]) < 28;
}

function isHandClosed(hand){
  // MediaPipe 손가락 관절을 이용한 확실한 주먹 감지
  const W = el.overlay.width, H = el.overlay.height;
  const P = hand.map(p=>({x:(1-p.x)*W, y:p.y*H})); // X축 반전 적용
  
  // 각 손가락의 접힘 상태 확인
  // 손가락 끝이 손가락 중간 관절보다 손바닥에 가까우면 접혀있는 것
  
  let closedFingers = 0;
  
  // 검지 (8: 끝, 6: 중간관절, 5: 시작) - 검지는 제외하고 백스페이스 감지
  const indexFingerClosed = P[8].y > P[6].y;
  
  // 중지 (12: 끝, 10: 중간관절, 9: 시작)
  if(P[12].y > P[10].y) {
    closedFingers++;
    console.log(`🔍 중지 접힘 감지`);
  }
  
  // 약지 (16: 끝, 14: 중간관절, 13: 시작)
  if(P[16].y > P[14].y) {
    closedFingers++;
    console.log(`🔍 약지 접힘 감지`);
  }
  
  // 새끼손가락 (20: 끝, 18: 중간관절, 17: 시작)
  if(P[20].y > P[18].y) {
    closedFingers++;
    console.log(`🔍 새끼손가락 접힘 감지`);
  }
  
  console.log(`🔍 접힌 손가락: ${closedFingers}/3개 (검지 제외), 검지 상태: ${indexFingerClosed ? '접힘' : '펼침'}`);
  
  // 검지가 펼쳐져 있으면 주먹 비활성화 (입력 모드)
  if(!indexFingerClosed) {
    console.log(`🔍 검지가 펼쳐져 있음 - 주먹 비활성화`);
    return false;
  }
  
  // 검지가 접혀있고, 나머지 손가락 2개 이상 접혀있으면 주먹으로 판단
  return closedFingers >= 2;
}

function emitBackspace(){
  if(textBuf.length > 0) {
    const removed = textBuf.pop();
    stats.erase++;
    renderText();
    console.log(`🗑️ 백스페이스 실행! 제거된 글자: "${removed}", 남은 글자: ${textBuf.length}개`);
  } else {
    console.log(`🗑️ 백스페이스 시도했지만 삭제할 글자가 없음`);
  }
}

function emitSpace(){
  const currentTime = performance.now();
  
  // 쿨다운 체크: 마지막 스페이스바 실행 후 300ms 이내면 실행하지 않음
  if (currentTime - spaceState.lastSpaceTime < 300) {
    console.log(`␣ 스페이스바 쿨다운 중... (${300 - (currentTime - spaceState.lastSpaceTime)}ms 남음)`);
    return;
  }
  
  textBuf.push(' ');
  stats.space++;
  spaceState.lastSpaceTime = currentTime;
  renderText();
  console.log(`␣ 스페이스바 실행! 현재 텍스트: "${textBuf.join('')}"`);
  
  // 스페이스바 입력 시 커서 깜빡임 효과
  if(el.outputText) {
    el.outputText.style.color = '#007aff';
    el.outputText.style.transform = 'scale(1.05)';
    setTimeout(() => {
      el.outputText.style.color = '#1d1d1f';
      el.outputText.style.transform = 'scale(1)';
    }, 200);
  }
}

function emitToken(i){
  const tok = (layer? TOKENS_ALT[i] : TOKENS_BASE[i]);
  console.log(`🎯 토큰 출력 성공! 인덱스 ${i+1}, 값 "${tok}", 레이어: ${layer ? 'ALT' : 'BASE'}`);
  textBuf.push(tok);
  stats.tap++;
  renderText();
  console.log(`📝 현재 텍스트 버퍼:`, textBuf);
  console.log(`📊 통계 업데이트: tap=${stats.tap}`);
}

function exportCard(){
  const text = textBuf.join(' ');
  
  // 빈 텍스트인 경우 아카이브로 보내지 않음
  if (!text || text.trim() === '') {
    console.log('⚠️ 빈 텍스트: 아카이브로 보내지 않음');
    
    // 상태 피드백 표시
    if(el.statusText) {
      el.statusText.textContent = '텍스트를 입력해주세요';
      setTimeout(() => {
        if(el.statusText) {
          el.statusText.textContent = '준비 완료';
        }
      }, 2000);
    }
    return;
  }
  
  // 아카이브에 메시지 저장
  const message = {
    text: text,
    timestamp: Date.now(),
    stats: { ...stats }
  };
  
  // 로컬 스토리지에 저장
  const archive = JSON.parse(localStorage.getItem('typingArchive') || '[]');
  archive.push(message);
  localStorage.setItem('typingArchive', JSON.stringify(archive));
  
  // 다른 아카이브 페이지들에게 새 메시지 알림 전송
  try {
    const archiveChannel = new BroadcastChannel('typing-archive');
    archiveChannel.postMessage({
      type: 'NEW_MESSAGE',
      data: message
    });
    console.log('📡 다른 아카이브 페이지들에게 새 메시지 알림 전송됨');
  } catch (error) {
    console.log('📡 BroadcastChannel 지원되지 않음, 로컬 스토리지 이벤트 사용');
    // BroadcastChannel이 지원되지 않는 경우 localStorage 이벤트 사용
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'typingArchive',
      newValue: JSON.stringify(archive)
    }));
  }
  
  // 전시용: 메인 페이지는 새로고침만 하고 아카이브 페이지로 이동하지 않음
  console.log('🎯 전시 모드: 메시지 저장 완료, 메인 페이지 새로고침');
  
  // 입력 상태 리셋
  resetAll();
  
  // 성공 피드백 표시
  if(el.statusText) {
    el.statusText.textContent = '메시지 저장 완료!';
    setTimeout(() => {
      if(el.statusText) {
        el.statusText.textContent = '준비 완료';
      }
    }, 2000);
  }
}

// 합장 감지 함수 - 개선된 조건과 안정성
function detectPrayer(left, right) {
  if (!left || !right) return false;
  
  const W = el.overlay.width, H = el.overlay.height;
  const L = left.map(p=>({x:(1-p.x)*W, y:p.y*H})); // X축 반전 적용
  const R = right.map(p=>({x:(1-p.x)*W, y:p.y*H})); // X축 반전 적용
  
  // 여러 손가락 포인트로 거리 측정
  const distances = [
    dist(L[8], R[8]),   // 검지 끝점
    dist(L[12], R[12]), // 중지 끝점
    dist(L[16], R[16]), // 약지 끝점
    dist(L[20], R[20])  // 새끼손가락 끝점
  ];
  
  // 가장 가까운 거리 사용
  const minDistance = Math.min(...distances);
  
  // 손바닥 중심점 간 거리도 측정
  const palmCenterL = {x: (L[0].x + L[5].x + L[17].x) / 3, y: (L[0].y + L[5].y + L[17].y) / 3};
  const palmCenterR = {x: (R[0].x + R[5].x + R[17].x) / 3, y: (R[0].y + R[5].y + R[17].y) / 3};
  const palmDistance = dist(palmCenterL, palmCenterR);
  
  // 손바닥 전체 영역 거리도 측정 (더 안정적)
  const palmAreaDistance = Math.min(
    dist(L[0], R[0]),   // 손목
    dist(L[5], R[5]),   // 검지 시작점
    dist(L[17], R[17])  // 새끼손가락 시작점
  );
  
  // 디버깅: 거리 정보 출력 (10프레임마다)
  if (Math.floor(performance.now() / 100) % 10 === 0) {
    console.log(`🙏 합장 거리: 손가락 최소 ${minDistance.toFixed(1)}px, 손바닥 중심 ${palmDistance.toFixed(1)}px, 손바닥 영역 ${palmAreaDistance.toFixed(1)}px`);
  }
  
  // 더 관대한 조건으로 조정
  const fingerClose = minDistance < 120;  // 손가락 끝점이 120px 이내 (80px → 120px)
  const palmClose = palmDistance < 200;   // 손바닥 중심이 200px 이내 (150px → 200px)
  const palmAreaClose = palmAreaDistance < 180; // 손바닥 영역이 180px 이내
  
  // 세 조건 중 하나라도 만족하면 합장으로 인식 (OR 조건)
  const isPraying = fingerClose || palmClose || palmAreaClose;
  
  if (isPraying && Math.floor(performance.now() / 100) % 10 === 0) {
    console.log(`🙏 합장 감지됨! 손가락: ${minDistance.toFixed(1)}px, 손바닥 중심: ${palmDistance.toFixed(1)}px, 손바닥 영역: ${palmAreaDistance.toFixed(1)}px`);
  }
  
  return isPraying;
}

// 합장 시작
function startPrayer() {
  if (prayerState.isPraying) return;
  
  prayerState.isPraying = true;
  prayerState.prayerStartTime = performance.now();
  prayerState.prayerProgress = 0;
  
  // 진행 상태 UI 표시
  const progressEl = document.getElementById('prayerProgress');
  const progressFillEl = document.getElementById('progressFill');
  
  if (progressEl && progressFillEl) {
    progressEl.style.display = 'block';
    progressFillEl.classList.add('active');
  }
  
  console.log('🙏 합장 시작!');
  
  // 진행 상태 업데이트 타이머
  prayerState.prayerTimer = setInterval(() => {
    const elapsed = performance.now() - prayerState.prayerStartTime;
    prayerState.prayerProgress = Math.min(elapsed / prayerState.prayerDuration, 1);
    
    if (progressFillEl) {
      progressFillEl.style.width = `${prayerState.prayerProgress * 100}%`;
    }
    
    // 3초 완료 시 아카이브로 이동
    if (prayerState.prayerProgress >= 1) {
      completePrayer();
    }
  }, 50); // 50ms마다 업데이트
}

// 합장 중단
function stopPrayer() {
  if (!prayerState.isPraying) return;
  
  prayerState.isPraying = false;
  
  // 타이머 정리
  if (prayerState.prayerTimer) {
    clearInterval(prayerState.prayerTimer);
    prayerState.prayerTimer = null;
  }
  
  // 진행 상태 UI 숨기기
  const progressEl = document.getElementById('prayerProgress');
  const progressFillEl = document.getElementById('progressFill');
  
  if (progressEl && progressFillEl) {
    progressEl.style.display = 'none';
    progressFillEl.style.width = '0%';
    progressFillEl.classList.remove('active');
  }
  
  console.log('🙏 합장 중단');
}

// 합장 완료
function completePrayer() {
  console.log('🙏 합장 완료! 아카이브로 이동합니다.');
  
  // 타이머 정리
  if (prayerState.prayerTimer) {
    clearInterval(prayerState.prayerTimer);
    prayerState.prayerTimer = null;
  }
  
  // 아카이브로 이동
  exportCard();
}

async function setup(){
  try {
    console.log('MediaPipe 모델 로딩 시작...');
    const { HandLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest');
    const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm');
    
    landmarker = await HandLandmarker.createFromOptions(files, {
      baseOptions: { 
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' 
      },
      numHands: 2, 
      runningMode: 'VIDEO', 
      minHandDetectionConfidence: 0.4, 
      minHandPresenceConfidence: 0.4, 
      minTrackingConfidence: 0.4
    });
    console.log('MediaPipe 모델 로딩 완료!');
  } catch (error) {
    console.error('MediaPipe 설정 오류:', error);
    throw error;
  }
}

async function startCam(){
  const stream = await navigator.mediaDevices.getUserMedia({ 
    video: { 
      width: 1280, 
      height: 720,
      brightness: { ideal: 0.8, min: 0.3, max: 1.0 },
      exposureMode: 'continuous',
      whiteBalanceMode: 'continuous',
      focusMode: 'continuous'
    }
  });
  el.video.srcObject = stream;
  await el.video.play();
  el.video.classList.add('on');
  
  // 비디오 밝기 조정을 위한 CSS 필터 적용
  el.video.style.filter = 'brightness(1.3) contrast(1.2) saturate(1.1)';
}

function prayerConfirm(left,right){
  // 새로운 합장 감지 로직 사용
  const isPraying = detectPrayer(left, right);
  const currentTime = performance.now();
  
  if (isPraying) {
    // 합장이 감지되면 연속 감지 횟수 증가
    prayerState.consecutiveDetections++;
    prayerState.consecutiveMisses = 0;
    
    // 첫 감지이거나 마지막 감지 시간 기록
    if (prayerState.lastDetectionTime === 0) {
      prayerState.lastDetectionTime = currentTime;
      console.log(`🙏 합장 감지 시작 - 연속 감지: ${prayerState.consecutiveDetections}`);
    }
    
    // 일정 시간(200ms) 이상 지속되고 연속 감지가 3회 이상이면 합장 시작
    if (!prayerState.isPraying && 
        currentTime - prayerState.lastDetectionTime >= prayerState.detectionThreshold &&
        prayerState.consecutiveDetections >= 3) {
      console.log(`🙏 합장 시작 조건 만족 - 연속 감지: ${prayerState.consecutiveDetections}회, 지속 시간: ${currentTime - prayerState.lastDetectionTime}ms`);
      startPrayer();
    }
  } else {
    // 합장이 감지되지 않으면 연속 미감지 횟수 증가
    prayerState.consecutiveMisses++;
    
    // 합장 중이었다면 중단 조건 확인
    if (prayerState.isPraying) {
      // 연속 미감지가 5회 이상이거나, 마지막 감지 후 500ms 이상 지났으면 중단
      if (prayerState.consecutiveMisses >= 5 || 
          (prayerState.lastDetectionTime > 0 && currentTime - prayerState.lastDetectionTime >= prayerState.interruptionThreshold)) {
        console.log(`🙏 합장 중단 조건 만족 - 연속 미감지: ${prayerState.consecutiveMisses}회, 마지막 감지 후: ${currentTime - prayerState.lastDetectionTime}ms`);
        stopPrayer();
      }
    } else {
      // 합장이 시작되지 않은 상태에서는 연속 미감지가 3회 이상이면 리셋
      if (prayerState.consecutiveMisses >= 3) {
        prayerState.lastDetectionTime = 0;
        prayerState.consecutiveDetections = 0;
        console.log(`🙏 합장 감지 리셋 - 연속 미감지: ${prayerState.consecutiveMisses}회`);
      }
    }
  }
  
  // 기존 로직과 호환성을 위해 합장 상태에 따라 반환
  return prayerState.isPraying;
}

function drawLandmarks(L){
  ctx.strokeStyle = '#7aa2ff'; ctx.lineWidth=2;
  for(const p of L){
    ctx.beginPath(); ctx.arc((1-p.x)*el.overlay.width, p.y*el.overlay.height, 3,0,Math.PI*2); ctx.stroke(); // X축 반전 적용
  }
}

// requestVideoFrameCallback 폴리필
if (!HTMLVideoElement.prototype.requestVideoFrameCallback) {
  HTMLVideoElement.prototype.requestVideoFrameCallback = function(callback) {
    const video = this;
    const raf = (now, metadata) => {
      callback(now, metadata);
    };
    return requestAnimationFrame(raf);
  };
}

async function loop(){
  if(!running || !landmarker || el.video.readyState<2){ el.video.requestVideoFrameCallback(loop); return; }
  
  try {
    const t = performance.now();
    const res = landmarker.detectForVideo(el.video, t);
    const hands = res.landmarks || [];
    // 손 개수 표시 (handChip이 없으므로 제거)
    
  ctx.clearRect(0,0,el.overlay.width,el.overlay.height);

  let left=null, right=null;
  if(hands.length===1){ 
    // 한 손만 인식될 때는 손의 위치로 왼손/오른손 구분
    const hand = hands[0];
    const handCenterX = hand[0].x; // 손목 중심점의 x 좌표
    if(handCenterX < 0.5) { // 화면 왼쪽 절반이면 왼손
      left = hand;
    } else { // 화면 오른쪽 절반이면 오른손
      right = hand;
    }
  }
  if(hands.length>=2){
    const a=hands[0], b=hands[1];
    (a[0].x < b[0].x)? (left=a,right=b) : (left=b,right=a);
  }
  
  console.log(`손 감지됨: ${hands.length}개 - 왼손: ${left ? 'O' : 'X'}, 오른손: ${right ? 'O' : 'X'}`);

  // 타이핑 영역은 항상 표시되도록 수정
  if(el.outputText) {
    el.outputText.style.display = 'block';
    const text = textBuf.join('');
    if(text) {
      // 입력된 텍스트가 있으면 커서 표시
      el.outputText.classList.remove('no-cursor');
    } else {
      // 입력된 텍스트가 없으면 커서 숨기기
      el.outputText.classList.add('no-cursor');
    }
  }

  if(right && isThumbToPalm(right)){ if(!layer){ layer=true; stats.layer++; } }
  else { if(layer){ layer=false; } }
  if(el.layerChip) {
    el.layerChip.textContent = layer ? '대문자' : '소문자';
  }

  let rois=null;
  if(left){
    // 왼손 커서 제거됨
    
    // 왼손 스페이스바 감지 - 한 번의 사이클에서 한 번만 실행
    const isLeftClosed = isHandClosed(left);
    
    if(isLeftClosed && !spaceState.wasClosed) {
      // 손이 쥐어지기 시작
      spaceState.wasClosed = true;
      spaceState.spaceExecuted = false;  // 새로운 사이클 시작
      console.log(`✊ 왼손 쥐어짐 - 스페이스바 사이클 시작`);
    } else if(!isLeftClosed && spaceState.wasClosed && !spaceState.spaceExecuted) {
      // 손이 펼쳐지고 아직 스페이스바가 실행되지 않았을 때만 실행
      console.log(`✋ 왼손 펴짐 - 스페이스바 실행 (한 번만)`);
      emitSpace();
      spaceState.spaceExecuted = true;  // 이 사이클에서 실행 완료
    } else if(!isLeftClosed && spaceState.wasClosed && spaceState.spaceExecuted) {
      // 손이 완전히 펼쳐져서 사이클 종료
      spaceState.wasClosed = false;
      spaceState.spaceExecuted = false;
      console.log(`✋ 왼손 완전히 펼쳐짐 - 스페이스바 사이클 종료`);
    }
    
    rois = regionsFromLeft(left);
    ctx.globalAlpha = 0.9;
    for(let i=0;i<rois.length;i++){
      const {c,r} = rois[i];
      
      // 원형 배경 채우기
      ctx.beginPath(); 
      ctx.arc(c.x, c.y, r, 0, Math.PI*2);
      ctx.fillStyle='rgba(255,255,255,0.9)'; 
      ctx.fill();
      
      // 원형 테두리
      ctx.strokeStyle='rgba(0,0,0,0.3)'; 
      ctx.lineWidth=2; 
      ctx.stroke();
      
      // 텍스트를 원 안에 중앙 정렬
      ctx.fillStyle='#1d1d1f'; 
      ctx.font='bold 16px ui-sans-serif'; 
      ctx.textAlign='center'; 
      ctx.textBaseline='middle'; 
      ctx.fillText(TOKENS_BASE[i], c.x, c.y);
    }
  }

  if(right){
    const W = el.overlay.width, H = el.overlay.height;
    
    // 손이 웹캠에 다 잡히지 않을 때를 대비한 안정적인 커서 위치 계산
    let tip;
    if(right[8] && right[8].x !== undefined && right[8].y !== undefined) {
      // 검지 끝이 정상적으로 감지된 경우
      tip = {x:(1-right[8].x)*W, y:right[8].y*H};
    } else if(right[7] && right[7].x !== undefined && right[7].y !== undefined) {
      // 검지 끝이 없으면 검지 두번째 관절 사용
      tip = {x:(1-right[7].x)*W, y:right[7].y*H};
    } else if(right[5] && right[5].x !== undefined && right[5].y !== undefined) {
      // 검지 관절들이 없으면 검지 시작점 사용
      tip = {x:(1-right[5].x)*W, y:right[5].y*H};
    } else if(right[0] && right[0].x !== undefined && right[0].y !== undefined) {
      // 손목 사용 (최후의 수단)
      tip = {x:(1-right[0].x)*W, y:right[0].y*H};
    } else {
      // 모든 랜드마크가 없으면 중앙 사용
      tip = {x:W/2, y:H/2};
    }
    
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 10, 0, Math.PI*2);
    ctx.strokeStyle='#9ee37d'; ctx.lineWidth=3; ctx.stroke();

    // 오른손 백스페이스 감지
    const isRightClosed = isHandClosed(right);
    if(isRightClosed && !backspaceState.wasClosed) {
      backspaceState.wasClosed = true;
      console.log(`✊ 오른손 쥐어짐 - 백스페이스 준비`);
    } else if(!isRightClosed && backspaceState.wasClosed) {
      console.log(`✋ 오른손 펴짐 - 백스페이스 실행`);
      emitBackspace();
      backspaceState.wasClosed = false;
    }

    if(rois){
      let hit=-1;
      for(let i=0;i<rois.length;i++){
        const {c,r}=rois[i];
        if(Math.hypot(tip.x-c.x, tip.y-c.y) < r) { hit=i; break; }
      }
      
      // 디버그 정보 업데이트
      debugInfo.lastHit = hit;
      
      for(let i=0;i<dwellProb.length;i++){
        const target = (i===hit);
        dwellProb[i] = 0.8*dwellProb[i] + (target?0.2:0); // 더 빠른 반응을 위해 조정
      }
      
      if(hit>=0){
        const p = dwellProb[hit];
        debugInfo.lastDwellProb = p;
        
        // 접촉 영역 하이라이트
        ctx.fillStyle = 'rgba(158, 227, 125, 0.2)';
        ctx.beginPath(); ctx.arc(rois[hit].c.x, rois[hit].c.y, rois[hit].r, 0, Math.PI*2); ctx.fill();
        
        // 더 두꺼운 원호로 시각적 피드백 강화
        ctx.beginPath(); ctx.arc(rois[hit].c.x, rois[hit].c.y, rois[hit].r+8, -Math.PI/2, -Math.PI/2 + p*2*Math.PI);
        ctx.strokeStyle='#9ee37d'; ctx.lineWidth=6; ctx.stroke();
        
        // 안정적인 속도 계산
        let speed = 0;
        if(right[8] && right[7] && right[8].x !== undefined && right[7].x !== undefined) {
          speed = Math.hypot((right[8].x-right[7].x)*W,(right[8].y-right[7].y)*H);
        } else if(right[7] && right[5] && right[7].x !== undefined && right[5].x !== undefined) {
          speed = Math.hypot((right[7].x-right[5].x)*W,(right[7].y-right[5].y)*H);
        }
        debugInfo.lastSpeed = speed;
        
        // 터치 감지 시 즉시 피드백 표시
        ctx.fillStyle = '#ff6b6b';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`터치! ${hit+1}`, rois[hit].c.x, rois[hit].c.y - 30);
        
        // 디버깅: 현재 상태 출력
        console.log(`🔍 터치 상태: hit=${hit+1}, dwell=${p.toFixed(2)}, speed=${speed.toFixed(1)}`);
        
        // 터치 상태 업데이트
        if(!touchState.wasTouching) {
          touchState.wasTouching = true;
          touchState.lastHit = hit;
        }
        
        // 로딩이 충분히 차면 입력 준비 상태로 설정
        if(p>0.8 && !touchState.readyToEmit) {
          touchState.readyToEmit = true;
          console.log(`⏳ 입력 준비 완료: hit=${hit+1}, dwell=${p.toFixed(2)}`);
          
          // 준비 완료 시각적 피드백
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 18px Arial';
          ctx.fillText('READY', rois[hit].c.x, rois[hit].c.y - 50);
        }
        
      } else {
        // 터치 해제 감지
        if(touchState.wasTouching && touchState.readyToEmit) {
          console.log(`🎯 터치 해제 감지! 입력 실행: hit=${touchState.lastHit+1}`);
          emitToken(touchState.lastHit);
          dwellProb[touchState.lastHit] = 0;
          
          // 성공 피드백
          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 20px Arial';
          ctx.fillText('✓', rois[touchState.lastHit].c.x, rois[touchState.lastHit].c.y - 50);
        }
        
        // 터치 상태 리셋
        touchState.wasTouching = false;
        touchState.readyToEmit = false;
        touchState.lastHit = -1;
        
        debugInfo.lastDwellProb = 0;
        debugInfo.lastSpeed = 0;
      }
    }
  }

  if(left && right){
    prayerConfirm(left,right);
  }

  // 디버그 정보 표시
  drawDebugInfo(left, right);

    const dt = t-lastT; if(dt>0){ fps=1000/dt; } lastT=t;
    if((t|0)%6===0 && el.fpsChip){ 
      el.fpsChip.textContent='FPS: '+Math.round(fps); 
    }
    
  } catch (error) {
    console.error('루프 실행 오류:', error);
  }
  
  el.video.requestVideoFrameCallback(loop);
}

async function startFlow(){
  try {
    if(el.statusText) {
      el.statusText.textContent='카메라 준비 중…';
    }
    if(!landmarker) {
      console.log('MediaPipe 모델 초기화 중...');
      await setup();
    }
    console.log('카메라 시작 중...');
    await startCam();
    setCanvasSize();
    running=true; 
    if(el.statusText) {
      el.statusText.textContent='준비 완료';
    }
    if(el.statusDot) {
      el.statusDot.classList.add('active');
    }
    console.log('시스템 준비 완료!');
    loop();
  } catch (error) {
    console.error('시작 오류:', error);
    if(el.statusText) {
      el.statusText.textContent='오류 발생: ' + error.message;
    }
  }
}

function resetAll(){
  textBuf=[]; stats={tap:0, erase:0, layer:0, space:0}; layer=false; confirmAccum=0; dwellProb.fill(0); 
  debugInfo = { lastHit: -1, lastSpeed: 0, lastDwellProb: 0 };
  touchState = { wasTouching: false, readyToEmit: false, lastHit: -1 };
  backspaceState = { wasClosed: false, readyToBackspace: false };
  spaceState = { 
    wasClosed: false, 
    readyToSpace: false, 
    lastSpaceTime: 0,
    spaceExecuted: false
  };
  
  // 합장 상태 리셋
  stopPrayer();
  prayerState = {
    isPraying: false,
    prayerStartTime: 0,
    prayerDuration: 3000,
    prayerProgress: 0,
    prayerTimer: null,
    lastDetectionTime: 0,
    detectionThreshold: 200,
    lastInterruptionTime: 0,
    interruptionThreshold: 500,
    consecutiveDetections: 0,
    consecutiveMisses: 0
  };
  
  renderText();
  if(el.layerChip) {
    el.layerChip.textContent='소문자';
  }
}

// 키보드 단축키
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    console.log('R키 눌림 - 리셋 실행');
    resetAll();
    if(el.statusText) {
      el.statusText.textContent = '리셋 완료';
    }
  }
});

// 자동 시작
window.addEventListener('load', async () => {
  console.log('페이지 로드 완료 - 자동으로 카메라 시작');
  await startFlow();
});

resetAll();