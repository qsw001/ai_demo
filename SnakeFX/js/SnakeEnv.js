import { Config } from './Config.js';
import { Utils } from './Utils.js';

export class SnakeEnv {
    constructor(game) {
        this.game = game;
        this.actionSpace = 4; // Up, Down, Left, Right
        this.stateSize = 9; // Food Dir (2) + Danger (3) + Direction (4) = 9 inputs
    }

    reset() {
        this.game.reset();
        
        // In training mode, we disable enemies and bullets to simplify the task
        this.game.enemies = [];
        this.game.bulletManager.bullets = [];
        
        this.steps = 0;
        
        // Ensure food exists
        if (this.game.foods.length === 0) {
             this.game.spawnFood();
        }

        this.lastDist = this.getDistanceToFood();
        
        return this.getState();
    }

    step(action) {
        this.steps++;
        const snake = this.game.snake;
        
        // Map action to direction
        let dir = { x: 0, y: 0 };
        if (action === 0) dir = { x: 0, y: -1 };
        else if (action === 1) dir = { x: 0, y: 1 };
        else if (action === 2) dir = { x: -1, y: 0 };
        else if (action === 3) dir = { x: 1, y: 0 };

        // Prevent reverse turn
        const lastDir = snake.lastDirection;
        if ((dir.x === -lastDir.x && dir.y === -lastDir.y && (dir.x !== 0 || dir.y !== 0))) {
            dir = lastDir; 
        }

        // Store food count before move to detect eating
        const prevFoodCount = this.game.foods.length;

        // Move snake
        snake.move(dir, this.game.gridCols, this.game.gridRows);
        
        // Check collisions
        this.game.checkCollisions();
        
        // Detect if food was eaten
        const currentFoodCount = this.game.foods.length;
        const ateFood = currentFoodCount < prevFoodCount;

        // Respawn food if needed (Training requires continuous food)
        if (this.game.foods.length < Config.MIN_FOODS) {
            this.game.spawnFood();
        }
        
        // Calculate Reward
        let reward = -0.01; // Step penalty
        let done = false;

        if (snake.isDead) {
            reward = -10;
            done = true;
        } else {
            if (ateFood) {
                reward = 10;
            } else {
                // Shaping: Distance to food
                const dist = this.getDistanceToFood();
                
                // Safe check for infinite distance
                if (!Number.isFinite(dist) || !Number.isFinite(this.lastDist)) {
                    // Fallback if distance calc fails
                    reward = 0;
                } else {
                    if (dist < this.lastDist) {
                        reward += 0.1; // Closer
                    } else {
                        reward -= 0.1; // Further
                    }
                }
                this.lastDist = dist;
            }
        }
        
        // Prevent infinite loops
        if (this.steps > 2000) { 
            done = true; 
        }

        return {
            state: this.getState(),
            reward: reward,
            done: done
        };
    }

    getDistanceToFood() {
        const head = this.game.snake.getHead();
        if (!head) return 0; // Should not happen

        let minDist = Infinity;
        if (this.game.foods.length === 0) return 0;

        for (let f of this.game.foods) {
            const d = Math.abs(head.x - f.x) + Math.abs(head.y - f.y);
            if (d < minDist) minDist = d;
        }
        return minDist === Infinity ? 0 : minDist;
    }

    getState() {
        const snake = this.game.snake;
        const head = snake.getHead();
        
        if (!head) {
             // Fallback state if dead/invalid
             return new Array(this.stateSize).fill(0);
        }

        // 1. Find closest food
        let closestFood = null;
        let minDist = Infinity;
        
        if (this.game.foods.length > 0) {
            for (let f of this.game.foods) {
                const d = Math.abs(head.x - f.x) + Math.abs(head.y - f.y);
                if (d < minDist) {
                    minDist = d;
                    closestFood = f;
                }
            }
        }
        
        if (!closestFood) closestFood = { x: head.x, y: head.y };

        // Relative direction to food (Sign)
        const dx = closestFood.x - head.x;
        const dy = closestFood.y - head.y;
        
        // 2. Danger detection
        // Fix-3: Use snake.lastDirection consistently
        const currentDir = snake.lastDirection || {x:1, y:0}; 
        
        // Relative vectors: Forward, Left, Right
        const forward = currentDir;
        const left = { x: currentDir.y, y: -currentDir.x };
        const right = { x: -currentDir.y, y: currentDir.x };
        
        const isDanger = (vec) => {
            const tx = head.x + vec.x;
            const ty = head.y + vec.y;
            // Wall
            if (!Utils.isInsideGrid(tx, ty, this.game.gridCols, this.game.gridRows)) return 1;
            // Body
            if (Utils.isCollidingWithBody(tx, ty, snake.body)) return 1;
            return 0;
        };

        // 3. Current Direction (One-hot 4)
        const dirState = [
            currentDir.y === -1 ? 1 : 0, // Up
            currentDir.y === 1 ? 1 : 0,  // Down
            currentDir.x === -1 ? 1 : 0, // Left
            currentDir.x === 1 ? 1 : 0   // Right
        ];

        const foodState = [
            Math.sign(dx),
            Math.sign(dy)
        ];
        
        const dangerState = [
            isDanger(forward),
            isDanger(left),
            isDanger(right)
        ];

        // Total: 2 + 3 + 4 = 9 inputs
        const state = [...foodState, ...dangerState, ...dirState];
        
        // Final NaN check - Fix-5
        return state.map(v => Number.isFinite(v) ? v : 0);
    }
}
