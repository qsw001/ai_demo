import { Config } from './Config.js';
import { Utils } from './Utils.js';

export class Food {
    constructor(x, y) {
        this.x = x !== undefined ? x : 0;
        this.y = y !== undefined ? y : 0;
        this.color = Config.COLORS.FOOD;
        this.time = Math.random() * 1000; // 随机初始相位
        this.gridCols = Config.CANVAS_WIDTH / Config.GRID_SIZE;
        this.gridRows = Config.CANVAS_HEIGHT / Config.GRID_SIZE;
        
        if (x === undefined) {
            // 如果没有指定位置，则稍后由 spawn 调用生成
        } else {
            // 指定了位置（掉落生成），随机颜色
            this.color = `hsl(${Math.random() * 60 + 30}, 100%, 50%)`;
        }
    }

    spawn(occupiedPositions) {
        let valid = false;
        while (!valid) {
            this.x = Utils.randomInt(0, this.gridCols - 1);
            this.y = Utils.randomInt(0, this.gridRows - 1);
            
            valid = !Utils.isCollidingWithBody(this.x, this.y, occupiedPositions);
        }
        this.color = `hsl(${Math.random() * 60 + 30}, 100%, 50%)`;
    }

    update(dt) {
        this.time += dt;
    }

    draw(ctx) {
        const size = Config.GRID_SIZE;
        const px = this.x * size + size / 2;
        const py = this.y * size + size / 2;
        
        // 呼吸动画
        const scale = 1 + Math.sin(this.time * 0.005) * 0.2;
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(px, py, (size / 2 - 2) * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // 发光效果
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}
