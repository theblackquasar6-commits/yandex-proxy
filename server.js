const http = require('http');
const https = require('https');

const server = http.createServer((clientReq, clientRes) => {
  console.log(`[REQUEST] ${clientReq.method} ${clientReq.url}`);
  
  // Всегда делаем запрос к Яндекс
  const options = {
    hostname: 'yandex.com',
    port: 443,
    path: clientReq.url,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      'host': 'yandex.com',
      'referer': 'https://yandex.com/'
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[RESPONSE] Status: ${proxyRes.statusCode}`);
    
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
    console.error('Error:', err);
    clientRes.writeHead(200, {
      'server': 'Yandex',
      'content-type': 'text/html; charset=utf-8'
    });
    clientRes.end('<html><body><h1>Yandex</h1></body></html>');
  });

  if (['POST', 'PUT'].includes(clientReq.method)) {
    clientReq.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// HTTPS через CONNECT
server.on('connect', (req, clientSocket, head) => {
  console.log(`[HTTPS] CONNECT to: ${req.url}`);
  
  const serverSocket = require('tls').connect({
    host: 'yandex.com',
    port: 443,
    servername: 'yandex.com'
  }, () => {
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
  console.log(`Yandex proxy server running on port ${PORT}`);
  console.log(`Server URL: https://your-app.onrender.com`);
});
