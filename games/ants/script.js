var cellSize = 15;
var tempW = Math.floor((window.innerWidth - 450) / cellSize) * cellSize;
var tempH = Math.floor((window.innerHeight - 40) / cellSize) * cellSize;

var canvas = document.getElementById('canvas');
canvas.style.width = tempW + "px";
canvas.style.height = tempH + "px";
var scale = 2;
canvas.width = tempW * scale;
canvas.height = tempH * scale;
var ctx = canvas.getContext('2d');
ctx.scale(scale, scale);
var sizeX = (canvas.width / scale) / cellSize;
var sizeY = (canvas.height / scale) / cellSize;

var cells = new Array();
var ants = new Array();
var antsCounter = 0;

var worms = new Array();

var intervalId = null;
var isPaused = true;
const speedInput = document.querySelector('input[type=range]');
var ANT_ID_COUNTER = 0;
var WORM_ID_COUNTER = 0;

var steps = 0;
var rainPeriod = 5000;
var beforeRain = 5000;

var types = {
    "ground": {
        "color": "AntiqueWhite"
    },
    "wall": {
        "color": "dimgray"
    },
    "leaf": {
        "color": "YellowGreen",
        "border": "darkolivegreen"
    },
    "meat": {
        "color": "IndianRed",
        "border": "Maroon"
    },
    "water": {
        "color": "SteelBlue",
        "border": "blue"
    },
    "home": {
        "color": "DimGray"
    },
    "trash": {
        "color": "Olive",
        "border": "dimgray"
    },
    "worm": {
        "color": "IndianRed",
        "border": "Maroon"
    }
};

var foods = ["leaf", "meat"];

var antTypes = {
    "scout": {
        "color": "Gold",
        "border": "black",
        "needed": {
            "water": 0.3,
            "food": {
                "leaf": 0.3,
                "meat": 0.1
            }
        },
        "maxFill": 3,
        "dist": 5,
        "attack": 3
    },
    "worker": {
        "color": "sienna",
        "border": "black",
        "needed": {
            "water": 0.2,
            "food": {
                "leaf": 0.3,
                "meat": 0.1
            }
        },
        "maxFill": 20,
        "dist": 1,
        "attack": 1
    },
    "mother": {
        "color": "OrangeRed",
        "border": "black",
        "needed": {
            "water": 0.5,
            "food": {
                "leaf": 1,
                "meat": 0.5
            }
        },
        "maxFill": 0,
        "dist": 1,
        "attack": 1
    },
    "builder": {
        "color": "Peru",
        "border": "black",
        "needed": {
            "water": 0.3,
            "food": {
                "leaf": 0.5,
                "meat": 0.2
            }
        },
        "maxFill": 40,
        "dist": 1,
        "attack": 1
    }
};

var cargos = {
    "leaf": {},
    "meat": {},
    "trash": {},
    "water": {}
};

var initResources = {
    "water": {"fill": 0},
    "meat": {"fill": 0},
    "leaf": {"fill": 0},
    "trash": {"fill": 0}
};

var homeRes = {
    "water": {
        "fill": 3,
        "req": 0,
        "reserve": 0
    },
    "meat": {
        "fill": 3,
        "req": 0,
        "reserve": 0
    },
    "leaf": {
        "fill": 3,
        "req": 0,
        "reserve": 0
    },
    "trash": {
        "fill": 0,
        "req": 0,
        "reserve": 0
    },
    "food": {
        "fill": 0,
        "req": 0,
        "reserve": 0
    }
};

var homeTarget = "trash";
var newHomeCost = 100;
var knownRes = {};
var homes = [];

/****************************************************/
/* UI                                               */
/****************************************************/
function drawCanvas() {
    drawCells();
    drawGrid();
    drawWorms();
    drawAnts();
}

function updCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCanvas();
}

