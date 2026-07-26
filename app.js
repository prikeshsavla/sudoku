// Generate and inject PWA Web App Manifest from a Blob
const manifestBlob = new Blob([JSON.stringify({
  name: "Sudoku Canvas Game",
  short_name: "Sudoku",
  start_url: "./",
  display: "standalone",
  background_color: "#0f172a",
  theme_color: "#0f172a",
  icons: [
    {src: "https://placehold.co/192x192/0f172a/6366f1?text=Sudoku", sizes: "192x192", type: "image/png"},
    {src: "https://placehold.co/512x512/0f172a/6366f1?text=Sudoku", sizes: "512x512", type: "image/png"}
  ]
})], {type: 'application/json'});
const manifestUrl = URL.createObjectURL(manifestBlob);
const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = manifestUrl;
document.head.appendChild(manifestLink);

// Register Service Worker directly
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker registered successfully!', reg))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

// Online/Offline status indicator logic
const updateOnlineStatus = () => {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = navigator.onLine ? '🟢 You are Online' : '🔴 You are Offline (serving from cache)';
  }
};

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// PWA Install Button logic
let deferredPrompt;
const installAppBtn = document.getElementById('installAppBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installAppBtn) {
    installAppBtn.classList.remove('hidden');
  }
});

if (installAppBtn) {
  installAppBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const {outcome} = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installAppBtn.classList.add('hidden');
      }
      deferredPrompt = null;
    }
  });
}

// Game Initialization
window.addEventListener('load', () => {
  window.sudokuGame = new SudokuCanvasGame();
});