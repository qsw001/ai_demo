import { Config } from './Config.js';
import { Utils } from './Utils.js';

export class Bullet {
    constructor(x, y, direction, ownerType) {
        this.x = x;
        this.y = y;
        this.direction = direction; // {x, y}
        this.ownerType = ownerType; // 'player' or 'enemy'
        this.speed = Config.BULLET_SPEED;
        this.isDead = false;
        
        // 调整初始位置到网格中心
        const size = Config.GRID_SIZE;
        this.pixelX = x * size + size / 2;
        this.pixelY = y * size + size / 2;
        
        this.color = ownerType === 'player' ? Config.COLORS.BULLET_PLAYER : Config.COLORS.BULLET_ENEMY;
    }

    update() {
        this.pixelX += this.direction.x * this.speed;
        this.pixelY += this.direction.y * this.speed;

        // 边界检查
        if (this.pixelX < 0 || this.pixelX > Config.CANVAS_WIDTH ||
            this.pixelY < 0 || this.pixelY > Config.CANVAS_HEIGHT) {
            this.isDead = true;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.pixelX, this.pixelY, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 获取当前的网格坐标（用于碰撞检测）
    getGridPos() {
        return {
            x: Math.floor(this.pixelX / Config.GRID_SIZE),
            y: Math.floor(this.pixelY / Config.GRID_SIZE)
        };
    }
}
