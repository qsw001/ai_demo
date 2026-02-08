// 输入处理
export class Input {
    constructor() {
        this.direction = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };
        this.hasStarted = false;
        
        // 键位映射
        this.keyMap = {
            'ArrowUp': { x: 0, y: -1 },
            'ArrowDown': { x: 0, y: 1 },
            'ArrowLeft': { x: -1, y: 0 },
            'ArrowRight': { x: 1, y: 0 },
            'w': { x: 0, y: -1 },
            's': { x: 0, y: 1 },
            'a': { x: -1, y: 0 },
            'd': { x: 1, y: 0 }
        };

        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (this.keyMap[e.key]) {
                const newDir = this.keyMap[e.key];
                
                // 禁止直接反向
                if (this.direction.x + newDir.x === 0 && this.direction.y + newDir.y === 0) {
                    return;
                }
                
                // 缓存下一次输入，防止一帧内多次按键导致自杀
                this.nextDirection = newDir;
                this.hasStarted = true;
            } else if (e.code === 'Space') {
                this.onSpacePressed && this.onSpacePressed();
            }
        });
    }

    // 在每一帧更新时调用，应用缓存的方向
    update() {
        if (this.nextDirection.x !== 0 || this.nextDirection.y !== 0) {
            this.direction = this.nextDirection;
        }
        return this.direction;
    }

    reset() {
        this.direction = { x: 1, y: 0 }; // 默认向右
        this.nextDirection = { x: 1, y: 0 };
        this.hasStarted = false;
    }
}
