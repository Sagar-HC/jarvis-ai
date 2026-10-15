import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../db';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded: any = jwt.verify(token, config.jwtSecret);
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'USER'
      };
      return next();
    } catch (err) {
      // Invalid token
    }
  }

  // Ensure default demo/developer user exists in DB for zero-friction execution
  const defaultEmail = 'user@jarvis.ai';
  let defaultUser = await prisma.user.findUnique({ where: { email: defaultEmail } });
  if (!defaultUser) {
    defaultUser = await prisma.user.create({
      data: {
        id: 'usr_default_jarvis',
        email: defaultEmail,
        passwordHash: 'not-used-in-dev',
        name: 'JARVIS Primary Operator',
        role: 'ADMIN'
      }
    });
  }

  req.user = {
    userId: defaultUser.id,
    email: defaultUser.email,
    role: defaultUser.role
  };
  next();
}
