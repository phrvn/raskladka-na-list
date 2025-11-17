const canvas = document.getElementById('layout-canvas');
const ctx = canvas.getContext('2d');

const sheetFormatSelect = document.getElementById('sheet-format');
const sheetLengthInput  = document.getElementById('sheet-length');
const sheetWidthInput   = document.getElementById('sheet-width');

const SHEET_FORMATS = {
  custom: null,
  SRA3:      { L: 450, W: 320 },
  "325x470": { L: 470, W: 325 },
  "330x488": { L: 488, W: 330 },
  "350x500": { L: 500, W: 350 },
  "470x620": { L: 620, W: 470 },
  "470x650": { L: 650, W: 470 },
  "500x700": { L: 700, W: 500 },
  "520x720": { L: 720, W: 520 },
  "640x900": { L: 900, W: 640 },
  "620x940": { L: 940, W: 620 },
  "700x1000": { L: 1000, W: 700 },
  "720x1040": { L: 1040, W: 720 }
};

sheetFormatSelect.addEventListener('change', () => {
  const value = sheetFormatSelect.value;
  const fmt = SHEET_FORMATS[value];
  if (fmt) {
    sheetLengthInput.value = fmt.L;
    sheetWidthInput.value  = fmt.W;
  }
  calculateAndDraw();
});

function resizeCanvas() {
  const parentRect = canvas.parentElement.getBoundingClientRect();
  let cssWidth = parentRect.width;
  let cssHeight = parseFloat(getComputedStyle(canvas).height);

  if (!cssWidth || cssWidth < 10) cssWidth = 300;
  if (!cssHeight || cssHeight < 10) cssHeight = 300;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', () => {
  resizeCanvas();
  calculateAndDraw();
});

function readInputs() {
  const sheetL = parseFloat(sheetLengthInput.value) || 0;
  const sheetW = parseFloat(sheetWidthInput.value) || 0;

  const cardL  = parseFloat(document.getElementById('card-length').value) || 0;
  const cardW  = parseFloat(document.getElementById('card-width').value) || 0;

  const gap    = Math.max(0, parseFloat(document.getElementById('gap').value) || 0);

  const mTop    = Math.max(0, parseFloat(document.getElementById('margin-top').value)    || 0);
  const mRight  = Math.max(0, parseFloat(document.getElementById('margin-right').value)  || 0);
  const mBottom = Math.max(0, parseFloat(document.getElementById('margin-bottom').value) || 0);
  const mLeft   = Math.max(0, parseFloat(document.getElementById('margin-left').value)   || 0);

  return {
    sheetL, sheetW,
    cardL, cardW,
    gap,
    margins: { top: mTop, right: mRight, bottom: mBottom, left: mLeft }
  };
}

function calcOneOrientation(sheetL, sheetW, cardL, cardW, gap, margins) {
  const availW = sheetL - margins.left - margins.right;
  const availH = sheetW - margins.top  - margins.bottom;

  if (availW <= 0 || availH <= 0 || cardL <= 0 || cardW <= 0) {
    return { countX: 0, countY: 0, total: 0 };
  }

  const countX = Math.max(
    0,
    Math.floor((availW + gap) / (cardL + gap))
  );
  const countY = Math.max(
    0,
    Math.floor((availH + gap) / (cardW + gap))
  );

  return {
    countX,
    countY,
    total: countX * countY,
    availW,
    availH
  };
}

function calculateLayouts(params) {
  const { sheetL, sheetW, cardL, cardW, gap, margins } = params;

  const normalBase  = calcOneOrientation(sheetL, sheetW, cardL, cardW, gap, margins);
  const rotatedBase = calcOneOrientation(sheetL, sheetW, cardW, cardL, gap, margins);

  const normal = {
    name: 'Без поворота',
    orientation: 'normal',
    cardL,
    cardW,
    ...normalBase
  };

  const rotated = {
    name: 'С поворотом на 90°',
    orientation: 'rotated',
    cardL: cardW,
    cardW: cardL,
    ...rotatedBase
  };

  const bestKey = rotated.total > normal.total ? 'rotated' : 'normal';

  return { normal, rotated, bestKey };
}

function formatMm(value) {
  const v = Math.round(value * 10) / 10;
  return (v % 1 === 0) ? v.toFixed(0) : v.toFixed(1);
}

