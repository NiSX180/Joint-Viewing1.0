// =====================================================
// JOINT VIEWING — СОВМЕСТНЫЙ ПРОСМОТР ВИДЕО VK
// Версия с iframe (работает на любом хостинге)
// =====================================================

let currentUser = {
    id: null,
    name: 'Гость',
    avatar: null
};

let currentRoom = {
    id: null,
    videoUrl: null,
    isPlaying: false
};

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

    // Показываем главное меню при запуске
    document.getElementById('mainMenu').classList.remove('hidden');
    document.querySelector('.app-header').classList.add('hidden');
    document.querySelector('.main-layout').classList.add('hidden');
}

function enterRoom() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.querySelector('.app-header').classList.remove('hidden');
    document.querySelector('.main-layout').classList.remove('hidden');
    roomIdDisplay.textContent = currentRoom.id;
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
                addSystemMessage('Привет, ' + data.first_name + '!');
            })
            .catch(() => {
                addSystemMessage('Режим браузера (без VK)');
            });
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

    document.getElementById('createRoomBtn').addEventListener('click', function() {
        currentRoom.id = generateRoomId();
        enterRoom();
        addSystemMessage('Комната создана: ' + currentRoom.id);
    });

    document.getElementById('joinRoomBtn').addEventListener('click', function() {
        const inputId = document.getElementById('joinRoomInput').value.trim().toUpperCase();
        if (inputId.length !== 4) {
            alert('Введите ID комнаты (4 символа)');
            return;
        }
        currentRoom.id = inputId;
        enterRoom();
        addSystemMessage('Вы присоединились к комнате: ' + currentRoom.id);
    });

    document.getElementById('backToMenuBtn').addEventListener('click', function() {
        if (confirm('Вернуться в меню? Прогресс комнаты будет потерян.')) {
            document.getElementById('mainMenu').classList.remove('hidden');
            document.querySelector('.app-header').classList.add('hidden');
            document.querySelector('.main-layout').classList.add('hidden');

            // Очищаем плеер
            vkPlayerContainer.innerHTML = '<div class="player-placeholder"><p>Вставьте ссылку на видео VK</p><p class="placeholder-hint">vk.com/video-85016643_456239733</p></div>';
            videoUrlInput.value = '';
            syncSeekBtn.disabled = true;
            currentRoom.isPlaying = false;
            currentRoom.videoUrl = null;
            chatMessages.innerHTML = '<div class="message system"><span class="message-text">Добро пожаловать в Joint Viewing</span><span class="message-time">Только что</span></div>';
        }
    });
}

// Загрузка видео через iframe
function loadVideo() {
    const url = videoUrlInput.value.trim();
    if (!url) {
        alert('Вставьте ссылку на видео VK');
        return;
    }

    const match = url.match(/(?:vk\.com|vkvideo\.ru)\/video(-?\d+_\d+)/);

    if (!match) {
        alert('Неверный формат ссылки.\nПример: vk.com/video-85016643_456239733');
        return;
    }

    const parts = match[1].split('_');
    const oid = parts[0];
    const videoId = parts[1];

    console.log('Загружаем видео:', { oid, videoId });

    currentRoom.videoUrl = url;
    currentRoom.isPlaying = false;

    vkPlayerContainer.innerHTML = `
        <iframe 
            src="https://vkvideo.ru/video_ext.php?oid=${oid}&id=${videoId}&hd=2&autoplay=0"
            width="100%" 
            height="100%" 
            frameborder="0" 
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen
            style="border: none;">
        </iframe>
    `;

    syncSeekBtn.disabled = false;
    playPauseBtn.textContent = 'ВОСПРОИЗВЕДЕНИЕ';
    playPauseBtn.classList.add('play');
    playPauseBtn.classList.remove('pause');

    addSystemMessage('Видео загружено');
}

// Кнопка Play/Pause
function togglePlayPause() {
    if (!currentRoom.videoUrl) {
        alert('Сначала загрузите видео');
        return;
    }

    if (currentRoom.isPlaying) {
        playPauseBtn.textContent = 'ВОСПРОИЗВЕДЕНИЕ';
        playPauseBtn.classList.add('play');
        playPauseBtn.classList.remove('pause');
        currentRoom.isPlaying = false;
        addSystemMessage('Пауза');
    } else {
        playPauseBtn.textContent = 'ПАУЗА';
        playPauseBtn.classList.add('pause');
        playPauseBtn.classList.remove('play');
        currentRoom.isPlaying = true;
        addSystemMessage('Воспроизведение');
    }
}

function syncSeek() {
    addSystemMessage('Синхронизация — в разработке');
    alert('Синхронизация будет добавлена позже');
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
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    div.innerHTML = `
        <div class="message-author">${isSystem ? 'Система' : author}</div>
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
    const link = 'https://nisx180.github.io/Joint-Viewing1.0/#room_' + currentRoom.id;
    if (vkBridgeAvailable) {
        vkBridge.send('VKWebAppShare', {
            link: link,
            text: 'Присоединяйся к комнате ' + currentRoom.id + ' в Joint Viewing!'
        }).catch(() => fallbackShare(link));
    } else {
        fallbackShare(link);
    }
    addSystemMessage('Комната: ' + currentRoom.id);
}

function fallbackShare(link) {
    navigator.clipboard?.writeText(link).then(() => {
        alert('Ссылка на комнату скопирована!');
    }).catch(() => {
        prompt('Ссылка на комнату:', link);
    });
}

function leaveRoom() {
    if (confirm('Выйти из комнаты?')) {
        currentRoom.id = generateRoomId();
        roomIdDisplay.textContent = currentRoom.id;
        vkPlayerContainer.innerHTML = `
            <div class="player-placeholder">
                <p>Вставьте ссылку на видео VK</p>
                <p class="placeholder-hint">vk.com/video-202318352_456239019</p>
            </div>
        `;
        videoUrlInput.value = '';
        syncSeekBtn.disabled = true;
        currentRoom.isPlaying = false;
        currentRoom.videoUrl = null;
        playPauseBtn.textContent = 'ВОСПРОИЗВЕДЕНИЕ';
        playPauseBtn.classList.add('play');
        playPauseBtn.classList.remove('pause');
        addSystemMessage('Новая комната: ' + currentRoom.id);
    }
}

document.addEventListener('DOMContentLoaded', initApp);