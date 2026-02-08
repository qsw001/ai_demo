import { Config } from './Config.js';
import { Utils } from './Utils.js';

export class Snake {
    constructor() {
        this.reset();
    }

    reset() {
        // 初始位置
        this.body = [
            { x: 10, y: 10 }, // Head
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
        this.moveTimer = 0;
        this.growPending = 0;
        this.isDead = false;
        this.colorHead = Config.COLORS.SNAKE_HEAD;
        this.colorBody = Config.COLORS.SNAKE_BODY;
        
        // 子弹系统
        this.bulletCooldown = 0;
        this.lastDirection = { x: 1, y: 0 }; // 记录最后移动方向用于射击
    }

    update(dt, inputDir, gridCols, gridRows) {
        if (this.isDead) return;

        // 更新射击冷却
        if (this.bulletCooldown > 0) {
            this.bulletCooldown -= dt;
        }

        this.moveTimer += dt;
        if (this.moveTimer >= Config.SNAKE_SPEED) {
            this.moveTimer = 0;
            this.move(inputDir, gridCols, gridRows);
        }
    }

    move(dir, cols, rows) {
        const head = this.body[0];
        // 如果输入方向为0（没按键），保持原方向
        if (dir.x !== 0 || dir.y !== 0) {
            this.lastDirection = dir;
        } else {
            // 这里有个小问题，input类会保持方向，所以dir通常不为0
            // 除非是初始化状态
        }
        
        // 确保使用当前实际移动方向更新 lastDirection
        // Input 类已经处理了反向逻辑，所以这里的 dir 是有效的移动方向
        this.lastDirection = dir;

        const newHead = {
            x: head.x + dir.x,
            y: head.y + dir.y
        };

        // 撞墙检测
        if (!Utils.isInsideGrid(newHead.x, newHead.y, cols, rows)) {
            this.isDead = true;
            return;
        }

        // 撞自己检测 (排除尾巴，因为尾巴会移走，除非刚好在长身体)
        // 简单起见，检测整个身体，如果是移动后的尾巴位置则不应碰撞
        // 但为了严谨，我们先移动再检测，或者检测 body 除去最后一个
        if (Utils.isCollidingWithBody(newHead.x, newHead.y, this.body.slice(0, -1))) {
            this.isDead = true;
            return;
        }

        this.body.unshift(newHead);

        if (this.growPending > 0) {
            this.growPending--;
        } else {
            this.body.pop();
        }
    }

    canShoot() {
        return this.bulletCooldown <= 0 && this.body.length > Config.BULLET_COST + 1;
    }

    shoot() {
        if (!this.canShoot()) return null;

        this.bulletCooldown = Config.BULLET_COOLDOWN;
        
        // 消耗身体
        for(let i=0; i<Config.BULLET_COST; i++) {
            if(this.body.length > 1) this.body.pop();
        }

        const head = this.body[0];
        return {
            x: head.x,
            y: head.y,
            direction: { ...this.lastDirection }
        };
    }

    grow() {
        this.growPending++;
    }

    draw(ctx) {
        const size = Config.GRID_SIZE;
        
        this.body.forEach((segment, index) => {
            const px = segment.x * size;
            const py = segment.y * size;
            
            ctx.fillStyle = index === 0 ? this.colorHead : this.colorBody;
            
            // 绘制圆角矩形或圆形
            ctx.beginPath();
            if (index === 0) {
                // 蛇头稍微大一点
                ctx.arc(px + size/2, py + size/2, size/2, 0, Math.PI * 2);
            } else {
                ctx.rect(px + 1, py + 1, size - 2, size - 2);
            }
            ctx.fill();
        });
    }

    getHead() {
        return this.body[0];
    }
}
