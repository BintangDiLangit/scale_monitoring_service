const ScaleMonitor = require('./scale-monitor');

async function testScaleMonitoring() {
    // Create scale monitor instance
    const monitor = new ScaleMonitor();

    // Add test scales to monitor (using simulator ports)
    monitor.addScale('localhost', 3002, 'SCALE_01');
    monitor.addScale('localhost', 3003, 'SCALE_02');
    monitor.addScale('localhost', 3004, 'SCALE_03');

    // Handle weight received events
    monitor.on('weightReceived', ({ scaleId, weight, timestamp }) => {
        console.log(`Received weight data:
        Scale ID: ${scaleId}
        Weight: ${weight} kg
        Time: ${timestamp.toISOString()}
        ------------------------`);
    });

    // Start monitoring
    monitor.startMonitoring();

    console.log('Scale monitoring started. Press Ctrl+C to stop.');

    // Handle application shutdown
    process.on('SIGINT', () => {
        console.log('Shutting down...');
        monitor.stopMonitoring();
        process.exit(0);
    });
}

// Start the test
testScaleMonitoring().catch(console.error);