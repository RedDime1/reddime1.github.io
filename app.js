const STORAGE_KEY = "dk-portfolio-achievements-v1";
const ACHIEVEMENT_NAMES = {
  photo: "Скрытая личность",
  space: "Астролог-аналитик",
  beaver: "Укротитель бобров"
};

function loadAchievements() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Object.fromEntries(Object.keys(ACHIEVEMENT_NAMES).map(key => [key, saved[key] === true]));
  } catch {
    return { photo: false, space: false, beaver: false };
  }
}

let achievements = loadAchievements();
let toastTimer = null;

function saveAchievements() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(achievements));
  } catch {
    document.getElementById("header-progress").title = "Сохранение недоступно в этом браузере";
  }
}

function renderAchievements() {
  const count = Object.values(achievements).filter(Boolean).length;
  document.getElementById("header-stars").textContent = Object.keys(ACHIEVEMENT_NAMES).map(key => achievements[key] ? "★" : "☆").join("");
  document.getElementById("header-progress").textContent = `${count} / 3`;
  document.getElementById("achievement-number").innerHTML = `${count} <small>/ 3</small>`;
  document.getElementById("achievement-progress-fill").style.width = `${count / 3 * 100}%`;
  Object.keys(ACHIEVEMENT_NAMES).forEach(key => {
    const card = document.getElementById(`achievement-${key}`);
    card.classList.toggle("is-unlocked", achievements[key]);
    card.querySelector(".achievement-status").textContent = achievements[key] ? "✓ Получено" : "Не получено";
  });
  document.getElementById("final-unlock").hidden = count !== 3;
}

function unlockAchievement(key) {
  if (!Object.hasOwn(ACHIEVEMENT_NAMES, key) || achievements[key]) return;
  achievements[key] = true;
  saveAchievements();
  renderAchievements();
  const toast = document.getElementById("achievement-toast");
  document.getElementById("toast-title").textContent = ACHIEVEMENT_NAMES[key];
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 4200);
}

const photoShell = document.getElementById("portrait-shell");
const photoCanvas = document.getElementById("scratch-canvas");
const photoCtx = photoCanvas.getContext("2d", { willReadFrequently: true });
const scratchCoin = document.getElementById("scratch-coin");
const scratchInstruction = document.getElementById("scratch-instruction");
const scratchProgressFill = document.getElementById("scratch-progress-fill");
let photoWidth = 0;
let photoHeight = 0;
let photoDpr = 1;
let scratchStrokeCount = 0;
let coinTapCount = 0;
let coinDrag = null;
let lastScratch = null;
let lastPhotoCheck = 0;

function paintPhotoCover() {
  if (achievements.photo) {
    showRevealedPhoto();
    return;
  }
  const rect = photoShell.getBoundingClientRect();
  photoWidth = rect.width;
  photoHeight = rect.height;
  if (photoWidth < 1 || photoHeight < 1) return;
  photoDpr = Math.min(window.devicePixelRatio || 1, 2);
  photoCanvas.width = Math.round(photoWidth * photoDpr);
  photoCanvas.height = Math.round(photoHeight * photoDpr);
  photoCtx.setTransform(photoDpr, 0, 0, photoDpr, 0, 0);
  photoCtx.globalCompositeOperation = "source-over";
  const gradient = photoCtx.createLinearGradient(0, 0, photoWidth, photoHeight);
  gradient.addColorStop(0, "#aeb5c1");
  gradient.addColorStop(.45, "#d0d3d7");
  gradient.addColorStop(1, "#8994a4");
  photoCtx.fillStyle = gradient;
  photoCtx.fillRect(0, 0, photoWidth, photoHeight);
  photoCtx.lineWidth = 1;
  photoCtx.strokeStyle = "rgba(255,255,255,.11)";
  for (let x = -photoHeight; x < photoWidth + photoHeight; x += 12) {
    photoCtx.beginPath();
    photoCtx.moveTo(x, 0);
    photoCtx.lineTo(x + photoHeight, photoHeight);
    photoCtx.stroke();
  }
  photoCtx.fillStyle = "#535e71";
  photoCtx.textAlign = "center";
  photoCtx.font = `700 ${Math.max(12, photoWidth * .041)}px monospace`;
  photoCtx.fillText("ЛИЧНОСТЬ ЗАСЕКРЕЧЕНА", photoWidth / 2, photoHeight / 2 - 13);
  photoCtx.font = `500 ${Math.max(11, photoWidth * .03)}px monospace`;
  photoCtx.fillText("ЗАЩИТНЫЙ СЛОЙ / СТЕРЕТЬ", photoWidth / 2, photoHeight / 2 + 18);
  scratchProgressFill.style.width = "0%";
  scratchStrokeCount = 0;
  coinTapCount = 0;
}

