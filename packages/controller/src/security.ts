import axios from 'axios';
import https from 'https';

export async function verifyTarget(targetUrl: string): Promise<boolean> {
  try {
    const url = new URL(targetUrl);
    // Force HTTPS
    if (url.protocol !== 'https:') {
      throw new Error('Only HTTPS targets are allowed.');
    }

    const verifyUrl = `${url.origin}/.well-known/stress-tester.txt`;
    
    const agent = new https.Agent({
      rejectUnauthorized: false // Allow self-signed certs for testing environments
    });

    const response = await axios.get(verifyUrl, {
      httpsAgent: agent,
      timeout: 5000,
      headers: {
         'User-Agent': 'Stress-Tester-Agent'
      }
    });

    if (response.status === 200) {
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Verification failed for ${targetUrl}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}
