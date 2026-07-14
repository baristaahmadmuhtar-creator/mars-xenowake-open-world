import './styles.css';
import { XenowakeGame, type HudState, type WinStats } from './game/XenowakeGame';
import { gameStorage, type Quality } from './game/storage';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) throw new Error('App root tidak ditemukan.');

app.innerHTML = `
  <main id="game-shell" class="game-shell" aria-label="Mars: Xenowake">
    <canvas id="game-canvas" aria-label="Dunia 3D Mars"></canvas>
    <div class="atmosphere" aria-hidden="true"></div>
    <div id="look-zone" class="look-zone" aria-label="Area kendali kamera"></div>

    <section id="menu-screen" class="screen menu-screen" aria-labelledby="game-title">
      <div class="menu-key-art" aria-hidden="true"></div>
      <div class="menu-vignette" aria-hidden="true"></div>
      <header class="menu-header">
        <a class="wordmark" href="#game-title" aria-label="Mars Xenowake">
          <span class="wordmark-mark">MX</span>
          <span>Xenological recovery unit</span>
        </a>
        <button id="briefing-button" class="text-button" type="button">Briefing</button>
      </header>
      <div class="menu-copy">
        <p class="eyebrow"><span>Sol 214</span> / sinyal kehidupan terdeteksi</p>
        <h1 id="game-title"><span>Mars:</span> Xenowake</h1>
        <p class="menu-lede">Bangunkan tiga menara. Hindari penjaga. Buka jalan pulang.</p>
        <div class="menu-actions">
          <button id="start-button" class="primary-button" type="button">
            <span>Mulai ekspedisi</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M14 7l5 5-5 5" /></svg>
          </button>
          <p><strong>5–10 menit</strong><span>Touch / keyboard</span></p>
        </div>
      </div>
      <div class="menu-coordinates" aria-hidden="true">
        <span>14.6°S</span><i></i><span>175.4°E</span>
      </div>
      <p class="menu-footnote">Audio dimulai setelah sentuhan pertama · offline-ready setelah kunjungan pertama</p>
    </section>

    <section id="loading-screen" class="screen loading-screen" hidden aria-live="polite">
      <div class="loading-copy">
        <p>Menyelaraskan kesadaran</p>
        <div class="loading-line"><i></i></div>
        <span>Merakit PBR asset pack / 10 GLB</span>
      </div>
    </section>

    <section id="briefing-screen" class="screen briefing-screen" hidden aria-labelledby="briefing-title">
      <button id="briefing-close" class="close-button" type="button" aria-label="Tutup briefing">×</button>
      <div class="briefing-content">
        <p class="eyebrow">Catatan kebangkitan / NIX–07</p>
        <h2 id="briefing-title">Mars mengingat<br />sesuatu yang bukan miliknya.</h2>
        <div class="briefing-sequence">
          <div><span>01</span><p><strong>Serap Xenite</strong>Kristal cyan memberi daya pada jaringan.</p></div>
          <div><span>02</span><p><strong>Aktifkan 3 menara</strong>Urutan bebas. Setiap sinyal membangunkan penjaga baru.</p></div>
          <div><span>03</span><p><strong>Kembali ke cincin</strong>Portal di lokasi jatuh terbuka setelah jaringan lengkap.</p></div>
        </div>
        <p class="desktop-controls">WASD bergerak · drag melihat · Space pulse · Shift dash · E interaksi / dialog ARI</p>
      </div>
    </section>

    <section id="hud" class="hud" hidden aria-label="Status ekspedisi">
      <div class="hud-top-left">
        <p class="hud-kicker">Misi aktif / Xenowake</p>
        <div class="objective-line">
          <span id="beacon-count">0 / 3</span>
          <p id="objective-label">Cari Xenite</p>
        </div>
        <div class="resource-line">
          <span class="xenite-symbol" aria-hidden="true"></span>
          <b id="xenite-count">0</b>
          <span>Xenite</span>
          <i></i>
          <div id="health-pips" class="health-pips" aria-label="Kesehatan 3 dari 3">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <div class="hud-heading" aria-hidden="true">
        <span id="heading-label">N</span>
        <i></i>
        <small id="mission-time">00:00</small>
      </div>

      <div class="hud-top-right">
        <div class="minimap-frame">
          <canvas id="minimap" width="256" height="256" aria-label="Peta area"></canvas>
          <span class="minimap-label">Valles / live</span>
        </div>
        <button id="pause-button" class="icon-button" type="button" aria-label="Jeda permainan">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12" /></svg>
        </button>
      </div>

      <div id="joystick-zone" class="joystick-zone" aria-label="Joystick bergerak">
        <span class="joystick-origin"><i id="joystick-knob"></i></span>
        <small>Bergerak</small>
      </div>

      <div class="action-cluster">
        <button id="dash-button" class="action-button action-button--dash" type="button" aria-label="Dash" aria-pressed="false">
          <span class="cooldown-sweep"></span>
          <svg viewBox="0 0 28 28" aria-hidden="true"><path d="m5 17 8-11-1 8h9L10 25l2-8H5Z" /></svg>
          <small>Dash</small>
        </button>
        <button id="pulse-button" class="action-button action-button--pulse" type="button" aria-label="Pulse" aria-pressed="false">
          <span class="cooldown-sweep"></span>
          <svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="4"/><circle cx="14" cy="14" r="9"/><path d="M14 1v4M14 23v4M1 14h4M23 14h4"/></svg>
          <small>Pulse</small>
        </button>
      </div>

      <button id="interact-button" class="interact-button" type="button" hidden aria-pressed="false">
        <kbd>E</kbd><span id="interact-label">Aktifkan menara</span>
      </button>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </section>

    <div id="damage-flash" class="damage-flash" aria-hidden="true"></div>
    <div id="respawn-overlay" class="respawn-overlay" hidden aria-live="assertive">
      <span>Kesadaran terputus</span><strong>Meregenerasi tubuh…</strong>
    </div>

    <section id="pause-screen" class="screen modal-screen" hidden aria-labelledby="pause-title">
      <div class="modal-index">MX / 04</div>
      <div class="modal-content">
        <p class="eyebrow">Transmisi ditahan</p>
        <h2 id="pause-title">Ekspedisi dijeda</h2>
        <button id="resume-button" class="primary-button" type="button"><span>Lanjutkan</span><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7V5Z"/></svg></button>
        <div class="setting-list">
          <button id="mute-button" type="button"><span>Audio</span><b>Aktif</b></button>
          <button id="quality-button" type="button"><span>Kualitas</span><b>High</b></button>
          <button id="restart-button" type="button"><span>Mulai ulang</span><b>Reset misi</b></button>
        </div>
      </div>
    </section>

    <section id="win-screen" class="screen win-screen" hidden aria-labelledby="win-title">
      <div class="win-radiance" aria-hidden="true"></div>
      <div class="win-content">
        <p class="eyebrow">Transmisi berhasil / 3 dari 3</p>
        <h2 id="win-title">Jalan pulang<br />telah terbuka.</h2>
        <div class="win-stats">
          <p><span>Waktu ekspedisi</span><strong id="win-time">00:00</strong></p>
          <p><span>Rekor terbaik</span><strong id="best-time">—</strong></p>
          <p><span>Xenite ditemukan</span><strong id="win-xenite">0</strong></p>
          <p><span>Kerusakan diterima</span><strong id="win-damage">0</strong></p>
        </div>
        <button id="replay-button" class="primary-button" type="button"><span>Ekspedisi baru</span><svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6"/></svg></button>
      </div>
    </section>

    <section id="unsupported-screen" class="screen unsupported-screen" hidden>
      <div>
        <p class="eyebrow">Perangkat tidak kompatibel</p>
        <h2>WebGL2 tidak tersedia.</h2>
        <p>Coba Safari atau Chrome versi terbaru, matikan mode hemat ekstrem, lalu muat ulang halaman.</p>
        <button class="primary-button" type="button" onclick="location.reload()"><span>Muat ulang</span></button>
      </div>
    </section>

    <div class="rotate-hint" aria-hidden="true">
      <svg viewBox="0 0 32 32"><rect x="9" y="4" width="14" height="24" rx="2"/><path d="M3 11a13 13 0 0 1 4-6M29 21a13 13 0 0 1-4 6M4 5h4v4M28 27h-4v-4"/></svg>
      <span>Putar ke landscape untuk pandangan lebih luas</span>
    </div>
  </main>
`;

