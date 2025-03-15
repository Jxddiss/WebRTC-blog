import { io } from "socket.io-client";
import userSVG from "./user.svg?raw";

// ---------------------------- Declarations des types ----------------------------
declare global {
  interface Window {
    call: (id: string) => void;
  }
}

// ---------------------------- Élements du DOM ----------------------------
const localVideo = document.getElementById("local-video") as HTMLVideoElement;
const remoteVideo = document.getElementById("remote-video") as HTMLVideoElement;
const callBox = document.getElementById("call-box") as HTMLDivElement;
const listeUtilisateursContainer = document.getElementById(
  "liste-utilisateurs-container"
) as HTMLDivElement;
const endCallButton = document.getElementById("end-call") as HTMLButtonElement;
const listeUtilisateurs = document.querySelector(".online-users");
const registerDialog = document.getElementById(
  "register-dialog"
) as HTMLDialogElement;
const registerForm = document.getElementById("register-form");
const registerInput = document.getElementById("username") as HTMLInputElement;
const callDialog = document.getElementById("call-dialog") as HTMLDialogElement;
const callDialogName = document.getElementById("caller-name");
const callDialogAccept = document.getElementById("accept-call");
const callDialogReject = document.getElementById("reject-call");

// ---------------------------- États ----------------------------
let peerConnection = new RTCPeerConnection();
let currentCallId: string | null = null;
let localStream: MediaStream | null = null;
const socket = io("http://localhost:3000");

// ---------------------------- Fonctions WebRTC ----------------------------
async function createOffer(socketId: string) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", { sdp: offer, to: socketId });
}

async function handleOffer(sdp: RTCSessionDescription, socketId: string) {
  await peerConnection.setRemoteDescription(sdp);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { sdp: answer, to: socketId });
}

function handleStream(stream: MediaStream) {
  localStream = stream;
  listeUtilisateursContainer.style.display = "none";
  callBox.style.display = "block";
  localVideo.srcObject = stream;
  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
}

function resetStates() {
  listeUtilisateursContainer.style.display = "flex";
  callBox.style.display = "none";
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  peerConnection.close();
  localStream?.getTracks().forEach((track) => track.stop());
  peerConnection = new RTCPeerConnection();
  setupPeerConnectionListeners();
}

// ---------------------------- Évènements WebRTC ----------------------------
function setupPeerConnectionListeners() {
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentCallId) {
      socket.emit("candidate", {
        candidate: event.candidate,
        to: currentCallId,
      });
    }
  };

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
}

// ---------------------------- Configuration du Socket ----------------------------
function setupSocketListeners() {
  socket.on("connect", () => console.log("connected"));

  socket.on("userConnected", () => {
    socket.emit("getOnlineUsers");
  });

  socket.on("onlineUsers", (users: Record<string, string>) => {
    renderOnlineUsers(users);
  });

  socket.on("userDisconnected", () => {
    socket.emit("getOnlineUsers");
  });

  socket.on("call", (data: { from: string; name: string }) => {
    showCallDialog(
      data.name,
      () => answerCall(data.from),
      () => socket.emit("endCall", { to: data.from })
    );
  });

  socket.on("endCall", resetStates);

  socket.on("offer", (data: { sdp: RTCSessionDescription; socketId: string }) =>
    handleOffer(data.sdp, data.socketId)
  );

  socket.on("answer", (data: { sdp: RTCSessionDescription }) =>
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp))
  );

  socket.on("candidate", (data: { candidate: RTCIceCandidate }) =>
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
  );
}

// ---------------------------- Logique des appels ----------------------------
window.call = async (id: string) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    handleStream(stream);
    socket.emit("call", { to: id });
    currentCallId = id;
  } catch (error) {
    console.error("Error starting call:", error);
  }
};

async function answerCall(socketId: string) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    handleStream(stream);
    currentCallId = socketId;
    await createOffer(socketId);
  } catch (error) {
    console.error("Error answering call:", error);
  }
}

function hangUp() {
  socket.emit("endCall", { to: currentCallId });
  resetStates();
}

// ---------------------------- Fonctions UI ----------------------------
function renderOnlineUsers(users: Record<string, string>) {
  if (!listeUtilisateurs) return;

  listeUtilisateurs.innerHTML = Object.entries(users)
    .filter(([id]) => id !== socket.id)
    .map(
      ([id, nom]) => `
      <li class="user">
          ${userSVG}
          <div class="name">${nom}</div>
          <button onclick="call('${id}')">Appeler</button>
      </li>
    `
    )
    .join("");
}

function showCallDialog(
  callerName: string,
  acceptCall: () => void,
  rejectCall: () => void
) {
  if (!callDialogName || !callDialogAccept || !callDialogReject) return;

  callDialogName.textContent = callerName;
  callDialogAccept.onclick = () => {
    acceptCall();
    callDialog.close();
  };
  callDialogReject.onclick = () => {
    rejectCall();
    callDialog.close();
  };
  callDialog.showModal();
}

// ---------------------------- Évènements UI ----------------------------
endCallButton.onclick = hangUp;
registerForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (registerInput.value) {
    socket.emit("register", registerInput.value);
    socket.emit("getOnlineUsers");
    registerDialog.close();
  }
});

// ---------------------------- Initialisation ----------------------------
setupPeerConnectionListeners();
setupSocketListeners();
socket.connect();
registerDialog.showModal();