// Рисуем один вариант раскладки в заданной позиции
function drawSheetWithLayout(params, layout, best, isFirstVariant, offsetX, offsetY, scale) {
  const { sheetL, sheetW, gap, margins } = params;
  const { cardL, cardW, countX, countY, total } = layout;

  const sheetPixelWidth  = sheetL * scale;
  const sheetPixelHeight = sheetW * scale;

  function toPxX(mm) { return offsetX + mm * scale; }
  function toPxY(mm) { return offsetY + mm * scale; }

  // Лист
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = best ? '#0055cc' : '#444';
  ctx.lineWidth = best ? 2 : 1.5;

  ctx.beginPath();
  ctx.rect(toPxX(0), toPxY(0), sheetL * scale, sheetW * scale);
  ctx.fill();
  ctx.stroke();

  // Печатная область
  const printAreaX = margins.left;
  const printAreaY = margins.top;
  const printAreaW = Math.max(0, sheetL - margins.left - margins.right);
  const printAreaH = Math.max(0, sheetW - margins.top - margins.bottom);

  if (printAreaW > 0 && printAreaH > 0) {
    ctx.fillStyle = '#f5faff';
    ctx.beginPath();
    ctx.rect(toPxX(printAreaX), toPxY(printAreaY), printAreaW * scale, printAreaH * scale);
    ctx.fill();
  }

  let distLeft = 0, distRight = 0, distTop = 0, distBottom = 0;

  if (countX > 0 && countY > 0) {
    const widthUsed  = countX * cardL + (countX - 1) * gap;
    const heightUsed = countY * cardW + (countY - 1) * gap;

    const extraW = Math.max(0, printAreaW - widthUsed);
    const extraH = Math.max(0, printAreaH - heightUsed);

    const offsetInPrintX = extraW / 2;
    const offsetInPrintY = extraH / 2;

    const leafletsStartX = margins.left + offsetInPrintX;
    const leafletsStartY = margins.top  + offsetInPrintY;

    distLeft   = leafletsStartX;
    distTop    = leafletsStartY;
    distRight  = sheetL - (leafletsStartX + widthUsed);
    distBottom = sheetW - (leafletsStartY + heightUsed);

    ctx.fillStyle = '#90c4ff';
    ctx.strokeStyle = '#003366';
    ctx.lineWidth = 1;

    for (let iy = 0; iy < countY; iy++) {
      for (let ix = 0; ix < countX; ix++) {
        const x = leafletsStartX + ix * (cardL + gap);
        const y = leafletsStartY + iy * (cardW + gap);
        ctx.beginPath();
        ctx.rect(toPxX(x), toPxY(y), cardL * scale, cardW * scale);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Подписи свободных полей
    ctx.fillStyle = '#000';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const yTopQuarter    = offsetY + sheetPixelHeight * 0.25;
    const yBottomQuarter = offsetY + sheetPixelHeight * 0.75;
    const ySides = isFirstVariant ? yTopQuarter : yBottomQuarter;

    // слева
    if (distLeft >= 0.01) {
      const xL = toPxX(leafletsStartX / 2);
      ctx.fillText(`${formatMm(distLeft)} мм`, xL, ySides);
    }

    // справа
    if (distRight >= 0.01) {
      const xR = toPxX(sheetL - distRight / 2);
      ctx.fillText(`${formatMm(distRight)} мм`, xR, ySides);
    }

    // сверху / снизу — чуть сдвигаем по X, чтобы не пересекалось с надписью длины
    const xCenter = offsetX + sheetPixelWidth / 2 + (isFirstVariant ? -20 : 20);

    if (distTop >= 0.01) {
      const yT = toPxY(leafletsStartY / 2);
      ctx.fillText(`${formatMm(distTop)} мм`, xCenter, yT);
    }

    if (distBottom >= 0.01) {
      const yB = toPxY(sheetW - distBottom / 2);
      ctx.fillText(`${formatMm(distBottom)} мм`, xCenter, yB);
    }

  } else {
    ctx.fillStyle = '#c00';
    ctx.font = '12px Arial';
    ctx.fillText('Не помещается', offsetX + 10, offsetY + 20);
  }

  // Контур печатной области
  if (printAreaW > 0 && printAreaH > 0) {
    ctx.strokeStyle = '#999';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(toPxX(printAreaX), toPxY(printAreaY), printAreaW * scale, printAreaH * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Подписи размеров листа
  ctx.fillStyle = '#333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `${sheetL} мм`,
    offsetX + sheetPixelWidth / 2,
    offsetY + sheetPixelHeight + 4
  );

  const labelW = `${sheetW} мм`;
  const textX = offsetX + sheetPixelWidth + 10;
  const textY = offsetY + sheetPixelHeight / 2;

  ctx.save();
  ctx.translate(textX, textY);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelW, 0, 0);
  ctx.restore();

  // Заголовок варианта
  ctx.fillStyle = best ? '#0055cc' : '#555';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  let title = layout.name;
  if (best) title = 'Оптимальный — ' + title;

  ctx.fillText(
    `${title} (${total} шт)`,
    offsetX + sheetPixelWidth / 2,
    offsetY - 6
  );
}

function drawLayout(params, layouts) {
  const { sheetL, sheetW, gap, margins } = params;
  const { normal, rotated, bestKey } = layouts;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (sheetL <= 0 || sheetW <= 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px Arial';
    ctx.fillText('Задай положительные размеры листа', 20, 30);
    document.getElementById('summary-label').textContent = '';
    document.getElementById('stats').textContent = '';
    return;
  }

  const bothZero = normal.total === 0 && rotated.total === 0;
  if (bothZero) {
    ctx.fillStyle = '#c00';
    ctx.font = '14px Arial';
    ctx.fillText('Листовки не помещаются ни в одном варианте.', 20, 30);
    document.getElementById('summary-label').textContent = '';
    document.getElementById('stats').textContent =
      'Листовки не помещаются ни без поворота, ни с поворотом при заданных параметрах.';
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const dprW = canvas.width / dpr;
  const dprH = canvas.height / dpr;

  const outerPad = 20;
  const isMobile = dprW < 700; // порог: меньше 700px считаем мобильным

  if (isMobile) {
    // Две строки: верх и низ
    const rowsTotal = 2;
    const rowGap = 40;
    const rowHeight = (dprH - 2 * outerPad - rowGap) / rowsTotal;

    const scale = Math.min(
      (dprW - 2 * outerPad) / sheetL,
      rowHeight / sheetW
    );

    const sheetPixelWidth  = sheetL * scale;
    const sheetPixelHeight = sheetW * scale;

    const offsetX = outerPad + (dprW - 2 * outerPad - sheetPixelWidth) / 2;
    const offsetYTop = outerPad + (rowHeight - sheetPixelHeight) / 2;
    const offsetYBottom = outerPad + rowHeight + rowGap + (rowHeight - sheetPixelHeight) / 2;

    // верхний вариант — первый
    drawSheetWithLayout(params, normal,  bestKey === 'normal',  true,  offsetX, offsetYTop,    scale);
    // нижний вариант — второй
    drawSheetWithLayout(params, rotated, bestKey === 'rotated', false, offsetX, offsetYBottom, scale);

  } else {
    // Две колонки: слева и справа
    const columnsTotal = 2;
    const columnGap = 20;
    const availableWidth = dprW - 2 * outerPad - columnGap;
    const columnWidth = availableWidth / columnsTotal;
    const availableHeight = dprH - 2 * outerPad;

    const scale = Math.min(
      columnWidth / sheetL,
      availableHeight / sheetW
    );

    const sheetPixelWidth  = sheetL * scale;
    const sheetPixelHeight = sheetW * scale;

    const col0X = outerPad + (columnWidth - sheetPixelWidth) / 2;
    const col1X = outerPad + columnWidth + columnGap + (columnWidth - sheetPixelWidth) / 2;
    const offsetY = outerPad + (availableHeight - sheetPixelHeight) / 2;

    // левый вариант — первый
    drawSheetWithLayout(params, normal,  bestKey === 'normal',  true,  col0X, offsetY, scale);
    // правый вариант — второй
    drawSheetWithLayout(params, rotated, bestKey === 'rotated', false, col1X, offsetY, scale);
  }

  const statsEl = document.getElementById('stats');
  const summaryEl = document.getElementById('summary-label');

  const bestLayout = bestKey === 'normal' ? normal : rotated;

  summaryEl.textContent =
    `Оптимальный: ${bestLayout.total} шт (${bestLayout.countX}×${bestLayout.countY})`;

  statsEl.innerHTML =
    `<b>Оптимальный вариант:</b> ${bestLayout.name}, ${bestLayout.total} шт (${bestLayout.countX}×${bestLayout.countY})<br>` +
    `<b>Вариант без поворота:</b> ${normal.total} шт (${normal.countX}×${normal.countY})<br>` +
    `<b>Вариант с поворотом:</b> ${rotated.total} шт (${rotated.countX}×${rotated.countY})<br>` +
    `Листовка в оптимальном варианте: ${bestLayout.cardL} × ${bestLayout.cardW} мм<br>` +
    `Размер листа: ${sheetL} × ${sheetW} мм, техполя (с/п/сн/л): ` +
    `${margins.top}/${margins.right}/${margins.bottom}/${margins.left} мм<br>` +
    `Расстав между листовками: ${gap} мм`;
}

function calculateAndDraw() {
  const params = readInputs();
  resizeCanvas();
  const layouts = calculateLayouts(params);
  drawLayout(params, layouts);
}

function saveAsPNG() {
  const root = document.getElementById('app-root');
  html2canvas(root, { scale: 2 }).then(canvasShot => {
    const link = document.createElement('a');
    link.download = 'layout.png';
    link.href = canvasShot.toDataURL('image/png');
    link.click();
  });
}

function initApp() {
  resizeCanvas();
  calculateAndDraw();

  [
    'sheet-length', 'sheet-width',
    'card-length', 'card-width',
    'gap',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left'
  ].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', calculateAndDraw);
    el.addEventListener('change', calculateAndDraw);
  });

  document.getElementById('btn-save').addEventListener('click', (e) => {
    e.preventDefault();
    saveAsPNG();
  });
}

document.addEventListener('DOMContentLoaded', initApp);
window.addEventListener('load', calculateAndDraw);
