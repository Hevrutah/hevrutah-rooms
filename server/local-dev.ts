/**
 * Local development API server.
 * Wraps the Vercel serverless functions as Express routes so you can run
 * the full stack with a single command: npm run dev:all
 */
import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import loginHandler from '../api/auth/login.js';
import usersHandler from '../api/auth/users.js';
import calendarTokenHandler from '../api/calendar/token.js';
import calendarConnectHandler from '../api/calendar/connect.js';

const app = express();
app.use(express.json());

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<unknown>;

function wrap(handler: Handler) {
  return async (req: Request, res: Response) => {
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  };
}

app.all('/api/auth/login', wrap(loginHandler));
app.all('/api/auth/users', wrap(usersHandler));
app.all('/api/calendar/token', wrap(calendarTokenHandler));
app.all('/api/calendar/connect', wrap(calendarConnectHandler));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`\n  ✓  API server running at http://localhost:${PORT}`);
  console.log(`     /api/auth/login`);
  console.log(`     /api/auth/users`);
  console.log(`     /api/calendar/token\n`);
});
