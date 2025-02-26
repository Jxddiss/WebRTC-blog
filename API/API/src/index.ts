import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const cors = require("cors");
const app: Express = express();

app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const port = process.env.PORT || 3000;

const rooms: Record<string, number> = {};
const connectedUsers: Record<string, string | undefined> = {};

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  connectedUsers[socket.id] = undefined;

  socket.on("message", (msg: string) => {
    socket.broadcast.emit("message", msg);
  });

  socket.on("register", (name: string) => {
    connectedUsers[socket.id] = name;
    console.log("user registered", name);
    socket.broadcast.emit("userConnected");
  });

  socket.on("join", (room: string) => {
    if (!rooms[room]) {
      rooms[room] = 1;
      setTimeout(() => {
        if (rooms[room] === 0) {
          delete rooms[room];
        }
      }, 3000);
    } else {
      rooms[room] = rooms[room]++;
    }
    socket.join(room);
  });

  socket.on("leave", (room: string) => {
    socket.leave(room);
    if (rooms[room] > 0) {
      rooms[room] = rooms[room]--;
    }
  });

  socket.on("call", (data) => {
    socket
      .to(data.to)
      .emit("call", { from: socket.id, name: connectedUsers[socket.id] });
  });

  socket.on("offer", (data) => {
    socket.to(data.room).emit("offer", { sdp: data.sdp, socketId: socket.id });
  });

  socket.on("answer", (data) => {
    socket.to(data.room).emit("answer", { sdp: data.sdp, socketId: socket.id });
  });

  socket.on("candidate", (data) => {
    socket.to(data.room).emit("candidate", { candidate: data.candidate });
  });

  socket.on("availableRooms", () => {
    socket.emit("availableRooms", rooms);
  });

  socket.on("getOnlineUsers", () => {
    socket.emit("onlineUsers", connectedUsers);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    if (connectedUsers[socket.id]) {
      socket.broadcast.emit("userDisconnected", socket.id);
      delete connectedUsers[socket.id];
    }
  });
});

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

server.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
