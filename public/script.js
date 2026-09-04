<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>DropLink — Share files instantly</title>
<link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div class="wrap">
    <header>
      <h1>DropLink</h1>
      <p class="tagline">Upload a file, get a link, share it anywhere.</p>
    </header>

    <div id="dropzone" class="dropzone">
      <input type="file" id="fileInput" hidden />
      <div class="dz-content">
        <div class="dz-icon">⇧</div>
        <p><strong>Click to choose a file</strong> or drag it here</p>
        <p class="dz-sub">Max file size: <span id="maxSize">1024</span>MB</p>
      </div>
    </div>

    <div class="options">
      <label for="expiry">Link expires after</label>
      <select id="expiry">
        <option value="24">1 day</option>
        <option value="168" selected>7 days</option>
        <option value="720">30 days</option>
      </select>
    </div>

    <div id="progressWrap" class="progress-wrap hidden">
      <div class="progress-bar"><div id="progressFill" class="progress-fill"></div></div>
      <p id="progressText">Uploading…</p>
    </div>

    <div id="result" class="result hidden">
      <p class="result-label">Your shareable link:</p>
      <div class="link-row">
        <input type="text" id="linkOutput" readonly />
        <button id="copyBtn">Copy</button>
      </div>
      <p id="resultMeta" class="result-meta"></p>
      <button id="uploadAnother" class="secondary">Upload another file</button>
    </div>

    <div id="errorBox" class="error hidden"></div>
  </div>

  <script src="/script.js"></script>
</body>
</html>
