const chatWindow = document.getElementById('chatWindow');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// Auto-grow textarea
userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
});

// Send on Enter (Shift+Enter for newline)
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);

function removeWelcome() {
    const welcome = chatWindow.querySelector('.welcome');
    if (welcome) welcome.remove();
}

function appendMessage(role, text) {
    removeWelcome();

    const row = document.createElement('div');
    row.classList.add('message-row', role);

    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    avatar.textContent = role === 'user' ? '👤' : '✦';

    const bubble = document.createElement('div');
    bubble.classList.add('bubble');
    bubble.textContent = text;

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatWindow.appendChild(row);
    scrollToBottom();
    return row;
}

function appendLoader() {
    removeWelcome();

    const row = document.createElement('div');
    row.classList.add('message-row', 'ai');

    const avatar = document.createElement('div');
    avatar.classList.add('avatar');
    avatar.textContent = '✦';

    const dots = document.createElement('div');
    dots.classList.add('dots');
    dots.innerHTML = '<span></span><span></span><span></span>';

    row.appendChild(avatar);
    row.appendChild(dots);
    chatWindow.appendChild(row);
    scrollToBottom();
    return row;
}

function scrollToBottom() {
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
}

function setLoading(isLoading) {
    sendBtn.disabled = isLoading;
    userInput.disabled = isLoading;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    userInput.value = '';
    userInput.style.height = 'auto';
    setLoading(true);

    const loaderRow = appendLoader();

    try {
        const res = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text }),
        });

        const data = await res.json();
        loaderRow.remove();

        if (!res.ok || data.error) {
            appendMessage('ai', `⚠️ ${data.error || 'Something went wrong. Please try again.'}`);
        } else {
            appendMessage('ai', data.reply);
        }
    } catch (err) {
        loaderRow.remove();
        appendMessage('ai', '⚠️ Network error. Is the server running?');
    } finally {
        setLoading(false);
        userInput.focus();
    }
}
