import axios from 'axios';
import https from 'https';

const axiosWithSNI = (url: string, sni: string, signal: AbortSignal | undefined, timeout: number) => {
    let agent = null;
    if (sni !== '') {
        agent = new https.Agent({
            servername: sni,
            host: sni
        });
    }

    return axios.create({
        baseURL: url,
        method: "GET",
        signal: signal,
        httpsAgent: agent,
        timeout: timeout
    });
};

export default axiosWithSNI;