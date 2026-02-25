export class DQNAgent {
    constructor(stateSize, actionSpace) {
        this.stateSize = stateSize;
        this.actionSpace = actionSpace;
        this.memory = [];
        this.gamma = 0.95;    // discount rate
        this.epsilon = 1.0;  // exploration rate
        this.epsilonMin = 0.01;
        this.epsilonDecay = 0.995;
        this.learningRate = 0.001;
        this.model = this._buildModel();
        this.modelLoaded = false;
    }

    _buildModel() {
        const model = tf.sequential();
        model.add(tf.layers.dense({
            units: 24,
            inputShape: [this.stateSize],
            activation: 'relu'
        }));
        model.add(tf.layers.dense({
            units: 24,
            activation: 'relu'
        }));
        model.add(tf.layers.dense({
            units: this.actionSpace,
            activation: 'linear'
        }));
        model.compile({
            loss: 'meanSquaredError',
            optimizer: tf.train.adam(this.learningRate)
        });
        return model;
    }

    remember(state, action, reward, nextState, done) {
        // Safe check for NaN
        if (!state || !nextState || !Number.isFinite(reward)) return;
        
        this.memory.push({ state, action, reward, nextState, done });
        if (this.memory.length > 2000) {
            this.memory.shift();
        }
    }

    act(state) {
        if (!state || state.some(v => !Number.isFinite(v))) {
             console.warn("Invalid state for act:", state);
             return Math.floor(Math.random() * this.actionSpace);
        }

        if (Math.random() <= this.epsilon) {
            return Math.floor(Math.random() * this.actionSpace);
        }
        return tf.tidy(() => {
            const qs = this.model.predict(tf.tensor2d([state], [1, this.stateSize]));
            return qs.argMax(1).dataSync()[0];
        });
    }

    async replay(batchSize) {
        if (this.memory.length < batchSize) return;

        const minibatch = [];
        for (let i = 0; i < batchSize; i++) {
            const idx = Math.floor(Math.random() * this.memory.length);
            minibatch.push(this.memory[idx]);
        }

        const states = minibatch.map(m => m.state);
        const nextStates = minibatch.map(m => m.nextState);
        
        const currentQs = tf.tidy(() => this.model.predict(tf.tensor2d(states, [batchSize, this.stateSize])));
        const nextQs = tf.tidy(() => this.model.predict(tf.tensor2d(nextStates, [batchSize, this.stateSize])));
        
        const currentQData = await currentQs.array();
        const nextQData = await nextQs.array();

        for (let i = 0; i < batchSize; i++) {
            const { action, reward, done } = minibatch[i];
            let target = reward;
            if (!done) {
                target = reward + this.gamma * Math.max(...nextQData[i]);
            }
            if(Number.isFinite(target)) {
                 currentQData[i][action] = target;
            }
        }

        const x = tf.tensor2d(states, [batchSize, this.stateSize]);
        const y = tf.tensor2d(currentQData, [batchSize, this.actionSpace]);

        await this.model.fit(x, y, { epochs: 1, verbose: 0 });
        
        x.dispose();
        y.dispose();
        currentQs.dispose();
        nextQs.dispose();

        if (this.epsilon > this.epsilonMin) {
            this.epsilon *= this.epsilonDecay;
        }
    }

    async save() {
        const result = await this.model.save('localstorage://snake-dqn-model');
        console.log("Model saved:", result);
        return result;
    }

    async load() {
        try {
            const loadedModel = await tf.loadLayersModel('localstorage://snake-dqn-model');
            
            // Validate shape
            const inputShape = loadedModel.inputs[0].shape;
            const outputShape = loadedModel.outputs[0].shape;
            
            if (inputShape[1] !== this.stateSize || outputShape[1] !== this.actionSpace) {
                throw new Error(`Model shape mismatch. Expected input ${this.stateSize}, output ${this.actionSpace}. Got ${inputShape[1]}, ${outputShape[1]}`);
            }

            this.model = loadedModel;
            this.model.compile({
                loss: 'meanSquaredError',
                optimizer: tf.train.adam(this.learningRate)
            });
            this.modelLoaded = true;
            console.log("Model loaded successfully");
        } catch (e) {
            console.error("Load model failed:", e);
            throw e; // Propagate error to UI
        }
    }
}
