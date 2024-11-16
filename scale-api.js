const express = require('express');
const ScaleMonitor = require('./scale-monitor');
const fs = require('fs');
const path = require('path');

class ScaleAPI {
    constructor() {
        this.app = express();
        this.port = 3000;
        this.configFile = path.join(__dirname, 'scale-config.json');
        this.scaleConfigs = {};

        // Load initial config
        this.loadConfig();

        // Add JSON body parser
        this.app.use(express.json());

        // Initialize routes
        this.initializeRoutes();
    }

    // Load config from JSON file
    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const data = fs.readFileSync(this.configFile, 'utf8');
                this.scaleConfigs = JSON.parse(data);
                console.log('Loaded scale configurations:', Object.keys(this.scaleConfigs));
            } else {
                // Create initial config file if not exists
                this.saveConfig();
            }
        } catch (error) {
            console.error('Error loading config:', error);
            this.scaleConfigs = {};
        }
    }

    // Save config to JSON file
    saveConfig() {
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(this.scaleConfigs, null, 2));
            console.log('Configuration saved successfully');
        } catch (error) {
            console.error('Error saving config:', error);
        }
    }

    initializeRoutes() {
        // Add or update scale configuration
        this.app.post('/api/scales', (req, res) => {
            const { name, ip, port, description } = req.body;

            if (!name || !ip || !port) {
                return res.status(400).json({
                    error: 'Missing required fields: name, ip, and port are required'
                });
            }

            this.scaleConfigs[name] = {
                ip,
                port: parseInt(port),
                description: description || '',
                updatedAt: new Date().toISOString()
            };

            this.saveConfig();

            res.json({
                message: 'Scale configuration saved',
                name,
                config: this.scaleConfigs[name]
            });
        });

        // Get all scale configurations
        this.app.get('/api/scales', (req, res) => {
            res.json(this.scaleConfigs);
        });

        // Get weight using only scale name
        this.app.get('/api/weight/:name', async (req, res) => {
            try {
                const { name } = req.params;

                if (!this.scaleConfigs[name]) {
                    return res.status(404).json({
                        error: `Scale "${name}" not found in configuration`
                    });
                }

                const config = this.scaleConfigs[name];
                const weight = await this.getWeight(config.ip, config.port, name);

                res.json(weight);
            } catch (error) {
                console.error('Error getting weight:', error);
                res.status(500).json({
                    error: error.message || 'Error getting weight data'
                });
            }
        });

        // Delete scale configuration
        this.app.delete('/api/scales/:name', (req, res) => {
            const { name } = req.params;

            if (this.scaleConfigs[name]) {
                delete this.scaleConfigs[name];
                this.saveConfig();
                res.json({ message: `Scale "${name}" configuration deleted` });
            } else {
                res.status(404).json({ error: `Scale "${name}" not found` });
            }
        });
    }

    getWeight(ip, port, name) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Operation timed out'));
            }, 5000);

            try {
                const monitor = new ScaleMonitor();
                let isResolved = false;

                monitor.addScale(ip, port, name);

                monitor.on('weightReceived', ({ scaleId, weight, timestamp }) => {
                    if (!isResolved) {
                        isResolved = true;
                        clearTimeout(timeout);
                        monitor.stopMonitoring();

                        resolve({
                            name: scaleId,
                            weight,
                            timestamp: timestamp.toISOString(),
                            unit: 'kg'
                        });
                    }
                });

                monitor.on('error', (error) => {
                    if (!isResolved) {
                        isResolved = true;
                        clearTimeout(timeout);
                        monitor.stopMonitoring();
                        reject(error);
                    }
                });

                monitor.startMonitoring();

            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`Scale API server running on port ${this.port}`);
        });
    }
}

// Create and start API server
const api = new ScaleAPI();
api.start();