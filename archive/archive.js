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
        
        // 무작위 애니메이션 지연 (0.1s ~ 1.5s)
        const randomDelay = 0.1 + Math.random() * 1.4;
        card.style.animationDelay = `${randomDelay}s`;
        
        container.appendChild(card);
    });
    
    console.log(`📚 테스트 메시지 로드 완료: ${testMessages.length}개 메시지`);
}

// 새로운 메시지 추가 시 스크롤 애니메이션 처리
function addNewMessageWithScrollAnimation(newMessage) {
    const container = document.querySelector('.archive-container');
    const existingCards = container.querySelectorAll('.message-card');
    
    // 12개가 다 찼을 때만 스크롤 애니메이션 실행
    if (existingCards.length >= 12) {
        // 기존 카드들에 스크롤 업 애니메이션 적용
        existingCards.forEach((card, index) => {
            card.style.animation = `scrollUp 0.8s ease-in-out forwards`;
            card.style.animationDelay = `${index * 0.05}s`; // 순차적으로 애니메이션
        });
        
        // 애니메이션 완료 후 새 메시지 추가 (기존 카드들은 그대로 유지)
        setTimeout(() => {
            // 새 메시지 카드 생성 및 추가
            const newCard = createMessageCard(newMessage, existingCards.length);
            newCard.style.animation = `slideInFromBottom 0.6s ease-out forwards`;
            
            // 새 카드를 맨 뒤에 추가 (스크롤된 상태에서)
            container.appendChild(newCard);
            
            // 기존 카드들의 애니메이션 초기화 (다음 애니메이션을 위해)
            setTimeout(() => {
                existingCards.forEach(card => {
                    card.style.animation = '';
                    card.style.transform = '';
                });
            }, 100);
            
        }, 800); // 스크롤 애니메이션 시간과 맞춤
    } else {
        // 12개 미만일 때는 일반적으로 추가
        const newCard = createMessageCard(newMessage, existingCards.length);
        newCard.style.animation = `slideIn 0.6s ease-out forwards`;
        container.appendChild(newCard);
    }
}

function createMessageCard(message, index) {
    const card = document.createElement('div');
    card.className = `message-card delay-${(index % 5) + 1}`;
    
    // 메시지 고유 ID 설정
    card.dataset.messageId = message.timestamp.toString();
    
    // 무작위성 부여 (그리드 내에서 더 큰 변화)
    const randomOffsetX = (Math.random() - 0.5) * 60; // -30px ~ +30px
    const randomOffsetY = (Math.random() - 0.5) * 40; // -20px ~ +20px
    const randomRotation = (Math.random() - 0.5) * 20; // -10도 ~ +10도
    const randomScale = 0.85 + Math.random() * 0.3; // 0.85 ~ 1.15
    
    card.style.transform = `translate(${randomOffsetX}px, ${randomOffsetY}px) rotate(${randomRotation}deg) scale(${randomScale})`;
    card.style.zIndex = Math.floor(Math.random() * 10) + 1; // 1~10 무작위 z-index
    
    card.innerHTML = `
        <div class="message-text">${message.text}</div>
    `;
    
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
    
    // 테스트용: 여러 개의 새로운 메시지 추가 (스크롤 애니메이션 테스트)
    setTimeout(() => {
        const testMessages = [
            { text: 'New message 1!', timestamp: Date.now(), stats: { tap: 5, erase: 0, layer: 0, space: 0 } },
            { text: 'New message 2!', timestamp: Date.now() + 1000, stats: { tap: 5, erase: 0, layer: 0, space: 0 } },
            { text: 'New message 3!', timestamp: Date.now() + 2000, stats: { tap: 5, erase: 0, layer: 0, space: 0 } }
        ];
        
        testMessages.forEach((message, index) => {
            setTimeout(() => {
                addNewMessageWithScrollAnimation(message);
            }, index * 2000); // 2초 간격으로 추가
        });
    }, 3000);
});

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // ESC 키로 메인 페이지로 돌아가기
        window.location.href = '../main/index.html';
    }
});