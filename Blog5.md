Après le dernier blog, nous avons eu l'occasion de voir comment créer un serveur de signal avec TypeScript, Express et Socket.io. Aujourd'hui, nous plongerons du côté client, alors préparez-vous !

## Contexte

Pour les besoin de ce blog nous développerons un client en WebRTC qui nous permettra de faire des appels un-à-un.

Elle nous permettra d'indiquer notre nom lorsqu'on arrive sur la page pour ensuite voir la liste de tous les utilisateurs connectés.

Chacun de ceux-ci pourra être appellé. Lorsqu'un appel est reçus, un dialog nous permettra de l'accepter ou de le refuser. S'il est accepté, alors les vidéos des deux utilisateurs sont affichées.

Tout comme pour le côté serveur, j'ai fait le choix d'utiliser TypeScript pour que l'on comprenne mieux avec les types. Par contre, j'ai aussi fait le choix de ne pas utiliser de « framework » comme React ou Angular pour ne nommer qu'eux. La raison est simple, mon blog est beaucoup plus axé sur WebRTC et comment le mettre en place, et je penses qu'utilisé l'une de ces technologie rajouterrait une couche de compléxité non-nécessaire pour le sujet du blog. Malgré tout, vous en apprendrez plus sur l'intégration de WebRTC, et celle-ci devrait sensiblement la même chose dans d'autre « framework ».

## Configuration initiale

