export class AudioSystem {
    constructor() {
        this.ctx = null;
        this.bgmOscillators = [];
        this.bgmInterval = null;
        this.isMuted = false;
        this.bgmNoteIndex = 0;
        
        // MP3 BGM
        this.bgmAudio = new Audio('assets/audio/bgm.mp3');
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = 0.5;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ... playTone and other SFX methods remain the same ...
    
    // 播放音调
    playTone(freq, type, duration, startTime = 0, vol = 0.1) {
        if (!this.ctx || this.isMuted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    // 1. 吃豆音效：清脆的高音跳跃
    playEat() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    // 2. 敌人生成：低沉的警告音
    playEnemySpawn() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(300, t + 0.3);
        
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    // 3. 敌人死亡：破碎声
    playEnemyDie() {
        if (!this.ctx) return;
        this.playNoise(0.2);
    }

    // 4. 玩家死亡：悲伤的长滑音 + 噪音
    playPlayerDie() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        
        // 滑音
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.5);

        // 噪音
        this.playNoise(0.5);
    }

    // 辅助：生成白噪声
    playNoise(duration) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }

    // 5. 背景音乐：播放 MP3 文件
    startBGM() {
        this.bgmAudio.play().catch(e => {
            console.log("Audio play failed (waiting for interaction):", e);
        });
    }

    stopBGM() {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
    }
}
