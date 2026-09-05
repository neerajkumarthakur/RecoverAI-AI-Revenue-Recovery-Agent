import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const demoKey = process.env.DEMO_API_KEY || 'recoverai';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.substring(7);
  if (token !== demoKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
}
