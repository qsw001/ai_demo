// 工具函数
export const Utils = {
    // 生成范围随机整数 [min, max]
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

    // 生成随机颜色
    randomColor: () => `hsl(${Math.random() * 360}, 70%, 50%)`,

    // 碰撞检测：点是否在网格内
    isInsideGrid: (x, y, cols, rows) => {
        return x >= 0 && x < cols && y >= 0 && y < rows;
    },

    // 碰撞检测：坐标是否在数组中（用于检测撞自己/别人）
    isCollidingWithBody: (x, y, body) => {
        return body.some(segment => segment.x === x && segment.y === y);
    }
};
