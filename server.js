const http = require('http');
const https = require('https');
const net = require('net');

const server = http.createServer((clientReq, clientRes) => {
  console.log(`[PROXY] ${clientReq.method} ${clientReq.url}`);
  
  const originalHost = clientReq.headers['host'];
  
  if (!originalHost) {
    return clientRes.end('No host');
  }

  // Используем реальный хост из запроса
  const targetHost = originalHost.split(':')[0];
  
  console.log(`Forwarding to real host: ${targetHost}`);
  
  const options = {
    hostname: targetHost,
    port: 443,
    path: clientReq.url,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      'host': targetHost
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[RESPONSE] ${proxyRes.statusCode} from ${targetHost}`);
    
    // ПОДМЕНЯЕМ ЗАГОЛОВКИ - теперь трафик выглядит от Яндекс
    const headers = {
      ...proxyRes.headers,
      'server': 'Yandex',
      'x-powered-by': 'Yandex',
      'content-type': proxyRes.headers['content-type'] || 'text/html; charset=utf-8'
    };
    
    clientRes.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (err) => {
    console.error('Error:', err);
    clientRes.writeHead(200, {
      'server': 'Yandex',
      'content-type': 'text/html'
    });
    clientRes.end('<html><body><h1>Yandex</h1></body></html>');
  });

  clientReq.pipe(proxyReq);
});

// HTTPS трафик для приложений
server.on('connect', (req, clientSocket, head) => {
  const [targetHost, targetPort] = req.url.split(':');
  console.log(`[HTTPS] Connecting to: ${targetHost}`);
  
  const serverSocket = net.connect(targetPort || 443, targetHost, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', (err) => {
    console.error('HTTPS error:', err);
    clientSocket.end();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Yandex masking proxy running on port', PORT);
});
