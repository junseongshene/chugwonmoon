// 아카이브 페이지 JavaScript - 텍스트만 표시

// 실시간 통신을 위한 BroadcastChannel
const archiveChannel = new BroadcastChannel('typing-archive');

// 로컬 스토리지에서 아카이브된 메시지들 가져오기
function loadArchivedMessages() {
  const container = document.querySelector('.archive-container');

  // 기존 메시지들 모두 제거
  container.innerHTML = '';

  // 테스트용 메시지들 생성 (비주얼 실험용)
  const testMessages = [
    { text: 'Hello world', timestamp: Date.now() - 1000, stats: { tap: 5, erase: 0, layer: 0, space: 0 } },
    { text: 'Good morning', timestamp: Date.now() - 2000, stats: { tap: 4, erase: 1, layer: 0, space: 1 } },
    { text: 'Thank you', timestamp: Date.now() - 3000, stats: { tap: 6, erase: 0, layer: 0, space: 0 } },
    { text: 'Have a nice day', timestamp: Date.now() - 4000, stats: { tap: 5, erase: 0, layer: 0, space: 1 } },
    { text: 'Sweet dreams', timestamp: Date.now() - 5000, stats: { tap: 5, erase: 0, layer: 0, space: 1 } },
    { text: 'Love you', timestamp: Date.now() - 6000, stats: { tap: 5, erase: 0, layer: 0, space: 1 } },
    { text: 'Stay strong', timestamp: Date.now() - 7000, stats: { tap: 5, erase: 0, layer: 0, space: 1 } },
    { text: 'Be happy', timestamp: Date.now() - 8000, stats: { tap: 5, erase: 0, layer: 0, space: 1 } },
    { text: 'Never give up', timestamp: Date.now() - 9000, stats: { tap: 6, erase: 0, layer: 0, space: 1 } },
    { text: 'Keep smiling', timestamp: Date.now() - 10000, stats: { tap: 6, erase: 0, layer: 0, space: 1 } },
    { text: 'You are amazing', timestamp: Date.now() - 11000, stats: { tap: 5, erase: 0, layer: 0, space: 1 } },
    { text: 'Dream big', timestamp: Date.now() - 12000, stats: { tap: 7, erase: 0, layer: 0, space: 1 } }
  ];

  // 테스트 메시지들을 시간순으로 정렬하여 표시
  testMessages.sort((a, b) => b.timestamp - a.timestamp);

  testMessages.forEach((message, index) => {
    const card = createMessageCard(message, index);
    // 애니메이션 제거: 지연 없이 즉시 추가
    container.appendChild(card);
  });

  console.log(`📚 테스트 메시지 로드 완료: ${testMessages.length}개 메시지`);
}

// 여러 요소의 animationend를 모두 기다림 (타임아웃 포함)
function waitForAllAnimationEnd(elements, timeoutMs = 1000) {
  return new Promise((resolve) => {
    if (!elements || elements.length === 0) return resolve();
    let remaining = elements.length;
    const onEnd = (e) => {
      e.currentTarget.removeEventListener('animationend', onEnd);
      remaining--;
      if (remaining === 0) resolve();
    };
    elements.forEach((el) => el.addEventListener('animationend', onEnd, { once: true }));
    setTimeout(resolve, timeoutMs);
  });
}

