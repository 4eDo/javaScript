var canvas = document.getElementById('game');
var context = canvas.getContext('2d');

var requestId;

var grid = 16;
var count = 0;

var snakeSpeed = 60 - document.querySelector("#snakeSpeed").value;
var snakeColorTimer = 0;
var eatedApples = 0;
var eatedTail = 0;
var snake = {
  x: 160,
  y: 160,

  // snake velocity. moves one grid length every frame in either the x or y direction
  dx: grid,
  dy: 0,

  // keep track of all grids the snake body occupies
  cells: [],

  // length of the snake. grows when eating an apple
  maxCells: 4,
  
  color: "green",
  colorHead: "olive",
  addSpeed: 0,
  addTail: 1
};

var redApple = {
  color: "red",
  snakeColor: "green",
  colorHead: "olive",
  addTimer: 0,
  addSpeed: 0,
  addField: 0,
  addTail: 1
}

var goldApple = {
  color: "goldenrod",
  snakeColor: "Fuchsia",
  colorHead: "violet",
  addTimer: 100,
  addSpeed: 5,
  addField: 0,
  addTail: 1
}
var blueApple = {
  color: "blue",
  snakeColor: "indigo",
  colorHead: "navy",
  addTimer: 50,
  addSpeed: -5,
  addField: 0,
  addTail: 1
}
var greenApple = {
  color: "yellowgreen",
  snakeColor: "seagreen",
  colorHead: "olivedrab",
  addTimer: 50,
  addSpeed: 0,
  addField: 0,
  addTail: 2
}
var tealApple = {
  color: "teal",
  snakeColor: "slategray",
  colorHead: "steelblue",
  addTimer: 2,
  addSpeed: 0,
  addField: 1,
  addTail: 1
}
var brownApple = {
  color: "brown",
  snakeColor: "darkred",
  colorHead: "firebrick",
  addTimer: 2,
  addSpeed: 0,
  addField: -1,
  addTail: 1
}
var siennaApple = {
  color: "sienna",
  snakeColor: "saddlebrown",
  colorHead: "rosybrown",
  addTimer: 50,
  addSpeed: 1,
  addField: 0,
  addTail: -1
}

var apple = {
  x: grid,
  y: grid,
  currType: 0,
  types: [
    redApple,   //0
    goldApple,  //1
    blueApple,  //2
    greenApple, //3
    tealApple,  //4
    brownApple, //5
    siennaApple //6
  ]
};



// get random whole numbers in a specific range
// @see https://stackoverflow.com/a/1527820/2124254
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function updApple(){
  apple.x = getRandomInt(0, document.querySelector("#canvasW").value) * grid;
  apple.y = getRandomInt(0, document.querySelector("#canvasH").value) * grid;
  let P = getRandomInt(0, 100);
  if(P < 10) {
    apple.currType = 1;
  } else if(P < 20) {
    apple.currType = 2;
  } else if(P < 30) {
    apple.currType = 3;
  } else if(P < 35) {
    apple.currType = 4;
  } else if(P < 40) {
    apple.currType = 5;
  } else if(P < 45) {
    apple.currType = 6;
  } else {
    apple.currType = 0;
  }
  checkApple();
}

function checkApple() {
  if(apple.x >= canvas.getAttribute("width") || apple.y >= canvas.getAttribute("height")) {
    updApple();
  }
}

