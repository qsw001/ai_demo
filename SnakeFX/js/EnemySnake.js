import { Config } from './Config.js';
import { Utils } from './Utils.js';

export class EnemySnake {
    constructor(startPos, length = 5, type = 'RESOURCE') {
        this.body = [];
        for (let i = 0; i < length; i++) {
            this.body.push({ x: startPos.x, y: startPos.y });
        }
        
        this.type = type; // 'RESOURCE' | 'AGGRESSIVE'
        this.direction = { x: 1, y: 0 };
        this.moveTimer = 0;
        this.isDead = false;
        
        // 属性差异
        if (type === 'RESOURCE') {
            this.colorHead = Config.COLORS.ENEMY_RESOURCE;
            this.colorBody = Config.COLORS.ENEMY_BODY;
            this.speed = Config.SNAKE_SPEED * 1.5; 
        } else {
            this.colorHead = Config.COLORS.ENEMY_AGGRESSIVE;
            this.colorBody = Config.COLORS.ENEMY_BODY;
            this.speed = Config.SNAKE_SPEED * 1.2; // 攻击型稍快
        }

        // 射击系统
        this.bulletCooldown = 0;
        this.shootRange = 15; // 射程（网格数）
    }

    update(dt, gridCols, gridRows, playerBody, foods) {
        if (this.isDead) return;

        if (this.bulletCooldown > 0) this.bulletCooldown -= dt;

        this.moveTimer += dt;
        if (this.moveTimer >= this.speed) {
            this.moveTimer = 0;
            this.decideMove(gridCols, gridRows, playerBody, foods);
            this.move(gridCols, gridRows);
        }
    }

    decideMove(cols, rows, playerBody, foods) {
        const head = this.body[0];
        const moves = [
            { x: 0, y: -1 }, { x: 0, y: 1 },
            { x: -1, y: 0 }, { x: 1, y: 0 }
        ];

        // 1. 获取所有安全移动方向
        const validMoves = moves.filter(m => !(m.x === -this.direction.x && m.y === -this.direction.y));
        const safeMoves = validMoves.filter(m => {
            const nx = head.x + m.x;
            const ny = head.y + m.y;
            if (!Utils.isInsideGrid(nx, ny, cols, rows)) return false;
            if (Utils.isCollidingWithBody(nx, ny, this.body)) return false;
            if (Utils.isCollidingWithBody(nx, ny, playerBody)) return false;
            return true;
        });

        if (safeMoves.length === 0) return;

        // 2. 根据类型选择目标
        let target = null;
        const playerHead = playerBody[0];

        if (this.type === 'RESOURCE') {
            // 寻找最近的食物
            if (foods.length > 0) {
                target = this.findClosest(head, foods);
            }
        } else {
            // 攻击型：优先追踪玩家，其次食物
            if (playerBody.length > 0) {
                target = playerHead;
            } else if (foods.length > 0) {
                target = this.findClosest(head, foods);
            }
        }

        // 3. 移动决策
        if (target) {
            safeMoves.sort((a, b) => {
                const da = Math.abs((head.x + a.x) - target.x) + Math.abs((head.y + a.y) - target.y);
                const db = Math.abs((head.x + b.x) - target.x) + Math.abs((head.y + b.y) - target.y);
                return da - db;
            });
            this.direction = safeMoves[0];
        } else {
            const idx = Utils.randomInt(0, safeMoves.length - 1);
            this.direction = safeMoves[idx];
        }
    }

    findClosest(head, targets) {
        let closest = null;
        let minDist = Infinity;
        for(const t of targets) {
            const dist = Math.abs(head.x - t.x) + Math.abs(head.y - t.y);
            if(dist < minDist) {
                minDist = dist;
                closest = t;
            }
        }
        return closest;
    }

    // 尝试射击（由Game主循环调用）
    tryShoot(playerBody) {
        if (this.bulletCooldown > 0 || this.body.length <= Config.BULLET_COST + 1) return null;

        const head = this.body[0];
        const playerHead = playerBody[0];

        // 只有攻击型AI会主动射击玩家
        // 资源型AI只有在被堵住时可能会射击（简化：资源型暂不射击，或仅低频射击）
        
        let shouldShoot = false;

        if (this.type === 'AGGRESSIVE') {
            // 检查是否在直线上且距离合适
            const dx = playerHead.x - head.x;
            const dy = playerHead.y - head.y;
            
            // 水平直线
            if (dy === 0 && Math.abs(dx) <= this.shootRange) {
                // 检查朝向是否正确
                if ((dx > 0 && this.direction.x > 0) || (dx < 0 && this.direction.x < 0)) {
                    shouldShoot = true;
                }
            }
            // 垂直直线
            else if (dx === 0 && Math.abs(dy) <= this.shootRange) {
                if ((dy > 0 && this.direction.y > 0) || (dy < 0 && this.direction.y < 0)) {
                    shouldShoot = true;
                }
            }
        }

        if (shouldShoot) {
            this.bulletCooldown = Config.BULLET_COOLDOWN * 2; // 敌人射击频率比玩家低
            
            for(let i=0; i<Config.BULLET_COST; i++) this.body.pop();

            return {
                x: head.x,
                y: head.y,
                direction: { ...this.direction },
                ownerType: 'enemy'
            };
        }
        return null;
    }

    move(cols, rows) {
        const head = this.body[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };

        // 最后的安全检查（防止上一帧还没死，这一帧撞了）
        if (!Utils.isInsideGrid(newHead.x, newHead.y, cols, rows)) {
            this.isDead = true;
            return;
        }

        this.body.unshift(newHead);
        this.body.pop();
    }

    draw(ctx) {
        const size = Config.GRID_SIZE;
        this.body.forEach((segment, index) => {
            const px = segment.x * size;
            const py = segment.y * size;
            
            ctx.fillStyle = index === 0 ? this.colorHead : this.colorBody;
            ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
        });
    }

    getHead() {
        return this.body[0];
    }
}
