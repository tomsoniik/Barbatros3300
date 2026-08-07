import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, ShieldAlert, Play, Square, Server, Zap, Globe, Cpu, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Stats = {
  cpu: number;
  memory: number;
  requests: number;
  errors: number;
  time: string;
};

function App() {
  const [target, setTarget] = useState('http://192.168.1.100');
  const [connections, setConnections] = useState(10);
  const [duration, setDuration] = useState(30);
  const [localAgentCount, setLocalAgentCount] = useState(0);
  const [toxAgentCount, setToxAgentCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [statsHistory, setStatsHistory] = useState<Stats[]>([]);
  
  const totalRequestsRef = useRef(0);
  const totalErrorsRef = useRef(0);

  useEffect(() => {
    const controllerUrl = import.meta.env.VITE_CONTROLLER_URL || 'ws://localhost:4000/ui';
    const socket = new WebSocket(controllerUrl);
    
    socket.onopen = () => {
      setWs(socket);
      setErrorMsg(null);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'AGENT_COUNT') {
          setLocalAgentCount(data.local || 0);
          setToxAgentCount(data.tox || 0);
        } else if (data.type === 'TEST_STARTED') {
          setIsRunning(true);
          setErrorMsg(null);
          setStatsHistory([]);
          totalRequestsRef.current = 0;
          totalErrorsRef.current = 0;
        } else if (data.type === 'TEST_STOPPED') {
          setIsRunning(false);
        } else if (data.type === 'ERROR') {
          setErrorMsg(data.message);
          setIsRunning(false);
        } else if (data.type === 'STATS') {
          totalRequestsRef.current += data.requests || 0;
          totalErrorsRef.current += data.errors || 0;
          
          setStatsHistory(prev => {
            const newStats = [...prev, {
              time: new Date().toLocaleTimeString(),
              cpu: Math.round(data.cpu),
              memory: Math.round(data.memory),
              requests: data.requests || 0,
              errors: data.errors || 0
            }];
            if (newStats.length > 30) newStats.shift();
            return newStats;
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    socket.onclose = () => {
      setWs(null);
    };

    return () => socket.close();
  }, []);

  const startTest = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      setErrorMsg(null);
      ws.send(JSON.stringify({ type: 'START_TEST', target, connections, duration }));
    }
  }, [ws, target, connections, duration]);

  const stopTest = useCallback(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'STOP_TEST' }));
    }
  }, [ws]);

  const currentStats = statsHistory.length > 0 ? statsHistory[statsHistory.length - 1] : null;
  const totalAgents = localAgentCount + toxAgentCount;

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={36} color="var(--accent-color)" /> Stress-Tester
          </h1>
          <p>Legal & Controlled Load Testing Framework</p>
        </div>
        <div className="status-badge">
          <div className={`status-dot ${ws ? 'online' : 'offline'}`} />
          {ws ? 'Controller Connected' : 'Controller Offline'}
        </div>
      </header>

      {errorMsg && (
        <div className="glass-panel" style={{ borderLeft: '4px solid var(--danger-color)', backgroundColor: 'rgba(255, 42, 85, 0.1)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger-color)' }}>
            <AlertTriangle size={20} /> Error
          </h3>
          <p style={{ marginTop: '8px', color: '#fff' }}>{errorMsg}</p>
        </div>
      )}

      <div className="grid">
        <div className="glass-panel">
          <h2>Configuration</h2>
          
          <div className="input-group">
            <label>Target URL (HTTP/HTTPS IPv4)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
              <Globe size={18} color="var(--text-secondary)" />
              <input 
                type="text" 
                value={target} 
                onChange={e => setTarget(e.target.value)}
                style={{ border: 'none', background: 'transparent', flex: 1, padding: '12px 0' }}
                disabled={isRunning}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="input-group" style={{ flex: 1 }}>
              <label>Concurrent Connections</label>
              <input 
                type="number" 
                value={connections} 
                onChange={e => setConnections(Number(e.target.value))}
                min={1}
                max={10000}
                disabled={isRunning}
              />
            </div>
            <div className="input-group" style={{ flex: 1 }}>
              <label>Duration (seconds)</label>
              <input 
                type="number" 
                value={duration} 
                onChange={e => setDuration(Number(e.target.value))}
                min={1}
                max={3600}
                disabled={isRunning}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
            {!isRunning ? (
              <button className="btn btn-primary" onClick={startTest} disabled={!ws || totalAgents === 0} style={{ flex: 1 }}>
                <Play size={20} /> Start Test
              </button>
            ) : (
              <button className="btn btn-danger" onClick={stopTest} style={{ flex: 1 }}>
                <Square size={20} /> EMERGENCY STOP
              </button>
            )}
          </div>
          
          <div style={{ marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <p>
              <strong>Security Policy:</strong> The target server must host the verification file at 
              <code> /.well-known/stress-tester.txt</code> over HTTPS.
            </p>
          </div>
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h2>Live Metrics</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Server size={18} /> Agents (Local / Tox)
              </div>
              <div className="stats-value">
                <span style={{ color: 'var(--text-primary)' }}>{localAgentCount}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', margin: '0 8px' }}>/</span>
                <span style={{ color: '#00ff88' }}>{toxAgentCount}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Zap size={18} /> Req / Sec (Total)
              </div>
              <div className="stats-value">{currentStats?.requests || 0}</div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <ShieldAlert size={18} /> Total Errors
              </div>
              <div className="stats-value" style={{ color: totalErrorsRef.current > 0 ? 'var(--danger-color)' : 'var(--text-primary)' }}>
                {totalErrorsRef.current}
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Cpu size={18} /> Agent CPU
              </div>
              <div className="stats-value">{currentStats?.cpu || 0}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ height: '400px' }}>
        <h2>Throughput Overview</h2>
        {statsHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={statsHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px' }}
                itemStyle={{ color: 'var(--accent-color)' }}
              />
              <Line type="monotone" dataKey="requests" stroke="var(--accent-color)" strokeWidth={3} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Awaiting test data...
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
