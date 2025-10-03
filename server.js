const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');

const server = http.createServer((clientReq, clientRes) => {
  console.log(`[HTTP] ${clientReq.method} ${clientReq.url}`);
  
  // Получаем реальный хост из заголовка Host
  const originalHost = clientReq.headers['host'];
  
  if (!originalHost) {
    clientRes.writeHead(400);
    return clientRes.end('No Host header');
  }

  // Определяем куда делать запрос - используем ОРИГИНАЛЬНЫЙ хост
  const targetHost = originalHost.split(':')[0]; // убираем порт если есть
  const useHTTPS = true; // всегда используем HTTPS для внешних сайтов
  
  console.log(`Proxying to real host: ${targetHost}`);
  
  const options = {
    hostname: targetHost,
    port: 443,
    path: clientReq.url,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      'host': targetHost // сохраняем оригинальный хост
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[RESPONSE] ${proxyRes.statusCode} from ${targetHost}`);
    
    // ПОДМЕНЯЕМ только заголовки чтобы трафик выглядел от Яндекс
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
    clientRes.end('Proxy Error');
  });

  if (['POST', 'PUT', 'PATCH'].includes(clientReq.method)) {
    clientReq.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// Обработка HTTPS трафика
server.on('connect', (req, clientSocket, head) => {
  const [targetHost, targetPort] = req.url.split(':');
  console.log(`[HTTPS] CONNECT to real host: ${targetHost}:${targetPort || 443}`);
  
  // Соединяемся с РЕАЛЬНЫМ хостом приложения
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
  console.log('Apps will connect to real servers, but traffic masked as Yandex');
});