function showRevealedPhoto() {
  photoCanvas.classList.add("revealed");
  document.getElementById("photo-unlocked").hidden = false;
  scratchInstruction.textContent = "Фотография открыта. Звезда получена!";
  scratchProgressFill.style.width = "100%";
  scratchCoin.disabled = true;
  scratchCoin.style.opacity = ".58";
}

function scratchAt(clientX, clientY) {
  if (achievements.photo || photoWidth < 1) return false;
  const rect = photoCanvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    lastScratch = null;
    return false;
  }
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const brush = Math.max(42, photoWidth * .13);
  photoCtx.globalCompositeOperation = "destination-out";
  photoCtx.strokeStyle = "#000";
  photoCtx.fillStyle = "#000";
  photoCtx.lineWidth = brush;
  photoCtx.lineCap = "round";
  photoCtx.lineJoin = "round";
  photoCtx.beginPath();
  if (lastScratch) {
    photoCtx.moveTo(lastScratch.x, lastScratch.y);
    photoCtx.lineTo(x, y);
    photoCtx.stroke();
  } else {
    photoCtx.arc(x, y, brush / 2, 0, Math.PI * 2);
    photoCtx.fill();
  }
  photoCtx.globalCompositeOperation = "source-over";
  lastScratch = { x, y };
  scratchStrokeCount++;
  if (performance.now() - lastPhotoCheck > 120 || scratchStrokeCount % 12 === 0) {
    lastPhotoCheck = performance.now();
    checkPhotoCoverage();
  }
  return true;
}

function checkPhotoCoverage() {
  if (achievements.photo || photoCanvas.width === 0) return;
  const { data, width } = photoCtx.getImageData(0, 0, photoCanvas.width, photoCanvas.height);
  let cleared = 0;
  let total = 0;
  const step = Math.max(7, Math.round(11 * photoDpr));
  for (let y = Math.floor(step / 2); y < photoCanvas.height; y += step) {
    for (let x = Math.floor(step / 2); x < photoCanvas.width; x += step) {
      if (data[(y * width + x) * 4 + 3] < 60) cleared++;
      total++;
    }
  }
  const ratio = total ? cleared / total : 0;
  scratchProgressFill.style.width = `${Math.round(ratio * 100)}%`;
  if (ratio >= .52) {
    unlockAchievement("photo");
    showRevealedPhoto();
  }
}

function coinKeyboardScratch() {
  if (achievements.photo || photoWidth <= 0) return;
  const row = coinTapCount % 6;
  coinTapCount++;
  const y = photoHeight * (.1 + row * .16);
  const rect = photoCanvas.getBoundingClientRect();
  lastScratch = null;
  for (let col = 0; col <= 14; col++) {
    const x = photoWidth * (.06 + col / 14 * .88);
    scratchAt(rect.left + x, rect.top + y);
  }
  lastScratch = null;
  checkPhotoCoverage();
}

scratchCoin.addEventListener("pointerdown", event => {
  if (achievements.photo) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  scratchCoin.setPointerCapture(event.pointerId);
  coinDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  lastScratch = null;
  scratchCoin.classList.add("coin-moving");
});

scratchCoin.addEventListener("pointermove", event => {
  if (!coinDrag || event.pointerId !== coinDrag.id || achievements.photo) return;
  const dx = event.clientX - coinDrag.x;
  const dy = event.clientY - coinDrag.y;
  if (Math.hypot(dx, dy) > 5) coinDrag.moved = true;
  scratchCoin.style.transform = `translate(${dx}px, ${dy}px)`;
  scratchAt(event.clientX, event.clientY);
});

