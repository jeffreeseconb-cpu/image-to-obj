const dropzone = document.getElementById('dropzone');
const imageInput = document.getElementById('imageInput');
const uploadPreview = document.getElementById('uploadPreview');
const uploadPreviewWrap = document.getElementById('uploadPreviewWrap');
const fileName = document.getElementById('fileName');
const convertBtn = document.getElementById('convertBtn');
const clearFileBtn = document.getElementById('clearFileBtn');
const progressText = document.getElementById('progressText');
const progressFill = document.getElementById('progressFill');
const resultsSection = document.getElementById('resultsSection');
const frontCanvas = document.getElementById('frontCanvas');
const backCanvas = document.getElementById('backCanvas');
const leftCanvas = document.getElementById('leftCanvas');
const rightCanvas = document.getElementById('rightCanvas');

const frontDownload = document.getElementById('frontDownload');
const backDownload = document.getElementById('backDownload');
const leftDownload = document.getElementById('leftDownload');
const rightDownload = document.getElementById('rightDownload');
const objDownload = document.getElementById('objDownload');
const zipDownload = document.getElementById('zipDownload');

let activeImage = null;
let imageUrl = '';
let currentObjText = '';
let currentViewData = null;

const pipelineSteps = [
  'Load image',
  'Generate 4-view T-pose',
  'Build OBJ mesh',
  'Download assets',
];

function setProgress(value) {
  const capped = Math.max(0, Math.min(100, value));
  progressFill.style.width = `${capped}%`;
  progressText.textContent = `${Math.round(capped)}%`;
}

function updatePipelineState(stageIndex) {
  const listItems = document.querySelectorAll('.pipeline-list li');
  listItems.forEach((item, index) => {
    item.classList.remove('active', 'done');
    if (index < stageIndex) {
      item.classList.add('done');
    } else if (index === stageIndex) {
      item.classList.add('active');
    }
  });
}

function attachFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    return;
  }

  if (imageUrl) {
    URL.revokeObjectURL(imageUrl);
  }

  imageUrl = URL.createObjectURL(file);
  activeImage = new Image();
  activeImage.onload = () => {
    uploadPreview.src = imageUrl;
    uploadPreviewWrap.classList.remove('hidden');
    fileName.textContent = file.name;
    convertBtn.disabled = false;
  };
  activeImage.src = imageUrl;
}

dropzone.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  attachFile(file);
});

clearFileBtn.addEventListener('click', () => {
  imageInput.value = '';
  if (imageUrl) {
    URL.revokeObjectURL(imageUrl);
    imageUrl = '';
  }
  activeImage = null;
  uploadPreview.src = '';
  uploadPreviewWrap.classList.add('hidden');
  fileName.textContent = 'No file selected';
  convertBtn.disabled = true;
  resultsSection.classList.add('hidden');
  setProgress(0);
  updatePipelineState(0);
});

function drawRoundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getBackgroundPalette() {
  return {
    bgA: '#0f1b2b',
    bgB: '#253a4d',
    accentA: '#8ef0d7',
    accentB: '#7c9cff',
    grid: 'rgba(255,255,255,0.08)'
  };
}

