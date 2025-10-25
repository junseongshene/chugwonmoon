// 아카이브 페이지 JavaScript

// 실시간 통신을 위한 BroadcastChannel
const archiveChannel = new BroadcastChannel('typing-archive');

// 로컬 스토리지에서 아카이브된 메시지들 가져오기
function loadArchivedMessages() {
    const messages = JSON.parse(localStorage.getItem('typingArchive') || '[]');
    const container = document.getElementById('messagesContainer');
    const totalMessagesEl = document.getElementById('totalMessages');
    
    // 기존 메시지들 모두 제거 (중복 방지)
    container.innerHTML = '';
    
    totalMessagesEl.textContent = messages.length;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: rgba(255,255,255,0.7);">
                <h2 style="font-size: 2rem; margin-bottom: 10px;">아직 메시지가 없습니다</h2>
                <p>메인 페이지에서 손으로 텍스트를 입력해보세요!</p>
            </div>
        `;
        return;
    }

    // 메시지들을 랜덤한 위치에 배치
    messages.forEach((message, index) => {
        const bubble = createMessageBubble(message, index);
        container.appendChild(bubble);
    });
    
    console.log(`📚 아카이브 로드 완료: ${messages.length}개 메시지`);
}

function createMessageBubble(message, index) {
    const bubble = document.createElement('div');
    bubble.className = `message-bubble delay-${(index % 5) + 1}`;
    
    // 메시지 고유 ID 설정
    bubble.dataset.messageId = message.timestamp.toString();
    
    // 랜덤한 위치 계산 (화면 경계와 버튼 영역 고려)
    const maxX = window.innerWidth - 400;
    const maxY = window.innerHeight - 300; // 버튼 영역을 피하기 위해 더 위쪽으로
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    
    bubble.innerHTML = `
        <div class="message-text">${message.text}</div>
        <div class="message-meta">
            <span class="message-time">${formatTime(message.timestamp)}</span>
            <div class="message-stats">
                <span class="stat-item">입력: ${message.stats.tap}</span>
                <span class="stat-item">지우기: ${message.stats.erase}</span>
                <span class="stat-item">전환: ${message.stats.layer}</span>
            </div>
            <button class="delete-button" onclick="deleteMessage('${message.timestamp}')" title="메시지 삭제">🗑️</button>
        </div>
    `;
    
    return bubble;
}

// 메시지 삭제 함수
function deleteMessage(messageId) {
    if (confirm('이 메시지를 삭제하시겠습니까?')) {
        // 로컬 스토리지에서 메시지 제거
        const messages = JSON.parse(localStorage.getItem('typingArchive') || '[]');
        const filteredMessages = messages.filter(msg => msg.timestamp.toString() !== messageId);
        localStorage.setItem('typingArchive', JSON.stringify(filteredMessages));
        
        // 다른 페이지들에게 삭제 알림
        archiveChannel.postMessage({
            type: 'REMOVE_MESSAGE',
            data: { messageId }
        });
        
        // 현재 페이지에서도 제거
        removeMessageFromUI(messageId);
        
        console.log('🗑️ 메시지 삭제됨:', messageId);
    }
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
        document.getElementById('messagesContainer').innerHTML = `
            <div class="empty-state" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: rgba(255,255,255,0.7);">
                <h2 style="font-size: 2rem; margin-bottom: 10px;">아직 메시지가 없습니다</h2>
                <p>메인 페이지에서 손으로 텍스트를 입력해보세요!</p>
            </div>
        `;
        document.getElementById('totalMessages').textContent = '0';
        
        console.log('🗑️ 전체 아카이브 초기화됨');
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function goBack() {
    window.location.href = '../main/index.html';
}

// 실시간 업데이트 함수들
function refreshMessages() {
    console.log('🔄 아카이브 메시지 새로고침 중...');
    loadArchivedMessages();
}

function addMessageToUI(message) {
    const container = document.getElementById('messagesContainer');
    const totalMessagesEl = document.getElementById('totalMessages');
    
    // 중복 메시지 체크 (같은 timestamp가 이미 있는지 확인)
    const existingMessage = container.querySelector(`[data-message-id="${message.timestamp}"]`);
    if (existingMessage) {
        console.log('⚠️ 중복 메시지 감지됨, 추가하지 않음:', message.timestamp);
        return;
    }
    
    // 빈 상태 메시지 제거
    if (container.querySelector('.empty-state')) {
        container.innerHTML = '';
    }
    
    // 새 메시지 버블 생성 및 추가
    const bubble = createMessageBubble(message, container.children.length);
    container.appendChild(bubble);
    
    // 총 메시지 수 업데이트
    const messages = JSON.parse(localStorage.getItem('typingArchive') || '[]');
    totalMessagesEl.textContent = messages.length;
    
    console.log('✨ 새 메시지가 실시간으로 추가되었습니다:', message.text);
}

function removeMessageFromUI(messageId) {
    const container = document.getElementById('messagesContainer');
    const bubbles = container.querySelectorAll('.message-bubble');
    
    // 해당 메시지 찾아서 제거
    bubbles.forEach(bubble => {
        if (bubble.dataset.messageId === messageId) {
            bubble.remove();
            console.log('🗑️ 메시지가 실시간으로 제거되었습니다:', messageId);
        }
    });
    
    // 총 메시지 수 업데이트
    const messages = JSON.parse(localStorage.getItem('typingArchive') || '[]');
    document.getElementById('totalMessages').textContent = messages.length;
    
    // 메시지가 없으면 빈 상태 표시
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: rgba(255,255,255,0.7);">
                <h2 style="font-size: 2rem; margin-bottom: 10px;">아직 메시지가 없습니다</h2>
                <p>메인 페이지에서 손으로 텍스트를 입력해보세요!</p>
            </div>
        `;
    }
}

// BroadcastChannel 메시지 수신 처리
let lastMessageTime = 0;
archiveChannel.addEventListener('message', (event) => {
    const { type, data } = event.data;
    const now = Date.now();
    
    // 중복 메시지 방지 (같은 메시지가 100ms 내에 여러 번 오는 경우)
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
            refreshMessages();
            break;
        case 'CLEAR_ALL':
            document.getElementById('messagesContainer').innerHTML = `
                <div class="empty-state" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: rgba(255,255,255,0.7);">
                    <h2 style="font-size: 2rem; margin-bottom: 10px;">아직 메시지가 없습니다</h2>
                    <p>메인 페이지에서 손으로 텍스트를 입력해보세요!</p>
                </div>
            `;
            document.getElementById('totalMessages').textContent = '0';
            break;
    }
});

// localStorage 변경 감지 (BroadcastChannel 대체용)
let lastStorageUpdate = 0;
window.addEventListener('storage', (event) => {
    if (event.key === 'typingArchive') {
        const now = Date.now();
        // 100ms 내 중복 이벤트 방지
        if (now - lastStorageUpdate > 100) {
            console.log('📡 localStorage 변경 감지됨, 아카이브 새로고침');
            refreshMessages();
            lastStorageUpdate = now;
        }
    }
});

// 페이지 로드 시 메시지들 로드
document.addEventListener('DOMContentLoaded', loadArchivedMessages);

// 창 크기 변경 시 메시지 위치 재조정
window.addEventListener('resize', () => {
    const bubbles = document.querySelectorAll('.message-bubble');
    bubbles.forEach(bubble => {
        const maxX = window.innerWidth - 400;
        const maxY = window.innerHeight - 200;
        const x = Math.random() * maxX;
        const y = Math.random() * maxY;
        
        bubble.style.left = `${x}px`;
        bubble.style.top = `${y}px`;
    });
});
