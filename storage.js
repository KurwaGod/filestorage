app.post('/upload', (req, res) => {
    upload.array('files')(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).send(`File too large. Maximum size: ${Math.round(MAX_FILE_SIZE/1024/1024)}MB`);
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).send('Too many files. Maximum: 10 files');
                }
            }
            return res.status(400).send(err.message);
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No files uploaded');
        }

        try {
            const uploadedFiles = req.files.map(file => {
                const fileInfo = {
                    filename: file.filename,
                    originalName: file.originalname,
                    size: file.size,
                    uploadDate: new Date().toISOString()
                };
                fileMetadata.set(file.filename, fileInfo);
                return fileInfo;
            });

            res.json(uploadedFiles);
        } catch (error) {
            console.error('Processing error:', error);
            res.status(500).send('Upload processing failed');
        }
    });
});

app.get('/files', async (req, res) => {
    try {
        const files = await fs.readdir(UPLOAD_DIR);
        const fileList = [];

        for (const filename of files) {
            try {
                const filepath = path.join(UPLOAD_DIR, filename);
                const stats = await fs.stat(filepath);
                const metadata = fileMetadata.get(filename) || {
                    filename: filename,
                    originalName: filename,
                    size: stats.size,
                    uploadDate: stats.birthtime.toISOString()
                };
                fileList.push(metadata);
            } catch (error) {
                console.error(`Error reading file ${filename}:`, error);
            }
        }

        fileList.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        resconst express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = parseInt(process.env.PORT) || 3000;
const UPLOAD_DIR = path.resolve('./uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024;

if (!fsSync.existsSync(UPLOAD_DIR)) {
    fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueName = `${Date.now()}-${uuidv4()}-${sanitized}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10
    },
    fileFilter: (req, file, cb) => {
        if (file.originalname.length > 255) {
            return cb(new Error('Filename too long'));
        }
        cb(null, true);
    }
});

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

let fileMetadata = new Map();

app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Local Cloud Storage</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;padding:20px}
.container{max-width:1200px;margin:0 auto;background:white;border-radius:15px;box-shadow:0 20px 40px rgba(0,0,0,0.1);overflow:hidden}
.header{background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);color:white;padding:30px;text-align:center}
.header h1{font-size:2.5rem;margin-bottom:10px;font-weight:700}
.content{padding:40px}
.upload-section{background:#f8f9fa;border-radius:10px;padding:30px;margin-bottom:40px;border:2px dashed #dee2e6;transition:all 0.3s ease}
.upload-section:hover{border-color:#4facfe;transform:translateY(-2px)}
.upload-form{display:flex;flex-direction:column;gap:20px;align-items:center}
.file-input-wrapper{position:relative;overflow:hidden;display:inline-block}
.file-input{position:absolute;left:-9999px}
.file-input-label{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:15px 30px;border-radius:50px;cursor:pointer;font-weight:600;transition:all 0.3s ease;display:inline-block}
.file-input-label:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(0,0,0,0.2)}
.upload-btn{background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);color:white;border:none;padding:15px 40px;border-radius:50px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.3s ease}
.upload-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 20px rgba(0,0,0,0.2)}
.upload-btn:disabled{opacity:0.6;cursor:not-allowed}
.files-section h2{margin-bottom:30px;color:#333;font-size:1.8rem}
.file-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.file-card{background:white;border-radius:10px;padding:20px;box-shadow:0 5px 15px rgba(0,0,0,0.08);transition:all 0.3s ease;border:1px solid #e9ecef}
.file-card:hover{transform:translateY(-5px);box-shadow:0 15px 30px rgba(0,0,0,0.15)}
.file-name{font-weight:600;margin-bottom:10px;color:#333;word-break:break-word}
.file-info{font-size:0.9rem;color:#666;margin-bottom:15px}
.file-actions{display:flex;gap:10px}
.btn{padding:8px 16px;border-radius:6px;text-decoration:none;font-size:0.9rem;font-weight:500;border:none;cursor:pointer;transition:all 0.3s ease}
.btn-download{background:#28a745;color:white}
.btn-download:hover{background:#218838}
.btn-delete{background:#dc3545;color:white}
.btn-delete:hover{background:#c82333}
.progress-bar{width:100%;height:6px;background:#e9ecef;border-radius:3px;overflow:hidden;margin-top:10px;display:none}
.progress-fill{height:100%;background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);width:0%;transition:width 0.3s ease}
.message{padding:15px;border-radius:8px;margin-bottom:20px;font-weight:500}
.message.success{background:#d4edda;color:#155724;border:1px solid #c3e6cb}
.message.error{background:#f8d7da;color:#721c24;border:1px solid #f5c6cb}
@media (max-width:768px){.content{padding:20px}.file-grid{grid-template-columns:1fr}.header h1{font-size:2rem}}
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>🌩️ Local Cloud Storage</h1>
<p>Upload, store, and access your files from any device</p>
</div>
<div class="content">
<div class="upload-section">
<form class="upload-form" onsubmit="uploadFile(event)">
<div class="file-input-wrapper">
<input type="file" id="fileInput" class="file-input" multiple>
<label for="fileInput" class="file-input-label">📁 Choose Files</label>
</div>
<div id="selectedFiles"></div>
<button type="submit" class="upload-btn" id="uploadBtn" disabled>⬆️ Upload Files</button>
<div class="progress-bar" id="progressBar">
<div class="progress-fill" id="progressFill"></div>
</div>
</form>
</div>
<div id="message"></div>
<div class="files-section">
<h2>📚 Your Files</h2>
<div class="file-grid" id="fileGrid"></div>
</div>
</div>
</div>
<script>
const fileInput=document.getElementById('fileInput');
const uploadBtn=document.getElementById('uploadBtn');
const selectedFiles=document.getElementById('selectedFiles');
const progressBar=document.getElementById('progressBar');
const progressFill=document.getElementById('progressFill');
const messageDiv=document.getElementById('message');
const fileGrid=document.getElementById('fileGrid');

fileInput.addEventListener('change',function(){
const files=Array.from(this.files);
uploadBtn.disabled=files.length===0;
if(files.length>0){
selectedFiles.innerHTML='<p><strong>Selected files:</strong> '+files.map(f=>f.name).join(', ')+'</p>';
}else{
selectedFiles.innerHTML='';
}
});

async function uploadFile(event){
event.preventDefault();
const files=fileInput.files;
if(files.length===0)return;
const formData=new FormData();
for(let file of files){
formData.append('files',file);
}
uploadBtn.disabled=true;
uploadBtn.textContent='⏳ Uploading...';
progressBar.style.display='block';
try{
const xhr=new XMLHttpRequest();
xhr.upload.addEventListener('progress',function(e){
if(e.lengthComputable){
const percentComplete=(e.loaded/e.total)*100;
progressFill.style.width=percentComplete+'%';
}
});
xhr.onload=function(){
if(xhr.status===200){
showMessage('Files uploaded successfully!','success');
fileInput.value='';
selectedFiles.innerHTML='';
loadFiles();
}else{
showMessage('Upload failed: '+xhr.responseText,'error');
}
uploadBtn.disabled=false;
uploadBtn.textContent='⬆️ Upload Files';
progressBar.style.display='none';
progressFill.style.width='0%';
};
xhr.onerror=function(){
showMessage('Upload failed: Network error','error');
uploadBtn.disabled=false;
uploadBtn.textContent='⬆️ Upload Files';
progressBar.style.display='none';
};
xhr.open('POST','/upload');
xhr.send(formData);
}catch(error){
showMessage('Upload failed: '+error.message,'error');
uploadBtn.disabled=false;
uploadBtn.textContent='⬆️ Upload Files';
progressBar.style.display='none';
}
}

async function loadFiles(){
try{
const response=await fetch('/files');
if(!response.ok)throw new Error('Failed to fetch files');
const files=await response.json();
if(files.length===0){
fileGrid.innerHTML='<p style="text-align:center;color:#666;grid-column:1/-1;">No files uploaded yet. Upload some files to get started!</p>';
return;
}
fileGrid.innerHTML=files.map(file=>`
<div class="file-card">
<div class="file-name">${escapeHtml(file.originalName)}</div>
<div class="file-info">
Size: ${formatFileSize(file.size)}<br>
Uploaded: ${new Date(file.uploadDate).toLocaleString()}
</div>
<div class="file-actions">
<a href="/download/${encodeURIComponent(file.filename)}" class="btn btn-download" target="_blank">⬇️ Download</a>
<button class="btn btn-delete" onclick="deleteFile('${escapeHtml(file.filename)}')">🗑️ Delete</button>
</div>
</div>
`).join('');
}catch(error){
showMessage('Failed to load files: '+error.message,'error');
}
}

async function deleteFile(filename){
if(!confirm('Are you sure you want to delete this file?'))return;
try{
const response=await fetch(`/delete/${encodeURIComponent(filename)}`,{
method:'DELETE'
});
if(response.ok){
showMessage('File deleted successfully!','success');
loadFiles();
}else{
const error=await response.text();
showMessage('Delete failed: '+error,'error');
}
}catch(error){
showMessage('Delete failed: '+error.message,'error');
}
}

function formatFileSize(bytes){
if(bytes===0)return '0 Bytes';
const k=1024;
const sizes=['Bytes','KB','MB','GB'];
const i=Math.floor(Math.log(bytes)/Math.log(k));
return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+' '+sizes[i];
}

function escapeHtml(text){
const div=document.createElement('div');
div.textContent=text;
return div.innerHTML;
}

function showMessage(text,type){
messageDiv.innerHTML=\`<div class="message \${type}">\${escapeHtml(text)}</div>\`;
setTimeout(()=>{
messageDiv.innerHTML='';
},5000);
}

loadFiles();
</script>
</body>
</html>`);
});

app.post('/upload', (req, res) => {
    upload.array('files')(req, res, (err) => {
        if (err) {
            console.error('Upload error:', err);
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).send(`File too large. Maximum size: ${Math.round(MAX_FILE_SIZE/1024/1024)}MB`);
                }
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).send('Too many files. Maximum: 10 files');
                }
            }
            return res.status(400).send(err.message);
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No files uploaded');
        }

        try {
            const uploadedFiles = req.files.map(file => {
                const fileInfo = {
                    filename: file.filename,
                    originalName: file.originalname,
                    size: file.size,
                    uploadDate: new Date().toISOString()
                };
                fileMetadata.set(file.filename, fileInfo);
                return fileInfo;
            });

            res.json(uploadedFiles);
        } catch (error) {
            console.error('Processing error:', error);
            res.status(500).send('Upload processing failed');
        }
    });
});