function renderTView(canvas, img, viewType) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const palette = getBackgroundPalette();

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, palette.bgA);
  bg.addColorStop(1, palette.bgB);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    const offset = (width / 8) * i;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(width, offset);
    ctx.stroke();
  }

  const torsoX = width * 0.33;
  const torsoY = height * 0.24;
  const torsoW = width * 0.34;
  const torsoH = height * 0.32;
  const headW = width * 0.18;
  const headH = height * 0.18;
  const armHalf = width * 0.18;
  const armThickness = width * 0.08;
  const legHeight = height * 0.28;

  ctx.fillStyle = 'rgba(10, 18, 30, 0.85)';
  drawRoundedRect(ctx, torsoX, torsoY, torsoW, torsoH, 20);
  ctx.fill();

  ctx.fillStyle = 'rgba(16, 22, 32, 0.92)';
  const headX = width * 0.41 - headW / 2;
  const headY = height * 0.08;
  drawRoundedRect(ctx, headX, headY, headW, headH, 26);
  ctx.fill();

  const mat = viewType === 'back' ? 'scale(-1, 1)' : viewType === 'left' ? 'scale(1,1)' : viewType === 'right' ? 'scale(-1,1)' : 'scale(1,1)';
  const isMirror = viewType === 'back' || viewType === 'right';

  const clampX = (sourceX, sourceY, sourceW, sourceH, targetX, targetY, targetW, targetH) => {
    ctx.save();
    if (isMirror) {
      ctx.translate(targetX + targetW, targetY);
      ctx.scale(-1, 1);
      ctx.drawImage(sourceX, sourceY, sourceW, sourceH, 0, 0, targetW, targetH);
    } else {
      ctx.drawImage(sourceX, sourceY, sourceW, sourceH, targetX, targetY, targetW, targetH);
    }
    ctx.restore();
  };

  const textureClipX = 0;
  const textureClipY = 0;
  const textureClipW = img.naturalWidth;
  const textureClipH = img.naturalHeight;

  const drawMappedTexture = (tx, ty, tw, th, x, y, w, h) => {
    if (isMirror) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      ctx.drawImage(img, tx, ty, tw, th, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(img, tx, ty, tw, th, x, y, w, h);
      ctx.restore();
    }
  };

  const textureX = (img.naturalWidth * 0.12);
  const textureY = (img.naturalHeight * 0.12);
  const textureW = img.naturalWidth * 0.76;
  const textureH = img.naturalHeight * 0.76;

  drawMappedTexture(textureX, textureY, textureW, textureH, torsoX + 8, torsoY + 8, torsoW - 16, torsoH - 10);
  drawMappedTexture(0, 0, img.naturalWidth, img.naturalHeight, headX + 8, headY + 8, headW - 16, headH - 12);

  drawRoundedRect(ctx, torsoX - armHalf, torsoY + 18, armHalf, armThickness, 16);
  ctx.fillStyle = 'rgba(12, 18, 30, 0.9)';
  ctx.fill();
  drawRoundedRect(ctx, torsoX + torsoW, torsoY + 18, armHalf, armThickness, 16);
  ctx.fill();

  drawRoundedRect(ctx, torsoX + torsoW * 0.28, torsoY + torsoH, armThickness * 0.7, legHeight, 18);
  ctx.fill();
  drawRoundedRect(ctx, torsoX + torsoW * 0.62, torsoY + torsoH, armThickness * 0.7, legHeight, 18);
  ctx.fill();

  if (viewType === 'front' || viewType === 'back') {
    ctx.strokeStyle = 'rgba(174, 215, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(torsoX + 4, torsoY + 4, torsoW - 8, torsoH - 8);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, height - 64, width, 64);
  ctx.fillStyle = '#dbeaff';
  ctx.font = '600 18px Inter';
  ctx.fillText(viewType.toUpperCase(), 22, height - 26);
}

