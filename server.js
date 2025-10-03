const http = require('http');
const https = require('https');
const net = require('net');

const server = http.createServer((clientReq, clientRes) => {
  console.log(`[HTTP] ${clientReq.method} ${clientReq.url}`);
  
  // Определяем реальный хост из заголовков
  const hostHeader = clientReq.headers['host'];
  let targetHost = 'yandex.com'; // По умолчанию Яндекс
  
  // Если хост указан и это не Яндекс, используем реальный хост
  if (hostHeader && !hostHeader.includes('yandex')) {
    targetHost = hostHeader.split(':')[0]; // Убираем порт если есть
    console.log(`Detected real host: ${targetHost}`);
  }
  
  // Используем HTTPS для всего кроме локальных адресов
  const useHTTPS = !targetHost.includes('localhost') && !targetHost.includes('127.0.0.1');
  const port = useHTTPS ? 443 : 80;
  const protocol = useHTTPS ? https : http;
  
  const options = {
    hostname: targetHost,
    port: port,
    path: clientReq.url,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      'host': targetHost
    }
  };

  const proxyReq = protocol.request(options, (proxyRes) => {
    console.log(`[RESPONSE] ${proxyRes.statusCode} from ${targetHost}`);
    
    // Подменяем заголовки чтобы ответ выглядел от Яндекс
    const headers = {
      ...proxyRes.headers,
      'server': 'Yandex',
      'x-powered-by': 'Yandex'
    };
    
    clientRes.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    clientRes.writeHead(500, {
      'server': 'Yandex',
      'content-type': 'text/html'
    });
    clientRes.end('Error');
  });

  if (['POST', 'PUT', 'PATCH'].includes(clientReq.method)) {
    clientReq.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// Обработка HTTPS трафика (для приложений)
server.on('connect', (req, clientSocket, head) => {
  const [targetHost, targetPort] = req.url.split(':');
  console.log(`[HTTPS] CONNECT to real host: ${targetHost}:${targetPort || 443}`);
  
  // Соединяемся с реальным хостом
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
  console.log(`Smart proxy running on port ${PORT}`);
  console.log('Traffic will be masked as Yandex but go to real destinations');
});
