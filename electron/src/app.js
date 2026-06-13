// ─── State ───────────────────────────────────────────────────────────────────
let connected = false;
let config = { host: '', port: '', pass: '' };
let pollInterval = null;
let banTarget = null;
let allPlayers = [];
let allResources = [];
const logs = [];

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiCall(path, method = 'GET', body = null) {
  const url = `http://${config.host}:${config.port}${path}`;
  const headers = { Authorization: `Bearer ${config.pass}` };
  try {
    const result = await window.electronAPI.request({ url, method, headers, body });
    return result;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── Connection ───────────────────────────────────────────────────────────────
document.getElementById('btn-connect').addEventListener('click', async () => {
  config.host = document.getElementById('inp-host').value.trim();
  config.port = document.getElementById('inp-port').value.trim();
  config.pass = document.getElementById('inp-pass').value.trim();

  if (!config.host || !config.port || !config.pass) {
    addLog('error', 'Заповніть всі поля підключення');
    return;
  }

  addLog('info', `Підключення до ${config.host}:${config.port}...`);
  const r = await apiCall('/api/auth', 'POST', { password: config.pass });

  if (r.ok && r.data?.success) {
    setConnected(true);
    addLog('join', 'Успішно підключено до сервера!');
    refreshAll();
    pollInterval = setInterval(refreshAll, 5000);
  } else {
    addLog('error', 'Помилка підключення: ' + (r.data?.error || r.error || 'Unknown'));
  }
});

document.getElementById('btn-disconnect').addEventListener('click', () => {
  setConnected(false);
  clearInterval(pollInterval);
  addLog('warn', 'Відключено від сервера');
});

function setConnected(state) {
  connected = state;
  document.getElementById('status-dot').className = 'dot ' + (state ? 'dot-green' : 'dot-red');
  document.getElementById('status-text').textContent = state ? 'Підключено' : 'Не підключено';
  document.getElementById('btn-connect').style.display = state ? 'none' : '';
  document.getElementById('btn-disconnect').style.display = state ? '' : 'none';
  document.getElementById('btn-broadcast').style.display = state ? '' : 'none';
}

// ─── Refresh ──────────────────────────────────────────────────────────────────
async function refreshAll() {
  await Promise.all([refreshServer(), refreshPlayers(), refreshResources()]);
}

async function refreshServer() {
  const r = await apiCall('/api/server');
  if (!r.ok || !r.data?.success) return;
  const d = r.data.data;
  document.getElementById('s-players').textContent = d.players + '/' + d.maxPlayers;
  document.getElementById('s-ping').textContent = d.ping + 'ms';
  document.getElementById('s-uptime').textContent = d.uptime;
  document.getElementById('s-name').textContent = d.name;
  renderStats(d);
}

async function refreshPlayers() {
  const r = await apiCall('/api/players');
  if (!r.ok || !r.data?.success) return;
  allPlayers = r.data.data;
  renderPlayers();
}

async function refreshResources() {
  const r = await apiCall('/api/resources');
  if (!r.ok || !r.data?.success) return;
  allResources = r.data.data;
  renderResources();
}

// ─── Players ──────────────────────────────────────────────────────────────────
function pingClass(p) {
  if (p < 60)  return 'ping-good';
  if (p < 120) return 'ping-ok';
  return 'ping-bad';
}

function renderPlayers() {
  const q = document.getElementById('player-search').value.toLowerCase();
  const list = allPlayers.filter(p => p.name.toLowerCase().includes(q));
  const tbody = document.getElementById('players-tbody');

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">${allPlayers.length ? 'Не знайдено' : 'Гравців немає'}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr>
      <td>
        <span style="display:inline-block;width:8px;height:8px;background:#4ade80;border-radius:50%;margin-right:8px;box-shadow:0 0 5px #4ade80"></span>
        <b>${esc(p.name)}</b>
        ${p.muted ? '<span class="badge" style="background:#92400e22;color:#fbbf24;border:1px solid #92400e55;margin-left:6px">MUTE</span>' : ''}
      </td>
      <td class="${pingClass(p.ping)}" style="font-family:monospace;font-weight:700">${p.ping}ms</td>
      <td style="color:var(--sub)">${p.score}</td>
      <td style="color:var(--sub);font-family:monospace">${p.time}</td>
      <td style="color:var(--dim)">${esc(p.account)}</td>
      <td style="text-align:right">
        <button class="btn" style="background:#92400e22;color:#fbbf24;border:1px solid #92400e55;padding:4px 10px;margin-right:4px" onclick="msgPlayer('${esc(p.name)}')">💬 PM</button>
        <button class="btn" style="background:#92400e22;color:#fb923c;border:1px solid #92400e55;padding:4px 10px;margin-right:4px" onclick="mutePlayer('${esc(p.name)}')">${p.muted ? '🔊' : '🔇'}</button>
        <button class="btn" style="background:#78350f22;color:#fb923c;border:1px solid #78350f55;padding:4px 10px;margin-right:4px" onclick="kickPlayer('${esc(p.name)}')">КІК</button>
        <button class="btn" style="background:#7f1d1d22;color:#f87171;border:1px solid #7f1d1d55;padding:4px 10px" onclick="openBan('${esc(p.name)}')">БАН</button>
      </td>
    </tr>
  `).join('');
}

document.getElementById('player-search').addEventListener('input', renderPlayers);

async function kickPlayer(name) {
  const r = await apiCall('/api/players/kick', 'POST', { name });
  if (r.data?.success) { addLog('warn', `Гравець ${name} кікнутий`); refreshPlayers(); }
  else addLog('error', r.data?.error || 'Помилка кіку');
}

async function mutePlayer(name) {
  const r = await apiCall('/api/players/mute', 'POST', { name });
  if (r.data?.success) { addLog('info', r.data.data.message + ': ' + name); refreshPlayers(); }
}

function openBan(name) {
  banTarget = name;
  document.getElementById('modal-player-name').textContent = 'Гравець: ' + name;
  document.getElementById('modal-reason').value = '';
  document.getElementById('modal-days').value = '1';
  document.getElementById('modal-overlay').classList.add('open');
}

async function msgPlayer(name) {
  const msg = prompt('Повідомлення для ' + name + ':');
  if (!msg) return;
  const r = await apiCall('/api/players/message', 'POST', { name, message: msg });
  if (r.data?.success) addLog('info', `PM надіслано ${name}: ${msg}`);
}

document.getElementById('modal-confirm').addEventListener('click', async () => {
  if (!banTarget) return;
  const reason = document.getElementById('modal-reason').value;
  const days   = parseInt(document.getElementById('modal-days').value) || 1;
  const r = await apiCall('/api/players/ban', 'POST', { name: banTarget, reason, days });
  if (r.data?.success) { addLog('warn', `Гравець ${banTarget} забанений на ${days} днів`); refreshPlayers(); }
  else addLog('error', r.data?.error || 'Помилка бану');
  document.getElementById('modal-overlay').classList.remove('open');
  banTarget = null;
});

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.remove('open');
  banTarget = null;
});

// ─── Resources ────────────────────────────────────────────────────────────────
function renderResources() {
  const q = document.getElementById('res-search').value.toLowerCase();
  const list = allResources.filter(r => r.name.toLowerCase().includes(q));
  const el = document.getElementById('resources-list');

  if (!list.length) { el.innerHTML = '<div class="empty">Ресурсів не знайдено</div>'; return; }

  el.innerHTML = list.map(r => {
    const on = r.status === 'running';
    return `
      <div class="res-card" style="margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="width:9px;height:9px;border-radius:50%;background:${on ? '#4ade80' : '#374151'};box-shadow:${on ? '0 0 6px #4ade8099' : 'none'};flex-shrink:0"></span>
          <span class="res-name">${esc(r.name)}</span>
          <span class="badge" style="background:${on ? '#14532d33' : '#37415133'};color:${on ? '#4ade80' : '#6b7280'};border:1px solid ${on ? '#14532d66' : '#37415166'}">${on ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
        <div class="res-actions">
          <button class="btn" style="background:#1d4ed822;color:#60a5fa;border:1px solid #1d4ed855;padding:5px 12px" onclick="restartRes('${esc(r.name)}')">↺ Рестарт</button>
          <button class="btn" style="background:${on ? '#7f1d1d22' : '#14532d22'};color:${on ? '#f87171' : '#4ade80'};border:1px solid ${on ? '#7f1d1d55' : '#14532d55'};padding:5px 12px" onclick="${on ? 'stopRes' : 'startRes'}('${esc(r.name)}')">${on ? '⏹ Стоп' : '▶ Старт'}</button>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('res-search').addEventListener('input', renderResources);

async function startRes(name) {
  const r = await apiCall('/api/resources/start', 'POST', { name });
  if (r.data?.success) { addLog('join', `Ресурс '${name}' запущено`); refreshResources(); }
}
async function stopRes(name) {
  const r = await apiCall('/api/resources/stop', 'POST', { name });
  if (r.data?.success) { addLog('warn', `Ресурс '${name}' зупинено`); refreshResources(); }
}
async function restartRes(name) {
  const r = await apiCall('/api/resources/restart', 'POST', { name });
  if (r.data?.success) { addLog('info', `Ресурс '${name}' перезапущено`); refreshResources(); }
}

// ─── Console ──────────────────────────────────────────────────────────────────
function addLog(type, text) {
  const t = new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logs.push({ type, text, time: t });
  const div = document.getElementById('console-log');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-time">[${t}]</span><span class="log-${type}">${esc(text)}</span>`;
  div.appendChild(line);
  div.scrollTop = div.scrollHeight;
}

document.getElementById('console-send').addEventListener('click', sendConsoleCmd);
document.getElementById('console-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendConsoleCmd(); });

async function sendConsoleCmd() {
  const inp = document.getElementById('console-input');
  const cmd = inp.value.trim();
  if (!cmd || !connected) return;
  addLog('cmd', '> ' + cmd);
  inp.value = '';
  const r = await apiCall('/api/console', 'POST', { command: cmd });
  if (!r.data?.success) addLog('error', r.data?.error || 'Помилка команди');
}

// ─── Broadcast ───────────────────────────────────────────────────────────────
document.getElementById('btn-broadcast').addEventListener('click', async () => {
  const msg = prompt('Повідомлення всім гравцям:');
  if (!msg) return;
  const r = await apiCall('/api/broadcast', 'POST', { message: msg });
  if (r.data?.success) addLog('info', 'Broadcast надіслано: ' + msg);
});

// ─── Stats panel ──────────────────────────────────────────────────────────────
function renderStats(d) {
  document.getElementById('stats-content').innerHTML = `
    <div style="display:grid;gap:10px;max-width:500px">
      ${[
        ['Назва сервера', d.name],
        ['Гравці', d.players + ' / ' + d.maxPlayers],
        ['Пінг сервера', d.ping + 'ms'],
        ['Аптайм', d.uptime],
        ['Порт', d.port],
        ['Версія MTA', d.version],
        ['Ігровий режим', d.gamemode],
      ].map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding:9px 0">
          <span style="color:var(--dim)">${k}</span>
          <span style="color:var(--text);font-family:'JetBrains Mono',monospace;font-weight:600">${v}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ─── Window controls ──────────────────────────────────────────────────────────
document.getElementById('btn-min').addEventListener('click',   () => window.electronAPI.minimize());
document.getElementById('btn-max').addEventListener('click',   () => window.electronAPI.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.electronAPI.close());

// ─── Utils ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Boot log
addLog('info', 'MTA Server Manager запущено');
addLog('info', 'Введіть IP, порт і пароль для підключення');
