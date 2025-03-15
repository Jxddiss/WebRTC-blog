Après le dernier blog, nous avons eu l'occasion de voir comment créer un serveur de signal avec TypeScript, Express et Socket.io. Aujourd'hui, nous plongerons du côté client, alors préparez-vous !

## Contexte

Pour les besoins de ce blog, nous développerons un client WebRTC qui nous permettra de faire des appels un-à-un.

Il nous permettra d’indiquer notre nom à notre arrivée sur la page, puis de voir la liste de tous les utilisateurs connectés.

Chacun d’eux pourra être appelé. Lorsqu'un appel est reçu, une boîte de dialogue nous permettra de l'accepter ou de le refuser. S'il est accepté, les vidéos des deux utilisateurs seront affichées.

Tout comme pour le côté serveur, j’ai choisi d’utiliser TypeScript afin de mieux comprendre grâce aux types. Cependant, j’ai également décidé de ne pas utiliser de « framework » comme React ou Angular, pour ne citer qu’eux. La raison est simple : mon blog est avant tout axé sur WebRTC et son intégration. Utiliser l’une de ces technologies ajouterait une couche de complexité non nécessaire pour le sujet abordé. Malgré tout, vous en apprendrez davantage sur l’intégration de WebRTC, et celle-ci devrait être sensiblement la même dans d'autres « frameworks ».

## Configuration initiale

