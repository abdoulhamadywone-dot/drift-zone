// Drift Zone — petit serveur local (Node.js, aucune dépendance)
// Usage : node serveur.js            -> ouvre le jeu
//         node serveur.js --emulateur -> ouvre l'émulateur mobile
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push('http://' + a.address + ':' + PORT + '/');
    }
  }
  return out;
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (urlPath === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ port: PORT, lan: lanUrls() }));
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('Interdit'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Introuvable'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.log('\n  Le port ' + PORT + ' est déjà utilisé : Drift Zone tourne sans doute déjà.');
    openPage();
    setTimeout(() => process.exit(0), 1500);
  } else { console.error(e); process.exit(1); }
});

function openPage() {
  const page = process.argv.includes('--emulateur') ? 'emulateur.html' : 'index.html';
  const url = 'http://localhost:' + PORT + '/' + page;
  if (process.argv.includes('--sans-navigateur')) return;
  // Chrome / Edge avec la musique autorisée dès le lancement (sinon le navigateur attend un clic ;
  // une manette seule ne suffit pas à débloquer le son)
  if (process.platform === 'win32') {
    const E = process.env, cands = [
      [E['ProgramFiles'], 'Google\\Chrome\\Application\\chrome.exe'], [E['ProgramFiles(x86)'], 'Google\\Chrome\\Application\\chrome.exe'], [E['LOCALAPPDATA'], 'Google\\Chrome\\Application\\chrome.exe'],
      [E['ProgramFiles(x86)'], 'Microsoft\\Edge\\Application\\msedge.exe'], [E['ProgramFiles'], 'Microsoft\\Edge\\Application\\msedge.exe']
    ].filter(c => c[0]).map(c => path.join(c[0], c[1]));
    const exe = cands.find(f => { try { return fs.existsSync(f); } catch (e) { return false; } });
    if (exe) {
      try { spawn(exe, ['--autoplay-policy=no-user-gesture-required', url], { detached: true, stdio: 'ignore' }).unref(); return; } catch (e) {}
    }
  }
  const cmd = process.platform === 'win32' ? 'start "" "' + url + '"' : process.platform === 'darwin' ? 'open "' + url + '"' : 'xdg-open "' + url + '"';
  exec(cmd);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ==============================================');
  console.log('   DRIFT ZONE est lancé !');
  console.log('  ==============================================');
  console.log('   Sur ce PC        : http://localhost:' + PORT + '/');
  console.log('   Émulateur mobile : http://localhost:' + PORT + '/emulateur.html');
  const lan = lanUrls();
  if (lan.length) {
    console.log('\n   Sur ton téléphone (même Wi-Fi que ce PC) :');
    for (const u of lan) console.log('     ' + u);
  }
  console.log('\n   Laisse cette fenêtre ouverte pendant que tu joues.');
  console.log('   Ferme-la pour arrêter le jeu.\n');
  openPage();
});