const shell = getElement<HTMLElement>('game-shell');
const canvas = getElement<HTMLCanvasElement>('game-canvas');
const menuScreen = getElement<HTMLElement>('menu-screen');
const loadingScreen = getElement<HTMLElement>('loading-screen');
const briefingScreen = getElement<HTMLElement>('briefing-screen');
const hud = getElement<HTMLElement>('hud');
const pauseScreen = getElement<HTMLElement>('pause-screen');
const winScreen = getElement<HTMLElement>('win-screen');
const unsupportedScreen = getElement<HTMLElement>('unsupported-screen');
const respawnOverlay = getElement<HTMLElement>('respawn-overlay');
const interactButton = getElement<HTMLButtonElement>('interact-button');
const interactLabel = getElement<HTMLElement>('interact-label');
const toast = getElement<HTMLElement>('toast');
const minimap = getElement<HTMLCanvasElement>('minimap');
const minimapContext = minimap.getContext('2d');
const pulseButton = getElement<HTMLButtonElement>('pulse-button');
const dashButton = getElement<HTMLButtonElement>('dash-button');
const muteButton = getElement<HTMLButtonElement>('mute-button');
const qualityButton = getElement<HTMLButtonElement>('quality-button');

let storage = gameStorage.load();
let toastTimer = 0;
let respawnTimer = 0;
let tutorialTimers: number[] = [];
let gameStarted = false;