// 컨테이너를 지정 시간 동안 부드럽게 스크롤
function smoothScrollTo(element, targetTop, durationMs = 300) {
  return new Promise((resolve) => {
    const startTop = element.scrollTop;
    const distance = targetTop - startTop;
    if (durationMs <= 0 || distance === 0) {
      element.scrollTop = targetTop;
      return resolve();
    }
    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = easeOutCubic(t);
      element.scrollTop = startTop + distance * eased;
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

// 새로운 메시지 추가 시 스크롤 애니메이션 처리
async function addNewMessageWithScrollAnimation(newMessage) {
  const container = document.querySelector('.archive-container');
  const existingCards = Array.from(container.querySelectorAll('.message-card'));

  // 현재 12개가 꽉 찼다면 상단 1~3을 페이드 아웃 후 제거
  if (existingCards.length >= 12) {
    const topRow = existingCards.slice(0, 3);
    topRow.forEach(card => card.classList.add('scroll-out'));

    // FLIP: 이동할 카드들(2번째 행 이후)을 캡처
    const movingCards = existingCards.slice(3);
    const firstRects = new Map();
    movingCards.forEach(card => firstRects.set(card, card.getBoundingClientRect()));

    // 1) 페이드아웃 종료 대기
    await waitForAllAnimationEnd(topRow, 600);
    // 2) DOM 제거
    topRow.forEach(card => card.remove());

    // 3) 최종 위치 캡처
    const lastRects = new Map();
    movingCards.forEach(card => lastRects.set(card, card.getBoundingClientRect()));

    // 4) Invert + Play: 위치 변화 애니메이션
    const durationMs = 300;
    movingCards.forEach(card => {
      const first = firstRects.get(card);
      const last = lastRects.get(card);
      if (!first || !last) return;
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      card.style.transition = 'none';
      card.style.transform = `translate(${dx}px, ${dy}px)`;
      void card.offsetWidth; // reflow
      card.style.transition = `transform ${durationMs}ms ease`;
      card.style.transform = 'translate(0, 0)';
    });

    // 5) 이동 종료 대기
    await waitForAllTransitionEnd(movingCards, durationMs + 100);

    // 6) 새 카드 추가 후 0.3초 대기하고 페이드 인 (message-card 자체 페이드)
    const newCard = createMessageCard(newMessage, existingCards.length);
    newCard.style.opacity = '0';
    container.appendChild(newCard);
    await new Promise(r => setTimeout(r, 300));
    requestAnimationFrame(() => {
      newCard.classList.add('animate-in');
    });
  } else {
    // 12개 미만이면 그냥 추가 + 인 애니메이션 (message-card 페이드)
    const newCard = createMessageCard(newMessage, existingCards.length);
    newCard.style.opacity = '0';
    container.appendChild(newCard);
    await new Promise(r => setTimeout(r, 300));
    requestAnimationFrame(() => {
      newCard.classList.add('animate-in');
    });
  }
}

// 여러 요소의 transitionend를 모두 기다림 (타임아웃 포함)
function waitForAllTransitionEnd(elements, timeoutMs = 500) {
  return new Promise((resolve) => {
    if (!elements || elements.length === 0) return resolve();
    let remaining = elements.length;
    const onEnd = (e) => {
      e.currentTarget.removeEventListener('transitionend', onEnd);
      remaining--;
      if (remaining === 0) resolve();
    };
    elements.forEach((el) => el.addEventListener('transitionend', onEnd, { once: true }));
    setTimeout(resolve, timeoutMs);
  });
}

function createMessageCard(message, index) {
  const card = document.createElement('div');
  // 애니메이션 클래스 제거
  card.className = `message-card`;

  // 메시지 고유 ID 설정
  card.dataset.messageId = message.timestamp.toString();

  // 무작위 변형 제거: 그리드 정렬 유지

  // 내부 래퍼를 추가하여 진입 애니메이션은 내부에만 적용
  const inner = document.createElement('div');
  inner.className = 'card-inner';
  inner.innerHTML = `<div class="message-text">${message.text}</div>`;
  card.appendChild(inner);

  return card;
}

function showEmptyState() {
  const container = document.querySelector('.archive-container');
  container.innerHTML = `
        <div class="empty-state">
            <h2>아직 메시지가 없습니다</h2>
            <p>메인 페이지에서 손으로 텍스트를 입력해보세요!</p>
        </div>
    `;
}

// 전체 아카이브 초기화 함수
function clearAllMessages() {
  if (confirm('모든 메시지를 삭제하시겠습니까?')) {
    localStorage.removeItem('typingArchive');

    // 다른 페이지들에게 초기화 알림
    archiveChannel.postMessage({
      type: 'CLEAR_ALL',
      data: {}
    });

    // 현재 페이지에서도 초기화
    showEmptyState();

    console.log('🗑️ 전체 아카이브 초기화됨');
  }
}

// 실시간 업데이트 함수들
function addMessageToUI(message) {
  const container = document.querySelector('.archive-container');

  // 중복 메시지 체크
  const existingMessage = container.querySelector(`[data-message-id="${message.timestamp}"]`);
  if (existingMessage) {
    console.log('⚠️ 중복 메시지 감지됨, 추가하지 않음:', message.timestamp);
    return;
  }

  // 빈 상태 메시지 제거
  if (container.querySelector('.empty-state')) {
    container.innerHTML = '';
  }

  // 새 메시지 카드 생성 및 맨 위에 추가
  const card = createMessageCard(message, 0);
  container.insertBefore(card, container.firstChild);

  console.log('✨ 새 메시지가 실시간으로 추가되었습니다:', message.text);
}

function removeMessageFromUI(messageId) {
  const container = document.querySelector('.archive-container');
  const messageCard = container.querySelector(`[data-message-id="${messageId}"]`);

  if (messageCard) {
    messageCard.remove();
    console.log('🗑️ 메시지가 실시간으로 제거되었습니다:', messageId);
  }

  // 메시지가 없으면 빈 상태 표시
  const remainingMessages = container.querySelectorAll('.message-card');
  if (remainingMessages.length === 0) {
    showEmptyState();
  }
}

// BroadcastChannel 메시지 수신 처리
let lastMessageTime = 0;
archiveChannel.addEventListener('message', (event) => {
  const { type, data } = event.data;
  const now = Date.now();

  // 중복 메시지 방지
  if (type === 'NEW_MESSAGE' && now - lastMessageTime < 100) {
    console.log('⚠️ 중복 BroadcastChannel 메시지 무시됨');
    return;
  }

  switch (type) {
    case 'NEW_MESSAGE':
      addMessageToUI(data);
      lastMessageTime = now;
      break;
    case 'REMOVE_MESSAGE':
      removeMessageFromUI(data.messageId);
      break;
    case 'REFRESH_ALL':
      loadArchivedMessages();
      break;
    case 'CLEAR_ALL':
      showEmptyState();
      break;
  }
});

// localStorage 변경 감지
let lastStorageUpdate = 0;
window.addEventListener('storage', (event) => {
  if (event.key === 'typingArchive') {
    const now = Date.now();
    if (now - lastStorageUpdate > 100) {
      console.log('📡 localStorage 변경 감지됨, 아카이브 새로고침');
      loadArchivedMessages();
      lastStorageUpdate = now;
    }
  }
});

// 페이지 로드 시 메시지들 로드
document.addEventListener('DOMContentLoaded', () => {
  loadArchivedMessages();

  // 테스트용: 3초 후 시작하여 10초 간격으로 새 메시지 추가
  setTimeout(() => {
    let testCounter = 1;
    setInterval(() => {
      const message = {
        text: `New message ${testCounter++}!`,
        timestamp: Date.now(),
        stats: { tap: 5, erase: 0, layer: 0, space: 0 }
      };
      addNewMessageWithScrollAnimation(message);
    }, 10000);
  }, 3000);
});

// 키보드 단축키
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // ESC 키로 메인 페이지로 돌아가기
    window.location.href = '../main/index.html';
  }
});