function drawGrid() {
    ctx.lineWidth = 0.1;
    ctx.strokeStyle = "red";

    for (var x = 0; x < canvas.width; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (var y = 0; y < canvas.height; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawCells() {
    for (let i = 0; i < sizeY; i++) {
        const row = cells[i];
        for (let j = 0; j < sizeX; j++) {
            fillCell(cells[i][j], j, i);
        }
    }
}

function drawAnts() {
    for (let ant of ants) {
        fillAnt(ant, ant.x, ant.y);
    }
}

function drawWorms() {
    for (let worm of worms) {
        for(let i = 0; i < worm.tail.length; i++) {
            ctx.fillStyle = types["worm"].color;
            ctx.fillRect(worm.tail[i][0] * cellSize, worm.tail[i][1] * cellSize, cellSize, cellSize);
        }
    }
}

function drawStat() {
    document.getElementById('antsLen').innerHTML = ants.length;
    document.getElementById('targetRes').innerHTML = homeTarget;
    document.getElementById('newHomeCost').innerHTML = newHomeCost;
    document.getElementById('steps').innerHTML = steps;
    
    for(let res in homeRes) {
        if (document.getElementById(res)) {
            document.getElementById(res).innerHTML = 
                `Fill: ${homeRes[res].fill}<br>Req: ${homeRes[res].req}<br>Reserve: ${homeRes[res].reserve}d`;
        }
    }
}

function fillCell(cell, x, y) {
    ctx.fillStyle = types[cell.type].color;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    
    for(let res in cell.resources) {
        if(cell.resources[res].fill > 0) {
            let currentFill = cell.resources[res].fill || 0;
            let fillLevel = currentFill >= 100 ? 1
                : currentFill >= 75 ? 0.75
                : currentFill >= 50 ? 0.5
                : currentFill >= 25 ? 0.25
                : 0.1;
            ctx.globalAlpha = fillLevel;
            ctx.fillStyle = types[res].color;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            ctx.globalAlpha = 1;
        }
    }
}

function fillAnt(ant, x, y) {
    const borderThickness = 1;

    ctx.fillStyle = antTypes[ant.type].color;
    ctx.lineWidth = 1;
    ctx.strokeStyle = antTypes[ant.type].border;

    ctx.beginPath();
    ctx.moveTo(x*cellSize, y*cellSize);
    ctx.lineTo(x*cellSize + cellSize, y*cellSize + cellSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x*cellSize + cellSize, y*cellSize);
    ctx.lineTo(x*cellSize, y*cellSize + cellSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x*cellSize, y*cellSize + cellSize/2);
    ctx.lineTo(x*cellSize + cellSize, y*cellSize + cellSize/2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x*cellSize + cellSize/2, y*cellSize);
    ctx.lineTo(x*cellSize + cellSize/2, y*cellSize + cellSize);
    ctx.stroke();

    let b_height = cellSize;
    let b_width = cellSize / 6;

    let h_height = cellSize / 4;
    let h_width = cellSize / 3;

    let a_height = cellSize / 2;
    let a_width = cellSize / 2;

    let body, head, ass;
    switch(ant.dir) {
        case "up":
            body = {
                x1: x * cellSize + (cellSize / 2 - b_width / 2),
                y1: y * cellSize,
                width: b_width,
                height: b_height
            };
            head = {
                x1: x * cellSize + (cellSize / 2 - h_width / 2),
                y1: y * cellSize,
                width: h_width,
                height: h_height
            };
            ass = {
                x1: x * cellSize + (cellSize / 2 - a_width / 2),
                y1: y * cellSize + (cellSize - a_height),
                width: a_width,
                height: a_height
            };
            break;
        case "down":
            body = {
                x1: x * cellSize + (cellSize / 2 - b_width / 2),
                y1: (y+1) * cellSize,
                width: b_width,
                height: -b_height
            };
            head = {
                x1: x * cellSize + (cellSize / 2 - h_width / 2),
                y1: (y+1) * cellSize - h_height,
                width: h_width,
                height: h_height
            };
            ass = {
                x1: x * cellSize + (cellSize / 2 - a_width / 2),
                y1: y * cellSize,
                width: a_width,
                height: a_height
            };
            break;
        case "left":
            body = {
                x1: x * cellSize,
                y1: y * cellSize + (cellSize / 2 - b_width / 2),
                width: b_height,
                height: b_width
            };
            head = {
                x1: x * cellSize,
                y1: y * cellSize + (cellSize / 2 - h_width / 2),
                width: h_height,
                height: h_width
            };
            ass = {
                x1: x * cellSize + (cellSize - a_height),
                y1: y * cellSize + (cellSize / 2 - a_width / 2),
                width: a_height,
                height: a_width
            };
            break;
        case "right":
            body = {
                x1: (x+1)*cellSize - b_height,
                y1: y*cellSize + (cellSize/2-b_width/2),
                width: b_height,
                height: b_width
            };
            head = {
                x1: (x+1)*cellSize - h_height,
                y1: y*cellSize + (cellSize/2-h_width/2),
                width: h_height,
                height: h_width
            };
            ass = {
                x1: x*cellSize,
                y1: y*cellSize + (cellSize/2-a_width/2),
                width: a_height,
                height: a_width
            };
            break;
    }

    ctx.fillRect(body.x1, body.y1, body.width, body.height);
    ctx.strokeRect(body.x1 - borderThickness / 2, body.y1 - borderThickness / 2, body.width + borderThickness, body.height + borderThickness);

    ctx.fillRect(head.x1, head.y1, head.width, head.height);
    ctx.strokeRect(head.x1 - borderThickness / 2, head.y1 - borderThickness / 2, head.width + borderThickness, head.height + borderThickness);

    ctx.fillRect(ass.x1, ass.y1, ass.width, ass.height);
    ctx.strokeRect(ass.x1 - borderThickness / 2, ass.y1 - borderThickness / 2, ass.width + borderThickness, ass.height + borderThickness);

    if(ant.cargo&&ant.cargo.type) {
        let cargoRadius;
        switch(ant.cargo.size) {
            case 1: cargoRadius = cellSize/6; break;
            case 2: cargoRadius = cellSize/4; break;
            case 3: cargoRadius = cellSize/3; break;
        }
        ctx.beginPath();
        ctx.arc(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, cargoRadius, 0, Math.PI * 2);
        ctx.fillStyle = types[ant.cargo.type].color;
        ctx.fill();
        ctx.strokeStyle = types[ant.cargo.type].border;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function step() {
    updCanvas();
    drawStat();

    calcHomeResRequired();

    for(let worm of worms) {
        wormStep(worm);
    }

    for (let ant of ants) {
        antStep(ant);
    }

    eat();
    steps++;
    beforeRain--;
    document.getElementById('nextRain').value = rainPeriod - beforeRain;
    if(beforeRain == 0) {
        doRain(0.01);
        beforeRain = rainPeriod;
    }
}

function startAnimation() {
    if (!intervalId || isPaused) {
        const delay = parseInt(speedInput.value);
        intervalId = setInterval(step, delay);
        isPaused = false;
    }
}

function pauseAnimation() {
    clearInterval(intervalId);
    isPaused = true;
}

function updateSpeed(value) {
    if (!isPaused && intervalId !== null) {
        clearInterval(intervalId);
        intervalId = setInterval(step, value);
    }
}

/****************************************************/
/* LIVE                                             */
/****************************************************/
function calcHomeResRequired() {
    for(let res in homeRes) {
        homeRes[res].req = 0;
    }
    for (let ant of ants) {
        let type = antTypes[ant.type].needed;
        homeRes["water"].req = Math.round((homeRes["water"].req + type["water"])*100)/100;

        for(let food in type.food) {
            homeRes[food].req = Math.round((homeRes[food].req + type.food[food])*100)/100;
        }
    }
    homeRes["food"].reserve = 0;
    for(let res in homeRes) {
        if(res == "trash") continue;
        if(homeRes[res].req == 0) continue;
        homeRes[res].fill = Math.round((homeRes[res].fill)*100)/100;
        homeRes[res].reserve = Math.round(homeRes[res].fill / homeRes[res].req);
        if(foods.includes(res)) homeRes["food"].reserve += 1*homeRes[res].reserve;
    }
    if(
        homeRes["trash"].fill >= newHomeCost &&
        homeRes["water"].reserve >= newHomeCost &&
        homeRes["food"].reserve >= newHomeCost
    ) {
        let home0 = randFromArr(homes);
        let longWay = 0;
        let tgX = getRandomInt(1, sizeX-1);
        let tgY = getRandomInt(1, sizeY-1);
        let knownCells = [...new Set([...Object.values(knownRes)].flatMap(set => [...set]))];
        for(let home_str of knownCells) {
            let home = home_str.split(":");
            let way = Math.abs(home0[0] - home[0]) + Math.abs(home0[0] - home[1]);
            if(way > longWay) {
                longWay = way;
                tgX = home[0];
                tgY = home[1];
            }
        }
        ants.push({
            id: ANT_ID_COUNTER++,
            type:"mother",
            dir:"down",
            x:home0[0],
            y:home0[1],
            target: {
                type: "newHome",
                x: tgX,
                y: tgY
            },
            cargo: {}
        });
        homeRes["trash"].fill -= Math.round((newHomeCost) * 100) / 100;
        newHomeCost += Math.round((newHomeCost/3) * 100) / 100;
    }
    homeTarget = chooseTargetRes();
}

function eat() {
    homeRes["water"].fill -= Math.round((homeRes["water"].req) * 100) / 100;
    let eated = false;
    for(let resId in foods) {
        let res = foods[resId];
        if(homeRes[res].fill - homeRes[res].req > 0) {
            homeRes[res].fill -= Math.round((homeRes[res].req) * 100) / 100;
            eated = true;
            break;
        } else {
            continue;
        }
    }
    if(!eated) console.log("Need food :(");
}

function chooseTargetRes() {
    let reserves = [];
    for(let res in homeRes) {
        if(res == "trash") continue;
        reserves.push([res, homeRes[res].reserve]);
    }
    let minKeys = [];
    let minValue = Infinity;

    for(let [key, value] of reserves) {
        if(key == "food" || key == "water") {
            if(value < minValue) {
                minValue = value;
                minKeys.length = 0;
                minKeys.push(key);
            } else if(value == minValue) {
                minKeys.push(key);
            }
        }
    }

    let target = randFromArr(minKeys);
    return target;
}

function wormStep(worm) {
    let currentCell = cells[worm.y][worm.x];

    if(worm.hp <= 0) {
        currentCell.resources["meat"].fill += worm.fill;
        worm.fill = 0;
        for(let i = 0; i < worm.tail.length; i++) {
            if(cells[worm.tail[i][1]][worm.tail[i][0]] == "home") {continue;}
            cells[worm.tail[i][1]][worm.tail[i][0]].resources["meat"].fill += 100;
        }
        worms = worms.filter(obj => {
            return obj.id != worm.id
        });
    } else if(currentCell.resources["leaf"].fill > 0) {
        worm.fill += currentCell.resources["leaf"].fill;
        currentCell.resources["leaf"].fill = 0;
    } else if(worm.last && worm.fill >= 100) {
        worm.tail.push(worm.last);
        worm.last = null;
        worm.fill -= 100;
    } else {
        const neighbors = getRoundCell(worm.x, worm.y, 1).filter(cell => cell.type !== 'wall'&&cell.type !== 'home');
        const oppositeDirections = {
            'up': 'down',
            'down': 'up',
            'left': 'right',
            'right': 'left'
        };

        // Случайное движение, если цели нет
        const possibleDirs = ['up', 'down', 'left', 'right'].filter(dir => dir !== oppositeDirections[worm.dir]);
        const randomDirIndex = Math.floor(Math.random() * possibleDirs.length);
        const dir = possibleDirs[randomDirIndex];

        switch(dir) {
            case 'up':
                if (neighbors.some(cell => cell.y === worm.y - 1)) {
                    worm.y--;
                }
                break;
            case 'down':
                if (neighbors.some(cell => cell.y === worm.y + 1)) {
                    worm.y++;
                }
                break;
            case 'left':
                if (neighbors.some(cell => cell.x === worm.x - 1)) {
                    worm.x--;
                }
                break;
            case 'right':
                if (neighbors.some(cell => cell.x === worm.x + 1)) {
                    worm.x++;
                }
                break;
        }
        worm.dir = dir;

        worm.tail.unshift([worm.x, worm.y]);
        worm.last = worm.tail.pop();
    }
}

function checkWarmInCell(cell) {
    for (let worm of worms) {
        for(let i = 0; i < worm.tail.length; i++) {
            if(worm.tail[i][0] == cell.x && worm.tail[i][1] == cell.y) return worm;
        }
    }
    return null;
}

function antStep(ant) {
    let currentCell = cells[ant.y][ant.x];
    rememberCurrentCell(currentCell);
    let warm = checkWarmInCell(currentCell);
    if(warm) {
        warm.hp -= antTypes[ant.type].attack;
    } else if(ant.type == "mother") {
        if(ant.x == ant.target.x && ant.y == ant.target.y) {
            buildNewHome(ant);
        } else {
            go(ant);
        }
    } else if (currentCell.type == "home") {
        // Разгружаемся
        if(ant.cargo&&ant.cargo.type&&ant.cargo.fill > 0) {
            homeRes[ant.cargo.type].fill = ant.cargo.fill + Math.round(homeRes[ant.cargo.type].fill * 100) / 100;
            ant.cargo = {}
        }
        // Выбираем новый целевой ресурс
        switch(ant.type) {
            case "builder": ant.target.type = "trash"; break;
            case "scout": ant.target.type = "search"; break;
            default: ant.target.type = homeTarget; break;
        }
        lookAroundFindTarget(ant);
    } else if(
        ant.cargo
        && (!ant.cargo.fill || ant.cargo.fill < antTypes[ant.type].maxFill)
        && ( notEmptyResInCell(currentCell).includes(ant.target.type)
        || notEmptyResInCell(currentCell).includes(ant.cargo.type)
        )
    ) {
        getCargo(ant, currentCell);
    } else if(ant.type == "scout" && ant.target.x == ant.x && ant.target.y == ant.y) {
        ant.target.x = null;
        ant.target.y = null;
    } else {
        lookAroundFindTarget(ant);
    }
}

function getCargo(ant, currentCell) {
    let maxWeight = antTypes[ant.type].maxFill;
    let needType = ant.cargo&&ant.cargo.type
        ? ant.cargo.type
        : ant.target.type != "search"
            ? ant.target.type
            : null;

    if(!needType) {
        let matchingKeys = [];
        Object.keys(currentCell.resources).forEach(key => {
            if (currentCell.resources[key] && currentCell.resources[key].fill > 0) {
                matchingKeys.push(key);
            }
        });
        if(matchingKeys.length == 0) {
            ant.target.x = null;
            ant.target.y = null;
            lookAroundFindTarget(ant);
            return;
        }
        needType = randFromArr(matchingKeys);
    } else if (needType == "food") {
        needType = randFromArr(getMatchesInArrs(notEmptyResInCell(currentCell), foods));
    }

    let cellFill = currentCell.resources[needType].fill;

    if(!ant.cargo.type) {
        ant.cargo.type = needType;
        if(maxWeight <= cellFill) {
            ant.cargo.size = 3;
            ant.cargo.fill = maxWeight;
            currentCell.resources[needType].fill -= maxWeight;
        } else {
            ant.cargo.size = cellFill < maxWeight/3 ? 2 : 1;
            ant.cargo.fill = cellFill;
            currentCell.resources[needType].fill = 0;
        }
        ant.target.x = null;
        ant.target.y = null;
    } else if(ant.cargo.fill < maxWeight) {
        let needed = maxWeight - ant.cargo.fill;
        let cancer = Math.min(needed, cellFill);
        ant.cargo.fill += cancer;
        currentCell.resources[needType].fill -= cancer;
        ant.cargo.size = ant.cargo.fill == maxWeight
            ? 3
            : (ant.cargo.fill > maxWeight/3 ? 2 : 1);
    }
    ant.target.type = "home";
    rememberCurrentCell(cells[ant.y][ant.x]);
}

function buildNewHome(ant) {
    let HOME_X = ant.x;
    let HOME_Y = ant.y;
    cells[HOME_Y][HOME_X].type = "home";
    cells[HOME_Y][HOME_X].resources = JSON.parse(JSON.stringify(initResources));
    for(let rkey in knownRes) {
        for(let rval of knownRes[rkey]) {
            if(rval == ant.x+":"+ant.y) {
                knownRes[rkey].delete(rval);
            }
        }
    }
    homes.push([HOME_X, HOME_Y]);
    ant.type = Math.random() < 0.2 ? "builder" : "worker";
}

function lookAroundFindTarget(ant) {
    if(ant.type == "scout" && !ant.target.x && !ant.target.y && !(ant.cargo&&ant.cargo.type)) {
        ant.target.type = "search";
        go(ant);
        return;
    }

    let target = ant.target;
    if(target.type == "home") {
        let nearWay = sizeX + sizeY;
        for(let home of homes) {
            let way = Math.abs(ant.x - home[0]) + Math.abs(ant.y - home[1]);
            if(way < nearWay) {
                nearWay = way;
                ant.target.x = home[0];
                ant.target.y = home[1];
            }
        }
    } else {
        let maxFill = 0;
        const around = getRoundCell(ant.x, ant.y, ant.dist);
        around.forEach((cell, index) => {
            const nx = cell.x;
            const ny = cell.y;
            rememberCurrentCell(cells[ny][nx]);
        });

        let targets = []
        switch(target.type) {
            case "food": targets = [...foods]; break;
            case "search": targets = [...foods, ...Object.keys(homeRes)]; break;
            default: targets.push(target.type);
        }

        let goodResKeys = getMatchesInArrs(Object.keys(knownRes), targets);
        let nearWay = sizeX + sizeY;
        let targetX, targetY;
        for(let grk in goodResKeys) {
            for(let coordStr of knownRes[goodResKeys[grk]]) {
                let coord = coordStr.split(":");
                let way = Math.abs(ant.x - coord[0]) + Math.abs(ant.y - coord[1]);
                if(way < nearWay) {
                    nearWay = way;
                    targetX = coord[0];
                    targetY = coord[1];
                }
            }
        }
        if(targetX) {
            ant.target.x = targetX;
            ant.target.y = targetY;
        } else {
            ant.target.x = null;
            ant.target.y = null;
        }
    }
    go(ant);
}

function rememberCurrentCell(cell) {
    for(let res in cell.resources) {
        if(!knownRes[res]) {
            knownRes[res] = new Set();
        }
        if(cell.resources[res].fill > 1) {
            knownRes[res].add(cell.x+":"+cell.y);
        } else {
            knownRes[res].delete(cell.x+":"+cell.y);
        }
    }
}

function go(ant) {
    const neighbors = getRoundCell(ant.x, ant.y).filter(cell => cell.type !== 'wall');
    const oppositeDirections = {
        'up': 'down',
        'down': 'up',
        'left': 'right',
        'right': 'left'
    };

    if (ant.target?.x != null && ant.target?.y != null) {
        let bestCell = null;
        neighbors.forEach(cell => {
            const dx = Math.abs(cell.x - ant.target.x);
            const dy = Math.abs(cell.y - ant.target.y);
            if ((!bestCell || (Math.abs(dx) + Math.abs(dy))
                < (Math.abs(bestCell.x - ant.target.x) + Math.abs(bestCell.y - ant.target.y)))
                && (cell.x == ant.x || cell.y == ant.y)
            ) {
                bestCell = cell;
            }
        });

        if (bestCell) {
            ant.dir = ant.x < bestCell.x
                ? "right"
                : ant.x > bestCell.x
                    ? "left"
                    : ant.y < bestCell.y
                        ? "down"
                        : "up";
            ant.x = bestCell.x;
            ant.y = bestCell.y;
        }
    } else {
        const possibleDirs = ['up', 'down', 'left', 'right'].filter(dir => dir != oppositeDirections[ant.dir]);
        const randomDirIndex = Math.floor(Math.random() * possibleDirs.length);
        const dir = possibleDirs[randomDirIndex];

        switch(dir) {
            case 'up':
                if (neighbors.some(cell => cell.y == ant.y - 1)) {
                    ant.y--;
                }
                break;
            case 'down':
                if (neighbors.some(cell => cell.y == ant.y + 1)) {
                    ant.y++;
                }
                break;
            case 'left':
                if (neighbors.some(cell => cell.x == ant.x - 1)) {
                    ant.x--;
                }
                break;
            case 'right':
                if (neighbors.some(cell => cell.x == ant.x + 1)) {
                    ant.x++;
                }
                break;
        }
        ant.dir = dir;
    }
}
/****************************************************/
/* UTILS                                            */
/****************************************************/
function notEmptyResInCell(cell) {
    let resources = new Set();
    for(let res in cell.resources) {
        if(cell.resources[res].fill > 0) {
            resources.add(res);
            if(foods.includes(res)) resources.add("food");
            resources.add("search");
        }
    }
    return [...resources];
}

function getMatchesInArrs(one, two) {
    return one.filter(value => two.includes(value))
}

function findCellByXY(x, y) {
    if(x < 0 || x >= sizeX || y < 0 || y >= sizeY) return null;
    return cells[y][x];
}

function getRoundCell(x, y, dist = 1) {
    let result = [];
    for(let di = -1*dist; di <= 1*dist; di++) {
        for(let dj = -1*dist; dj <= 1*dist; dj++) {
            if(di == 0 && dj == 0) continue;
            let ni = y + di, nj = x + dj;
            if(ni >= 0 && ni < sizeY && nj >= 0 && nj < sizeX) {
                result.push(cells[ni][nj]);
            }
        }
    }
    return result;
}

function randFromArr(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function doRain(rainPower = 0) {
    let waterPercent = rainPower == 0 ? document.getElementById('rain').value : rainPower;
    for (let i = 0; i < sizeY; i++) {
        const row = cells[i];
        for (let j = 0; j < sizeX; j++) {
            if(cells[i][j].type == 'wall' || cells[i][j].type == "home") continue;
            cells[i][j].resources["trash"]["fill"] += cells[i][j].resources["leaf"]["fill"] + cells[i][j].resources["meat"]["fill"];
            cells[i][j].resources["leaf"]["fill"] = 0;
            cells[i][j].resources["meat"]["fill"] = 0;
        }
    }
}

function addResourceField(percent, type) {
    for (let i = 0; i < sizeY; i++) {
        const row = cells[i];
        for (let j = 0; j < sizeX; j++) {
            if(cells[i][j].type == 'wall' || cells[i][j].type == "home") continue;
            if (Math.random() < percent) {
                cells[i][j].resources[type]['fill'] = getRandomInt(5, 125);
                moreRes(j, i, type);
            }
        }
    }
}

function moreRes(x, y, type) {
    const currentFill = cells[y][x].resources[type].fill;

    let newFill = currentFill >= 75 ? getRandomInt(50, 75)
        : currentFill >= 50 ? getRandomInt(25, 50)
        : currentFill >= 25 ? getRandomInt(0, 25)
        : 0;

    const neighbors = getRoundCell(x, y);

    neighbors.forEach((neighbor, index) => {
        const nx = neighbor.x;
        const ny = neighbor.y;

        if (cells[ny][nx].resources[type].fill < newFill &&
            cells[ny][nx].type != 'wall' && cells[ny][nx].type != 'home' &&
            nx >= 0 && nx < sizeX && ny >= 0 && ny < sizeY
        ) {
            cells[ny][nx].resources[type].fill = newFill;
            moreRes(nx, ny, type);
        }
    });
}

function addResource(resource, resPercent, minCount, maxCount) {
    for (let i = 0; i < sizeY; i++) {
        const row = cells[i];
        for (let j = 0; j < sizeX; j++) {
            let cell = cells[i][j];
            if(cell.type == 'wall') continue;
            if(cell.type == 'home') continue;
            if (Math.random() < resPercent) {
                cell.resources[resource]['fill'] += getRandomInt(minCount, maxCount);
            }
        }
    }
}

function addWorm() {
    let x=0;
    let y=0;
    while(cells[y][x].type == 'wall' || cells[y][x].type == 'home') {
        x = getRandomInt(1, sizeX-1);
        y = getRandomInt(1, sizeY-1);
    }

    worms.push({
        id: WORM_ID_COUNTER++,
        x: x,
        y: y,
        last: [x, y],
        tail: [[x,y]],
        hp: getRandomInt(5, 30),
        fill: 0,
        dir: "down"
    });
}

function init() {
    let waterPercent = 0.04;
    let needShowTestAnts = false;

    document.getElementById('nextRain').max = rainPeriod;

    for (let y = 0; y < sizeY; y++) {
        let row = []
        for (let x = 0; x < sizeX; x++) {
            if ((y == 0 || y == sizeY - 1) ||
                (x == 0 || x == sizeX - 1)) {
                row.push({
                    type: "wall",
                    resources: JSON.parse(JSON.stringify(initResources)),
                    x: x,
                    y: y
                });
            } else {
                row.push({
                    type: "ground",
                    resources: JSON.parse(JSON.stringify(initResources)),
                    x: x,
                    y: y
                });
            }
        }
        cells.push(row);
    }

    doRain();
    addResourceField(waterPercent, "water");
    addResource("meat", 0.05, 5, 50);
    addResource("leaf", 0.15, 1, 50);
    addResource("trash", 0.1, 5, 50);
    
    addWorm();
    addWorm();
    addWorm();

    let HOME_X = getRandomInt(1, sizeX-1);
    let HOME_Y = getRandomInt(1, sizeY-1);
    cells[HOME_Y][HOME_X].type = "home";
    cells[HOME_Y][HOME_X].resources = JSON.parse(JSON.stringify(initResources));

    homes.push([HOME_X, HOME_Y]);

    ants.push({
        id: ANT_ID_COUNTER++,
        type:"worker",
        dir:"up",
        x:HOME_X,
        y:HOME_Y,
        target: {},
        cargo: {}
    });

    ants.push({
        id: ANT_ID_COUNTER++,
        type:"worker",
        dir:"up",
        x:HOME_X,
        y:HOME_Y,
        target: {},
        cargo: {}
    });
    ants.push({
        id: ANT_ID_COUNTER++,
        type:"worker",
        dir:"up",
        x:HOME_X,
        y:HOME_Y,
        target: {},
        cargo: {}
    });

    ants.push({
        id: ANT_ID_COUNTER++,
        type:"worker",
        dir:"up",
        x:HOME_X,
        y:HOME_Y,
        target: {},
        cargo: {}
    });

    ants.push({
        id: ANT_ID_COUNTER++,
        type:"scout",
        dir:"down",
        x:HOME_X,
        y:HOME_Y,
        target: {}
    });

    ants.push({
        id: ANT_ID_COUNTER++,
        type:"builder",
        dir:"down",
        x:HOME_X,
        y:HOME_Y,
        target: {},
        cargo: {}
    });

    if (needShowTestAnts) showTestAnts();
    drawCanvas();
}
init();
