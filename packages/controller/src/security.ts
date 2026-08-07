import axios from 'axios';
import https from 'https';

export async function verifyTarget(targetUrl: string): Promise<boolean> {
  try {
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `http://${targetUrl}`;
    }
    const url = new URL(targetUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Only HTTP/HTTPS targets are allowed.');
    }

    const verifyUrl = `${url.origin}/.well-known/stress-tester.txt`;
    
    const requestConfig: any = {
      timeout: 5000,
      headers: {
         'User-Agent': 'Stress-Tester-Agent'
      }
    };

    if (url.protocol === 'https:') {
      requestConfig.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    const response = await axios.get(verifyUrl, requestConfig);

    if (response.status === 200) {
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Verification failed for ${targetUrl}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}
