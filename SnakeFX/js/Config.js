// 全局配置
export const Config = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    GRID_SIZE: 20,
    FPS: 60,
    
    // 颜色配置
    COLORS: {
        BG: '#1a1a1a',
        SNAKE_HEAD: '#4caf50',
        SNAKE_BODY: '#81c784',
        ENEMY_HEAD: '#f44336',
        ENEMY_BODY: '#e57373',
        ENEMY_RESOURCE: '#ffd700', // 资源型AI (金色)
        ENEMY_AGGRESSIVE: '#ff4444', // 攻击型AI (红色)
        FOOD: '#ffeb3b',
        TEXT: '#ffffff',
        BULLET_PLAYER: '#a5d6a7',
        BULLET_ENEMY: '#ff8a80'
    },

    // 游戏规则
    SNAKE_SPEED: 150, // 移动间隔(ms)
    ENEMY_SPAWN_INTERVAL: 7000, // 敌方生成间隔(ms)
    MAX_ENEMIES: 5,
    WIN_LENGTH: 50, // 胜利条件
    MIN_FOODS: 3,   // 地图最少糖豆数
    
    // 子弹配置
    BULLET_SPEED: 1, // 像素/帧 (降低一半，给玩家反应时间)
    BULLET_COOLDOWN: 500, // ms
    BULLET_COST: 1, // 发射消耗身体长度

    // 特效配置
    SHAKE_INTENSITY: 10,
    SHAKE_DURATION: 300,
    PARTICLE_COUNT: 15
};
