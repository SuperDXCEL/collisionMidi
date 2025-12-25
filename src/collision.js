import MidiPlayer from 'midi-player-js';
import * as Tone from "tone";

const FPS = 480;
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
            // Calculate time of the note that just played
            previousNoteTime = MIDI_ARRAY[this.noteCounter - 1].tick * SECONDS_PER_TICK;
        } catch (e) {
            previousNoteTime = 0;
        }

        // Calculate time of the NEXT note
        const currNoteTime = MIDI_ARRAY[this.noteCounter].tick * SECONDS_PER_TICK;
        
        // Calculate the duration available for the ball to travel to the next wall
        let time_between_notes = Math.abs(currNoteTime - previousNoteTime);
        
        // Safety: prevent division by zero or super-low values that cause infinite speed
        if (time_between_notes < 0.05) {
            time_between_notes = 0.1; 
        }

        // Factor = (How long it currently takes) / (How long it MUST take)
        // Avoid NaN if prediction failed
        const factor = isNaN(time_till_collision) || time_till_collision === 0 
            ? 1 
            : time_till_collision / time_between_notes;

        // Apply the factor to current velocities
        let newVelX = this.velX * factor;
        let newVelY = this.velY * factor;

        // --- SPEED CLAMPING (The "Anti-Ghosting" Logic) ---
        // The ball must not move more than ~80% of a cell width per frame.
        // Otherwise, it will "tunnel" through the wall before the check happens.
        const maxSafePixelPerFrame = this.mazeRef.cellWidth * 0.8;
        const maxSafeVelocity = maxSafePixelPerFrame * FPS;

        const currentSpeed = Math.sqrt(newVelX ** 2 + newVelY ** 2);

        if (currentSpeed > maxSafeVelocity) {
            const reductionRatio = maxSafeVelocity / currentSpeed;
            newVelX *= reductionRatio;
            newVelY *= reductionRatio;
            console.warn("Velocity capped to prevent wall-phasing");
        }

        // Minimum speed check to prevent the ball from stopping
        const minSpeed = 50; 
        if (currentSpeed < minSpeed) {
            const boostRatio = minSpeed / (currentSpeed || 1);
            newVelX *= boostRatio;
            newVelY *= boostRatio;
        }

        this.velX = newVelX;
        this.velY = newVelY;

        console.log("ADJUSTED VELOCITY:", this.velX, this.velY, "FACTOR:", factor);
}
    update() {
        const dt = 1 / FPS;
        this.prevPositionX = this.position["x"];
        this.prevPositionY = this.position["y"];
        
        this.position["x"] += this.velX * dt;
        this.position["y"] += this.velY * dt;

        const gridX = Math.floor(this.position['x'] / this.mazeRef.cellWidth);
        const gridY = Math.floor(this.position['y'] / this.mazeRef.cellHeight);

        // CHECK IF OUT OF BOUNDS
        if (!this.mazeRef.cells[gridX] || !this.mazeRef.cells[gridX][gridY]) {
            this.position["x"] = this.prevPositionX;
            this.position["y"] = this.prevPositionY;
            this.velX = -this.velX;
            this.velY = -this.velY;
            this.noteCounter++;
        } else {
            let cell = this.mazeRef.cells[gridX][gridY];
            if (cell.type == 'w') {
                this.handleBoxCollision(cell, [gridX, gridY]);
            }
        }
        
        this.drawBall();
        setTimeout(() => this.update(), 1000/FPS);
    }
    predictNextCollision(cell) {
        console.log("CELL: ", cell);
        console.log("CURRENT POSITION", this.position["x"], this.position["y"]);
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
        console.log("GOT EXACT POINT: ", exact_point);
        console.log("CURRXY", currX, currY)
        this.time_till_next_collisition = this.calculate_time_till_next_collision(exact_point);
        console.log("TIME TILL NEXT COLLISION: ", this.time_till_next_collisition);
        // currCell holds the next cell
        this.colorWallWithRandomColor(currCell);
    }
    predictExactPoint(currCell) {
        const px = this.position.x;
        const py = this.position.y;
        const vx = this.velX;
        const vy = this.velY;

        let tx = Infinity;
        let ty = Infinity;

        // Time to hit the relevant face of the wall
        if (vx > 0) tx = (currCell.left - px) / vx;
        else if (vx < 0) tx = (currCell.right - px) / vx;

        if (vy > 0) ty = (currCell.top - py) / vy;
        else if (vy < 0) ty = (currCell.bottom - py) / vy;

        // Pick the smallest POSITIVE time. 
        // We use 0.001 to ignore the wall we are currently snapped to.
        const t = Math.min(tx > 0.001 ? tx : Infinity, ty > 0.001 ? ty : Infinity);

        if (t === Infinity) return { x: px, y: py };

        return {
            x: px + vx * t,
            y: py + vy * t
        };
    }
    calculate_time_till_next_collision(point_of_collision) {
        const distance_between_x = point_of_collision["x"] - this.position["x"];
        const distance_between_y = point_of_collision["y"] - this.position["y"];
        
        // Total distance to collision point
        const total_distance = Math.sqrt(distance_between_x ** 2 + distance_between_y ** 2);
        
        // Total velocity magnitude
        const total_velocity = Math.sqrt(this.velX ** 2 + this.velY ** 2);
        
        const time_till_collision = total_distance / total_velocity;
        
        if (time_till_collision == 0) {
            // print();
        }
        console.log("Distance:", total_distance, "Velocity:", total_velocity, "Time:", time_till_collision);
        
        return time_till_collision;
    }
    handleBoxCollision(cell, currentCellIndex) {
        //left-right 
        if (this.prevPositionX < cell.left && this.position["x"] >= cell.left) {
            console.log("JUST COLLIDED: ", this.position["x"], this.position["y"]);
            this.velX = -this.velX;
            this.position["x"] = cell.left - 0.1
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
            console.log("JUST COLLIDED: ", this.position["x"], this.position["y"]);
            this.velX = -this.velX;
            this.position["x"] = cell.right + 0.1
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
            console.log("JUST COLLIDED: ", this.position["x"], this.position["y"]);
            this.velY = -this.velY;
            this.position["y"] = cell.top - 0.1;
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
            console.log("JUST COLLIDED: ", this.position["x"], this.position["y"]);
            this.velY = -this.velY;
            //snap back
            this.position["y"] = cell.bottom + 0.1;
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