let FOUND_PAINTS_ARR = [];

function calculateColorSums() {
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
    if (paint.picId === imgsrcbase64.title) {
      sums.red += parseInt(paint.red, 10);
      sums.green += parseInt(paint.green, 10);
      sums.blue += parseInt(paint.blue, 10);
      sums.white += parseInt(paint.white, 10);
      sums.black += parseInt(paint.black, 10);
      sums.pale += parseInt(paint.pale, 10);
      sums.vivid += parseInt(paint.vivid, 10);
    }
  });

  return sums;
}

async function loadPaints() {
  try {
    const response = await fetch("found_paints.json");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    FOUND_PAINTS_ARR = await response.json();
    const colorSums = calculateColorSums();
    applyFilters(colorSums);
  } catch (error) {
    console.error("Ошибка загрузки JSON:", error);
  }
}

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const image = new Image();
let originalData;

image.crossOrigin = "";
image.src = imgsrcbase64.src; // Укажите здесь URL изображения

image.onload = function () {
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  originalData = imageData.data.slice(); // Сохраняем оригинальные данные
  loadPaints(); // Загружаем данные из JSON после загрузки изображения
};

image.onerror = function () {
  console.error("Ошибка загрузки изображения. Проверьте URL и настройки CORS.");
};

function applyFilters(colorSums) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const red = colorSums.red / 100;
  document.getElementById("red").innerText = colorSums.red;
  const green = colorSums.green / 100;
  document.getElementById("green").innerText = colorSums.green;
  const blue = colorSums.blue / 100;
  document.getElementById("blue").innerText = colorSums.blue;

  const light = 100 - 1 * colorSums.black + colorSums.white;
  document.getElementById("black").innerText = colorSums.black;
  document.getElementById("white").innerText = colorSums.white;

  const shadow = 100 - 1 * colorSums.pale + colorSums.vivid;
  document.getElementById("pale").innerText = colorSums.pale;
  document.getElementById("vivid").innerText = colorSums.vivid;

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
