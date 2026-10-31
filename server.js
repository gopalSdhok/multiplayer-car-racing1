const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.ALLOWED_ORIGIN || '*' } });
const PORT = Number(process.env.PORT) || 3000;
const rooms = new Map();
const TRACK_LENGTH = 1;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function publicRoom(room) {
  return {
    code: room.code,
    status: room.status,
    countdown: room.countdown,
    winner: room.winner,
    players: [...room.players.values()].map(({ id, name, color, progress, lane, speed, slot }) => ({ id, name, color, progress, lane, speed, slot }))
  };
}

function emitRoom(room) {
  io.to(room.code).emit('room:update', publicRoom(room));
}

function resetRace(room) {
  room.status = 'countdown';
  room.countdown = 3;
  room.winner = null;
  room.countdownEnds = Date.now() + 3000;
  for (const player of room.players.values()) {
    player.progress = 0;
    player.lane = player.slot === 0 ? -0.12 : 0.12;
    player.speed = 0;
    player.input = { throttle: 0, steer: 0, brake: 0 };
  }
  emitRoom(room);
}

io.on('connection', (socket) => {
  socket.on('room:create', ({ name } = {}, reply = () => {}) => {
    const code = makeCode();
    const room = { code, status: 'waiting', countdown: null, winner: null, countdownEnds: null, players: new Map() };
    rooms.set(code, room);
    joinRoom(socket, room, name, reply);
  });

  socket.on('room:join', ({ code, name } = {}, reply = () => {}) => {
    const normalized = String(code || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room) return reply({ error: 'We could not find that room. Check the code and try again.' });
    if (room.players.size >= 2) return reply({ error: 'This room already has two racers.' });
    if (room.status !== 'waiting') return reply({ error: 'That race has already started. Ask the host to restart.' });
    joinRoom(socket, room, name, reply);
    if (room.players.size === 2) resetRace(room);
  });

  socket.on('player:input', (input = {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);
    if (!player || room.status !== 'racing') return;
    player.input = {
      throttle: clamp(input.throttle),
      brake: clamp(input.brake),
      steer: clamp(input.steer)
    };
  });

  socket.on('race:restart', () => {
    const room = rooms.get(socket.data.roomCode);
    if (room && room.players.size === 2 && room.status === 'finished') resetRace(room);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    room.players.delete(socket.id);
    if (!room.players.size) rooms.delete(code);
    else {
      room.status = 'waiting';
      room.countdown = null;
      room.winner = null;
      emitRoom(room);
      io.to(code).emit('room:message', 'Your opponent disconnected. Share the room code to invite another racer.');
    }
  });
});

function joinRoom(socket, room, name, reply) {
  const slot = room.players.size;
  const player = {
    id: socket.id,
    name: cleanName(name, slot),
    color: slot === 0 ? '#ff5a4e' : '#6f9dff',
    slot,
    progress: 0,
    lane: slot === 0 ? -0.12 : 0.12,
    speed: 0,
    input: { throttle: 0, steer: 0, brake: 0 }
  };
  room.players.set(socket.id, player);
  socket.data.roomCode = room.code;
  socket.join(room.code);
  reply({ room: publicRoom(room), playerId: socket.id });
  emitRoom(room);
}

function cleanName(value, slot) {
  const text = String(value || '').trim().replace(/[<>]/g, '').slice(0, 16);
  return text || `Racer ${slot + 1}`;
}
function clamp(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(-1, Math.min(1, number)) : 0;
}

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status === 'countdown') {
      room.countdown = Math.max(0, Math.ceil((room.countdownEnds - now) / 1000));
      if (now >= room.countdownEnds) {
        room.status = 'racing';
        room.countdown = null;
      }
      emitRoom(room);
      continue;
    }
    if (room.status !== 'racing') continue;
    for (const player of room.players.values()) {
      const input = player.input;
      player.speed += input.throttle * 0.34;
      player.speed -= input.brake * 0.5;
      player.speed *= 0.992;
      player.speed = Math.max(0, Math.min(1, player.speed));
      player.progress += (player.speed / 24) / 60;
      player.lane = Math.max(-0.24, Math.min(0.24, player.lane + input.steer * 0.003));
      if (player.progress >= TRACK_LENGTH && room.status === 'racing') {
        room.status = 'finished';
        room.winner = { id: player.id, name: player.name };
        for (const racer of room.players.values()) racer.input = { throttle: 0, brake: 0, steer: 0 };
      }
    }
    emitRoom(room);
  }
}, 1000 / 30);

server.listen(PORT, '0.0.0.0', () => console.log(`Pitlane Rivals running on http://localhost:${PORT}`));