const callbacks = {
  onHud: updateHud,
  onToast: showToast,
  onInteract: (label: string | null, enabled: boolean): void => {
    interactButton.hidden = label === null;
    interactButton.disabled = !enabled;
    interactButton.classList.toggle('is-disabled', !enabled);
    if (label) interactLabel.textContent = label;
  },
  onDamage: (): void => {
    shell.classList.remove('is-damaged');
    void shell.offsetWidth;
    shell.classList.add('is-damaged');
    window.setTimeout(() => shell.classList.remove('is-damaged'), 420);
  },
  onRespawn: (): void => {
    window.clearTimeout(respawnTimer);
    respawnOverlay.hidden = false;
    shell.classList.add('is-respawning');
    respawnTimer = window.setTimeout(() => {
      respawnOverlay.hidden = true;
      shell.classList.remove('is-respawning');
    }, 1350);
  },
  onWin: showWin,
  onPauseRequest: showPause,
  onAutoQuality: (fps: number): void => {
    storage.settings = gameStorage.updateSettings({ quality: 'low' });
    syncSettingsUI();
    showToast(`Mode Low otomatis • performa ${Math.round(fps)} FPS`, 'warning');
  },
  onContextStatus: (status: 'lost' | 'restored'): void => {
    showPause();
    showToast(
      status === 'lost'
        ? 'Koneksi grafis terputus — status misi diamankan'
        : 'Koneksi grafis pulih — sentuh Lanjutkan',
      status === 'lost' ? 'warning' : 'success',
    );
  },
};

const game = new XenowakeGame(
  canvas,
  shell,
  callbacks,
  storage.settings.quality,
  storage.settings.muted,
);

if (!game.isSupported) {
  menuScreen.hidden = true;
  unsupportedScreen.hidden = false;
  shell.classList.add('is-unsupported');
}

syncSettingsUI();

getElement<HTMLButtonElement>('start-button').addEventListener('click', startExpedition);
getElement<HTMLButtonElement>('briefing-button').addEventListener('click', () => {
  briefingScreen.hidden = false;
  menuScreen.setAttribute('aria-hidden', 'true');
});
getElement<HTMLButtonElement>('briefing-close').addEventListener('click', closeBriefing);
briefingScreen.addEventListener('click', (event) => {
  if (event.target === briefingScreen) closeBriefing();
});
getElement<HTMLButtonElement>('pause-button').addEventListener('click', () => {
  game.setPaused(true);
  showPause();
});
getElement<HTMLButtonElement>('resume-button').addEventListener('click', resumeGame);
getElement<HTMLButtonElement>('restart-button').addEventListener('click', restartGame);
getElement<HTMLButtonElement>('replay-button').addEventListener('click', restartGame);