Commençons par ce à quoi vous avez accès. Dans [le dépôt du projet sur GitHub](https://github.com/Jxddiss/WebRTC-blog), vous retrouverez, dans la branche `client`, le canevas sur lequel nous allons travailler dans le blog d'aujourd'hui. Celui-ci contient les styles de base de la page, le fichier HTML, le script JavaScript incomplet ainsi que le projet avec le serveur de signal.

Même s'il est vrai que ce que nous verrons pourrait être utilisé avec n'importe quel projet client, je sentais que, pour que nous restions concentrés sur WebRTC, certaines choses comme le CSS n'avaient pas à être détaillées dans cet article. C'est pourquoi je vous ai préparé un projet incomplet.

Vous pouvez le cloner dans votre espace et accéder à la branche avec les commandes suivantes :

```
git clone https://github.com/Jxddiss/WebRTC-blog.git
cd webrtc-blog
git switch client
```

Maintenant que nous avons les prérequis, nous pouvons installer les dépendances dont nous avons besoin.

La première est `socket.io-client`, qui nous permet de communiquer avec le serveur WebSocket utilisant Socket.io.¹

```
cd WebApp/simple-webrtc-client
npm i socket.io-client
```

Ensuite, nous devons installer la librairie `webrtc-adapter`. Celle-ci permet d'améliorer la compatibilité entre les différents navigateurs.¹

```
npm i webrtc-adapter
```

Maintenant, passons au code. Nous travaillerons dans le fichier `main.ts`.

## Types

Commençons par définir une interface pour `window`. Il s'agit de quelque chose qui va nous permettre d'ajouter la fonction `call`, qui sera définie plus tard, à l'objet `window`. Ceci est nécessaire puisque nous utilisons TypeScript.

```
declare global {
  interface Window {
    call: (id: string) => void;
  }
}
```

## Éléments du DOM

Maintenant, allons chercher les éléments du DOM qui nous seront utiles.

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

Laissez-moi vous expliquer à quoi correspond chacun de ces éléments :

- `localVideo` : L'élément qui contiendra la vidéo de l'utilisateur local
- `remoteVideo` : L'élément qui contiendra la vidéo de l'autre pair
- `callBox` : Le conteneur contenant les deux vidéos
- `listeUtilisateursContainer` : Le conteneur contenant l'élément avec la liste des utilisateurs connectés
- `endCallButton` : Le bouton pour arrêter un appel
- `listeUtilisateurs` : L'élément avec la liste des utilisateurs connectés
- `registerDialog` : Le dialogue pour l'inscription
- `registerForm` : Le formulaire d'inscription
- `registerInput` : Le champ avec le nom
- `callDialog` : Le dialogue affiché lorsqu'un appel est reçu
- `callDialogName` : Le nom de l'utilisateur qui appelle
- `callDialogAccept` : Le bouton pour accepter un appel
- `callDialogReject` : Le bouton pour rejeter un appel

## États

Pour implémenter la logique, nous aurons besoin de plusieurs états.

```
let peerConnection = new RTCPeerConnection();
let currentCallId: string | null = null;
let localStream: MediaStream | null = null;
const socket = io("http://localhost:3000");
```

Ici, `peerConnection` est l'objet qui référence la connexion WebRTC. On utilise `let` puisqu'il sera changé entre chaque appel.

Ensuite, `currentCallId` nous permet de garder en mémoire l'ID de connexion de celui avec qui nous sommes en appel. Grâce à celui-ci, nous pourrons directement lui envoyer des informations.

`localStream` représente le flux vidéo venant de la caméra de l'utilisateur.

Finalement, `socket` est l'objet représentant la connexion au serveur de signal.

## Fonctions WebRTC

Cette prochaine section portera son attention sur les fonctions utilitaires liées à WebRTC dont nous aurons besoin.

La première est celle qui nous permet de créer et d'envoyer une offre SDP à l'autre utilisateur.

```
async function createOffer(socketId: string) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", { sdp: offer, to: socketId });
}
```

Dans le cas où une offre est reçue, il faut renvoyer une réponse SDP. C'est donc là qu'entre en jeu `handleOffer`.

```
async function handleOffer(sdp: RTCSessionDescription, socketId: string) {
  await peerConnection.setRemoteDescription(sdp);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", { sdp: answer, to: socketId });
}
```

**Comme mentionné dans un blog précédent, un échange SDP (offre ou réponse) est une description de la connexion WebRTC³**

La fonction suivante nous permet de gérer le flux vidéo de l'utilisateur local. Lorsqu'il est reçu, l'état avec le flux vidéo est mis à jour, la liste des utilisateurs connectés est cachée, le conteneur avec les éléments vidéo est montré, le flux est mis en source dans l'élément contenant la vidéo locale, puis toutes les pistes (audio et vidéo) sont ajoutées à la connexion WebRTC avec l'état `peerConnection`.

```
function handleStream(stream: MediaStream) {
  localStream = stream;
  listeUtilisateursContainer.style.display = "none";
  callBox.style.display = "block";
  localVideo.srcObject = stream;
  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
}
```

Finalement, `resetStates` retire le conteneur de vidéo, réaffiche les utilisateurs connectés, arrête les pistes et réinitialise tous les états.

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

## Évènements WebRTC

Pour faire fonctionner la connexion WebRTC, nous devons définir ce qu'il se passe lors de certains événements. Ceux qui vont nous intéresser aujourd'hui sont `onicecandidate` et `ontrack`. Par contre, il en existe d'autres.

Puisque `peerConnection` est réinitialisé après chaque appel, nous devons placer la définition des comportements dans la fonction `setupPeerConnectionListeners`.

```
function setupPeerConnectionListeners() {
  ...
}
```

`onicecandidate` est lancé lorsqu'un « ICE candidate »⁴ est détecté. Ce que nous voulons faire, c'est les envoyer à l'autre pair.

```
function setupPeerConnectionListeners() {
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentCallId) {
      socket.emit("candidate", { candidate: event.candidate, to: currentCallId });
    }
  };
}
```

`ontrack` lui est lancé lorsqu'un flux de média est ajouté à la connexion par l'autre pair. Nous voulons le prendre et l'ajouter dans l'élément correspondant à la vidéo de l'autre utilisateur.

```
function setupPeerConnectionListeners() {
  ...

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };
}
```

## Configuration Socket

Nous savons comment gérer la connexion WebRTC, mais maintenant la question c'est de savoir comment gérer la connexion au serveur de signal ?

Avec la librairie `socket.io-client`, les événements sont gérés un peu de la même manière que du côté serveur, donc ce que nous ferons sera similaire au précédent blog.

Pour définir ce qui sera fait lors d'un événement, on utilise la méthode `on` de l'objet `socket`, donc cela donne `socket.on("<nom_event>", fonction à faire)`.

La configuration de tous les événements pour cette application sera faite à l'intérieur d'une fonction `setupSocketListeners`.

Commençons par ce qui sera fait lors de la connexion initiale.

```
function setupSocketListeners() {
  socket.on("connect", () => console.log("connected"));
}
```

Ensuite, nous avons l'événement `userConnected`, lancé après que l'utilisateur s'est inscrit en envoyant son nom au serveur.

```
function setupSocketListeners() {
  ...
  socket.on("userConnected", () => {
    socket.emit("getOnlineUsers");
  });
}
```

`socket.emit` permet d'appeler un événement sur le serveur, dans ce cas-ci, `getOnlineUsers`. Le serveur répondra en appelant un autre événement du côté client.

Cet autre est `onlineUsers`. On voit dans la fonction à côté un paramètre, il s'agit de ce qui est retourné par le serveur. Dans ce cas-ci, un dictionnaire avec l'ID de connexion ainsi que le nom des utilisateurs connectés.

```
function setupSocketListeners() {
  ...
  socket.on("onlineUsers", (users: Record<string, string>) => {
      renderOnlineUsers(users);
  });
}
```

`renderOnlineUsers` est une fonction liée à l'interface qui sera expliquée plus tard.

`userDisconnected` est lancé à la déconnexion d'un utilisateur. Ici, on relance `getOnlineUsers` sur le serveur.

```
function setupSocketListeners() {
  ...
  socket.on("userDisconnected", () => {
      socket.emit("getOnlineUsers");
  });
}
```

`call` est ce qui est lancé lorsqu'un appel est reçu. Il appelle une méthode d'interface qui prend en paramètre ce qui doit être fait si l'appel est accepté ou refusé.

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

`endCall` c'est lorsque l'autre utilisateur met fin à l'appel. Les états sont réinitialisés.

```
function setupSocketListeners() {
  ... précédants évènements
  socket.on("endCall", resetStates);
}
```

Finalement, nous avons les événements liés à WebRTC directement : `offer` lorsqu'une offre SDP est reçue, `answer` lors de la réception d'une réponse SDP, et `candidate` pour gérer les candidats reçus.

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

C'est ici que nous allons définir les fonctions associées à la logique des appels.

La première est liée à ce que nous avons ajouté plus tôt à `window`. En effet, c'est ici que nous définirons `window.call`, qui est appelé lorsqu'on veut appeler un autre utilisateur.

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

`await navigator.mediaDevices.getUserMedia` nous permet d'aller chercher les flux de média à partir de la webcam de l'utilisateur. C'est ce qui retourne l'objet `stream` passé à `handleStream`, qui deviendra l'état `localStream`.

Ensuite, nous avons `answerCall` qui a une logique légèrement différente puisqu'il s'agit de ce qui est fait lorsqu'un appel est accepté.

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

Puis finalement, nous avons `hangUp` pour terminer l'appel et le communiquer à l'autre utilisateur.

```
function hangUp() {
  socket.emit("endCall", { to: currentCallId });
  resetStates();
}
```

## Interface utilisateur

C'est maintenant ici que les fonctions liées à l'interface utilisateur seront définies.

La première est ce qui permet d'afficher la liste des utilisateurs connectés reçus du serveur.

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

La façon dont les utilisateurs sont rendus est la raison pour laquelle la fonction `call` fait partie de `window`. En effet, je passe directement le `onclick` aux boutons avec l'ID de l'utilisateur.

Ensuite, nous avons la fonction `showCallDialog` qui sera appelée lorsqu'un appel est reçu. Elle reçoit en paramètre le nom de l'appelant ainsi que les fonctions à lancer si l'appel est accepté ou refusé.

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

## Événements interface utilisateur

En plus des fonctions liées à l'interface, nous avons des écouteurs à définir.  
Le premier est pour permettre au bouton `endCallButton` de mettre fin à l'appel.

```
endCallButton.onclick = hangUp;
```

Finalement, nous en ajoutons un lorsque le formulaire d'inscription est envoyé, pour envoyer le nom avec le socket.

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

Tout ce qu'il nous reste à faire maintenant, c'est appeler les fonctions de mise en place, connecter le socket et montrer le dialog avec le formulaire d'inscription.

```
setupPeerConnectionListeners();
setupSocketListeners();
socket.connect();
registerDialog.showModal();
```

## Démonstration

Voyons maintenant ce que nous avons en photos.

### Formulaire d'inscription

![formulaire d'inscription](https://github.com/Jxddiss/WebRTC-blog/blob/main/images/insc.png?raw=true)

### Liste des utilisateurs connectés

![Liste des utilisateurs connectés](https://github.com/Jxddiss/WebRTC-blog/blob/main/images/users.png?raw=true)

### Dialog d'appel

![Dialog d'appel](https://github.com/Jxddiss/WebRTC-blog/blob/main/images/diag-appel.png?raw=true)

### Zone d'appel

![Zone d'appel](https://github.com/Jxddiss/WebRTC-blog/blob/main/images/appel-video.png?raw=true)

**Ici, j'ai utilisé deux fenêtres du même navigateur, dont une en navigation privée, puisque deux applications ne peuvent pas avoir accès à ma webcam en même temps, mais il s'agit de deux utilisateurs différents et d'une connexion WebRTC entre deux pairs distinctes pour chaques utilisateurs.**

## Conclusion

Dans cet énorme article, nous avons vu comment créer une application cliente utilisant WebRTC pour faire des appels un-à-un. Pour la suite, je ne sais pas encore ce que nous verrons, mais nous risquons de construire sur cette application afin d'explorer un peu plus ce que nous pouvons faire, comme par exemple intégrer le partage d'écran. Alors sur ce, à la prochaine !

## Lien

Si vous voulez explorer la totalité du code que nous avons jusqu'à présent, voici le lien : [https://github.com/Jxddiss/WebRTC-blog](https://github.com/Jxddiss/WebRTC-blog)

---

## Sources

1. videosdk, « How to Build Real-time Apps using Socket.IO and WebRTC? », dans videosdk, 2024, [https://www.videosdk.live/developer-hub/socketio/socketio-webrtc](https://www.videosdk.live/developer-hub/socketio/socketio-webrtc)

2. codezup, « Building a Real-Time Collaboration Platform with WebRTC and Socket.io », dans codezup, 14 Décembre 2024, [https://codezup.com/building-a-real-time-collaboration-platform-with-webrtc-and-socket-io/](https://codezup.com/building-a-real-time-collaboration-platform-with-webrtc-and-socket-io/)

3. Digital Samba, « Deciphering SDP: An In-Depth Exploration of WebRTC’s Session Description Protocol », dans medium, 2 Novembre 2023, [https://medium.com/@digital_samba/deciphering-sdp-an-in-depth-exploration-of-webrtcs-session-description-protocol-b5dc0fca71a9](https://medium.com/@digital_samba/deciphering-sdp-an-in-depth-exploration-of-webrtcs-session-description-protocol-b5dc0fca71a9)

4. A. KERANEN, et al, « RFC 8445: Interactive Connectivity Establishment (ICE) : A Protocol for Network Address Translator (NAT Traversal ) », dans rfc-editor, Juillet 2018, ISSN: 2070-1721, [https://www.rfc-editor.org/rfc/rfc8445#section-1](https://www.rfc-editor.org/rfc/rfc8445#section-1)
