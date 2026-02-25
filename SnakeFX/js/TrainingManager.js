import { SnakeEnv } from './SnakeEnv.js';
import { DQNAgent } from './DQN.js';
import { Input } from './Input.js'; // Import Input for queue logic

export class TrainingManager {
    constructor(game) {
        this.game = game;
        this.env = new SnakeEnv(game);
        this.agent = new DQNAgent(this.env.stateSize, this.env.actionSpace);
        
        this.isTraining = false;
        this.isAI = false;
        this.episode = 0;
        this.totalSteps = 0;
        
        // AI Demo state management
        this.aiRestartCooldownUntil = 0;
        
        // AI Input Queue (Virtual Input)
        this.aiInput = new Input(); 
        // We override bindEvents to do nothing, as we push manually
        this.aiInput.bindEvents = () => {}; 
        
        // Debug Flag
        this.DEBUG = false;

        // Stats
        this.stats = {
            rewards: [], // Episode rewards
            scores: [],  // Episode lengths/scores
            epsilons: []
        };
        
        this.currentEpisodeReward = 0;
        this.lastUIUpdate = 0;
        
        this.config = {
            batchSize: 32,
            speed: 1, // Steps per frame
            render: true
        };

        this.setupUI();
    }

    setupUI() {
        const btnManual = document.getElementById('btn-manual');
        const btnAI = document.getElementById('btn-ai');
        const btnTrain = document.getElementById('btn-train');
        
        if(btnManual) {
            btnManual.onclick = () => this.setMode('MANUAL');
            btnAI.onclick = () => this.setMode('AI');
            btnTrain.onclick = () => this.setMode('TRAINING');
        }

        const btnSave = document.getElementById('btn-save');
        const btnLoad = document.getElementById('btn-load');
        if(btnSave) btnSave.onclick = async () => {
            try {
                await this.agent.save();
                alert('Model saved successfully!');
            } catch(e) {
                alert('Save failed: ' + e.message);
            }
        };
        if(btnLoad) btnLoad.onclick = async () => {
            try {
                await this.agent.load();
                this.agent.epsilon = 0.05; // Set low epsilon for demo
                alert('Model loaded successfully! Ready for AI Demo.');
                // Update UI immediately
                this.updateUI();
            } catch(e) {
                alert('Load failed: ' + e.message);
            }
        };

        const sliderSpeed = document.getElementById('slider-speed');
        if(sliderSpeed) {
            sliderSpeed.oninput = (e) => {
                this.config.speed = parseInt(e.target.value);
                document.getElementById('val-speed').innerText = this.config.speed + 'x';
            };
        }
    }

    setMode(mode) {
        console.log("Switching to mode:", mode);
        this.game.setMode(mode); 
        
        if (mode === 'TRAINING') {
            this.isTraining = true;
            this.isAI = false;
            this.env.reset();
            this.currentEpisodeReward = 0;
        } else if (mode === 'AI') {
            this.isTraining = false;
            this.isAI = true;
            this.restartForAIDemo(); // Clean start
        } else {
            this.isTraining = false;
            this.isAI = false;
            this.game.reset(); 
        }
    }

    restartForAIDemo() {
        // Fix-4: Ensure clean single reset
        
        // 1. Call real game reset
        this.game.reset();
        
        // 2. Force state to RUNNING
        this.game.state = 1; // RUNNING
        
        // 3. Reset Env logic
        this.env.steps = 0;
        this.env.game.enemies = []; // AI mode no enemies
        this.env.game.bulletManager.bullets = [];
        this.env.lastDist = this.env.getDistanceToFood();
        
        // Reset AI Input
        this.aiInput.reset();

        // 4. Update initial state
        this.currentState = this.env.getState();
        
        // 5. Cooldown to prevent instant re-death loops
        this.aiRestartCooldownUntil = performance.now() + 1000; 
        
        if (this.DEBUG) console.log("[AIDemo] Restarted. State reset.");
    }

    update() {
        if (this.isTraining) {
            // Training Loop
            const loops = this.config.speed;
            for(let i=0; i<loops; i++) {
                this.stepTraining();
            }
            this.throttleUI();
        } else if (this.isAI) {
            this.stepAIDemo();
        }
    }
    
    stepAIDemo() {
        // 1. Check Game Over
        if (this.game.isGameOver()) {
            const now = performance.now();
            if (now > this.aiRestartCooldownUntil) {
                if (this.DEBUG) {
                     console.log("[AIDemo] Game Over detected. Restarting...");
                     console.log("State:", this.currentState);
                     console.log("Score:", this.game.snake.body.length);
                }
                this.restartForAIDemo();
                this.aiRestartCooldownUntil = now + 500; 
            }
            return; 
        }

        // Fix-2: Flow Control - One Tick One Action
        // Check if snake has consumed the previous command
        // If the queue has items, it means the snake hasn't moved yet (or just partly).
        // To prevent "double turn" in one frame (or confusing the AI with stale state),
        // we only predict if the queue is empty.
        if (this.aiInput.queue.length > 0) {
            return;
        }

        // 2. Get State
        this.currentState = this.env.getState();
        
        // Fix-5: NaN Check
        if (this.currentState.some(v => !Number.isFinite(v))) {
             console.warn("[AIDemo] NaN in state!", this.currentState);
             // Fallback to zero state or skip
             this.currentState = new Array(this.env.stateSize).fill(0);
        }

        // 3. Predict Action
        let action;
        if (this.totalSteps === 0 && !this.agent.modelLoaded) {
             action = Math.floor(Math.random() * 4);
        } else {
             const originalEpsilon = this.agent.epsilon;
             this.agent.epsilon = 0.05; 
             try {
                action = this.agent.act(this.currentState);
             } catch(e) {
                 console.error("[AIDemo] Agent act error:", e);
                 action = 0; // Fallback
             }
             this.agent.epsilon = originalEpsilon;
        }
        
        // 4. Apply Action (Queue it)
        this.queueAction(action);
        
        this.throttleUI(this.currentState);
    }