muteButton.addEventListener('click', () => {
  storage.settings = gameStorage.updateSettings({ muted: !storage.settings.muted });
  game.setMuted(storage.settings.muted);
  syncSettingsUI();
});

qualityButton.addEventListener('click', () => {
  const quality: Quality = storage.settings.quality === 'high' ? 'low' : 'high';
  storage.settings = gameStorage.updateSettings({ quality });
  game.setQuality(quality);
  syncSettingsUI();
  showToast(`Kualitas ${quality === 'high' ? 'High' : 'Low'} diterapkan`, 'normal');
});

window.addEventListener('pagehide', () => game.setPaused(true));
window.addEventListener('offline', () => showToast('Mode offline • dunia tetap tersimpan', 'warning'));
window.addEventListener('online', () => showToast('Koneksi pulih', 'success'));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, { once: true });
}

async function startExpedition(): Promise<void> {
  if (!game.isSupported) return;
  gameStarted = true;
  clearTutorialTimers();
  menuScreen.classList.add('is-departing');
  loadingScreen.hidden = false;
  void game.start();
  window.setTimeout(() => {
    menuScreen.hidden = true;
    menuScreen.classList.remove('is-departing');
    loadingScreen.hidden = true;
    hud.hidden = false;
    shell.classList.add('is-playing');
    scheduleTutorial();
  }, 720);
}

async function resumeGame(): Promise<void> {
  pauseScreen.hidden = true;
  shell.classList.remove('is-paused');
  await game.resume();
}

async function restartGame(): Promise<void> {
  clearTutorialTimers();
  pauseScreen.hidden = true;
  winScreen.hidden = true;
  respawnOverlay.hidden = true;
  shell.classList.remove('is-paused', 'is-won', 'is-respawning');
  hud.hidden = false;
  gameStarted = true;
  await game.start();
  scheduleTutorial();
}

function showPause(): void {
  if (!gameStarted || !winScreen.hidden) return;
  pauseScreen.hidden = false;
  shell.classList.add('is-paused');
}

function showWin(stats: WinStats): void {
  clearTutorialTimers();
  shell.classList.add('is-won');
  hud.hidden = true;
  winScreen.hidden = false;
  const bestTime = gameStorage.recordBestTime(stats.elapsedMs);
  storage = gameStorage.load();
  getElement<HTMLElement>('win-time').textContent = formatTime(stats.elapsedMs);
  getElement<HTMLElement>('best-time').textContent = bestTime === null ? '—' : formatTime(bestTime);
  getElement<HTMLElement>('win-xenite').textContent = String(stats.collected);
  getElement<HTMLElement>('win-damage').textContent = String(stats.damageTaken);
}

function closeBriefing(): void {
  briefingScreen.hidden = true;
  menuScreen.removeAttribute('aria-hidden');
  getElement<HTMLButtonElement>('briefing-button').focus();
}

function updateHud(state: HudState): void {
  getElement<HTMLElement>('beacon-count').textContent = `${state.beacons} / 3`;
  getElement<HTMLElement>('objective-label').textContent = state.objectiveLabel;
  getElement<HTMLElement>('xenite-count').textContent = String(state.xenite);
  getElement<HTMLElement>('mission-time').textContent = formatTime(state.elapsedMs);
  const pips = Array.from(getElement<HTMLElement>('health-pips').children);
  pips.forEach((pip, index) => pip.classList.toggle('is-empty', index >= state.health));
  getElement<HTMLElement>('health-pips').setAttribute('aria-label', `Kesehatan ${state.health} dari 3`);

  pulseButton.style.setProperty('--cooldown', `${Math.round(state.pulseRemaining * 360)}deg`);
  dashButton.style.setProperty('--cooldown', `${Math.round(state.dashRemaining * 360)}deg`);
  pulseButton.classList.toggle('is-cooling', state.pulseRemaining > 0.01);
  dashButton.classList.toggle('is-cooling', state.dashRemaining > 0.01);
  getElement<HTMLElement>('heading-label').textContent = cardinalDirection(state.playerHeading);
  drawMinimap(state);
}

