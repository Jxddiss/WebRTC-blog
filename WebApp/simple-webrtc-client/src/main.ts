import { io } from "socket.io-client";
import userSVG from "./user.svg?raw";

declare global {
  interface Window {
    appeller: (id: string) => void;
  }
}

const socket = io("http://localhost:3000", {});

function register(name: string) {
  socket.emit("register", name);
  socket.emit("getOnlineUsers");
}

function prepareSocket() {
  socket.on("connect", () => {
    console.log("connected");
  });

  socket.on("userConnected", () => {
    socket.emit("getOnlineUsers");
  });

  socket.on("onlineUsers", (data) => {
    renderOnlineUsers(data);
  });

  socket.on("userDisconnected", (data) => {
    console.log("user disconnected", data);
    socket.emit("getOnlineUsers");
  });

  socket.on("call", (data) => {
    showCallDialog(
      data.name,
      () => {
        console.log("accept call");
      },
      () => {
        console.log("reject call");
      }
    );
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
            <button class="call" onclick="appeller('${id}')">Appeler</button>
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

const callDialog = document.getElementById("call-dialog") as HTMLDialogElement;
const callDialogName = document.getElementById("caller-name");
const callDialogAccept = document.getElementById("accept-call");
const callDialogReject = document.getElementById("reject-call");

function showCallDialog(
  callerName: string,
  acceptCall: () => void,
  rejectCall: () => void
) {
  if (!callDialogName || !callDialogAccept || !callDialogReject) return;
  callDialogAccept.onclick = () => {
    acceptCall();
    callDialog.close();
  };
  callDialogReject.onclick = () => {
    rejectCall();
    callDialog.close();
  };
  callDialogName.textContent = callerName;
  callDialog.showModal();
}

window.appeller = appeller;

function appeller(id: string) {
  socket.emit("call", { to: id });
}
