import { Bullet } from './Bullet.js';

export class BulletManager {
    constructor() {
        this.bullets = [];
    }

    spawn(x, y, direction, ownerType) {
        this.bullets.push(new Bullet(x, y, direction, ownerType));
    }

    update() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update();
            if (b.isDead) {
                this.bullets.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.bullets.forEach(b => b.draw(ctx));
    }

    reset() {
        this.bullets = [];
    }
}