function drawMinimap(state: HudState): void {
  const context = minimapContext;
  if (!context) return;
  const size = minimap.width;
  const center = size / 2;
  const radius = size * 0.43;
  const mapScale = radius / 88;
  context.clearRect(0, 0, size, size);

  const gradient = context.createRadialGradient(center, center, 8, center, center, radius);
  gradient.addColorStop(0, 'rgba(18, 19, 19, .64)');
  gradient.addColorStop(0.74, 'rgba(29, 20, 18, .72)');
  gradient.addColorStop(1, 'rgba(62, 27, 21, .06)');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(151, 218, 207, .18)';
  context.lineWidth = 1.5;
  context.stroke();

  context.save();
  context.beginPath();
  context.arc(center, center, radius - 2, 0, Math.PI * 2);
  context.clip();
  context.strokeStyle = 'rgba(255, 255, 255, .055)';
  context.lineWidth = 1;
  for (let step = -60; step <= 60; step += 30) {
    context.beginPath();
    context.moveTo(center + step * mapScale, center - radius);
    context.lineTo(center + step * mapScale, center + radius);
    context.stroke();
    context.beginPath();
    context.moveTo(center - radius, center + step * mapScale);
    context.lineTo(center + radius, center + step * mapScale);
    context.stroke();
  }

  for (const objective of state.objectives) {
    const x = center + objective.x * mapScale;
    const y = center + objective.z * mapScale;
    context.strokeStyle = objective.active ? '#7dfff2' : 'rgba(171, 241, 231, .72)';
    context.fillStyle = objective.active ? 'rgba(70, 246, 230, .32)' : 'rgba(70, 246, 230, .08)';
    context.lineWidth = objective.active ? 4 : 2;
    context.beginPath();
    context.arc(x, y, objective.active ? 8 : 6, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  if (state.portalActive) {
    context.strokeStyle = '#d7fff8';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(center, center + 8 * mapScale, 10, 0, Math.PI * 2);
    context.stroke();
  }

  for (const drone of state.drones) {
    context.fillStyle = drone.alert ? '#ff674b' : 'rgba(255, 119, 90, .56)';
    context.beginPath();
    context.arc(center + drone.x * mapScale, center + drone.z * mapScale, drone.alert ? 5 : 3, 0, Math.PI * 2);
    context.fill();
  }

  const px = center + state.playerX * mapScale;
  const py = center + state.playerZ * mapScale;
  context.translate(px, py);
  context.rotate(-state.playerHeading);
  context.fillStyle = '#f4fffd';
  context.shadowColor = '#46f6e6';
  context.shadowBlur = 12;
  context.beginPath();
  context.moveTo(0, -9);
  context.lineTo(6, 7);
  context.lineTo(0, 4);
  context.lineTo(-6, 7);
  context.closePath();
  context.fill();
  context.restore();
}

function showToast(message: string, tone: 'normal' | 'warning' | 'success' = 'normal'): void {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.remove('is-visible');
  void toast.offsetWidth;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
}

function scheduleTutorial(): void {
  clearTutorialTimers();
  tutorialTimers = [
    window.setTimeout(() => showToast('Joystick kiri untuk bergerak', 'normal'), 900),
    window.setTimeout(() => showToast('Geser sisi kanan untuk melihat', 'normal'), 4300),
    window.setTimeout(() => showToast('Dekati kristal cyan, lalu aktifkan menara', 'normal'), 7900),
  ];
}

function clearTutorialTimers(): void {
  tutorialTimers.forEach((timer) => window.clearTimeout(timer));
  tutorialTimers = [];
}

function syncSettingsUI(): void {
  muteButton.querySelector('b')!.textContent = storage.settings.muted ? 'Nonaktif' : 'Aktif';
  muteButton.setAttribute('aria-pressed', String(storage.settings.muted));
  qualityButton.querySelector('b')!.textContent = storage.settings.quality === 'high' ? 'High' : 'Low';
  qualityButton.setAttribute('aria-pressed', String(storage.settings.quality === 'high'));
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function cardinalDirection(heading: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const normalized = ((heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return directions[Math.round(normalized / (Math.PI / 4)) % directions.length];
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemen #${id} tidak ditemukan.`);
  return element as T;
}