    queueAction(action) {
        let dir = { x: 0, y: 0 };
        if (action === 0) dir = { x: 0, y: -1 }; 
        else if (action === 1) dir = { x: 0, y: 1 }; 
        else if (action === 2) dir = { x: -1, y: 0 }; 
        else if (action === 3) dir = { x: 1, y: 0 }; 
        
        // Use Input's queue logic to validate and push
        // We simulate a key press effect by pushing to queue directly
        // But Input.queue stores 'newDir'.
        // We need to validate against last planned direction (Fix-3)
        
        const lastPlannedDir = this.aiInput.queue.length > 0 
            ? this.aiInput.queue[this.aiInput.queue.length - 1] 
            : this.game.snake.lastDirection; // Use actual snake direction as base

        // Anti-reverse check
        if (lastPlannedDir.x + dir.x === 0 && lastPlannedDir.y + dir.y === 0) {
            if (this.DEBUG) console.log("[AIDemo] Ignored reverse action:", action);
            return;
        }
        
        // Push to queue
        this.aiInput.queue.push(dir);
        
        if (this.DEBUG) console.log("[AIDemo] Queued action:", action, "Dir:", dir);
    }

    stepTraining() {
        if (!this.currentState) {
            this.currentState = this.env.reset();
            this.currentEpisodeReward = 0;
        }

        const action = this.agent.act(this.currentState);
        
        const { state: nextState, reward, done } = this.env.step(action);
        
        this.currentEpisodeReward += reward;

        if (!Number.isFinite(reward)) {
            console.error("NaN Reward detected:", reward);
        }

        this.agent.remember(this.currentState, action, reward, nextState, done);
        this.agent.replay(this.config.batchSize);

        this.currentState = nextState;
        this.totalSteps++;

        if (done) {
            this.episode++;
            this.stats.scores.push(this.env.lastScore);
            this.stats.rewards.push(this.currentEpisodeReward); 
            
            this.updateCharts();
            
            this.currentState = null; 
            this.currentEpisodeReward = 0;
        }
    }

    // Removed direct applyAction, replaced by queueAction
    
    throttleUI(state = null) {
        const now = performance.now();
        if (now - this.lastUIUpdate > 100) { 
            this.updateUI(state);
            this.lastUIUpdate = now;
        }
    }

    updateUI(overrideState = null) {
        const elEp = document.getElementById('stat-episode');
        const elEps = document.getElementById('stat-epsilon');
        if(elEp) elEp.innerText = this.episode;
        if(elEps) elEps.innerText = this.agent.epsilon.toFixed(4);
        
        const state = overrideState || this.currentState;
        if (state) {
            tf.tidy(() => {
                const qs = this.agent.model.predict(tf.tensor2d([state], [1, this.env.stateSize]));
                const qData = qs.dataSync();
                if (qData.some(v => !Number.isFinite(v))) {
                    return;
                }
                this.drawQChart(qData);
            });
        }
    }

    drawQChart(qData) {
        const canvas = document.getElementById('qChartCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const actions = ['Up', 'Down', 'Left', 'Right'];
        const barWidth = 40;
        const spacing = 15;
        const startX = 20;
        const centerY = canvas.height / 2;
        
        qData.forEach((q, i) => {
            const h = Math.min(Math.abs(q) * 20, centerY - 10); 
            const x = startX + i * (barWidth + spacing);
            
            ctx.fillStyle = q >= 0 ? '#4caf50' : '#f44336';
            if (q >= 0) {
                ctx.fillRect(x, centerY - h, barWidth, h);
            } else {
                ctx.fillRect(x, centerY, barWidth, h);
            }
            
            ctx.fillStyle = '#aaa';
            ctx.font = '10px Arial';
            ctx.fillText(actions[i], x, canvas.height - 5);
        });
        
        ctx.strokeStyle = '#555';
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(canvas.width, centerY);
        ctx.stroke();
    }

    updateCharts() {
        const canvas = document.getElementById('chartCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const rewards = this.stats.rewards;
        const viewCount = 200;
        const data = rewards.slice(-viewCount);
        
        if (data.length === 0) return;

        const validData = data.filter(n => Number.isFinite(n));
        if (validData.length === 0) return;

        const max = Math.max(...validData);
        const min = Math.min(...validData);
        const range = Math.max(max - min, 10); 
        
        const last100 = rewards.slice(-100).filter(n => Number.isFinite(n));
        const avg = last100.reduce((a, b) => a + b, 0) / (last100.length || 1);

        const w = canvas.width;
        const h = canvas.height;
        const padding = 10;
        const drawH = h - 2 * padding;

        ctx.strokeStyle = '#4caf50';
        ctx.beginPath();
        
        data.forEach((val, i) => {
            if (!Number.isFinite(val)) return;
            const x = (i / (viewCount-1)) * w;
            const normalized = (val - min) / range;
            const y = h - padding - (normalized * drawH);
            
            if(i===0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.fillText(`Max: ${max.toFixed(1)}`, 5, 10);
        ctx.fillText(`Avg: ${avg.toFixed(1)}`, 100, 10);
        ctx.fillText(`Min: ${min.toFixed(1)}`, 200, 10);
    }
}