function finishCoinDrag(event) {
  if (!coinDrag || event.pointerId !== coinDrag.id) return;
  if (!coinDrag.moved) coinKeyboardScratch();
  checkPhotoCoverage();
  scratchCoin.classList.remove("coin-moving");
  scratchCoin.style.transform = "";
  coinDrag = null;
  lastScratch = null;
}

scratchCoin.addEventListener("pointerup", finishCoinDrag);
scratchCoin.addEventListener("pointercancel", finishCoinDrag);
scratchCoin.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && !achievements.photo) {
    event.preventDefault();
    coinKeyboardScratch();
  }
});

function generateDataset() {
  const rows = [];
  for (let i = 0; i < 20; i++) {
    const group = Math.floor(i / 5);
    const angle = i * 2.3999632297;
    const r = .35 + (i % 5) * .21;
    const x = [-1.7, 1.35, -1.25, 1.5][group] + r * Math.cos(angle);
    const y = [-1.15, -1.25, 1.55, 1.3][group] + r * Math.sin(angle);
    const value = [
      5 + 1.2 * x + .12 * Math.sin(i * 4.1),
      6 + 1.1 * y + .15 * Math.cos(i * 2.1),
      3 + .65 * x - .4 * y + .12 * Math.sin(i * 1.3),
      7 - .45 * x + .85 * y + .1 * Math.cos(i * 3.7),
      4 + .3 * x + .47 * y + .21 * Math.sin(i * 1.9),
      3 + .92 * x - .2 * y + .12 * Math.cos(i * 2.7),
      6 - .75 * x - .34 * y + .14 * Math.sin(i * .7),
      5 + .42 * x + .58 * y + .22 * Math.cos(i * 1.4)
    ];
    rows.push({ id: i + 1, group, values: value });
  }
  return rows;
}

const dataset = generateDataset();
const tableBody = document.getElementById("data-table-body");
let selectedPoint = null;

function populateDataTable() {
  const fragment = document.createDocumentFragment();
  dataset.forEach(row => {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.setAttribute("aria-label", `Выбрать объект ${row.id}`);
    const cells = [String(row.id).padStart(2, "0"), ...row.values.map(v => v.toFixed(2))];
    cells.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    const select = () => {
      selectedPoint = row.id;
      Array.from(tableBody.children).forEach((el, index) => el.classList.toggle("selected", index === row.id - 1));
      renderChart();
    };
    tr.addEventListener("click", select);
    tr.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
    fragment.appendChild(tr);
  });
  tableBody.appendChild(fragment);
}

