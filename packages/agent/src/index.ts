import WebSocket from 'ws';
import { startTest, stopTest } from './runner';

const CONTROLLER_URL = process.env.CONTROLLER_URL || 'ws://localhost:4000/agent';

function connect() {
  console.log(`Connecting to controller at ${CONTROLLER_URL}...`);
  const ws = new WebSocket(CONTROLLER_URL);

  ws.on('open', () => {
    console.log('Connected to controller.');
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'START') {
        console.log(`Starting test on ${data.target} with ${data.connections} connections for ${data.duration}s`);
        startTest(
          data.target,
          data.connections,
          data.duration,
          (stats) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(stats));
            }
          },
          () => {
            console.log('Test finished.');
          }
        );
      } else if (data.type === 'STOP') {
        console.log('Stopping test...');
        stopTest();
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Disconnected from controller. Reconnecting in 5s...');
    stopTest();
    setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
}

connect();
