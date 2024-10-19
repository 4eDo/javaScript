const ageCount = {};

roles.forEach(role => {
    const age = role.age;
    if (ageCount[age]) {
        ageCount[age]++;
    } else {
        ageCount[age] = 1;
    }
});

const labels = Object.keys(ageCount);
const data = Object.values(ageCount);

const canvas = document.createElement('canvas');
canvas.id = 'ageChart';
canvas.width = 800;
canvas.height = 400;

const targetContainer = document.querySelector('#pun-main > div > div');
targetContainer.appendChild(canvas);

const ctx = canvas.getContext('2d');
const chartHeight = 300;
const chartWidth = canvas.width;
const padding = 50;

const maxValue = Math.max(...data);

function drawChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(padding, chartHeight + padding - (data[0] / maxValue) * chartHeight);
    
    data.forEach((value, index) => {
        const x = padding + (index * (chartWidth - 2 * padding) / (data.length - 1));
        const y = chartHeight + padding - (value / maxValue) * chartHeight;
        ctx.lineTo(x, y);
    });
    
    ctx.strokeStyle = 'rgba(75, 192, 192, 1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'black';
    ctx.fillText('Количество', 20, padding + 10);
    ctx.save();
    ctx.translate(chartWidth / 2, chartHeight + padding + 30);
    ctx.rotate(0);
    ctx.fillText('Возраст', 0, 0);
    ctx.restore();

    const yStep = chartHeight / 5;
    for (let i = 0; i <= 5; i++) {
        const yValue = Math.round((maxValue / 5) * i);
        ctx.fillText(yValue, 20, chartHeight + padding - (i * yStep));
    }

    labels.forEach((label, index) => {
        const x = padding + (index * (chartWidth - 2 * padding) / (data.length - 1));
        ctx.fillText(label, x - 10, chartHeight + padding + 15);
    });
}

drawChart();

canvas.addEventListener('mousemove', (event) => {
    const mouseX = event.offsetX;
    const mouseY = event.offsetY;
    let found = false;

    labels.forEach((label, index) => {
        const x = padding + (index * (chartWidth - 2 * padding) / (data.length - 1));
        if (mouseX >= x - 10 && mouseX <= x + 10) {
            found = true;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawChart();
            ctx.fillText(`${label}y.o.: ${data[index]}`, mouseX + 10, mouseY - 10);
        }
    });

    if (!found) {
        drawChart();
    }
});

canvas.addEventListener('click', (event) => {
    const mouseX = event.offsetX;
    labels.forEach((label, index) => {
        const x = padding + (index * (chartWidth - 2 * padding) / (data.length - 1));
        if (mouseX >= x - 10 && mouseX <= x + 10) {
            const age = label;
            const characters = roles.filter(role => role.age === age);
            displayCharacterList(age, characters);
        }
    });
});

function displayCharacterList(age, characters) {
    const listContainer = document.getElementById('characterList');
    if (!listContainer) {
        const newListContainer = document.createElement('div');
        newListContainer.id = 'characterList';
        targetContainer.appendChild(newListContainer);
    } else {
        listContainer.innerHTML = '';
    }

    const title = document.createElement('h3');
    title.textContent = `Персонажи с возрастом ${age}:`;
    document.getElementById('characterList').appendChild(title);

    characters.forEach(character => {
        const listItem = document.createElement('div');
        const characterLink = document.createElement('a');
        characterLink.href = character.profile;
        characterLink.textContent = `${character.name} ${character.surname}`;
        characterLink.target = "_blank";
        listItem.appendChild(characterLink);
        document.getElementById('characterList').appendChild(listItem);
    });
}