app.get('/files', async (req, res) => {
    try {
        const files = await fs.readdir(UPLOAD_DIR);
        const fileList = [];

        for (const filename of files) {
            try {
                const filepath = path.join(UPLOAD_DIR, filename);
                const stats = await fs.stat(filepath);
                const metadata = fileMetadata.get(filename) || {
                    filename: filename,
                    originalName: filename,
                    size: stats.size,
                    uploadDate: stats.birthtime.toISOString()
                };
                fileList.push(metadata);
            } catch (error) {
                console.error(`Error reading file ${filename}:`, error);
            }
        }

        fileList.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        res.json(fileList);
    } catch (error) {
        console.error('File listing error:', error);
        res.status(500).json({ error: 'Failed to read files' });
    }
});

app.get('/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).send('Invalid filename');
        }

        const filepath = path.join(UPLOAD_DIR, filename);
        const resolvedPath = path.resolve(filepath);
        const uploadDirPath = path.resolve(UPLOAD_DIR);

        if (!resolvedPath.startsWith(uploadDirPath)) {
            return res.status(403).send('Access denied');
        }

        if (!fsSync.existsSync(filepath)) {
            return res.status(404).send('File not found');
        }

        const metadata = fileMetadata.get(filename);
        const downloadName = metadata ? metadata.originalName : filename;

        res.download(filepath, downloadName, (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).send('Download failed');
                }
            }
        });
    } catch (error) {
        console.error('Download processing error:', error);
        res.status(500).send('Download failed');
    }
});

app.delete('/delete/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).send('Invalid filename');
        }

        const filepath = path.join(UPLOAD_DIR, filename);
        const resolvedPath = path.resolve(filepath);
        const uploadDirPath = path.resolve(UPLOAD_DIR);

        if (!resolvedPath.startsWith(uploadDirPath)) {
            return res.status(403).send('Access denied');
        }

        await fs.unlink(filepath);
        fileMetadata.delete(filename);

        res.send('File deleted successfully');
    } catch (error) {
        console.error('Delete error:', error);
        if (error.code === 'ENOENT') {
            res.status(404).send('File not found');
        } else {
            res.status(500).send('Delete failed');
        }
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
    res.status(404).send('Not found');
});

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal server error');
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Local Cloud Storage server running on port ${PORT}`);
    console.log(`Access from localhost: http://localhost:${PORT}`);
    console.log(`Upload directory: ${UPLOAD_DIR}`);
    console.log(`Max file size: ${Math.round(MAX_FILE_SIZE/1024/1024)}MB`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});
