import autocannon from 'autocannon';
import si from 'systeminformation';

let instance: autocannon.Instance | null = null;
let statsInterval: NodeJS.Timeout | null = null;

export function startTest(
  target: string,
  connections: number,
  duration: number,
  onStats: (stats: any) => void,
  onDone: () => void
) {
  if (instance) {
    stopTest();
  }

  instance = autocannon({
    url: target,
    connections,
    duration,
  }, (err: any, result: autocannon.Result) => {
    if (err) {
      console.error('Autocannon error:', err);
    }
    stopTest();
    onDone();
  });

  let requests = 0;
  let errors = 0;

  statsInterval = setInterval(async () => {
    if (!instance) return;
    
    try {
      const cpu = await si.currentLoad();
      const mem = await si.mem();
      
      onStats({
        type: 'STATS',
        cpu: cpu.currentLoad,
        memory: (mem.active / mem.total) * 100,
        requests,
        errors
      });
      // Reset for next second
      requests = 0;
      errors = 0;
    } catch (e) {
      console.error('Failed to get system stats', e);
    }
  }, 1000);

  
  instance.on('response', (client: autocannon.Client, statusCode: number, resBytes: number, responseTime: number) => {
    requests++;
    const status = parseInt(statusCode.toString(), 10);
    if (status >= 400) {
      errors++;
    }
  });

  instance.on('reqError', () => {
    errors++;
  });

  instance.on('done', () => {
     // emit final stats if needed
  });
}

export function stopTest() {
  if (instance) {
    instance.stop();
    instance = null;
  }
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
}