function generateObjectString(img) {
  const targetWidth = 1.5;
  const targetHeight = 2.4;
  const targetDepth = 0.9;

  const scale = Math.max(0.7, (img.naturalWidth / img.naturalHeight) * 0.8);
  const width = targetWidth * scale;
  const height = targetHeight;
  const depth = targetDepth;

  const vertices = [];
  const faces = [];

  function addBox(x, y, z, sx, sy, sz, name) {
    const halfX = sx / 2;
    const halfY = sy / 2;
    const halfZ = sz / 2;

    const base = vertices.length;
    const points = [
      [x - halfX, y - halfY, z - halfZ],
      [x + halfX, y - halfY, z - halfZ],
      [x + halfX, y + halfY, z - halfZ],
      [x - halfX, y + halfY, z - halfZ],
      [x - halfX, y - halfY, z + halfZ],
      [x + halfX, y - halfY, z + halfZ],
      [x + halfX, y + halfY, z + halfZ],
      [x - halfX, y + halfY, z + halfZ],
    ];

    points.forEach(([vx, vy, vz]) => vertices.push({ x: vx, y: vy, z: vz }));

    const faceDefs = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ];

    faceDefs.forEach(([a, b, c, d]) => {
      faces.push([base + a, base + b, base + c, base + d, name]);
    });
  }

  const centerX = 0;
  const centerY = 0;
  const centerZ = 0;

  const headW = width * 0.34;
  const headH = height * 0.2;
  const headD = depth * 0.5;
  addBox(centerX, height * 0.18, centerZ, headW, headH, headD, 'head');

  const torsoW = width * 0.62;
  const torsoH = height * 0.42;
  const torsoD = depth * 0.66;
  addBox(centerX, 0, centerZ, torsoW, torsoH, torsoD, 'torso');

  const armLength = width * 0.8;
  const armW = width * 0.18;
  const armH = height * 0.13;
  const armD = depth * 0.32;
  addBox(centerX - armLength / 2, 0.15, centerZ, armW, armH, armD, 'left_arm');
  addBox(centerX + armLength / 2, 0.15, centerZ, armW, armH, armD, 'right_arm');

  const legW = width * 0.15;
  const legH = height * 0.46;
  const legD = depth * 0.34;
  addBox(centerX - width * 0.16, -height * 0.5, centerZ, legW, legH, legD, 'left_leg');
  addBox(centerX + width * 0.16, -height * 0.5, centerZ, legW, legH, legD, 'right_leg');

  const lines = ['# Image to OBJ model', 'o character_t_pose'];
  vertices.forEach((vertex) => {
    lines.push(`v ${vertex.x.toFixed(6)} ${vertex.y.toFixed(6)} ${vertex.z.toFixed(6)}`);
  });

  lines.push('s off');
  faces.forEach(([a, b, c, d, name]) => {
    lines.push(`f ${a + 1} ${b + 1} ${c + 1} ${d + 1}`);
  });

  return lines.join('\n');
}

function showResultSet(viewMap) {
  const canvasMap = {
    front: frontCanvas,
    back: backCanvas,
    left: leftCanvas,
    right: rightCanvas,
  };

  Object.entries(canvasMap).forEach(([key, canvas]) => {
    const ctx = canvas.getContext('2d');
    const source = viewMap[key];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const link = document.getElementById(`${key}Download`);
    link.href = canvas.toDataURL('image/png');
  });

  const objString = generateObjectString(activeImage);
  currentObjText = objString;
  const blob = new Blob([objString], { type: 'text/plain' });
  const objUri = URL.createObjectURL(blob);
  objDownload.href = objUri;

  const zipBlob = new Blob([objString], { type: 'application/octet-stream' });
  zipDownload.href = URL.createObjectURL(zipBlob);
  zipDownload.download = 'image-to-obj-assets.zip';

  resultsSection.classList.remove('hidden');
}

function processImage() {
  if (!activeImage) {
    return;
  }

  setProgress(10);
  updatePipelineState(1);

  const viewNames = ['front', 'back', 'left', 'right'];
  const viewMap = {};

  viewNames.forEach((viewName, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 820;
    const context = canvas.getContext('2d');
    renderTView(canvas, activeImage, viewName);
    viewMap[viewName] = canvas;

    const complete = ((index + 1) / viewNames.length) * 100;
    setProgress(15 + complete * 0.55);
  });

  setProgress(70);
  updatePipelineState(2);

  currentViewData = viewMap;
  showResultSet(viewMap);

  setTimeout(() => {
    setProgress(100);
    updatePipelineState(3);
  }, 200);
}

convertBtn.addEventListener('click', processImage);

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.style.borderColor = 'rgba(142, 240, 215, 0.9)';
});

dropzone.addEventListener('dragleave', () => {
  dropzone.style.borderColor = 'rgba(183, 206, 255, 0.42)';
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.style.borderColor = 'rgba(183, 206, 255, 0.42)';
  const file = event.dataTransfer.files[0];
  attachFile(file);
});

updatePipelineState(0);
setProgress(0);
