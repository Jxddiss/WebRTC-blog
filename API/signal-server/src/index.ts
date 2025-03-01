import app from "./app";
import http from "http";
import { Server } from "socket.io";

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
const port = process.env.PORT || 3000;

const connectedUsers: Record<string, string | undefined> = {};

io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  connectedUsers[socket.id] = undefined;

  socket.on("register", (name: string) => {
    connectedUsers[socket.id] = name;
    console.log("user registered", name);
    socket.broadcast.emit("userConnected");
  });

  socket.on("call", (data) => {
    socket
      .to(data.to)
      .emit("call", { from: socket.id, name: connectedUsers[socket.id] });
  });

  socket.on("offer", (data) => {
    socket.to(data.to).emit("offer", { sdp: data.sdp, socketId: socket.id });
  });

  socket.on("answer", (data) => {
    socket.to(data.to).emit("answer", { sdp: data.sdp, socketId: socket.id });
  });

  socket.on("candidate", (data) => {
    socket.to(data.to).emit("candidate", { candidate: data.candidate });
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

server.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`Listening: http://localhost:${port}`);
  /* eslint-enable no-console */
});
