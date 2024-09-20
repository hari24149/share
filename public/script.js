const socket = io();
let username = "";

// Prompt for username
document.getElementById('enterChat').addEventListener('click', function () {
    username = document.getElementById('usernameInput').value.trim();
    if (username) {
        document.getElementById('usernamePrompt').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';
    }
});

// Send a chat message
document.getElementById('sendMessage').addEventListener('click', function () {
    const message = document.getElementById('messageInput').value.trim();
    if (message) {
        socket.emit('chatMessage', { username, message });
        document.getElementById('messageInput').value = ''; // Clear input after sending
    }
});

// Receive a chat message
socket.on('chatMessage', (data) => {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', data.username === username ? 'current-user' : 'other-user');
    messageDiv.innerHTML = `${data.username}: ${data.message}`;

    document.getElementById('messages').appendChild(messageDiv);
    document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
});

// Handle file uploads with chunking and real-time feedback
document.getElementById('uploadForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const file = document.getElementById('fileInput').files[0];

    if (!file) return; // No file selected

    const CHUNK_SIZE = 1024 * 1024; // 1MB per chunk
    let start = 0;
    let uploaded = 0; // Track uploaded data

    const reader = new FileReader();

    while (start < file.size) {
        const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('fileName', file.name);
        formData.append('chunkNumber', start / CHUNK_SIZE);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                uploaded += chunk.size; // Update uploaded data
                const percentage = Math.round((uploaded / file.size) * 100);

                // Emit real-time upload progress to the server and clients
                socket.emit('uploadProgress', { fileName: file.name, percentage });

                document.getElementById('uploadPercentage').textContent = percentage + '%';
                document.getElementById('uploadProgressBar').style.width = percentage + '%';
            } else {
                throw new Error('Server error during upload');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload file: ' + error.message);
            break; // Exit the loop on failure
        }

        start += CHUNK_SIZE;
    }

    if (uploaded === file.size) {
        alert('File uploaded successfully!');
        socket.emit('fileUploaded', file.name); // Notify server of file upload
        previewFile(file); // Preview file after successful upload
    }
});

// Preview file inside the chat box
function previewFile(file) {
    const fileDiv = document.createElement('div');
    fileDiv.classList.add('file-preview-message', 'current-user');

    if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.classList.add('file-preview');
        fileDiv.appendChild(img);
    } else {
        const fileLink = document.createElement('a');
        fileLink.href = `/download/${file.name}`;
        fileLink.innerText = file.name;
        fileLink.download = file.name;

        const fileIcon = document.createElement('i');
        fileIcon.classList.add('fa', 'fa-file'); // Use a file icon for non-images
        fileDiv.appendChild(fileIcon);
        fileDiv.appendChild(fileLink);
    }

    document.getElementById('filePreviews').appendChild(fileDiv);
}

// Fetch uploaded files every 2 seconds
async function fetchUploadedFiles() {
    try {
        const response = await fetch('/uploads');
        const files = await response.json();

        document.getElementById('filePreviews').innerHTML = ''; // Clear only file previews

        files.forEach(file => {
            const fileDiv = document.createElement('div');
            fileDiv.classList.add('file-preview-message', 'other-user');

            const fileLink = document.createElement('a');
            fileLink.href = `/download/${file}`;
            fileLink.innerText = file;
            fileLink.download = file;

            const fileIcon = document.createElement('i');
            fileIcon.classList.add('fa', 'fa-file'); // Use a file icon for non-images
            fileDiv.appendChild(fileIcon);
            fileDiv.appendChild(fileLink);

            document.getElementById('filePreviews').appendChild(fileDiv);
        });

    } catch (error) {
        console.error('Error fetching uploaded files:', error);
    }
}

// Fetch the uploaded files every 2 seconds
setInterval(fetchUploadedFiles, 2000);

// Clear all files
document.getElementById('clearUploads').addEventListener('click', async function () {
    const confirmed = confirm('Are you sure you want to delete all uploaded files?');
    if (confirmed) {
        try {
            const response = await fetch('/clearUploads', {
                method: 'DELETE'
            });
            if (response.ok) {
                alert('All uploaded files have been cleared!');
                document.getElementById('filePreviews').innerHTML = ''; // Clear the file previews area
            } else {
                throw new Error('Failed to clear files');
            }
        } catch (error) {
            console.error('Error clearing files:', error);
            alert('Error: ' + error.message);
        }
    }
});

// Socket.io events for real-time updates
socket.on('uploadProgress', (data) => {
    const uploadPercentageText = `${data.percentage}%`;
    document.getElementById('uploadPercentage').textContent = uploadPercentageText;
    document.getElementById('uploadProgressBar').style.width = data.percentage + '%';
});

// Handle file uploaded broadcast
socket.on('fileUploaded', (fileName) => {
    fetchUploadedFiles(); // Fetch the updated list of files or handle real-time update
});
