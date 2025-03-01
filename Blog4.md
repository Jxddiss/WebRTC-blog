Après s'être préparé à l'aide de quatre article sur WebRTC, nous sommes enfin près à crée notre première application.
Dans le dernier article, j'ai mentionné que nous verrons comment l'utiliser pour faire des appels un-à-un, malgré tout, en y repensant, je pense qu'il serait tout aussi pertinent de vous montrer comment créer un serveur de signal. C'est donc dans cette direction que cet article ira.

## Contexte

Premièrement, pour cette application, j'ai fait le choix d'utiliser Node js, Express, Typescript et la librairie socket.io. J'ai fait le choix de Typescript pour que le typage sois plus clair et qu'on comprennent un peu mieux d'ou vient chaque parties. Le choix de socket.io lui est du au fait qu'il s'agit d'une librairie qui nous permet de facilement implémenté un système de signal(websocket ou « long-polling »), la simplicité de cette librairie, nous permet de voir de facon plus clair le fonctionnement de WebRTC.

## Configuration Initial

Commençons par la partie serveur de signal. Pour metre en celui-ci nous devons commencer avec un projet express avec typescript. Pour ceci nous pouvons lancer cette commande qui nous l'initialisera:

```
npx create-express-api --typescript --directory my-api-name
```

Ensuite nous devons installer la librairie socket.io, vous devez aller à la racine du dossier contenant le projet généré à l'étape précedente.

```
cd my-api-name
npm i socket.io
```

le projet, généré contient plusieurs fichiers qui sont intéressant dans le cas d'une API, mais pour les besoin du blog, nous nous concentrerons sur le index.ts dans le dossier src.

Nous commencerons par configurer un serveur socket.io

```
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
```

N'oubliez pas de remplacer `app.listen` par `server.listen` pour que l'application puisse utiliser tout ce qui est websocket.

```
server.listen(port, () => {
  /* eslint-disable no-console */
  console.log(`Listening: http://localhost:${port}`);
  /* eslint-enable no-console */
});
```

Par la suite nous pouvons créer une variable qui contiendra les informations des utilisateurs connecté en mémoire pour permettre au client de savoir qui est présentement en ligne.

```
const connectedUsers: Record<string, string | undefined> = {};
```

## Mise en place des évènements

### Avant WebRTC

Maintenant que la configuration initial est terminer, nous pouvons commencer à définir les évènements à lancer. Ceux si sont des évènement côté serveur définie avec la méthode `on` qui ont la possibilité d'appeler d'autre évènements côté client grace à la méthode `emit`. Tout ces évènement sont définis dans un premier appeler `connection` lancé lors de la première connexion.

```
io.on("connection", (socket) => {
    // Futur évènements serveurs et évènement clients
});
```

Continuons maintenant avec tout ce qui est nécéssaire mais qui ne fait pas directement partie de WebRTC.

Commençons par enregistrer le id de connexion de l'utilisateur avant qu'il indique son pseudo.

```
io.on("connection", (socket) => {
    connectedUsers[socket.id] = undefined;
});
```

Par la suite nous définirons le moyen pour l'utilisateurs d'indiquer son pseudo avec l'évènement `register`.

```
io.on("connection", (socket) => {
  console.log("a user connected", socket.id);
  connectedUsers[socket.id] = undefined;

  socket.on("register", (name: string) => {
    connectedUsers[socket.id] = name;
    console.log("user registered", name);
    socket.broadcast.emit("userConnected");
  });
});
```

Son pseudo est enregistrer et ajouté au dictionnaire et l'ajout est notifier à tout les autres clients connecté avec `broadcast.emit`. Ceux-ci lancerons l'évenement `userConnected`.

Ensuite, définissons celui pour obtenir les utilisateurs connecté.

```
io.on("connection", (socket) => {
    ...précedent évenements
    socket.on("getOnlineUsers", () => {
        socket.emit("onlineUsers", connectedUsers);
    });
});
```

Maintenant que nous savons qui est connecté, et que leurs pseudos sont renseigné, ajouton en un pour commencer le processus de connexion WebRTC.

Le premier sera pour notifier à un autre utilisateur qu'il à un appel.

```
io.on("connection", (socket) => {
    ...précedent évenements
    socket.on("call", (data) => {
        socket
            .to(data.to)
            .emit("call", { from: socket.id, name: connectedUsers[socket.id] });
    });
});
```

Ici le `to` envoie le signal a une connexion particulière à l'aide de l'attribut to de l'objet data qui représente le id qu'on appel. On le recoit avec l'objet data qui est les données reçus du client. Le deuxième paramêtre de `emit` est les données envoyées à l'autre client, ici on envoie l'id de l'apellant et son pseudo. Ceci permettra à celui qui est appeler de commencer le processus de connexion WebRTC.

Maintenant, pour terminer tout ce qui n'est pas WebRTC, définissons comment la déconnexion est gérée.

```
io.on("connection", (socket) => {
    ...précedent évenements
    socket.on("disconnect", () => {
        console.log("user disconnected");
        if (connectedUsers[socket.id]) {
        socket.broadcast.emit("userDisconnected", socket.id);
        delete connectedUsers[socket.id];
        }
    });
});
```

Ici on retire l'utilisateurs de la liste de ceux qui sont connecté et on notifie tout les autres.

### WebRTC

Nous avons parlé de beaucoup d'évènements mais qu'en est t'il de WebRTC? Eh bien, allons y.

Les premiers sont lié au offre SDP.

```
io.on("connection", (socket) => {
    ...précedent évenements
      socket.on("offer", (data) => {
        socket.to(data.to).emit("offer", { sdp: data.sdp, socketId: socket.id });
    });

    socket.on("answer", (data) => {
        socket.to(data.to).emit("answer", { sdp: data.sdp, socketId: socket.id });
    });
});
```

Comme nous l'avons vu précédèment, il s'agit d'une description de la connexion WebRTC en devenir. Celui qui répond à `call` sera celui qui envoi l'offre SDP qui sera suivie d'une réponse de l'autre client.

Ensuite, ajoutons l'évènement pour les « ICE candidates »

```
io.on("connection", (socket) => {
    ...précedent évenements
    socket.on("candidate", (data) => {
        socket.to(data.to).emit("candidate", { candidate: data.candidate });
    });
});
```

Ici comme les précedents, les données sont transféré au destinataire à l'aide de `to`.

Il s'agissait du dernier évènements nécéssaire pour permettre la connexion WebRTC.

## Conclusion

En conclusion, nous avons vu comment créer un serveur de signal pour WebRTC. Il s'agit d'un serveur très simple, mais il nous servira pour la suite. Dans le prochain article, nous le connecterons à un client pour voir un appel fait en un-a-un.

---

## Sources

1. Sude Kılıç, « Socket.IO with Node.Js + Express », dans medium, 16 Décembre 2021, [https://medium.com/kocfinanstech/socket-io-with-node-js-express-5cc75aa67cae](https://medium.com/kocfinanstech/socket-io-with-node-js-express-5cc75aa67cae)

2. videosdk, « How to Build Real-time Apps using Socket.IO and WebRTC? », 2024, [https://www.videosdk.live/developer-hub/socketio/socketio-webrtc](https://www.videosdk.live/developer-hub/socketio/socketio-webrtc)
