import tls from 'tls';
import { Client } from 'pg';

export const initDb = async () => {
  if (!process.env.POSTGRES_PORT) {
    console.log('Missing required environment variable(s). Exiting.');
    return;
  }

  const socketPromise = await new Promise((resolve, reject) => {
    const socket = tls.connect(
      parseInt(process.env.POSTGRES_PORT!),
      process.env.POSTGRES_HOST,
      {
        // These config options enable SNI, which postgres doesn't natively support
        servername: process.env.POSTGRES_HOST,
        host: process.env.POSTGRES_HOST,
      },
      () => {
        if (socket.authorized) {
          resolve(socket);
        } else {
          reject('TLS Authorisation failure');
        }
      }
    );
  });

  const db = new Client({
    stream: socketPromise as tls.TLSSocket,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  });
  await db.connect();

  try {
    await db.query('select 1;');
  } catch (pgErr) {
    console.trace(pgErr);
    return;
  }

  return db;
};
