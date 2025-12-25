import MidiPlayer from 'midi-player-js';
import * as Tone from "tone";

const FPS = 60;
const SECONDS_PER_TICK = 0.001736;

class Ball {
    constructor(size, vel, accel, mazeRef, boxRef, ballStartingPos=null) {
        this.size = size;
        this.velX = vel;
        this.velY = vel;
        this.accel = accel;
        this.mazeRef = mazeRef;
        this.array = mazeRef.array;
        this.boxRef = boxRef;
        this.noteCounter = 0;
        this.ballStartingPos = ballStartingPos;
    }
    spawnBall() {
        const ballCanvas = window.document.getElementById("ballCanvas");
        ballCanvas.width = window.innerWidth;
        ballCanvas.height = window.innerHeight;
        this.ctx = ballCanvas.getContext("2d");
        this.position = this.ballStartingPos ? this.ballStartingPos : this.findCenter();
        this.setUpCellColorCanvas();
        this.drawBall();
    }
    drawBall() {
        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        this.ctx.beginPath();
        // console.log(this.position);
        this.ctx.arc(this.position["x"], this.position["y"], this.size, 0, 2 * Math.PI);
        this.ctx.strokeStyle = "white";
        this.ctx.stroke();
        this.ctx.fillStyle = "blue"
        this.ctx.fill();
    }
    findCenter() {
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 2;
        return {"x": x, "y": y};
    }
    async startSynth() {
        // Start Tone.js AudioContext (required on first user interaction)
        await Tone.start();
        console.log('Audio context started');
        
        this.synth = new Tone.Synth().toDestination();
    }
    playNote() {
        const note = MIDI_ARRAY[this.noteCounter];
        console.log("NOTE: ", note);
        const frequency = Tone.Frequency(note["note"], "midi").toFrequency();
        this.synth.triggerAttackRelease(note["noteName"], "8n");
        console.log("JUST PLAYED: ", frequency);
        this.noteCounter++;
    }
    adjust_velocity_to_note_timing(time_till_collision) {
        let previousNoteTime;
        try {
            previousNoteTime = MIDI_ARRAY[this.noteCounter - 1].tick * SECONDS_PER_TICK;
        } catch (e) {
            previousNoteTime = 0;
        }
        console.log("FYM", this.noteCounter, MIDI_ARRAY);
        const currNoteTime = MIDI_ARRAY[this.noteCounter].tick * SECONDS_PER_TICK;
        console.log("THESE TWO NOTES: ", previousNoteTime, currNoteTime);
        const time_between_notes = Math.abs(currNoteTime - previousNoteTime);
        console.log("TIME BETWEEN NOTES: ", time_between_notes);
        const factor_of_multiplication = time_between_notes == 0 ? 1 : time_till_collision / time_between_notes;
        console.log("TTC", time_till_collision);
        console.log("OLD VELOCITY: ", this.velX, this.velY)
        this.velX = this.velX * factor_of_multiplication;
        this.velY = this.velY * factor_of_multiplication;
        console.log("NEW VELOCITY: ", this.velX, this.velY);
        console.log("FOM", factor_of_multiplication);
    }
    update() {
        const dt = 1 / FPS;
        // this.velX += this.accel * dt;
        // this.velY += this.accel * dt;
        this.prevPositionX = this.position["x"];
        this.prevPositionY = this.position["y"];
        this.position["x"] += this.velX * dt;
        this.position["y"] += this.velY * dt;
        const currentCellIndex = [Math.floor(this.position['x'] / this.mazeRef.cellWidth), Math.floor(this.position['y'] / this.mazeRef.cellHeight)];
        // console.log("CURRENT CELL INDEX: ", currentCellIndex);
        const cell = this.mazeRef.cells[currentCellIndex[0]][currentCellIndex[1]];
        // this.predictNextCollision(cell);
        // const time_till_collision = this.calculate_time_till_next_collision(cell);
        // this.adjust_velocity_to_note_timing(time_till_collision);
        // console.log("FUCK CELL: ", cell);
        // this.predictNextCollision(cell);
        if (cell.type == 'w') {
            this.handleBoxCollision(cell, currentCellIndex);
        }
        this.drawBall();
        // this.handleBoxCollision(null);
        setTimeout(() => this.update(), 1000/FPS);
    }
    predictNextCollision(cell) {
        console.log("CELL: ", cell);
        let currCell = cell;
        console.log(currCell.type);
        let currX = this.position["x"];
        let currY = this.position["y"];
        while (currCell.type != 'w') {
            if (this.velX < 0) {
                console.log("X", currX);
                currX -= 1;
                console.log("X", currX);
            } else {
                console.log("X", currX);
                currX += 1;
                console.log("X", currX);
            }
            if (this.velY < 0) {
                console.log("Y", currY);
                currY -= 1;
                console.log("Y", currY);
            } else {
                console.log("Y", currY);
                currY += 1;
                console.log("Y", currY);
            }
            currCell = this.mazeRef.cells[Math.floor(currX / this.mazeRef.cellWidth)][Math.floor(currY / this.mazeRef.cellHeight)];
        }
        const exact_point = this.predictExactPoint(currCell);
        this.time_till_next_collisition = this.calculate_time_till_next_collision(exact_point);
        console.log("TIME TILL NEXT COLLISION: ", this.time_till_next_collisition);
        // currCell holds the next cell
        this.colorWallWithRandomColor(currCell);
    }
    predictExactPoint(currCell) {
        let x = this.position["x"];
        let y = this.position["y"];
        const rangeX = [currCell.x, currCell.x + currCell.width];
        const rangeY = [currCell.y, currCell.y + currCell.height];
        // while ((x < rangeX[0] || x > rangeX[1]) && (y < rangeY[0] || y > rangeY[1])) {
        //     x += this.velX * 0.1;
        //     y += this.velY * 0.1;
        // }
        while (x < rangeX[0] || x > rangeX[1]) x += this.velX * 0.1;
        while (y < rangeY[0] || y > rangeY[1]) y += this.velY * 0.1;
        this.cellColorContext.fillStyle = "red";
        this.cellColorContext.fillRect(x - 25, y - 25, 50, 50); // Center the rect on the point
        return {"x": x, "y": y};
    }
    calculate_time_till_next_collision(point_of_collision) {
        const distance_between_x = point_of_collision["x"] - this.position["x"];
        const distance_between_y = point_of_collision["y"] - this.position["y"];
        
        // Total distance to collision point
        const total_distance = Math.sqrt(distance_between_x ** 2 + distance_between_y ** 2);
        
        // Total velocity magnitude
        const total_velocity = Math.sqrt(this.velX ** 2 + this.velY ** 2);
        
        const time_till_collision = total_distance / total_velocity;
        
        console.log("Distance:", total_distance, "Velocity:", total_velocity, "Time:", time_till_collision);
        
        return time_till_collision;
    }
    handleBoxCollision(cell, currentCellIndex) {
        //left-right 
        if (this.prevPositionX < cell.left && this.position["x"] >= cell.left) {
            this.velX = -this.velX;
            this.playNote();
            this.colorWallWithRandomColor(cell);
            console.log("FUCK");
            // We have to send the next cell, current one is already a wall.
            const nextCell = this.mazeRef.cells[currentCellIndex[0]-1][currentCellIndex[1]];
            console.log(nextCell);
            this.predictNextCollision(nextCell);
            this.adjust_velocity_to_note_timing(this.time_till_next_collisition);
        }
        if (this.prevPositionX > cell.right && this.position["x"] <= cell.right) {
            this.velX = -this.velX;
            this.playNote();
            this.colorWallWithRandomColor(cell);
            console.log("FUCK");
            // We have to send the next cell, current one is already a wall.
            const nextCell = this.mazeRef.cells[currentCellIndex[0]+1][currentCellIndex[1]];
            console.log(nextCell);
            this.predictNextCollision(nextCell);
            this.adjust_velocity_to_note_timing(this.time_till_next_collisition);
        }
        //top-bottom
        if (this.prevPositionY < cell.top && this.position["y"] >= cell.top) {
            this.velY = -this.velY;
            this.playNote();
            this.colorWallWithRandomColor(cell);
            console.log("FUCK");
            // We have to send the next cell, current one is already a wall.
            const nextCell = this.mazeRef.cells[currentCellIndex[0]][currentCellIndex[1] - 1];
            console.log(nextCell);
            this.predictNextCollision(nextCell);
            this.adjust_velocity_to_note_timing(this.time_till_next_collisition);
        }
        if (this.prevPositionY > cell.bottom && this.position["y"] <= cell.bottom) {
            this.velY = -this.velY;
            this.playNote();
            this.colorWallWithRandomColor(cell);
            console.log("FUCK");
            // We have to send the next cell, current one is already a wall.
            const nextCell = this.mazeRef.cells[currentCellIndex[0]][currentCellIndex[1] + 1];
            console.log(nextCell);
            this.predictNextCollision(nextCell);
            this.adjust_velocity_to_note_timing(this.time_till_next_collisition);
        }
        // console.log(this.position, this.boxRef);
        // if (this.position['x'] >= this.boxRef.XBoundaries[0] + this.boxRef.XBoundaries[1] || this.position['x'] < this.boxRef.XBoundaries[0]) {
        //     this.velX = -this.velX;
        // }
        // if (this.position['y'] >= this.boxRef.YBoundaries[0] + this.boxRef.YBoundaries[1] || this.position['y'] <= this.boxRef.YBoundaries[0]) {
        //     this.velY = -this.velY;
        // }
    }
    setUpCellColorCanvas() {
        const canvas = window.document.getElementById("colorCanvas");
        canvas.height = window.innerHeight;
        canvas.width = window.innerWidth;
        this.cellColorContext = canvas.getContext("2d");
    }
    colorWallWithRandomColor(cell) {
        console.log("AT WALL COLORING", cell);
        const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16);
        this.cellColorContext.fillStyle = randomColor;
        this.cellColorContext.fillRect(cell.x, cell.y, cell.width, cell.height);
    }
}

