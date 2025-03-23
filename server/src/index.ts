import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

interface User {
  id: string;
  socket: WebSocket;
}

interface Room {
  users: User[];
}

interface Message {
  type: "join" | "message" | "system";
  roomId: string;
  userId?: string;
  text?: string;
}

const rooms: Record<string, Room> = {};

let userCount = 0;

wss.on("connection", (ws) => {
  let currentUser: User | null = null;
  let currentRoomId: string | null = null;

  userCount += 1;
  console.log("User connected #", userCount);

  ws.on("message", (data) => {
    const message: Message = JSON.parse(data.toString());

    if (message.type === "join") {
      const { userId, roomId } = message;

      if (!rooms[roomId]) {
        rooms[roomId] = { users: [] };
      }
      currentRoomId = roomId;
      currentUser = { id: userId!, socket: ws };
      rooms[roomId].users.push(currentUser);

      console.log(`${userId} joined room: ${roomId}`);
      broadcast(roomId, { type: "system", text: `${userId} has joined the room.` });
    }

    if (message.type === "message") {
      if (currentRoomId && currentUser) {
        broadcast(currentRoomId, { type: "message", userId: currentUser.id, text: message.text });
      }
    }
  });

  ws.on("close", () => {
    if (currentUser && currentRoomId) {
      const { id } = currentUser;
      rooms[currentRoomId].users = rooms[currentRoomId].users.filter((user) => user.socket !== ws);

      if (rooms[currentRoomId].users.length === 0) {
        delete rooms[currentRoomId];
      }

      console.log(`${id} left room: ${currentRoomId}`);
      broadcast(currentRoomId, { type: "system", text: `${id} has left the room.` });
    }
  });
});

function broadcast(roomId: string, message: object) {
  if (rooms[roomId]) {
    rooms[roomId].users.forEach((user) => {
      if (user.socket.readyState === WebSocket.OPEN) {
        user.socket.send(JSON.stringify(message));
      }
    });
  }
}
