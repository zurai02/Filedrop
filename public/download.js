function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const id = window.location.pathname.split('/').pop();
const fileCard = document.getElementById('fileCard');
const errorCard = document.getElementById('errorCard');

fetch(`/api/info/${id}`)
  .then((res) => {
    if (!res.ok) return res.json().then((d) => Promise.reject(d));
    return res.json();
  })
  .then((info) => {
    document.getElementById('fileName').textContent = info.originalName;
    document.getElementById('fileMeta').textContent =
      `${formatBytes(info.size)} · uploaded ${new Date(info.uploadedAt).toLocaleDateString()} · ${info.downloadCount} download(s)`;
    document.getElementById('downloadBtn').href = `/d/${id}`;
    document.getElementById('expiryNote').textContent =
      `Link expires ${new Date(info.expiresAt).toLocaleString()}`;
    fileCard.classList.remove('hidden');
  })
  .catch((err) => {
    document.getElementById('errorText').textContent = err.error || 'This link is invalid or has expired.';
    errorCard.classList.remove('hidden');
  });