function classicalMDS(rows) {
  const n = rows.length;
  const features = rows[0].values.length;
  const means = Array.from({ length: features }, (_, j) => rows.reduce((sum, row) => sum + row.values[j], 0) / n);
  const scales = means.map((mean, j) => Math.sqrt(rows.reduce((sum, row) => sum + (row.values[j] - mean) ** 2, 0) / n) || 1);
  const standardized = rows.map(row => row.values.map((value, j) => (value - means[j]) / scales[j]));
  const distancesSquared = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sum = standardized[i].reduce((total, value, k) => total + (value - standardized[j][k]) ** 2, 0);
      distancesSquared[i][j] = sum;
      distancesSquared[j][i] = sum;
    }
  }
  const rowMeans = distancesSquared.map(row => row.reduce((a, b) => a + b, 0) / n);
  const grandMean = rowMeans.reduce((a, b) => a + b, 0) / n;
  const B = distancesSquared.map((row, i) => row.map((value, j) => -.5 * (value - rowMeans[i] - rowMeans[j] + grandMean)));
  const eigenvectors = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Number(i === j)));
  for (let iteration = 0; iteration < 16000; iteration++) {
    let p = 0;
    let q = 1;
    let maximum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const abs = Math.abs(B[i][j]);
        if (abs > maximum) {
          maximum = abs;
          p = i;
          q = j;
        }
      }
    }
    if (maximum < 1e-10) break;
    const phi = .5 * Math.atan2(2 * B[p][q], B[q][q] - B[p][p]);
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const app = B[p][p];
    const aqq = B[q][q];
    const apq = B[p][q];
    B[p][p] = c * c * app + s * s * aqq - 2 * s * c * apq;
    B[q][q] = s * s * app + c * c * aqq + 2 * s * c * apq;
    B[p][q] = 0;
    B[q][p] = 0;
    for (let k = 0; k < n; k++) {
      if (k !== p && k !== q) {
        const bkp = B[k][p];
        const bkq = B[k][q];
        B[k][p] = B[p][k] = c * bkp - s * bkq;
        B[k][q] = B[q][k] = s * bkp + c * bkq;
      }
      const vkp = eigenvectors[k][p];
      const vkq = eigenvectors[k][q];
      eigenvectors[k][p] = c * vkp - s * vkq;
      eigenvectors[k][q] = s * vkp + c * vkq;
    }
  }
  const eigenvalues = B.map((row, i) => ({ value: row[i], index: i })).sort((a, b) => b.value - a.value);
  const first = eigenvalues[0];
  const second = eigenvalues[1];
  const points = rows.map((row, i) => ({
    id: row.id,
    group: row.group,
    x: eigenvectors[i][first.index] * Math.sqrt(Math.max(0, first.value)),
    y: eigenvectors[i][second.index] * Math.sqrt(Math.max(0, second.value))
  }));
  const explained = Math.max(0, first.value + second.value) / Math.max(1e-12, eigenvalues.filter(v => v.value > 0).reduce((sum, v) => sum + v.value, 0));
  return { points, explained };
}

const chartCanvas = document.getElementById("mds-chart");
const chartCtx = chartCanvas.getContext("2d");
const chartOverlay = document.getElementById("chart-overlay");
const chartCenterLabel = document.getElementById("chart-center");
const chartZoomLabel = document.getElementById("chart-zoom");
const galaxy = { x: 2004, y: 2026 };
const groupColors = ["#2c699b", "#8170b6", "#288b80", "#bc7f32"];
let mdsReady = false;
let mdsPoints = [];
let view = { x: 0, y: 0, scale: 30 };
let canvasWidth = 0;
let canvasHeight = 0;
let canvasDpr = 1;
let mapDrag = null;
let cameraAnimation = null;

function screenToWorld(clientX, clientY) {
  const rect = chartCanvas.getBoundingClientRect();
  return {
    x: view.x + (clientX - rect.left - rect.width / 2) / view.scale,
    y: view.y - (clientY - rect.top - rect.height / 2) / view.scale
  };
}

function worldToScreen(x, y) {
  return { x: canvasWidth / 2 + (x - view.x) * view.scale, y: canvasHeight / 2 - (y - view.y) * view.scale };
}

function niceStep(value) {
  const exponent = 10 ** Math.floor(Math.log10(Math.max(value, 1e-9)));
  const fraction = value / exponent;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * exponent;
}

