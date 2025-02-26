import { io } from "socket.io-client";
import userSVG from "./user.svg?raw";

const socket = io("http://localhost:3000", {});

function register(name: string) {
  socket.emit("register", name);
  socket.emit("getOnlineUsers");
}

function prepareSocket() {
  socket.on("connect", () => {
    console.log("connected");
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
        <li class="user">
            ${userSVG}
            <div class="name">${nom}</div>
            <button class="call">Appeler</button>
        </li>
        `;
    }
  }
}

const registerDialog = document.getElementById(
  "register-dialog"
) as HTMLDialogElement;
const registerForm = document.getElementById("register-form");
const registerInput = document.getElementById("username") as HTMLInputElement;

registerForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (registerInput.value) {
    register(registerInput.value);
    registerDialog.close();
  }
});

registerDialog.showModal();
