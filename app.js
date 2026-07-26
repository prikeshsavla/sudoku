// Register Service Worker if supported
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker registered successfully!', reg))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

// Optional UI status indicator
const updateOnlineStatus = () => {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = navigator.onLine ? '🟢 You are Online' : '🔴 You are Offline (serving from cache)';
  }
};

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();