// game loop
function loop() {
  requestId = requestAnimationFrame(loop);

  // slow game loop to 15 fps instead of 60 (60/15 = 4)
  if (++count < snakeSpeed - snake.addSpeed) {
    return;
  }

  if(snakeColorTimer > 0) {
    if(snakeColorTimer == 1) {
      snake.color = apple.types[0].snakeColor;
      snake.colorHead = apple.types[0].colorHead;
      snake.addSpeed = apple.types[0].addSpeed;
      snake.addTail = apple.types[0].addTail;
    }
    snakeColorTimer--;
    document.querySelector("#snakeColorTimer").value = snakeColorTimer;
  }
  count = 0;
  context.clearRect(0,0,canvas.width,canvas.height);

  // move snake by it's velocity
  snake.x += snake.dx;
  snake.y += snake.dy;

  // wrap snake position horizontally on edge of screen
  if (snake.x < 0) {
    snake.x = canvas.width - grid;
  }
  else if (snake.x >= canvas.width) {
    snake.x = 0;
  }

  // wrap snake position vertically on edge of screen
  if (snake.y < 0) {
    snake.y = canvas.height - grid;
  }
  else if (snake.y >= canvas.height) {
    snake.y = 0;
  }

  // keep track of where snake has been. front of the array is always the head
  snake.cells.unshift({x: snake.x, y: snake.y});

  // remove cells as we move away from them
  if (snake.cells.length > snake.maxCells) {
    snake.cells.pop();
  }

  // draw apple
  context.fillStyle = apple.types[apple.currType].color;
  context.fillRect(apple.x, apple.y, grid-1, grid-1);

  // draw snake one cell at a time
  context.fillStyle = snake.color;
  snake.cells.forEach(function(cell, index) {
 
    // drawing 1 px smaller than the grid creates a grid effect in the snake body so you can see how long it is
    context.fillRect(cell.x, cell.y, grid-1, grid-1);

    // snake ate apple
    if (cell.x === apple.x && cell.y === apple.y) {
      
      if(apple.currType != 0){
          snake.color = apple.types[apple.currType].snakeColor;
          snake.colorHead = apple.types[apple.currType].colorHead;
          snakeColorTimer = apple.types[apple.currType].addTimer;
          snake.addSpeed = apple.types[apple.currType].addSpeed;
          snake.addTail = apple.types[apple.currType].addTail;
      }
      snake.maxCells += snake.addTail;
      
      if(apple.types[apple.currType].addField != 0) {
        
        if(((apple.types[apple.currType].addField > 0
             && document.querySelector("#canvasW").value < document.querySelector("#canvasW").getAttribute("max"))
           ) || (apple.types[apple.currType].addField < 0 && document.querySelector("#canvasW").value > document.querySelector("#canvasW").getAttribute("min"))
        ) {
          document.querySelector("#canvasW").value = Math.round(document.querySelector("#canvasW").value) + Math.round(apple.types[apple.currType].addField);
          canvas.setAttribute("width", document.querySelector("#canvasW").value * grid);
        }
        
        if(((apple.types[apple.currType].addField > 0
             && document.querySelector("#canvasH").value < document.querySelector("#canvasH").getAttribute("max"))
           ) || (apple.types[apple.currType].addField < 0 && document.querySelector("#canvasH").value > document.querySelector("#canvasH").getAttribute("min"))
        ) {
          document.querySelector("#canvasH").value = Math.round(document.querySelector("#canvasH").value) + Math.round(apple.types[apple.currType].addField);
          canvas.setAttribute("height", document.querySelector("#canvasH").value * grid);
        }
        
        checkApple();
      }
      
      document.querySelector("#currLen").value = snake.maxCells;
      if(snake.maxCells > document.querySelector("#maxLen").value) {
        document.querySelector("#maxLen").value = snake.maxCells
      }
      eatedApples++;
      document.querySelector("#applesCount").value = eatedApples;
      updApple();
    }

    // check collision with all cells after this one (modified bubble sort)
    for (var i = index + 1; i < snake.cells.length; i++) {
      // snake occupies same space as a body part. reset game
      if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
        snake.x = 160;
        snake.y = 160;
        snake.cells = [];
        snake.maxCells = 4;
        snake.dx = grid;
        snake.dy = 0;
        document.querySelector("#currLen").value = 4;
        eatedApples = 0;
        eatedTail++;
        document.querySelector("#tailCount").value = eatedTail;
        snakeColorTimer = 1;
        updApple();
      }
    }
  });
  
  context.fillStyle = 
          snake.colorHead = snake.colorHead;
  context.fillRect(snake.x, snake.y, grid-1, grid-1);
}

// listen to keyboard events to move the snake
document.addEventListener('keydown', function(e) {
  // prevent snake from backtracking on itself by checking that it's
  // not already moving on the same axis (pressing left while moving
  // left won't do anything, and pressing right while moving left
  // shouldn't let you collide with your own body)

  // left arrow key
  if (e.which === 37 && snake.dx === 0) {
    goLeft();
  }
  // up arrow key
  else if (e.which === 38 && snake.dy === 0) {
    goUp();
  }
  // right arrow key
  else if (e.which === 39 && snake.dx === 0) {
    goRight();
  }
  // down arrow key
  else if (e.which === 40 && snake.dy === 0) {
    goDown();
  }
});

// start the game
function loopMain(time) {
    requestId = undefined;
    
    doStuff(time)
    start();
}

function start() {
    if (!requestId) {
       requestId = window.requestAnimationFrame(loopMain);
    }
}

function stop() {
    if (requestId) {
       window.cancelAnimationFrame(requestId);
       requestId = undefined;
    }
}

function doStuff(time) {
  requestId = requestAnimationFrame(loop);
}
  

document.querySelector("#start").addEventListener('click', function() {
  start();
});

document.querySelector("#stop").addEventListener('click', function() {
  stop();
});

 document.querySelector("#snakeSpeed").addEventListener("change", function(){snakeSpeed = 60 - this.value});

document.querySelector("#canvasW").addEventListener("change", function(){
  canvas.setAttribute("width", this.value * grid);
  checkApple();
});
document.querySelector("#canvasH").addEventListener("change", function(){
  canvas.setAttribute("height", this.value * grid);
  checkApple();
});

function goUp(){
  snake.dy = -grid;
  snake.dx = 0;
}
function goDown(){
  snake.dy = grid;
  snake.dx = 0;
}
function goLeft(){
  snake.dx = -grid;
  snake.dy = 0;
}
function goRight(){
  snake.dx = grid;
  snake.dy = 0;
}

document.querySelector("#goUp").addEventListener('click', function() {
  if (snake.dy === 0) {
    goUp();
  }
});
document.querySelector("#goLeft").addEventListener('click', function() {
  if (snake.dx === 0) {
    goLeft();
  }
});
document.querySelector("#goRight").addEventListener('click', function() {
  if (snake.dx === 0) {
    goRight();
  }
});
document.querySelector("#goDown").addEventListener('click', function() {
  if (snake.dy === 0) {
    goDown();
  }
});
