const net = require('net');
const EventEmitter = require('events');

class ScaleMonitor extends EventEmitter {
    constructor() {
        super();
        this.scales = new Map(); // Store scale configurations
        this.connections = new Map(); // Store active connections
        this.isRunning = false;
    }

    // Add a new scale to monitor
    addScale(ip, port, scaleId) {
        this.scales.set(scaleId, { ip, port, scaleId });
    }

    // Start monitoring all scales
    startMonitoring() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Start monitoring each scale
        for (const [scaleId, config] of this.scales) {
            this.monitorScale(config);
        }
    }

    // Stop monitoring all scales
    stopMonitoring() {
        this.isRunning = false;

        // Close all connections
        for (const [scaleId, client] of this.connections) {
            client.destroy();
        }
        this.connections.clear();
    }

    // Monitor a single scale
    monitorScale(config) {
        const reconnectDelay = 5000; // 5 seconds delay before reconnecting

        const connect = () => {
            if (!this.isRunning) return;

            const client = new net.Socket();

            client.on('connect', () => {
                console.log(`Connected to scale ${config.scaleId} at ${config.ip}:${config.port}`);
                this.connections.set(config.scaleId, client);

                // Send initial request
                const requestBytes = Buffer.alloc(256);
                client.write(requestBytes);
            });

            client.on('data', (data) => {
                try {
                    const response = data.toString('ascii');
                    const weight = this.parseWeight(response);

                    if (weight > 0) {
                        const timestamp = new Date();

                        // Emit weight received event
                        this.emit('weightReceived', {
                            scaleId: config.scaleId,
                            weight,
                            timestamp
                        });

                        // Send next request after receiving response
                        const requestBytes = Buffer.alloc(256);
                        client.write(requestBytes);
                    }
                } catch (err) {
                    console.error(`Error processing data from scale ${config.scaleId}:`, err);
                }
            });

            client.on('error', (err) => {
                console.error(`Error on scale ${config.scaleId}:`, err.message);
                client.destroy();
            });

            client.on('close', () => {
                console.log(`Connection to scale ${config.scaleId} closed. Reconnecting in ${reconnectDelay}ms...`);
                this.connections.delete(config.scaleId);

                // Try to reconnect after delay
                setTimeout(() => {
                    if (this.isRunning) {
                        connect();
                    }
                }, reconnectDelay);
            });

            // Connect to the scale
            client.connect(config.port, config.ip);
        };

        // Start initial connection
        connect();
    }

    // Parse weight from scale response
    parseWeight(response) {
        try {
            // Parse the response format: ST,GS,+,0001234kg
            const match = response.match(/ST,GS,\+,(\d{7})kg/);
            if (match) {
                const weight = parseInt(match[1]);
                return isNaN(weight) ? 0 : weight;
            }

            // Fallback to original parsing method if format doesn't match
            const upperResponse = response.toUpperCase();
            const marker = '99';
            const markerIndex = upperResponse.indexOf(marker);

            if (markerIndex !== -1) {
                const weightStr = upperResponse.substring(markerIndex + 3, markerIndex + 10);
                const weight = parseInt(weightStr);
                return isNaN(weight) ? 0 : weight;
            }
        } catch (err) {
            console.error('Error parsing weight:', err);
        }
        return 0;
    }
}

// Export the class
module.exports = ScaleMonitor;