class Box {
    constructor(height, width) {
        this.height = height;
        this.width = width;
    }
    buildBox(ctx, x, y) {
        ctx.fillRect(x, y, this.width, this.height);
        this.XBoundaries = [x, x + this.width];
        this.YBoundaries = [y, y + this.height];
    }
}

class Cell {
    constructor(x, y, width, height, type) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.buildBoundaries();
    }
    buildBoundaries() {
        this.left = this.x;
        this.right = this.x + this.width;
        this.top = this.y;
        this.bottom = this.y + this.height;
    }
}

class Maze {
    constructor(array, context, n_rows, n_columns) {
        this.array = array;
        this.context = context;
        this.cellWidth = window.innerWidth / n_rows;
        this.cellHeight = window.innerHeight / n_columns;
        this.cells = {};
    }
    buildMaze() {
        this.array.forEach((row, row_index) => {
            let columns = {}
            row.forEach((column, column_index) => {
                if (column == 0) {
                    const wall = this.drawWall(row_index, column_index);
                    columns[column_index] = wall;
                }
                if (column == 1) {
                    const path = this.drawPath(row_index, column_index);
                    columns[column_index] = path;
                }
            });
            this.cells[row_index] = columns;
        });
    }
    drawWall(row_index, column_index) {
        this.context.fillStyle = "black";
        const x = row_index * this.cellWidth;
        const y = column_index * this.cellHeight;
        this.context.fillRect(x, y, this.cellWidth, this.cellHeight);
        const wall = new Cell(x, y, this.cellWidth, this.cellHeight, 'w');
        return wall;
    }
    drawPath(row_index, column_index) {
        this.context.fillStyle = "purple";
        const x = row_index * this.cellWidth;
        const y = column_index * this.cellHeight;
        this.context.fillRect(x, y, this.cellWidth, this.cellHeight);
        const path = new Cell(x, y, this.cellWidth, this.cellHeight, 'p');
        return path;
    }
}

