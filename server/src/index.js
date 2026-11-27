import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ApiError } from './errors.js';
import { closePool } from './db/pool.js';
import listingsRouter from './routes/listings.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_request, response) =>
  response.json({ data: { status: 'ok', service: 'afyalink-api' } }),
);

app.use('/api', listingsRouter);

app.use((_request, response) =>
  response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not implemented' } }),
);

app.use((error, _request, response, _next) => {
  if (error instanceof ApiError) {
    const body = { error: { code: error.code, message: error.message } };
    if (error.fields) body.error.fields = error.fields;
    return response.status(error.status).json(body);
  }
  if (error.code === 'DB_NOT_CONFIGURED') {
    return response
      .status(503)
      .json({ error: { code: 'DB_NOT_CONFIGURED', message: 'Database is not configured' } });
  }
  if (error.type === 'entity.parse.failed') {
    return response
      .status(400)
      .json({ error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } });
  }
  if (error.type === 'entity.too.large') {
    return response
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
  }
  console.error('Unhandled request error:', error.message);
  return response
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
});

const port = Number(process.env.PORT || 5000);
const server = app.listen(port, () => console.log(`AfyaLink API listening on port ${port}`));

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
