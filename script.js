// =====================================================
// JOINT VIEWING — СОВМЕСТНЫЙ ПРОСМОТР ВИДЕО VK
// =====================================================

// ==================== ГЛАВА 0: FIREBASE ====================
const firebaseConfig = {
  apiKey: "AIzaSyABEtgE3HOh41kmgPQXIuO-LTI2ZPieaBc",
  authDomain: "joint-viewing.firebaseapp.com",
  projectId: "joint-viewing",
  storageBucket: "joint-viewing.firebasestorage.app",
  messagingSenderId: "224004484626",
  appId: "1:224004484626:web:502ae915083a8e3c4f2cb"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==================== ГЛАВА 1: ПЕРЕМЕННЫЕ ====================
// Пользователь
let currentUser = {
    id: null,
    name: 'Гость',
    avatar: null
};

// Комната
let currentRoom = {
    id: null,
    videoUrl: null,
    isPlaying: false
};

// VK Bridge
let vkBridgeAvailable = false;

// ==================== ГЛАВА 2: DOM-ЭЛЕМЕНТЫ ====================
// Шапка
const roomIdDisplay = document.getElementById('roomIdDisplay');
const userNameDisplay = document.getElementById('userNameDisplay');
const userAvatar = document.getElementById('userAvatar');

// Плеер
const vkPlayerContainer = document.getElementById('vkPlayerContainer');
const videoUrlInput = document.getElementById('videoUrlInput');
const loadVideoBtn = document.getElementById('loadVideoBtn');
const syncSeekBtn = document.getElementById('syncSeekBtn');

// Чат
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const onlineCount = document.getElementById('onlineCount');

// Комната
const shareRoomBtn = document.getElementById('shareRoomBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');


// ==================== ГЛАВА 3: ИНИЦИАЛИЗАЦИЯ ====================
function initApp() {
    console.log('Joint Viewing запущен');
    
    // Проверяем, есть ли ID комнаты в ссылке
    const hash = window.location.hash;
    if (hash && hash.startsWith('#room_')) {
        currentRoom.id = hash.replace('#room_', '');
        enterRoom();
        addSystemMessage('Вы присоединились к комнате: ' + currentRoom.id);
        return;
    }
    
    currentRoom.id = generateRoomId();
    roomIdDisplay.textContent = currentRoom.id;
    initVKBridge();
    setupEventListeners();

    document.getElementById('mainMenu').classList.remove('hidden');
    document.querySelector('.app-header').classList.add('hidden');
    document.querySelector('.main-layout').classList.add('hidden');
}

function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 4; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

// ==================== ГЛАВА 4: VK BRIDGE ====================
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
                    userAvatar.innerHTML = `<img src="${data.photo_100}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
                }
                addSystemMessage('Привет, ' + data.first_name + '!');
            })
            .catch(() => {
                addSystemMessage('Режим браузера (без VK)');
            });
    }
}

// ==================== ГЛАВА 5: КОМНАТА ====================
function enterRoom() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.querySelector('.app-header').classList.remove('hidden');
    document.querySelector('.main-layout').classList.remove('hidden');
    roomIdDisplay.textContent = currentRoom.id;

    chatMessages.innerHTML = '';
    listenToChat();
        listenToPlayer();

    const userRef = db.ref('rooms/' + currentRoom.id + '/users/' + Date.now());
    userRef.set(true);
    userRef.onDisconnect().remove();

    updateOnlineCount();
    systemEvent('join', currentUser.name || 'Гость');
}

function shareRoom() {
    const link = 'https://nisxlar.github.io/Joint-Viewing/#room_' + currentRoom.id;
    
    // Копируем ссылку в буфер
    navigator.clipboard?.writeText(link).then(() => {
        addSystemMessage('Ссылка скопирована: ' + currentRoom.id);
    }).catch(() => {
        prompt('Ссылка на комнату:', link);
    });
    
    // Если в VK — ещё и диалог поделиться
    if (vkBridgeAvailable) {
        vkBridge.send('VKWebAppShare', {
            link: link,
            text: 'Присоединяйся к комнате ' + currentRoom.id + ' в Joint Viewing!'
        }).catch(() => {});
    }
}

function leaveRoom() {
    systemEvent('leave', currentUser.name || 'Гость');
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
        addSystemMessage('Новая комната: ' + currentRoom.id);
    }
}

function updateOnlineCount() {
    db.ref('rooms/' + currentRoom.id + '/users').on('value', function(snapshot) {
        const count = snapshot.numChildren();
        document.getElementById('onlineCount').textContent = count + ' онлайн';
    });
}

// ==================== ГЛАВА 6: ПЛЕЕР ====================
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
    const videoUrl = url;

    // Сохраняем в Firebase для всех
    db.ref('rooms/' + currentRoom.id + '/player').set({
        oid: oid,
        videoId: videoId,
        videoUrl: videoUrl,
        isPlaying: false
    });

    addSystemMessage('Видео загружено');
    systemEvent('video', videoUrl);
}

function syncSeek() {
    if (!currentRoom.videoUrl) {
        alert('Сначала загрузите видео');
        return;
    }

    // Переключаем воспроизведение для всех
    const newState = !currentRoom.isPlaying;
    db.ref('rooms/' + currentRoom.id + '/player/isPlaying').set(newState);
    addSystemMessage(newState ? 'Воспроизведение синхронизировано' : 'Пауза синхронизирована');
}

function updatePlayer(oid, videoId, videoUrl, isPlaying) {
    currentRoom.videoUrl = videoUrl;
    currentRoom.isPlaying = isPlaying;

    const autoplay = isPlaying ? '1' : '0';

    vkPlayerContainer.innerHTML = `
        <iframe 
            src="https://vkvideo.ru/video_ext.php?oid=${oid}&id=${videoId}&hd=2&autoplay=${autoplay}"
            width="100%" height="100%" frameborder="0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen style="border: none;">
        </iframe>
    `;

    syncSeekBtn.disabled = false;
}

function listenToPlayer() {
    db.ref('rooms/' + currentRoom.id + '/player').off();
    db.ref('rooms/' + currentRoom.id + '/player').on('value', function(snapshot) {
        const data = snapshot.val();
        if (data) {
            updatePlayer(data.oid, data.videoId, data.videoUrl, data.isPlaying);
        }
    });
}

// ==================== ГЛАВА 7: ЧАТ ====================
function sendChatMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    db.ref('rooms/' + currentRoom.id + '/messages').push({
        author: currentUser.name || 'Гость',
        text: text,
        time: Date.now(),
        system: false
    });
    messageInput.value = '';
}

function addChatMessage(author, text, isSystem) {
    const div = document.createElement('div');
    div.className = isSystem ? 'message system' : 'message';

    const now = new Date();
    const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    // Контент сообщения
    let authorHTML = '';
    if (isSystem) {
        authorHTML = '<div class="message-author">Система</div>';
    } else if (author) {
        authorHTML = '<div class="message-author">' + author + '</div>';
    }

    let replyHTML = '';
    if (!isSystem) {
        replyHTML = '<button class="reply-btn" data-author="' + (author || '').replace(/"/g, '&quot;') + '" data-text="' + text.replace(/"/g, '&quot;') + '">ОТВЕТИТЬ</button>';
    }

    div.innerHTML = authorHTML + '<div class="message-text">' + text + '</div><div class="message-time">' + time + '</div>' + replyHTML;
    chatMessages.appendChild(div);

    // Кнопка "Ответить"
    if (!isSystem) {
        const replyBtn = div.querySelector('.reply-btn');
        if (replyBtn) {
            replyBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                messageInput.value = '> ' + this.dataset.author + ': ' + this.dataset.text + '\n';
                messageInput.focus();
            });
        }
    }

    // Прокрутка
    if (chatMessages.children.length > 7) {
        div.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
}

function listenToChat() {
    db.ref('rooms/' + currentRoom.id + '/messages').off();
    db.ref('rooms/' + currentRoom.id + '/messages').on('child_added', function(snapshot) {
        const msg = snapshot.val();
        addChatMessage(msg.author, msg.text, msg.system || false);
    });
}

function clearChat() {
    if (confirm('Очистить историю чата?')) {
        db.ref('rooms/' + currentRoom.id + '/messages').remove();
        chatMessages.innerHTML = '';
        addSystemMessage('Чат очищен');
    }
}

// ==================== ГЛАВА 8: СИСТЕМНЫЕ СООБЩЕНИЯ ====================
function addSystemMessage(text) {
    db.ref('rooms/' + currentRoom.id + '/messages').push({
        author: '',
        text: text,
        time: Date.now(),
        system: true
    });
}

function systemEvent(type, data) {
    const events = {
        'join': data + ' присоединился к комнате',
        'leave': data + ' покинул комнату',
        'video': 'Видео загружено: ' + data
    };
    const text = events[type] || '';
    if (text) {
        db.ref('rooms/' + currentRoom.id + '/messages').push({
            author: '',
            text: text,
            time: Date.now(),
            system: true
        });
    }
}

// ==================== ГЛАВА 9: ОБРАБОТЧИКИ СОБЫТИЙ ====================
function setupEventListeners() {
       // Плеер
    loadVideoBtn.addEventListener('click', loadVideo);
    videoUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadVideo();
    });
    syncSeekBtn.addEventListener('click', syncSeek);
    // Чат
    sendMessageBtn.addEventListener('click', sendChatMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    document.getElementById('clearChatBtn').addEventListener('click', clearChat);

    // Комната
    shareRoomBtn.addEventListener('click', shareRoom);
    leaveRoomBtn.addEventListener('click', leaveRoom);

    // Меню
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
        if (confirm('Вернуться в меню?')) {
            systemEvent('leave', currentUser.name || 'Гость');
            document.getElementById('mainMenu').classList.remove('hidden');
            document.querySelector('.app-header').classList.add('hidden');
            document.querySelector('.main-layout').classList.add('hidden');

            vkPlayerContainer.innerHTML = '<div class="player-placeholder"><p>Вставьте ссылку на видео VK</p><p class="placeholder-hint">vk.com/video-85016643_456239733</p></div>';
            videoUrlInput.value = '';
            syncSeekBtn.disabled = true;
            currentRoom.isPlaying = false;
            currentRoom.videoUrl = null;
            chatMessages.innerHTML = '<div class="message system"><span class="message-text">Добро пожаловать в Joint Viewing</span><span class="message-time">Только что</span></div>';
        }
    });

    document.getElementById('copyRoomBtn').addEventListener('click', function() {
        navigator.clipboard?.writeText(currentRoom.id).then(() => {
            addSystemMessage('ID скопирован: ' + currentRoom.id);
        }).catch(() => {
            prompt('ID комнаты:', currentRoom.id);
        });
    });
}

// ==================== ЗАПУСК ====================
document.addEventListener('DOMContentLoaded', initApp);