Commençons par ce auxquel vous avez accès. dans [le dépôt du projet sur github](https://github.com/Jxddiss/WebRTC-blog), vous retrouverez dans la branche `client` le canevas sur lequel nous allons travailler dans le blog d'aujourd'hui. Celui-ci contient les styles de base de la page, le fichier HTML, le script JavaScript incomplêt ainsi que le projet avec le serveur de signal.

Même s'il est vrai que ce que nous verrons pourrait être utilisé avec n'importe quel projet client, je sentait que pour que nous restions concentré sur WebRTC, certaines choses comme le css n'aurait pas à être dans cet article. D'où pourquoi je vous ai préparé un projet incomplêt.

Vous pouvez le cloner dans votre espace et aller sur la branche avec les commandes suivantes :

```
git clone https://github.com/Jxddiss/WebRTC-blog.git
git switch client
```

Maintenant que nous avons les prérequis, nous pouvons installer les dépendances dont nous avons besoins.

La première est `socket.io-client` c'est ce qui nous permet de communiquer avec le serveur websocket qui utilise Socket.io¹

```
cd WebApp/simple-webrtc-client
npm i socket.io-client
```

Ensuite, nous devons installer la librairie `webrtc-adapter` celle-ci permet d'améliorer la compatibilité entre les différents navigateurs¹

```
npm i webrtc-adapter
```

Maintenant, passons au code, nous travaillerons dans le fichier `main.ts`.

## Types

Commençons par définir une interface pour window, il s'agit de quelque chose qui va nous permettre d'ajouter La fonction call, qui sera définie plus tard, à l'objet window. Ceci est nécesaire puisque nous utilisons TypeScript.

```
declare global {
  interface Window {
    call: (id: string) => void;
  }
}
```

## Éléments du DOM

Maintenant, allons chercher les élément du DOM qui nous serons utiles.

```
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
```

Laissez moi vous expliquer a quoi chacun de ces éléments correspond

- `localVideo` : L'élément qui contiendra la vidéo de l'utilisateur local
- `remoteVideo` : L'élément qui contiendra la vidéo de l'autre pair
- `callBox` : Le conteneur contenant les deux vidéos
- `listeUtilisateursContainer` : Le conteneur contenant l'élément avec la liste d'utilisateur connecté
- `endCallButton` : Le bouton pour arreter un appel
- `listeUtilisateurs` : L'élément avec la liste d'utilisateur connecté
- `registerDialog` : Le dialog pour l'inscription
- `registerForm` : Le formulaire d'inscription
- `registerInput` : Le champ avec le nom
- `callDialog` : Le dialog affiché lorsqu'un appel est reçu
- `callDialogName` : le nom de l'utilisateur qui appel
- `callDialogAccept` : Le boutton pour accepter un appel
- `callDialogReject` : Le boutton pour rejeter un appel

## États

Pour implémenter la logique, nous aurons besoins de plusieurs états.

```
let peerConnection = new RTCPeerConnection();
let currentCallId: string | null = null;
let localStream: MediaStream | null = null;
const socket = io("http://localhost:3000");
```

Ici, `peerConnection` est l'objet qui référence la connexion WebRTC. On utilise let puisqu'il sera changé entre chaque appel.

Ensuite, `currentCallId` nous permet de garder en mémoire l'id de connexion de celui avec qui nous somme en appel, Grace à celui-ci, nous pourrons directement lui envoyer des informations.

`localStream` représente le flux vidéo vennant de la caméra de l'utilisateur.

Finalement, `socket` est l'objet représentant la connexion au serveur de signal.

## Fonctions WebRTC

Cette prochaine section portera son attention sur les fonctions utilitaires liées à WebRTC dont nous aurons besoins.

La première est celle qui nous permet de créer et d'envoyer une offre SDP à l'autre utilisateur.

```
async function createOffer(socketId: string) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", { sdp: offer, to: socketId });
}
```

Dans le cas où une offre est reçus, il faut renvoyé un réponse SDP, c'est donc la qu'entre en jeux `handleOffer`

```
async function handleOffer(sdp: RTCSessionDescription, socketId: string) {
  await peerConnection.setRemoteDescription(sdp);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { sdp: answer, to: socketId });
}
```

**Comme mentionnée dans un blog précédant, un échange SDP (offre ou réponse) est une déscription de la connextion WebRTC³**

La fonction suivante nous permet de gérer le flux vidéo de l'utilisateur local, lorsqu'il est reçus, l'état avec le flux vidéo est mis à jour, la liste des utilisateurs connectés est caché, le conteneur avec les éléments vidéo est montré, le flux est mis en source dans l'élément contenant la vidéo locale puis toutes les pistes( audio et video ) sont ajouté à la connexion WebRTC avec l'état peerConnection.

```
function handleStream(stream: MediaStream) {
  localStream = stream;
  listeUtilisateursContainer.style.display = "none";
  callBox.style.display = "block";
  localVideo.srcObject = stream;
  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
}
```

Finalement, `resetStates` retire le conteneur de vidéo, réaffiche les utilisateurs connectés, arrête les pistes et rénitialise tous les états.

```
function resetData() {
  listeUtilisateursContainer.style.display = "flex";
  callBox.style.display = "none";
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  peerConnection.close();
  localStream?.getTracks().forEach((track) => track.stop());
  peerConnection = new RTCPeerConnection();
  setupPeerConnectionListeners();
}
```

## Évènement WebRTC

Pour faire fonctionner la connection WebRTC nous devons définir ce qu'il se passe lors de certains évènements. Ceux qui vont nous intéresser aujourd'hui sont `onicecandidate` et `ontrack`. Parcontre, il en existe d'autre.

Puisque `peerConnection` est rénitialisé après chaque appel, nous devons placé la définition des comportements dans la fonction `setupPeerConnectionListeners`

```
function setupPeerConnectionListeners() {
  ...
}
```

`onicecandidate` est lancé lorsqu'un « ICE candidates »⁴ est détecté. Ce que nous voulons faire, c'est les envoyés à l'autre pair.

```
function setupPeerConnectionListeners() {
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentCallId) {
      socket.emit("candidate", { candidate: event.candidate, to: currentCallId });
    }
  };
}
```

`ontrack` lui est lancé quand un flux de média est ajouté à la connexion par l'autre pair. Nous voulons le prendre et l'ajouter dans l'élément correspondant à la vidéo de l'autre utilisateur.

```
function setupPeerConnectionListeners() {
  ...

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
}
```

## Configuration Socket

Nous savons comment gérer la connexion WebRTC, mais maintenant la question c'est de savoir comment gérer la connexion au serveur de signal?

Avec la librairie `socket.io-client`, les évènements sont géré un peu de la même manière que du côté serveur, donc ce que nous ferons sera similaire au précédant blog.

Pour définir ce qui sera fait lors d'un évènement, on utilise la méthode `on` de l'objet `socket` donc cela donne `socket.on("<nom_event>", fonction à faire)`

La configuration de tous les évènements pour cette application sera fait à l'intérieur d'une fonction `setupSocketListeners`

Commençons par ce qui sera fait lors de la connexion initial

```
function setupSocketListeners() {
  socket.on("connect", () => console.log("connected"));
}
```

Ensuite, nous avons l'évènement `userConnected` lancé après que l'utilisateur c'est inscrit en envoyant son nom au serveur

```
function setupSocketListeners() {
  ...
  socket.on("userConnected", () => {
    socket.emit("getOnlineUsers");
  });
}
```

`socket.emit` permet d'appeller un évènement sur le serveur, dans ce cas ci, `getOnlineUsers`. Le serveur répondra en appelant un autre du côté client.

Cet autre est `onlineUsers`, on voit dans la fonction à côté un paramêtre, il s'agit de ce qui est retourné par le serveur. Dans ce cas ci, un dictionnaire avec le id de connexion ainsi que le nom des utilisateurs connecté.

```
function setupSocketListeners() {
  ...
  socket.on("onlineUsers", (users: Record<string, string>) => {
      renderOnlineUsers(users);
  });
}
```

`renderOnlineUsers` est une fonctions lié à l'interface qui sera expliqué plus tard.

`userDisconnected` est lancé à la déconnexion d'un utilisateur, ici on relance `getOnlineUsers` sur le serveur.

```
function setupSocketListeners() {
  ...
  socket.on("userDisconnected", () => {
      socket.emit("getOnlineUsers");
  });
}
```

`call` est ce qui est lancé lorsqu'un appel est reçus. Il appel une méthode d'interface qui prends en paramêtre ce qui doit être fait si l'appel est accepté ou refusé.

```
function setupSocketListeners() {
  ...
  socket.on("call", (data: { from: string; name: string }) => {
    showCallDialog(
      data.name,
      () => answerCall(data.from),
      () => socket.emit("endCall", { to: data.from })
    );
  });
}
```

`endCall` c'est lorsque l'autre utilisateur met fin à l'appel, les états sont rénitialisés

```
function setupSocketListeners() {
  ... précédants évènements
  socket.on("endCall", resetStates);
}
```

Finalement, nous avons les évènements liés à WebRTC directement, `offer` lorsqu'une offre SDP est reçus, `answer` lors de la récéption d'une réponse SDP et `candidate` pour gérer les candidats reçus

```
function setupSocketListeners() {
  ... précédants évènements
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
```

## Logique des appels

C'est ici que nous allons définir les fonctions associé à la logique des appel.

La première est lié au ce que nous avons ajouter plutôt à window. En effet, c'est ici que nous définirons `window.call`, qui est appellé lorsqu'on veut appeller un autre utilisateur.

```
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
```

`await navigator.mediaDevices.getUserMedia` nous permet d'aller chercher les flux de média à partir de la webcam de l'utilisateur, c'est ce qui retourne l'objet stream passé à `handleStream`, qui deviendra l'état `localStream`

Ensuite, nous avons `answerCall` qui à une logique légèrement différente puisqu'il s'agit de ce qui est fait lorsqu'un appel est accepté

```
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
```

Puis finalement, nous avons `hangUp` pour terminer l'appel et le communiquer à l'autre utilisateur

```
function hangUp() {
  socket.emit("endCall", { to: currentCallId });
  resetStates();
}
```

## Interface utilisateurs

C'est maintenant ici que les fonctions liés à l'interface utilisateurs seront définies

La première est ce qui permet d'afficher la liste des utilisateurs connecté reçus du serveur.

```
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
```

La façon dont les utilisateurs sont rendus est la raison pourquoi la fonction `call` fait partie de window. En effet, je passe directement le onclick aux bouton avec le id de l'utilisateur.

Ensuite, nous avons la fonction `showCallDialog` qui sera appeler lorsqu'un appel est reçu. Elle reçois en paramètre le nom de l'appellant ainsi que les fonctions à lancé si l'appel est accepté ou refuser.

```
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
```

## Évènements interface utilisateur

En plus des fonctions liés à l'interface, nous avons des écouteurs à définir
le premier est pour permettre au bouton `endCallButton` de mettre fin à l'appel

```
endCallButton.onclick = hangUp;
```

Finalement, nous en ajoutons un lorsque le formulaire d'inscription est envoyé pour envoyé le nom avec le socket

```
registerForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (registerInput.value) {
    socket.emit("register", registerInput.value);
    socket.emit("getOnlineUsers");
    registerDialog.close();
  }
});
```

## Initialisation

Tout ce qu'il nous reste à faire maintenant, c'est appeller les fonction de mise en place, connecter le socket et montre le dialog avec le formulair d'inscription

```
setupPeerConnectionListeners();
setupSocketListeners();
socket.connect();
registerDialog.showModal();
```

## Lien

Si vous voulez explorer la totalité du code que nous avons jusqu'a présent, voici le lien : [https://github.com/Jxddiss/WebRTC-blog](https://github.com/Jxddiss/WebRTC-blog)

---

## Sources

1. videosdk, « How to Build Real-time Apps using Socket.IO and WebRTC? », dans videosdk, 2024, [https://www.videosdk.live/developer-hub/socketio/socketio-webrtc](https://www.videosdk.live/developer-hub/socketio/socketio-webrtc)

2. codezup, « Building a Real-Time Collaboration Platform with WebRTC and Socket.io », dans codezup, 14 Décembre 2024, [https://codezup.com/building-a-real-time-collaboration-platform-with-webrtc-and-socket-io/](https://codezup.com/building-a-real-time-collaboration-platform-with-webrtc-and-socket-io/)

3. Digital Samba, « Deciphering SDP: An In-Depth Exploration of WebRTC’s Session Description Protocol », dans medium, 2 Novembre 2023, [https://medium.com/@digital_samba/deciphering-sdp-an-in-depth-exploration-of-webrtcs-session-description-protocol-b5dc0fca71a9](https://medium.com/@digital_samba/deciphering-sdp-an-in-depth-exploration-of-webrtcs-session-description-protocol-b5dc0fca71a9)

4. A. KERANEN, et al, « RFC 8445: Interactive Connectivity Establishment (ICE) : A Protocol for Network Address Translator (NAT Traversal ) », dans rfc-editor, Juillet 2018, ISSN: 2070-1721, [https://www.rfc-editor.org/rfc/rfc8445#section-1](https://www.rfc-editor.org/rfc/rfc8445#section-1)