function formatCoordinate(value) {
  if (Math.abs(value) >= 100) return Math.round(value).toLocaleString("ru-RU").replace(/\s/g, "");
  if (Math.abs(value) >= 1) return value.toFixed(1).replace(/\.0$/, "");
  if (Math.abs(value) < .0001) return "0";
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function drawGrid(ctx) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  const step = niceStep(78 / view.scale);
  const xMin = view.x - canvasWidth / 2 / view.scale;
  const xMax = view.x + canvasWidth / 2 / view.scale;
  const yMin = view.y - canvasHeight / 2 / view.scale;
  const yMax = view.y + canvasHeight / 2 / view.scale;
  const firstX = Math.ceil(xMin / step);
  const lastX = Math.floor(xMax / step);
  const firstY = Math.ceil(yMin / step);
  const lastY = Math.floor(yMax / step);
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  for (let i = firstX; i <= lastX && i - firstX < 150; i++) {
    const value = i * step;
    const x = worldToScreen(value, 0).x;
    ctx.strokeStyle = Math.abs(value) < step * .001 ? "#aab9c6" : "#e7edf2";
    ctx.lineWidth = Math.abs(value) < step * .001 ? 1.3 : .8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
    ctx.fillStyle = "#7d8a98";
    ctx.fillText(formatCoordinate(value), x, canvasHeight - 12);
  }
  for (let i = firstY; i <= lastY && i - firstY < 150; i++) {
    const value = i * step;
    const y = worldToScreen(0, value).y;
    ctx.strokeStyle = Math.abs(value) < step * .001 ? "#aab9c6" : "#e7edf2";
    ctx.lineWidth = Math.abs(value) < step * .001 ? 1.3 : .8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#7d8a98";
    if (y > 14 && y < canvasHeight - 14) ctx.fillText(formatCoordinate(value), 12, y - 5);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#6c7c8d";
  ctx.font = "11px monospace";
  ctx.fillText("Y ↑", 13, 18);
  ctx.textAlign = "right";
  ctx.fillText("X →", canvasWidth - 13, canvasHeight - 15);
}

function drawMdsPoints(ctx) {
  mdsPoints.forEach(point => {
    const { x, y } = worldToScreen(point.x, point.y);
    if (x < -20 || x > canvasWidth + 20 || y < -20 || y > canvasHeight + 20) return;
    const isSelected = selectedPoint === point.id;
    ctx.beginPath();
    ctx.arc(x, y, isSelected ? 11 : 7, 0, Math.PI * 2);
    ctx.fillStyle = `${groupColors[point.group]}22`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, isSelected ? 6 : 4.3, 0, Math.PI * 2);
    ctx.fillStyle = groupColors[point.group];
    ctx.fill();
    ctx.fillStyle = "#4d6174";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(point.id).padStart(2, "0"), x, y - 13);
  });
}

function drawConstellation(ctx) {
  const center = worldToScreen(galaxy.x, galaxy.y);
  const outerPx = 3 * view.scale;
  if (center.x + outerPx < 0 || center.x - outerPx > canvasWidth || center.y + outerPx < 0 || center.y - outerPx > canvasHeight) return;
  const vertices = Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? 3 : 1.35;
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    return worldToScreen(galaxy.x + Math.cos(angle) * radius, galaxy.y + Math.sin(angle) * radius);
  });
  ctx.beginPath();
  vertices.forEach((vertex, index) => index === 0 ? ctx.moveTo(vertex.x, vertex.y) : ctx.lineTo(vertex.x, vertex.y));
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#bf872c";
  ctx.fillStyle = "#e8b8622c";
  ctx.fill();
  ctx.stroke();
  vertices.filter((_, i) => i % 2 === 0).forEach(vertex => {
    ctx.beginPath();
    ctx.arc(vertex.x, vertex.y, Math.min(5, Math.max(2, view.scale * .09)), 0, Math.PI * 2);
    ctx.fillStyle = "#c08a30";
    ctx.fill();
  });
  if (view.scale >= 12) {
    ctx.fillStyle = "#a66b1e";
    ctx.textAlign = "center";
    ctx.font = "11px monospace";
    ctx.fillText("♑ 16.01.2004 · КОСМИЧЕСКАЯ АНОМАЛИЯ", center.x, center.y + Math.max(58, 4 * view.scale));
  }
}

function renderChart() {
  if (!canvasWidth || !canvasHeight) return;
  chartCtx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
  drawGrid(chartCtx);
  if (mdsReady) {
    drawMdsPoints(chartCtx);
    drawConstellation(chartCtx);
  }
  chartCenterLabel.textContent = `Центр: (${formatCoordinate(view.x)}; ${formatCoordinate(view.y)})`;
  chartZoomLabel.textContent = `Масштаб: ${(view.scale / 30).toFixed(2).replace(/\.00$/, "")}×`;
}

function resizeChart() {
  const rect = chartCanvas.getBoundingClientRect();
  canvasWidth = rect.width;
  canvasHeight = rect.height;
  if (!canvasWidth || !canvasHeight) return;
  canvasDpr = Math.min(window.devicePixelRatio || 1, 2);
  chartCanvas.width = Math.round(canvasWidth * canvasDpr);
  chartCanvas.height = Math.round(canvasHeight * canvasDpr);
  renderChart();
}

