import { Game } from './Game.js';
import { Config } from './Config.js';

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    canvas.width = Config.CANVAS_WIDTH;
    canvas.height = Config.CANVAS_HEIGHT;

    // 启动游戏实例
    const game = new Game(canvas);
};