let MIDI_ARRAY = [];
async function populateMidiArray() {
    // Initialize player and register event handler
    const Player = new MidiPlayer.Player(function(event) {
        // console.log(event);
    });

    // Load a MIDI file
    await fetch("assets/zeldaoot.mid")
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            Player.loadArrayBuffer(arrayBuffer);
            MIDI_ARRAY = Player.getEvents()[1];
            MIDI_ARRAY = MIDI_ARRAY.filter(event => event["name"] == "Note on");
            console.log("ARRAY:",   MIDI_ARRAY);
    });
}

let myMaze = null;
let myBox = null;
function main(counter) {
    if (counter == 0) {
        const canvas = window.document.getElementById("bigGCanvas")
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const context = canvas.getContext("2d");
const array = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,0,1,1,1,0,1,1,0,1,1,1,0,1,0],
  [0,1,1,1,0,1,1,0,1,1,0,1,1,1,1,0],
  [0,0,1,1,1,0,1,1,1,0,1,1,0,1,1,0],
  [0,1,1,0,1,1,0,1,1,1,0,1,1,0,1,0],
  [0,1,0,1,1,0,1,1,0,1,1,0,1,1,1,0],
  [0,1,1,1,0,1,0,1,1,0,1,1,1,0,1,0],
  [0,0,1,1,1,1,1,0,1,1,0,1,1,1,1,0],
  [0,1,1,0,1,1,1,1,0,1,1,0,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];
        myMaze = new Maze(array, context, array.length, array[0].length);
        myBox = new Box(window.innerHeight, window.innerWidth);
        // myBox.buildBox(context, 0, 0);
        myMaze.buildMaze();
    }
    const cellRow = parseInt(prompt("please enter the cell row to spawn the ball"));
    const cellColumn = parseInt(prompt("please enter the cell column to spawn the ball"));
    const ballStartingPos = getPositionFromCell(cellRow, cellColumn);
    const myBall = new Ball(15, 200, 5, myMaze, myBox, ballStartingPos);
    myBall.startSynth();
    myBall.spawnBall();
    myBall.update();
}

function getPositionFromCell(cellRow, cellColumn) {
    const cell = myMaze.cells[cellColumn][cellRow];
    return {"x": cell.x, "y": cell.y}
}

populateMidiArray();
let counter = 0;
const button = window.document.createElement("button");
button.textContent = "Start";
button.style.fontFamily = "cursive";
button.style.fontSize = "40px";
button.style.pointerEvents = "auto";
button.style.position = "absolute";
button.style.zIndex = 20;
button.addEventListener('click', () => {
    button.style.backgroundColor = "black";
    button.style.zIndex = 20;
    main(counter);
    counter++;
});
window.document.body.appendChild(button);