function checkSpaceAchievement() {
  if (mdsReady && Math.hypot(view.x - galaxy.x, view.y - galaxy.y) <= 4) unlockAchievement("space");
}

function stopCameraAnimation() {
  if (cameraAnimation !== null) cancelAnimationFrame(cameraAnimation);
  cameraAnimation = null;
}

function navigateTo(x, y, animated = true) {
  stopCameraAnimation();
  if (!animated || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    view.x = x;
    view.y = y;
    renderChart();
    checkSpaceAchievement();
    return;
  }
  const start = performance.now();
  const fromX = view.x;
  const fromY = view.y;
  const duration = 800;
  const loop = now => {
    const t = Math.min(1, (now - start) / duration);
    const eased = t * t * (3 - 2 * t);
    view.x = fromX + (x - fromX) * eased;
    view.y = fromY + (y - fromY) * eased;
    renderChart();
    if (t < 1) cameraAnimation = requestAnimationFrame(loop);
    else {
      cameraAnimation = null;
      checkSpaceAchievement();
    }
  };
  cameraAnimation = requestAnimationFrame(loop);
}

function adjustZoom(factor, clientX, clientY) {
  if (!mdsReady) return;
  stopCameraAnimation();
  const rect = chartCanvas.getBoundingClientRect();
  const targetX = clientX === undefined ? rect.left + rect.width / 2 : clientX;
  const targetY = clientY === undefined ? rect.top + rect.height / 2 : clientY;
  const before = screenToWorld(targetX, targetY);
  view.scale = Math.min(120, Math.max(.015, view.scale * factor));
  const after = screenToWorld(targetX, targetY);
  view.x += before.x - after.x;
  view.y += before.y - after.y;
  renderChart();
  checkSpaceAchievement();
}

chartCanvas.addEventListener("wheel", event => {
  if (!mdsReady) return;
  event.preventDefault();
  adjustZoom(Math.exp(-event.deltaY * .0013), event.clientX, event.clientY);
}, { passive: false });

chartCanvas.addEventListener("pointerdown", event => {
  if (!mdsReady || (event.pointerType === "mouse" && event.button !== 0)) return;
  stopCameraAnimation();
  chartCanvas.setPointerCapture(event.pointerId);
  mapDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: view.x, startY: view.y };
});

chartCanvas.addEventListener("pointermove", event => {
  if (!mapDrag || event.pointerId !== mapDrag.id) return;
  view.x = mapDrag.startX - (event.clientX - mapDrag.x) / view.scale;
  view.y = mapDrag.startY + (event.clientY - mapDrag.y) / view.scale;
  renderChart();
  checkSpaceAchievement();
});

function endMapDrag(event) {
  if (mapDrag?.id === event.pointerId) mapDrag = null;
}
chartCanvas.addEventListener("pointerup", endMapDrag);
chartCanvas.addEventListener("pointercancel", endMapDrag);
chartCanvas.addEventListener("keydown", event => {
  if (!mdsReady) return;
  let dx = 0;
  let dy = 0;
  if (event.key === "ArrowRight") dx = 70 / view.scale;
  else if (event.key === "ArrowLeft") dx = -70 / view.scale;
  else if (event.key === "ArrowUp") dy = 70 / view.scale;
  else if (event.key === "ArrowDown") dy = -70 / view.scale;
  else if (event.key === "+" || event.key === "=") adjustZoom(1.2);
  else if (event.key === "-") adjustZoom(1 / 1.2);
  else return;
  event.preventDefault();
  stopCameraAnimation();
  view.x += dx;
  view.y += dy;
  renderChart();
  checkSpaceAchievement();
});

