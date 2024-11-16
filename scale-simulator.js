const net = require('net');

class ScaleSimulator {
    constructor(port, scaleId) {
        this.port = port;
        this.scaleId = scaleId;
        this.server = null;
        this.minWeight = 1000;  // Berat minimum (kg)
        this.maxWeight = 9999;  // Berat maximum (kg)
    }

    // Generate random weight
    generateWeight() {
        const weight = Math.floor(Math.random() * (this.maxWeight - this.minWeight + 1)) + this.minWeight;
        return weight.toString().padStart(7, '0'); // Format to 7 digits
    }

    // Generate response format
    generateResponse() {
        const weight = this.generateWeight();
        return `ST,GS,+,${weight}kg\r\n`;  // Format: ST,GS,+,0001234kg
    }

    // Start the simulator
    start() {
        this.server = net.createServer((socket) => {
            console.log(`Client connected to Scale ${this.scaleId}`);

            socket.on('data', (data) => {
                // Simulate processing time (100ms)
                setTimeout(() => {
                    // Generate and send response
                    const response = this.generateResponse();
                    console.log(`Scale ${this.scaleId} sending: ${response.trim()}`);
                    socket.write(response);
                }, 100);
            });

            socket.on('error', (err) => {
                console.error(`Socket error on Scale ${this.scaleId}:`, err);
            });

            socket.on('close', () => {
                console.log(`Client disconnected from Scale ${this.scaleId}`);
            });
        });

        this.server.listen(this.port, () => {
            console.log(`Scale simulator ${this.scaleId} running on port ${this.port}`);
        });

        this.server.on('error', (err) => {
            console.error(`Server error on Scale ${this.scaleId}:`, err);
        });
    }

    // Stop the simulator
    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log(`Scale simulator ${this.scaleId} stopped`);
            });
        }
    }
}

// Create and start multiple scale simulators
const simulators = [
    new ScaleSimulator(3002, 'SCALE_01'),
    new ScaleSimulator(3003, 'SCALE_02'),
    new ScaleSimulator(3004, 'SCALE_03')
];

// Start all simulators
simulators.forEach(simulator => simulator.start());

// Handle application shutdown
process.on('SIGINT', () => {
    console.log('Shutting down simulators...');
    simulators.forEach(simulator => simulator.stop());
    process.exit(0);
});