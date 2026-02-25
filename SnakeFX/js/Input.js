
// 输入处理
export class Input {
    constructor() {
        this.direction = { x: 1, y: 0 }; // 当前生效的方向 (默认为右)
        this.queue = []; // 输入缓冲队列
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
            // 防止按键重复触发 (key repeat)
            if (e.repeat) return;

            if (this.keyMap[e.key]) {
                const newDir = this.keyMap[e.key];
                
                // 获取最后计划的方向 (如果队列有值，取队列最后一个；否则取当前生效方向)
                const lastPlannedDir = this.queue.length > 0 
                    ? this.queue[this.queue.length - 1] 
                    : this.direction;

                // 1. 禁止直接反向 (基于最后计划的方向判断)
                if (lastPlannedDir.x + newDir.x === 0 && lastPlannedDir.y + newDir.y === 0) {
                    return;
                }

                // 2. 禁止同向 (可选，避免队列堆积无用输入)
                if (lastPlannedDir.x === newDir.x && lastPlannedDir.y === newDir.y) {
                    return;
                }
                
                // 3. 限制队列长度 (防止输入积压过多，通常存2步就够了)
                if (this.queue.length < 2) {
                    this.queue.push(newDir);
                    this.hasStarted = true;
                }
            } else if (e.code === 'Space') {
                this.onSpacePressed && this.onSpacePressed();
            }
        });
    }

    // 获取并消耗下一个方向 (由 Snake 在移动 Tick 时调用)
    popDirection() {
        if (this.queue.length > 0) {
            this.direction = this.queue.shift();
        }
        return this.direction;
    }

    // 重置状态
    reset() {
        this.direction = { x: 1, y: 0 }; // 默认向右
        this.queue = [];
        this.hasStarted = false;
    }

    // 兼容旧接口 (如果其他地方还在调用 update)
    update() {
        return this.direction;
    }
}
