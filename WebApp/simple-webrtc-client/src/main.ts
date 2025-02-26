import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {});

function register(name: string) {
  socket.emit("register", name);
  socket.emit("getOnlineUsers");
}

function prepareSocket() {
  socket.on("connect", () => {
    console.log("connected");
    register("client" + Math.floor(Math.random() * 1000));
  });

  socket.on("userConnected", (data) => {
    socket.emit("getOnlineUsers");
    console.log("Whatt?", data);
  });

  socket.on("onlineUsers", (data) => {
    renderOnlineUsers(data);
  });

  socket.on("userDisconnected", (data) => {
    console.log("user disconnected", data);
    socket.emit("getOnlineUsers");
  });
}

prepareSocket();
socket.connect();

const onlineUsers = document.querySelector(".online-users");
function renderOnlineUsers(users: Record<string, string>) {
  if (!onlineUsers) return;
  onlineUsers.innerHTML = "";
  for (const [id, nom] of Object.entries(users)) {
    if (id !== socket.id) {
      onlineUsers.innerHTML += `
        <div class="user">
            <div class="name">${nom}</div>
            <button class="call">Call</button>
        </div>
        `;
    }
  }
}
