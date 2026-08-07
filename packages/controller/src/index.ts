import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import cors from 'cors';
import { verifyTarget } from './security';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const TOX_C2_URL = process.env.TOX_C2_URL || 'http://localhost:4001';

const agents: Set<WebSocket> = new Set();
const uis: Set<WebSocket> = new Set();

let isRunning = false;

wss.on('connection', (ws, req) => {
  const isAgent = req.url?.includes('/agent');
  const isUI = req.url?.includes('/ui');

  if (isAgent) {
    agents.add(ws);
    broadcastToUI({ type: 'AGENT_COUNT', count: agents.size + toxAgentsCount });
    console.log(`Agent connected. Total: ${agents.size}`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'STATS') {
          // Forward agent stats to all UIs
          broadcastToUI(data);
        }
      } catch (err) {
        console.error('Failed to parse agent message', err);
      }
    });

    ws.on('close', () => {
      agents.delete(ws);
      broadcastToUI({ type: 'AGENT_COUNT', count: agents.size + toxAgentsCount });
      console.log(`Agent disconnected. Total: ${agents.size}`);
    });
  } else if (isUI) {
    uis.add(ws);
    ws.send(JSON.stringify({ type: 'AGENT_COUNT', count: agents.size + toxAgentsCount }));
    console.log('UI connected.');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'START_TEST') {
          if (isRunning) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Test is already running' }));
            return;
          }
          if (agents.size === 0) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'No agents connected' }));
            return;
          }

          console.log(`Verifying target: ${data.target}`);
          const isVerified = await verifyTarget(data.target);
          if (!isVerified) {
            ws.send(JSON.stringify({ type: 'ERROR', message: `Target verification failed. Ensure /.well-known/stress-tester.txt exists on ${data.target} and it uses HTTPS.` }));
            return;
          }

          isRunning = true;
          console.log('Target verified. Starting test on all agents.');
          
          broadcastToAgents({
            type: 'START',
            target: data.target,
            connections: data.connections,
            duration: data.duration
          });

          // Dispatch to Tox C2
          const req = http.request(`${TOX_C2_URL}/masslinux`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }, (res) => {
            console.log(`Tox C2 Start Status: ${res.statusCode}`);
          });
          req.on('error', (err) => console.error('Tox C2 Start Error:', err.message));
          req.write(JSON.stringify({ command: `npx autocannon -c ${data.connections} -d ${data.duration} ${data.target}` }));
          req.end();

          broadcastToUI({ type: 'TEST_STARTED' });
        } else if (data.type === 'STOP_TEST') {
          isRunning = false;
          broadcastToAgents({ type: 'STOP' });
          
          // Dispatch Stop to Tox C2
          const req = http.request(`${TOX_C2_URL}/stop`, { method: 'POST' });
          req.on('error', (err) => console.error('Tox C2 Stop Error:', err.message));
          req.end();
          
          broadcastToUI({ type: 'TEST_STOPPED' });
        }
      } catch (err) {
        console.error('Failed to process UI message', err);
      }
    });

    ws.on('close', () => {
      uis.delete(ws);
      console.log('UI disconnected.');
    });
  } else {
    ws.close();
  }
});

function broadcastToUI(data: any) {
  const msg = JSON.stringify(data);
  for (const client of uis) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function broadcastToAgents(data: any) {
  const msg = JSON.stringify(data);
  for (const client of agents) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

let toxAgentsCount = 0;
setInterval(() => {
  const req = http.request(`${TOX_C2_URL}/list`, { method: 'GET' }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (toxAgentsCount !== parsed.count) {
          toxAgentsCount = parsed.count;
          broadcastToUI({ type: 'AGENT_COUNT', count: agents.size + toxAgentsCount });
        }
      } catch (err) {}
    });
  });
  req.on('error', () => {
    if (toxAgentsCount !== 0) {
      toxAgentsCount = 0;
      broadcastToUI({ type: 'AGENT_COUNT', count: agents.size + toxAgentsCount });
    }
  });
  req.end();
}, 5000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Controller listening on port ${PORT}`);
});
