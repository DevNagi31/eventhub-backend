import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import eventRoutes from './routes/events.js';
import groupRoutes from './routes/groups.js';
import groupEventRoutes from './routes/groupEvents.js';
import chatRoutes from './routes/chat.js';
import groupMessageRoutes from './routes/groupMessages.js';
import { query } from './config/database.js';
import { startWorker } from './jobs/worker.js';
import scheduler from './services/scheduler.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/group-events', groupEventRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/group-messages', groupMessageRoutes);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-group', (groupId) => {
    socket.join(`group:${groupId}`);
  });

  socket.on('leave-group', (groupId) => {
    socket.leave(`group:${groupId}`);
  });

  socket.on('group-message', async (data) => {
    const { groupId, userId, username, message } = data;
    
    try {
      await query(
        'INSERT INTO group_messages (group_id, user_id, message) VALUES ($1, $2, $3)',
        [groupId, userId, message]
      );

      io.to(`group:${groupId}`).emit('new-message', {
        userId,
        username,
        message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error storing group message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5001;

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  await testConnection();

  // Start Faktory worker and scheduler
  try {
    await startWorker();
    await scheduler.start();
  } catch (error) {
    console.error('⚠️  Faktory not available:', error.message);
    console.log('   Make sure Faktory is running: brew services start faktory');
  }
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await scheduler.stop();
  httpServer.close(() => process.exit(0));
});
