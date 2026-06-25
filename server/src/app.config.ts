import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { defineRoom, defineServer } from '@colyseus/core';
import { Drop8Room } from './rooms/Drop8Room.js';
import { listPublicRooms } from './roomRegistry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const clientRoot = path.join(projectRoot, 'client');
const clientDist = path.join(clientRoot, 'dist');
const isDevelopment = process.env.NODE_ENV === 'development';

const vite = isDevelopment
  ? await import('vite').then(({ createServer }) => createServer({
      root: clientRoot,
      server: { middlewareMode: true },
      appType: 'spa',
    }))
  : undefined;

const server = defineServer({
  rooms: {
    drop8: defineRoom(Drop8Room),
  },
  express: (app) => {
    app.get('/api/health', (_request, response) => {
      response.json({ ok: true, game: 'DROP 8', mode: isDevelopment ? 'development' : 'production' });
    });

    app.get('/api/rooms', (_request, response) => {
      response.json({ rooms: listPublicRooms() });
    });

    if (vite) {
      app.use(vite.middlewares);
      return;
    }

    app.use(express.static(clientDist));
    app.get('*', (_request, response) => {
      response.sendFile(path.join(clientDist, 'index.html'));
    });
  },
});

export default server;
