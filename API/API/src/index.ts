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

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);

  socket.on("message", (msg: string) => {
    socket.broadcast.emit("message", msg);
  });

  socket.on("join", (room: string) => {
    socket.join(room);
    if (!rooms[room]) {
      rooms[room] = 1;
      setTimeout(() => {
        if (rooms[room] === 0) {
          delete rooms[room];
        }
      });
    } else {
      rooms[room] = rooms[room]++;
    }
  });

  socket.on("leave", (room: string) => {
    socket.leave(room);
    if (rooms[room] > 0) {
      rooms[room] = rooms[room]--;
    }
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

  socket.on("available-rooms", () => {
    socket.emit("available-rooms", rooms);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

app.get("/", (req: Request, res: Response) => {
  res.send("Express + TypeScript Server");
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
