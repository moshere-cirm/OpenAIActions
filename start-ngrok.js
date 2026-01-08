const ngrok = require('ngrok');
const { spawn } = require('child_process');

(async function () {
    // 1. Start the Express server
    const server = spawn('node', ['index.js'], { stdio: 'inherit' });

    server.on('error', (err) => {
        console.error('Failed to start server:', err);
    });

    // Wait a moment for the server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        // 2. Connect to ngrok
        try {
            await ngrok.disconnect(); // Disconnect any active tunnels
            await ngrok.kill(); // Kill the process
            await new Promise(resolve => setTimeout(resolve, 500)); // Give it a moment
        } catch (e) {
            console.log('Cleanup error (ignored):', e.message);
        }

        try {
            const url = await ngrok.connect({
                addr: 3000,
                onStatusChange: status => console.log('Ngrok Status:', status),
            });

            console.log('\n------------------------------------------------------------');
            console.log(`Tunnel successfully established!`);
            console.log(`Public URL: ${url}`);
            console.log('------------------------------------------------------------\n');
            console.log('Test your endpoint with this curl command:');
            console.log(`curl -X POST ${url}/current-hour`);
            console.log('\n------------------------------------------------------------\n');

        } catch (err) {
            console.error('Error connecting to ngrok:', err);
            server.kill();
        }

        // Handle cleanup
        process.on('SIGINT', async () => {
            await ngrok.kill();
            server.kill();
            process.exit();
        });
    } catch (error) {
        console.error('Global error:', error);
        try {
            if (server) server.kill();
        } catch (e) { }
        process.exit(1);
    }
})();
