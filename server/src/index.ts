import { createGameServer } from './app';

const port = Number(process.env.PORT ?? 3001);
const server = createGameServer({ allowDebug: process.env.NODE_ENV !== 'production' });
server.http.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`);
});
