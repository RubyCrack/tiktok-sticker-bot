const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.resolve(__dirname, '../graphify-out');

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.svg': 'image/svg+xml'
};

function resolveSafePublicFile(rawUrl, publicDir = PUBLIC_DIR) {
    let reqPath;
    try {
        reqPath = decodeURIComponent((rawUrl || '/').split('?')[0]);
    } catch (_) {
        return { status: 400, error: 'Bad Request' };
    }
    if (reqPath.includes('\0')) return { status: 403, error: 'Forbidden' };
    if (reqPath === '/' || reqPath === '') reqPath = '/architecture_graph.html';

    const candidate = path.resolve(publicDir, reqPath.replace(/^\/+/, ''));
    const rel = path.relative(publicDir, candidate);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        return { status: 403, error: 'Forbidden' };
    }

    try {
        const realPublic = fs.realpathSync(publicDir);
        const realFile = fs.realpathSync(candidate);
        const realRel = path.relative(realPublic, realFile);
        if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
            return { status: 403, error: 'Forbidden' };
        }
        return fs.statSync(realFile).isFile()
            ? { status: 200, filePath: realFile }
            : { status: 404, error: '404 Not Found' };
    } catch (_) {
        return { status: 404, error: '404 Not Found' };
    }
}

function createGraphServer(publicDir = PUBLIC_DIR) {
    return http.createServer((req, res) => {
        const resolved = resolveSafePublicFile(req.url, publicDir);
        if (resolved.status !== 200) {
            res.writeHead(resolved.status, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(resolved.error);
            return;
        }

        const ext = path.extname(resolved.filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(resolved.filePath);
        stream.on('error', () => {
            if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Internal Server Error');
        });
        stream.pipe(res);
    });
}

if (require.main === module) {
    const server = createGraphServer(PUBLIC_DIR);
    server.listen(PORT, '127.0.0.1', () => {
        console.log(`🌐 Servidor activo en http://127.0.0.1:${PORT}/`);
    });
}

module.exports = { createGraphServer, resolveSafePublicFile, PUBLIC_DIR };
