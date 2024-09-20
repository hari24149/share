const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');   
// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Set up static files
app.use(express.static('public'));

// Handle chunk uploads using multer
const chunkUpload = multer().single('chunk');

// Append chunk data to the file
app.post('/upload', chunkUpload, (req, res) => {
    const fileName = req.body.fileName;
    const chunkNumber = req.body.chunkNumber;
    const filePath = path.join(__dirname, 'uploads', fileName);

    // Append the chunk to the file
    fs.appendFile(filePath, req.file.buffer, (err) => {
        if (err) {
            return res.status(500).send('Failed to upload chunk');
        }
        res.status(200).send('Chunk uploaded');
    });
});

// Endpoint to verify file integrity with checksum
app.post('/verifyChecksum', (req, res) => {
    const { fileName, checksum } = req.body;
    const filePath = path.join(__dirname, 'uploads', fileName);

    const fileStream = fs.createReadStream(filePath);
    const hash = crypto.createHash('sha256');

    fileStream.on('data', (data) => hash.update(data));
    fileStream.on('end', () => {
        const fileHash = hash.digest('hex');
        if (fileHash === checksum) {
            res.status(200).send('File verified successfully');
        } else {
            res.status(400).send('File integrity check failed');
        }
    });
});

// Serve uploaded files
app.get('/uploads', (req, res) => {
    fs.readdir('uploads', (err, files) => {
        if (err) {
            return res.status(500).send('Unable to scan files');
        }
        res.json(files);
    });
});




app.delete('/clearUploads', (req, res) => {
    const uploadDir = path.join(__dirname, 'uploads');

    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).send('Error reading upload directory');

        // Delete each file
        for (const file of files) {
            fs.unlink(path.join(uploadDir, file), err => {
                if (err) console.error(`Failed to delete file: ${file}`, err);
            });
        }

        return res.sendStatus(200); // Success
    });
});


app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    res.download(filePath);
});

// Delete a file
app.delete('/delete/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    fs.unlink(filePath, (err) => {
        if (err) {
            return res.status(500).send('Unable to delete file');
        }
        res.status(200).send();
    });
});

// WebSocket handling
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('chatMessage', (data) => {
        io.emit('chatMessage', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
