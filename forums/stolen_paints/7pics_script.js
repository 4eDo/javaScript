let FOUND_PAINTS_ARR = [];

async function loadPaints() {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`https://4edo.github.io/javaScript/forums/stolen_paints/found_paints.json?timestamp=${timestamp}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    FOUND_PAINTS_ARR = await response.json();
    document.querySelectorAll('.container').forEach(container => {
      processContainer(container);
    });
  } catch (error) {
    console.error('Ошибка загрузки JSON:', error);
  }
}

function calculateColorSums(paintId) {
  const sums = {
    red: 0,
    green: 0,
    blue: 0,
    white: 0,
    black: 0,
    pale: 0,
    vivid: 0
  };

  FOUND_PAINTS_ARR.forEach((paint) => {
    if (paint.picId === paintId) {
      sums.red += parseFloat(paint.red);
      sums.green += parseFloat(paint.green);
      sums.blue += parseFloat(paint.blue);
      sums.white += parseFloat(paint.white);
      sums.black += parseFloat(paint.black);
      sums.pale += parseFloat(paint.pale);
      sums.vivid += parseFloat(paint.vivid);
    }
  });

  // Округляем суммы до одного знака после запятой
  for (let key in sums) {
    sums[key] = parseFloat(sums[key].toFixed(1));
  }

  return sums;
}

function processContainer(container) {
  const canvas = container.querySelector('.canvas');
  const ctx = canvas.getContext('2d');
  const image = new Image();
  const imgElement = container.querySelector('.imgsrcbase64');
  const picId = container.getAttribute('data-pic-id');
  let originalData;

  image.crossOrigin = "";
  image.src = imgElement.src;

  image.onload = function () {
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    originalData = imageData.data.slice();
    const colorSums = calculateColorSums(picId);
    applyFilters(ctx, canvas, originalData, colorSums, container);
  };

  image.onerror = function () {
    console.error("Ошибка загрузки изображения. Проверьте URL и настройки CORS.");
  };
}

function applyFilters(ctx, canvas, originalData, colorSums, container) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const red = colorSums.red / 100;
  container.querySelector(".red").innerText = colorSums.red;
  const green = colorSums.green / 100;
  container.querySelector(".green").innerText = colorSums.green;
  const blue = colorSums.blue / 100;
  container.querySelector(".blue").innerText = colorSums.blue;

  const light = 100 - 1 * colorSums.black + colorSums.white;
  container.querySelector(".black").innerText = colorSums.black;
  container.querySelector(".white").innerText = colorSums.white;

  const shadow = 100 - 1 * colorSums.pale + colorSums.vivid;
  container.querySelector(".pale").innerText = colorSums.pale;
  container.querySelector(".vivid").innerText = colorSums.vivid;

  for (let i = 0; i < data.length; i += 4) {
    let brightness =
      0.299 * originalData[i] +
      0.587 * originalData[i + 1] +
      0.114 * originalData[i + 2];

    data[i] = brightness * red + (originalData[i] - brightness) * red;
    data[i + 1] =
      brightness * green + (originalData[i + 1] - brightness) * green;
    data[i + 2] = brightness * blue + (originalData[i + 2] - brightness) * blue;
  }

  ctx.putImageData(imageData, 0, 0);

  // Применяем CSS фильтры
  canvas.style.filter = `brightness(${light}%) saturate(${shadow}%)`;
}

loadPaints();
