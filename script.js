// =====================================================
// VK RAVE — СОВМЕСТНЫЙ ПРОСМОТР ВИДЕО
// =====================================================

let currentUser = {
    id: null,
    name: 'Гость',
    avatar: null
};

let currentRoom = {
    id: null,
    videoId: null,
    videoOid: null,
    isPlaying: false
};

let vkPlayer = null;
let vkBridgeAvailable = false;

const roomIdDisplay = document.getElementById('roomIdDisplay');
const userNameDisplay = document.getElementById('userNameDisplay');
const userAvatar = document.getElementById('userAvatar');
const vkPlayerContainer = document.getElementById('vkPlayerContainer');
const videoUrlInput = document.getElementById('videoUrlInput');
const loadVideoBtn = document.getElementById('loadVideoBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const syncSeekBtn = document.getElementById('syncSeekBtn');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const shareRoomBtn = document.getElementById('shareRoomBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

function initApp() {
    console.log('Joint Viewing запущен');
    currentRoom.id = generateRoomId();
    roomIdDisplay.textContent = currentRoom.id;
    initVKBridge();
    setupEventListeners();
}

function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 4; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

function initVKBridge() {
    if (typeof vkBridge !== 'undefined') {
        vkBridgeAvailable = true;
        vkBridge.send('VKWebAppInit', {})
            .then(() => vkBridge.send('VKWebAppGetUserInfo'))
            .then(data => {
                currentUser.id = data.id;
                currentUser.name = data.first_name + ' ' + data.last_name;
                userNameDisplay.textContent = data.first_name;
                if (data.photo_100) {
                    userAvatar.innerHTML = `<img src="${data.photo_100}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                }
                addSystemMessage(`Привет, ${data.first_name}! Комната: ${currentRoom.id}`);
            })
            .catch(() => addSystemMessage('Демо-режим (без VK)'));
    }
}

function setupEventListeners() {
    loadVideoBtn.addEventListener('click', loadVideo);
    videoUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadVideo();
    });
    playPauseBtn.addEventListener('click', togglePlayPause);
    syncSeekBtn.addEventListener('click', syncSeek);
    sendMessageBtn.addEventListener('click', sendChatMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    shareRoomBtn.addEventListener('click', shareRoom);
    leaveRoomBtn.addEventListener('click', leaveRoom);
}

function loadVideo() {
    const url = videoUrlInput.value.trim();
    if (!url) {
        alert('Вставьте ссылку на видео VK');
        return;
    }
    const match = url.match(/video(-?\d+)_(\d+)/);
    if (!match) {
        alert('Неверный формат ссылки. Пример: vk.com/video-202318352_456239019');
        return;
    }
    const oid = match[1];
    const videoId = match[2];
    currentRoom.videoOid = oid;
    currentRoom.videoId = videoId;
    vkPlayerContainer.innerHTML = '';

    try {
        vkPlayer = new VK.VideoPlayer(vkPlayerContainer, {
            id: videoId,
            owner_id: oid
        }, {
            width: '100%',
            height: '100%',
            autoplay: 0
        });
        vkPlayer.on('started', () => {
            currentRoom.isPlaying = true;
            updatePlayPauseBtn();
        });
        vkPlayer.on('paused', () => {
            currentRoom.isPlaying = false;
            updatePlayPauseBtn();
        });
        vkPlayer.on('ended', () => {
            currentRoom.isPlaying = false;
            updatePlayPauseBtn();
        });
        syncSeekBtn.disabled = false;
        addSystemMessage('📺 Видео загружено!');
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось загрузить видео. Проверьте настройки приватности.');
        vkPlayerContainer.innerHTML = '<div class="player-placeholder"><div class="placeholder-icon">📺</div><p>Не удалось загрузить видео</p></div>';
    }
}

function updatePlayPauseBtn() {
    if (currentRoom.isPlaying) {
        playPauseBtn.textContent = '⏸ ПАУЗА';
        playPauseBtn.classList.add('pause');
        playPauseBtn.classList.remove('play');
    } else {
        playPauseBtn.textContent = '▶️ ВОСПРОИЗВЕДЕНИЕ';
        playPauseBtn.classList.add('play');
        playPauseBtn.classList.remove('pause');
    }
}

function togglePlayPause() {
    if (!vkPlayer) {
        alert('Сначала загрузите видео');
        return;
    }
    if (currentRoom.isPlaying) {
        vkPlayer.pause();
    } else {
        vkPlayer.play();
    }
}

function syncSeek() {
    if (!vkPlayer) return;
    alert('Синхронизация будет работать после настройки сервера');
}

function sendChatMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    addChatMessage(currentUser.name || 'Вы', text);
    messageInput.value = '';
}

function addChatMessage(author, text, isSystem = false) {
    const div = document.createElement('div');
    div.className = isSystem ? 'message system' : 'message';
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    div.innerHTML = `
        <div class="message-author">${isSystem ? '⚙️ Система' : author}</div>
        <div class="message-text">${text}</div>
        <div class="message-time">${time}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(text) {
    addChatMessage('', text, true);
}

function shareRoom() {
    const link = `https://nisx180.github.io/Joint-Viewing/#room_${currentRoom.id}`;
    if (vkBridgeAvailable) {
        vkBridge.send('VKWebAppShare', { link: link });
    } else {
        navigator.clipboard?.writeText(link).then(() => alert('Ссылка скопирована!'));
    }
    addSystemMessage(`🔗 Комната: ${currentRoom.id}`);
}

function leaveRoom() {
    if (confirm('Выйти из комнаты?')) {
        if (vkPlayer) {
            vkPlayer.destroy();
            vkPlayer = null;
        }
        currentRoom.id = generateRoomId();
        roomIdDisplay.textContent = currentRoom.id;
        vkPlayerContainer.innerHTML = '<div class="player-placeholder"><div class="placeholder-icon">📺</div><p>Вставьте ссылку на видео VK</p></div>';
        videoUrlInput.value = '';
        syncSeekBtn.disabled = true;
        currentRoom.isPlaying = false;
        updatePlayPauseBtn();
        addSystemMessage(`Новая комната: ${currentRoom.id}`);
    }
}

document.addEventListener('DOMContentLoaded', initApp);