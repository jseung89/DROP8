import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { defineRoom, defineServer } from '@colyseus/core';
import { Encoder } from '@colyseus/schema';
import { Drop8Room } from './rooms/Drop8Room.js';
import { listPublicRooms } from './roomRegistry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const clientRoot = path.join(projectRoot, 'client');
const clientDist = path.join(clientRoot, 'dist');
const isDevelopment = process.env.NODE_ENV === 'development';

// DROP8_REFACTOR_017_ADHESIVE_STRIP_LOBBY_BAZOOKA_WATER
// Refactor 013: tests import app.config.ts directly, so keep the encoder limit here too.
Encoder.BUFFER_SIZE = 64 * 1024;

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

    app.get('/api/rooms', async (_request, response) => {
      try{
        response.setHeader('Cache-Control','no-store');
        response.json({ rooms: await listPublicRooms() });
      }catch(error){
        console.error('[DROP8 Refactor 017] room list query failed',error);
        response.status(503).json({rooms:[],error:'ROOM_LIST_UNAVAILABLE'});
      }
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
