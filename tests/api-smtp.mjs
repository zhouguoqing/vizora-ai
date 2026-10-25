// Test-only loopback SMTP receiver. No production hooks and no verification bypass.
import net from 'node:net';
import http from 'node:http';

const smtpPort = Number(process.env.TEST_SMTP_PORT || 55252);
const httpPort = Number(process.env.TEST_MAIL_HTTP_PORT || 55253);
const messages = [];
function decode(raw) {
  const body = raw.split(/\r?\n\r?\n/).slice(1).join('\r\n\r\n');
  if (/Content-Transfer-Encoding: base64/i.test(raw))
    return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8');
  if (/Content-Transfer-Encoding: quoted-printable/i.test(raw))
    return Buffer.from(body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi,
      (_, hex) => String.fromCharCode(parseInt(hex, 16))), 'binary').toString('utf8');
  return body;
}
const smtp = net.createServer(socket => {
  socket.setEncoding('utf8');
  socket.write('220 localhost Vizora integration SMTP\r\n');
  let buffer = '', data = false, lines = [], recipient = '';
  socket.on('data', chunk => {
    buffer += chunk;
    let eol;
    while ((eol = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, eol);
      buffer = buffer.slice(eol + 2);
      if (data) {
        if (line === '.') {
          const raw = lines.join('\r\n');
          messages.push({ to: recipient, text: decode(raw), receivedAt: new Date().toISOString() });
          data = false; lines = [];
          socket.write('250 2.0.0 stored\r\n');
        } else lines.push(line.replace(/^\.\./, '.'));
      } else if (/^EHLO|^HELO/i.test(line)) socket.write('250-localhost\r\n250 8BITMIME\r\n');
      else if (/^MAIL FROM:/i.test(line)) socket.write('250 2.1.0 OK\r\n');
      else if (/^RCPT TO:/i.test(line)) { recipient = line.slice(8).replace(/[<>]/g, '').trim(); socket.write('250 2.1.5 OK\r\n'); }
      else if (/^DATA/i.test(line)) { data = true; socket.write('354 End data with <CRLF>.<CRLF>\r\n'); }
      else if (/^QUIT/i.test(line)) socket.end('221 bye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
  socket.on('error', () => {});
});
const mailbox = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET' && req.url === '/messages') res.end(JSON.stringify(messages));
  else if (req.method === 'GET' && req.url === '/health') res.end('{"status":"ok"}');
  else { res.statusCode = 404; res.end('{"error":"not_found"}'); }
});
smtp.listen(smtpPort, '127.0.0.1', () => console.log(`SMTP listening 127.0.0.1:${smtpPort}`));
mailbox.listen(httpPort, '127.0.0.1', () => console.log(`Mail capture http://127.0.0.1:${httpPort}/messages`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { smtp.close(); mailbox.close(); });