const runButton = document.getElementById("run-mds");
runButton.addEventListener("click", () => {
  const result = classicalMDS(dataset);
  mdsPoints = result.points;
  mdsReady = true;
  chartOverlay.hidden = true;
  document.getElementById("coordinate-go").disabled = false;
  document.getElementById("reset-view").disabled = false;
  document.getElementById("zoom-in").disabled = false;
  document.getElementById("zoom-out").disabled = false;
  const bound = Math.max(3.5, ...mdsPoints.map(p => Math.max(Math.abs(p.x), Math.abs(p.y))));
  view.scale = Math.min(40, (Math.min(canvasWidth, canvasHeight) / 2 - 25) / bound);
  view.x = 0;
  view.y = 0;
  document.getElementById("mds-result").textContent = `Готово: ${mdsPoints.length} точек. Первые две компоненты: ${(result.explained * 100).toFixed(1)}% положительной спектральной суммы.`;
  document.getElementById("mds-result").classList.add("success");
  runButton.textContent = "Пересчитать MDS ↻";
  document.getElementById("coordinate-x").value = 0;
  document.getElementById("coordinate-y").value = 0;
  renderChart();
});

document.getElementById("coordinate-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!mdsReady) return;
  const xRaw = document.getElementById("coordinate-x").value.trim();
  const yRaw = document.getElementById("coordinate-y").value.trim();
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!xRaw || !yRaw || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) {
    document.getElementById("mds-result").textContent = "Введи две конечные координаты по модулю не больше 1 000 000 000.";
    document.getElementById("mds-result").classList.remove("success");
    return;
  }
  navigateTo(x, y);
});

document.getElementById("reset-view").addEventListener("click", () => {
  navigateTo(0, 0);
  document.getElementById("coordinate-x").value = "0";
  document.getElementById("coordinate-y").value = "0";
});
document.getElementById("zoom-in").addEventListener("click", () => adjustZoom(1.4));
document.getElementById("zoom-out").addEventListener("click", () => adjustZoom(1 / 1.4));

document.getElementById("beaver-hint").addEventListener("click", () => {
  const hint = document.getElementById("beaver-hint-answer");
  hint.hidden = !hint.hidden;
});

document.getElementById("sequence-form").addEventListener("submit", event => {
  event.preventDefault();
  const feedback = document.getElementById("sequence-feedback");
  const input = document.getElementById("sequence-answer").value.trim();
  const normalized = input.replace(/[\s,.\u00a0_]/g, "");
  if (!/^\d+$/.test(normalized)) {
    feedback.textContent = "Введи целое неотрицательное число.";
    feedback.classList.remove("success");
    return;
  }
  if (normalized.replace(/^0+/, "") === "47176870") {
    feedback.textContent = "Верно! S(5) = 47 176 870. Третья звезда открыта.";
    feedback.classList.add("success");
    unlockAchievement("beaver");
  } else {
    feedback.textContent = "Не угадал. Это не арифметическая прогрессия — попробуй подсказку ниже.";
    feedback.classList.remove("success");
  }
});

document.getElementById("reset-progress").addEventListener("click", () => {
  if (!window.confirm("Сбросить все три достижения в этом браузере?")) return;
  achievements = { photo: false, space: false, beaver: false };
  saveAchievements();
  renderAchievements();
  photoCanvas.classList.remove("revealed");
  document.getElementById("photo-unlocked").hidden = true;
  scratchInstruction.textContent = "Фотография под защитным слоем. Попробуйте стереть его монеткой.";
  scratchCoin.disabled = false;
  scratchCoin.style.opacity = "";
  paintPhotoCover();
  document.getElementById("sequence-answer").value = "";
  document.getElementById("sequence-feedback").textContent = "Это не арифметическая прогрессия.";
  document.getElementById("sequence-feedback").classList.remove("success");
  view.x = 0;
  view.y = 0;
  renderChart();
});

function initialize() {
  document.getElementById("footer-year").textContent = new Date().getFullYear();
  renderAchievements();
  populateDataTable();
  if (achievements.photo) showRevealedPhoto();
  const photoObserver = new ResizeObserver(() => {
    if (!achievements.photo && !coinDrag) paintPhotoCover();
  });
  photoObserver.observe(photoShell);
  const chartObserver = new ResizeObserver(resizeChart);
  chartObserver.observe(chartCanvas);
  requestAnimationFrame(() => {
    if (!achievements.photo) paintPhotoCover();
    resizeChart();
  });
}

initialize();
