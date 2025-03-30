import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

interface Room {
  id: string;
}
interface User {
  id: string;
  socket: WebSocket;
  rooms: Room[]
}

interface Message {
  type: "join" | "message" | "leave" | "system";
  roomId: string;
  userId: string;
  text?: string;
}

let users: User[] = []

wss.on("connection", (ws) => {
  let currentUser: User | null = null;
  let currentRoomId: string | null = null;

  ws.on("message", (data) => {
    try {
      const message: Message = JSON.parse(data.toString());
      if (message.type === "join") {
        const { userId, roomId } = message;
        let user = users.find(u => u.id === userId)
        if(!user) {
          user = {
            id: userId,
            socket: ws,
            rooms: []
          }
          users.push(user)
        } else {
          user.socket = ws;
        } 

        // user exist:
        currentUser = user

        // find room:
        if(!user.rooms.some(r => r.id === roomId)) {
          user.rooms.push({id: roomId})
        }

        currentRoomId = roomId
        console.log(`${userId} joined room: ${roomId}`);
        broadcast(roomId, { 
          type: "system", 
          roomId,
          userId: "system",
          text: `${userId} has joined the room.` 
        });
      }

      if (message.type === "message") {
        if (currentRoomId && currentUser) {
          broadcast(currentRoomId, { type: "message", userId: currentUser.id, text: message.text });
        }
      }

      if (message.type === "leave") {
        if (currentUser && message.roomId) {
          leaveRoom(currentUser, message.roomId);
          currentRoomId = null;
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(JSON.stringify({
        type: "system",
        userId: "system",
        text: "Error processing your message. Please check the format."
      }));
    }
  });

  ws.on("close", () => {
    if (currentUser) {
      // Leave all rooms when connection closes
      currentUser.rooms.forEach(room => {
        leaveRoom(currentUser!, room.id);
      });
      
      // Remove user from global list
      const index = users.findIndex(u => u.id === currentUser!.id);
      if (index !== -1) {
        users.splice(index, 1);
      }
    }
  });
});


function getUsersInRoom(roomId: string): User[] {
  return users.filter(user => user.rooms.some(room => room.id === roomId))
}
function broadcast(roomId: string, msg: Omit<Message,"roomId"> & { roomId?: string}) {
  const usersInRoom = getUsersInRoom(roomId)
  const fullMsg = {...msg, roomId}

  usersInRoom.forEach(user => {
    if(user.socket.readyState === WebSocket.OPEN) {
      user.socket.send(JSON.stringify(fullMsg))
    }
  })
}

function leaveRoom(user: User, roomId: string) {
  const roomIndex = user.rooms.findIndex(r => r.id === roomId);
  if (roomIndex !== -1) {
    user.rooms.splice(roomIndex, 1);
    console.log(`${user.id} left room: ${roomId}`);
    
    broadcast(roomId, { 
      type: "system", 
      roomId,
      userId: "system",
      text: `${user.id} has left the room.` 
    });
    
    // Notify the user they've left
    if (user.socket.readyState === WebSocket.OPEN) {
      user.socket.send(JSON.stringify({
        type: "system",
        roomId,
        userId: "system",
        text: `You have left room ${roomId}`
      }));
    }
  }
}