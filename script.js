const API_KEY = 'AIzaSyCtsWdK-GxSIqtfnQqQs2CjYbKoOHSEwVE';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

let isDarkMode = false;
let uploadedFiles = [];

// Event Listeners
document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
document.getElementById('file-upload').addEventListener('change', handleFileUpload);
document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-theme');
    const icon = document.getElementById('theme-toggle-btn');
    icon.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
}

async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    const filePreview = document.getElementById('file-preview');

    for (const file of files) {
        const reader = new FileReader();

        reader.onload = async function(event) {
            const fileData = {
                name: file.name,
                type: file.type,
                content: event.target.result,
                language: detectLanguage(file.name),
            };

            uploadedFiles.push(fileData);

            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.innerHTML = `
                <i class="fas ${file.type.includes('image') ? 'fa-image' : 'fa-file-code'}"></i>
                <span>${file.name}</span>
                <span class="remove-file" onclick="removeFile('${file.name}')">×</span>
            `;
            filePreview.appendChild(previewItem);
        };

        if (file.type.includes('image')) {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    }
}

function removeFile(fileName) {
    uploadedFiles = uploadedFiles.filter(file => file.name !== fileName);
    updateFilePreview();
}

function updateFilePreview() {
    const filePreview = document.getElementById('file-preview');
    filePreview.innerHTML = '';

    uploadedFiles.forEach(file => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <i class="fas ${file.type.includes('image') ? 'fa-image' : 'fa-file-code'}"></i>
            <span>${file.name}</span>
            <span class="remove-file" onclick="removeFile('${file.name}')">×</span>
        `;
        filePreview.appendChild(previewItem);
    });
}

async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();

    if (message === '' && uploadedFiles.length === 0) return;

    let messageContent = message;

    // Prepare message with files
    if (uploadedFiles.length > 0) {
        messageContent += '\n\nFiles attached:\n';
        uploadedFiles.forEach(file => {
            if (file.type.includes('image')) {
                messageContent += `\n[Image: ${file.name}]`;
            } else {
                messageContent += `\n\nFile: ${file.name}\nLanguage: ${file.language}\nContent:\n${file.content}`;
            }
        });

        if (message.toLowerCase().includes('fix') || message.toLowerCase().includes('correct')) {
            messageContent += '\n\nPlease fix the code and provide the corrected version.';
        }
    }

    appendMessage('user', messageContent, uploadedFiles);
    userInput.value = '';

    // Clear file preview and uploaded files
    document.getElementById('file-preview').innerHTML = '';
    const oldFiles = [...uploadedFiles];
    uploadedFiles = [];

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot-message';
    loadingDiv.innerHTML = `
        <div class="loading-animation">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
    document.getElementById('chat-messages').appendChild(loadingDiv);

    try {
        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: messageContent,
                    }],
                }],
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch response from Gemini API');
        }

        const data = await response.json();
        const botResponse = data.candidates[0].content.parts[0].text;

        loadingDiv.remove();
        appendMessage('bot', botResponse, oldFiles);
    } catch (error) {
        loadingDiv.remove();
        appendMessage('bot', 'Error: Could not get response');
        console.error('Error:', error);
    }
}

function appendMessage(sender, text, files = []) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    // Handle files in the message
    if (files.length > 0) {
        files.forEach(file => {
            if (file.type.includes('image')) {
                messageDiv.innerHTML += `
                    <div class="file-attachment">
                        <img src="${file.content}" class="image-preview" alt="${file.name}">
                        <div class="file-name">${file.name}</div>
                    </div>
                `;
            } else {
                messageDiv.innerHTML += `
                    <div class="file-attachment">
                        <div class="file-name">${file.name}</div>
                        <div class="file-content">${file.content}</div>
                    </div>
                `;
            }
        });
    }

    // Convert markdown to HTML and handle code blocks
    const formattedText = marked.parse(text);
    messageDiv.innerHTML += formattedText;

    // Add interactive elements to code blocks
    messageDiv.querySelectorAll('pre code').forEach((block) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block';

        const language = block.className.split('-')[1];
        const languageLabel = document.createElement('div');
        languageLabel.className = 'language-label';
        languageLabel.textContent = language || 'text';

        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.onclick = () => {
            navigator.clipboard.writeText(block.textContent);
            copyButton.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copyButton.innerHTML = '<i class="fas fa-copy"></i>';
            }, 2000);
        };

        const saveButton = document.createElement('button');
        saveButton.className = 'copy-button save-button';
        saveButton.innerHTML = '<i class="fas fa-download"></i>';
        saveButton.style.right = '70px';
        saveButton.onclick = () => downloadFixedCode(block.textContent, language || 'txt');

        block.parentNode.insertBefore(wrapper, block);
        wrapper.appendChild(block);
        wrapper.appendChild(copyButton);
        wrapper.appendChild(saveButton);
        wrapper.appendChild(languageLabel);
    });

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    hljs.highlightAll();
}

function detectLanguage(filename) {
    const extensions = {
        'js': 'javascript',
        'py': 'python',
        'html': 'html',
        'css': 'css',
        'json': 'json',
        'cpp': 'cpp',
        'c': 'c',
        'java': 'java',
        'rb': 'ruby',
        'php': 'php',
        'go': 'go',
        'rs': 'rust',
        'ts': 'typescript',
        'txt': 'text'
    };
    const ext = filename.split('.').pop().toLowerCase();
    return extensions[ext] || 'text';
}

function downloadFixedCode(code, language) {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixed-code.${language}`;
    a.click();
    window.URL.revokeObjectURL(url);
}
