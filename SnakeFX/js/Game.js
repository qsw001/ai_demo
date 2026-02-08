import { Config } from './Config.js';
import { Utils } from './Utils.js';
import { Snake } from './Snake.js';
import { EnemySnake } from './EnemySnake.js';
import { Food } from './Food.js';
import { Input } from './Input.js';
import { ParticleSystem } from './ParticleSystem.js';
import { AudioSystem } from './AudioSystem.js';
import { BulletManager } from './BulletManager.js';

const STATE = {
    READY: 0,
    RUNNING: 1,
    OVER: 2,
    VICTORY: 3
};

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = Config.CANVAS_WIDTH;
        this.height = Config.CANVAS_HEIGHT;
        this.gridCols = this.width / Config.GRID_SIZE;
        this.gridRows = this.height / Config.GRID_SIZE;

        // 初始化模块
        this.input = new Input();
        this.particles = new ParticleSystem();
        this.audio = new AudioSystem(); 
        this.snake = new Snake();
        this.bulletManager = new BulletManager(); // 子弹管理
        this.foods = []; // 支持多个食物
        this.enemies = [];

        this.state = STATE.READY;
        this.lastTime = 0;
        this.enemySpawnTimer = 0;
        this.shakeTimer = 0;
        
        // 绑定按键
        this.input.onSpacePressed = () => this.handleSpace();
        
        // 绑定射击键 (J键)
        window.addEventListener('keydown', (e) => {
            if (this.state === STATE.RUNNING) {
                if (e.key === 'j' || e.key === 'J') {
                    const bullet = this.snake.shoot();
                    if (bullet) {
                        this.bulletManager.spawn(bullet.x, bullet.y, bullet.direction, 'player');
                        // 播放射击音效 (可选)
                        this.audio.playTone(400, 'square', 0.05, 0, 0.05);
                    }
                }
            }
        });

        // 启动循环
        requestAnimationFrame((t) => this.loop(t));
    }

    handleSpace() {
        this.audio.init();

        if (this.state === STATE.READY || this.state === STATE.OVER || this.state === STATE.VICTORY) {
            this.reset();
            this.state = STATE.RUNNING;
            this.audio.startBGM();
        }
    }

    reset() {
        this.snake.reset();
        this.enemies = [];
        this.foods = [];
        this.bulletManager.reset();
        this.particles.reset();
        
        // 初始生成3个食物
        for(let i=0; i<Config.MIN_FOODS; i++) {
            this.spawnFood();
        }
        
        this.input.reset();
        this.enemySpawnTimer = 0;
        this.shakeTimer = 0;
    }

    spawnFood(pos = null) {
        const occupied = [...this.snake.body];
        this.enemies.forEach(e => occupied.push(...e.body));
        this.foods.forEach(f => occupied.push({x: f.x, y: f.y}));
        
        const f = new Food(pos ? pos.x : undefined, pos ? pos.y : undefined);
        if (!pos) f.spawn(occupied);
        this.foods.push(f);
    }

    update(dt) {
        if (this.state !== STATE.RUNNING) return;

        if (this.shakeTimer > 0) this.shakeTimer -= dt;

        // 胜利检测
        if (this.snake.body.length >= Config.WIN_LENGTH) {
            this.gameVictory();
            return;
        }

        // 1. 更新玩家
        const dir = this.input.update();
        this.snake.update(dt, dir, this.gridCols, this.gridRows);

        if (this.snake.isDead) {
            this.gameOver();
            return;
        }

        // 2. 更新敌人
        this.updateEnemies(dt);

        // 3. 更新子弹
        this.bulletManager.update();

        // 4. 更新粒子 & 食物
        this.particles.update();
        this.foods.forEach(f => f.update(dt));

        // 5. 补充食物
        if (this.foods.length < Config.MIN_FOODS) {
            this.spawnFood();
        }

        // 6. 碰撞检测
        this.checkCollisions();
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        try {
            this.update(dt);
            this.draw();
        } catch (e) {
            console.error("Game Loop Error:", e);
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    updateEnemies(dt) {
        // 生成敌人
        this.enemySpawnTimer += dt;
        if (this.enemySpawnTimer > Config.ENEMY_SPAWN_INTERVAL && this.enemies.length < Config.MAX_ENEMIES) {
            this.enemySpawnTimer = 0;
            const pos = { x: Utils.randomInt(0, this.gridCols-1), y: Utils.randomInt(0, this.gridRows-1) };
            if (!Utils.isCollidingWithBody(pos.x, pos.y, this.snake.body)) {
                // 随机类型
                const type = Math.random() > 0.5 ? 'RESOURCE' : 'AGGRESSIVE';
                this.enemies.push(new EnemySnake(pos, 5, type));
                this.audio.playEnemySpawn();
            }
        }

        // 更新每个敌人
        this.enemies.forEach(enemy => {
            enemy.update(dt, this.gridCols, this.gridRows, this.snake.body, this.foods);
            
            // 尝试射击
            const bulletInfo = enemy.tryShoot(this.snake.body);
            if (bulletInfo) {
                this.bulletManager.spawn(bulletInfo.x, bulletInfo.y, bulletInfo.direction, 'enemy');
                // 敌人射击音效
                this.audio.playTone(300, 'sawtooth', 0.05, 0, 0.03);
            }
        });

        this.enemies = this.enemies.filter(e => !e.isDead);
    }

    checkCollisions() {
        const head = this.snake.getHead();

        // 1. 吃食物
        for (let i = this.foods.length - 1; i >= 0; i--) {
            const f = this.foods[i];
            if (head.x === f.x && head.y === f.y) {
                this.snake.grow();
                this.audio.playEat();
                this.particles.explode(
                    head.x * Config.GRID_SIZE + Config.GRID_SIZE/2, 
                    head.y * Config.GRID_SIZE + Config.GRID_SIZE/2, 
                    f.color, 
                    Config.PARTICLE_COUNT
                );
                this.foods.splice(i, 1);
            }
        }

        // 2. 玩家撞敌人
        for (let enemy of this.enemies) {
            if (Utils.isCollidingWithBody(head.x, head.y, enemy.body)) {
                this.snake.isDead = true;
                this.gameOver();
                return;
            }
            const enemyHead = enemy.getHead();
            if (Utils.isCollidingWithBody(enemyHead.x, enemyHead.y, this.snake.body)) {
                this.killEnemy(enemy);
            }
        }

        // 3. 子弹碰撞
        for (let i = this.bulletManager.bullets.length - 1; i >= 0; i--) {
            const b = this.bulletManager.bullets[i];
            const bGrid = b.getGridPos();

            // 击中玩家
            if (b.ownerType === 'enemy') {
                if (Utils.isCollidingWithBody(bGrid.x, bGrid.y, this.snake.body)) {
                    this.snake.isDead = true;
                    b.isDead = true;
                    this.gameOver();
                    return;
                }
            }

            // 击中敌人
            if (b.ownerType === 'player') {
                for (let enemy of this.enemies) {
                    if (Utils.isCollidingWithBody(bGrid.x, bGrid.y, enemy.body)) {
                        this.killEnemy(enemy);
                        b.isDead = true;
                        break;
                    }
                }
            }
        }
    }

    killEnemy(enemy) {
        enemy.isDead = true;
        this.audio.playEnemyDie();
        this.triggerShake();
        
        const head = enemy.getHead();
        this.particles.explode(
            head.x * Config.GRID_SIZE, 
            head.y * Config.GRID_SIZE, 
            Config.COLORS.ENEMY_BODY, 
            20
        );

        // 掉落食物
        const dropCount = Math.floor(enemy.body.length / 2);
        for(let i=0; i<dropCount; i++) {
            // 在死亡位置附近随机散落
            const pos = {
                x: Math.max(0, Math.min(this.gridCols-1, head.x + Utils.randomInt(-2, 2))),
                y: Math.max(0, Math.min(this.gridRows-1, head.y + Utils.randomInt(-2, 2)))
            };
            this.spawnFood(pos);
        }
    }

    gameVictory() {
        this.state = STATE.VICTORY;
        this.audio.stopBGM();
        // 胜利音效?
        this.audio.playTone(600, 'sine', 0.2, 0, 0.2);
        this.audio.playTone(800, 'sine', 0.4, 0.2, 0.2);
    }

    gameOver() {
        this.state = STATE.OVER;
        this.triggerShake();
        this.audio.playPlayerDie();
        this.audio.stopBGM();
        this.snake.body.forEach(seg => {
            this.particles.explode(
                seg.x * Config.GRID_SIZE, 
                seg.y * Config.GRID_SIZE, 
                Config.COLORS.SNAKE_BODY, 
                5
            );
        });
    }

    draw() {
        this.ctx.fillStyle = Config.COLORS.BG;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        if (this.shakeTimer > 0) {
            const dx = (Math.random() - 0.5) * Config.SHAKE_INTENSITY;
            const dy = (Math.random() - 0.5) * Config.SHAKE_INTENSITY;
            this.ctx.translate(dx, dy);
        }

        this.foods.forEach(f => f.draw(this.ctx));
        this.bulletManager.draw(this.ctx);
        this.snake.draw(this.ctx);
        this.enemies.forEach(e => e.draw(this.ctx));
        this.particles.draw(this.ctx);
        this.ctx.restore();

        this.drawUI();
    }

    drawUI() {
        this.ctx.fillStyle = Config.COLORS.TEXT;
        this.ctx.textAlign = 'center';
        
        if (this.state === STATE.READY) {
            this.ctx.font = '30px Arial';
            this.ctx.fillText("SHOOTER SNAKE", this.width/2, this.height/2 - 40);
            this.ctx.font = '20px Arial';
            this.ctx.fillText("按空格键开始", this.width / 2, this.height / 2);
            this.ctx.font = '14px Arial';
            this.ctx.fillText("移动: 方向键 | 射击: J 键 (消耗长度)", this.width / 2, this.height / 2 + 40);
        } else if (this.state === STATE.OVER) {
            this.ctx.font = '40px Arial';
            this.ctx.fillStyle = '#ff4444';
            this.ctx.fillText("GAME OVER", this.width / 2, this.height / 2);
            this.ctx.fillStyle = Config.COLORS.TEXT;
            this.ctx.font = '20px Arial';
            this.ctx.fillText("按空格键重试", this.width / 2, this.height / 2 + 50);
        } else if (this.state === STATE.VICTORY) {
            this.ctx.font = '40px Arial';
            this.ctx.fillStyle = '#ffd700';
            this.ctx.fillText("VICTORY!", this.width / 2, this.height / 2);
            this.ctx.fillStyle = Config.COLORS.TEXT;
            this.ctx.font = '20px Arial';
            this.ctx.fillText("你成为了蛇王!", this.width / 2, this.height / 2 + 50);
        } else {
            this.ctx.textAlign = 'left';
            this.ctx.font = '16px Arial';
            this.ctx.fillText(`长度: ${this.snake.body.length}/${Config.WIN_LENGTH}`, 10, 25);
            
            // 冷却提示
            if (this.snake.canShoot()) {
                 this.ctx.fillStyle = '#4caf50';
                 this.ctx.fillText("射击就绪 [J]", 10, 50);
            } else {
                 this.ctx.fillStyle = '#888';
                 this.ctx.fillText("充能中...", 10, 50);
            }
        }
    }
}
