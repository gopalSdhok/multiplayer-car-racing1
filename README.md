# Pitlane Rivals

A small real-time, two-player browser racing game. One player creates a room, shares its five-character code, and a friend joins from their own device. The Node.js server runs the race and sends both browsers the same player positions.

## Run it on your computer

1. Install Node.js 18 or newer from [nodejs.org](https://nodejs.org/).
2. Open a terminal in this project folder.
3. Run `npm install` once to download the server packages.
4. Run `npm start`.
5. Open `http://localhost:3000` in a browser. Open a second browser or a private window to act as the other player.
6. Create a room in the first window, share the code, and enter it in the second window.

The host and guest both drive. Use **W / ↑** to accelerate, **S / ↓** to brake, and **A / ← / D / →** to steer. Phones have on-screen controls. The first car to complete one lap wins. Either racer can choose **Race Again** after the finish.

## Publish it online

The app needs a host that keeps a Node.js process running and supports WebSocket connections. Render, Railway, and Fly.io are examples of services that can host Node applications. A simple deploy generally looks like this:

1. Put the project in a Git repository and push it to your Git hosting account.
2. Create a new **web service** on your chosen host and connect that repository.
3. Set the build command to `npm install` and the start command to `npm start`.
4. Deploy. The host assigns a public HTTPS URL; open it on two separate devices and try a race.

The server reads the port from the host's `PORT` environment variable. Set `ALLOWED_ORIGIN` to your public site's origin (for example, `https://your-game.example`) if you want to restrict which website can connect to the Socket.IO server. The default allows browser connections from any origin, which is convenient for local development.

## What is included

- Two-player rooms with short shareable codes
- Shared race state, countdown, finish detection, winner announcement, and rematch
- Keyboard and touch controls with a responsive layout
- A health endpoint at `/health`
- No database or player account needed

Rooms live in server memory. If the host restarts, active rooms end. That is fine for casual matches; a larger game would add persistent room storage, reconnection support, and stronger abuse protection.
