import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createServer } from 'node:http';

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 5500);
const rootDir = resolve(process.cwd());

const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
    '.xml': 'application/xml; charset=utf-8'
};

function sendNotFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
}

function sendServerError(res) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
}

function resolvePath(urlPath) {
    const pathname = decodeURIComponent((urlPath || '/').split('?')[0]);
    const trimmed = pathname.replace(/^\/+/, '');
    const normalizedPath = normalize(trimmed || 'index.html');
    let absolutePath = resolve(join(rootDir, normalizedPath));

    if (!absolutePath.startsWith(rootDir)) {
        return null;
    }

    if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
        absolutePath = resolve(join(absolutePath, 'index.html'));
    }

    return absolutePath;
}

const server = createServer((req, res) => {
    const filePath = resolvePath(req.url || '/');

    if (!filePath) {
        sendNotFound(res);
        return;
    }

    if (!existsSync(filePath)) {
        sendNotFound(res);
        return;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff'
    });

    const stream = createReadStream(filePath);
    stream.on('error', () => sendServerError(res));
    stream.pipe(res);
});

server.listen(port, host, () => {
    console.log(`Language Playground dev server running at http://${host}:${port}`);
});
