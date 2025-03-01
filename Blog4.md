Après s'être préparés à l'aide de quatre articles sur WebRTC, nous sommes enfin prêts à créer notre première application.
Dans le dernier article, j'ai mentionné que nous verrions comment l'utiliser pour faire des appels un-à-un. Cependant, en y repensant, je pense qu'il serait tout aussi pertinent de vous montrer comment créer un serveur de signal. C'est donc dans cette direction que cet article ira.

## Contexte

Pour cette application, j'ai choisi d'utiliser Node.js, Express, TypeScript et la bibliothèque Socket.IO. J'ai opté pour TypeScript afin que le typage soit plus clair et que l'on comprenne mieux d'où viennent chaque partie du code. Le choix de Socket.IO est dû au fait qu'il s'agit d'une bibliothèque qui permet d'implémenter facilement un système de signalisation (WebSocket ou "long-polling"). Sa simplicité nous permet de mieux comprendre le fonctionnement de WebRTC.

## Configuration Initiale

Commençons par la partie serveur de signal. Pour mettre en place celui-ci, nous devons commencer avec un projet Express avec TypeScript. Pour cela, nous pouvons exécuter cette commande qui l'initialisera :

```
npx create-express-api --typescript --directory my-api-name
```

Ensuite, nous devons installer la bibliothèque Socket.IO. Pour cela, placez-vous à la racine du dossier contenant le projet généré à l'étape précédente :

```
cd my-api-name
npm i socket.io
```

Le projet généré contient plusieurs fichiers intéressants dans le cadre d'une API, mais pour les besoins de cet article, nous nous concentrerons sur `index.ts` dans le dossier `src`.

Nous commencerons par configurer un serveur Socket.IO :

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
  console.log(`Listening: http://localhost:${port}`);
});
```

Ensuite, nous pouvons créer une variable qui contiendra les informations des utilisateurs connectés en mémoire, ce qui permettra au client de savoir qui est actuellement en ligne :

```
const connectedUsers: Record<string, string | undefined> = {};
```

## Mise en place des évènements

### Avant WebRTC

Maintenant que la configuration initiale est terminée, nous pouvons commencer à définir les événements à déclencher. Ceux-ci sont des événements côté serveur définis avec la méthode `on`, qui ont la possibilité d'appeler d'autres événements côté client grâce à la méthode `emit`. Tous ces événements sont définis dans un premier événement appelé `connection`, déclenché lors de la première connexion d'un client :

```
io.on("connection", (socket) => {
    // Futur évènements serveurs et évènement clients
});
```

Continuons avec tout ce qui est nécessaire mais qui ne fait pas directement partie de WebRTC.

Commençons par enregistrer l'ID de connexion de l'utilisateur avant qu'il indique son pseudo :

```
io.on("connection", (socket) => {
    connectedUsers[socket.id] = undefined;
});
```

Ensuite, nous définirons le moyen pour l'utilisateur d'indiquer son pseudo avec l'événement `register`:

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

Son pseudo est enregistré et ajouté au dictionnaire, et l'ajout est notifié à tous les autres clients connectés avec `broadcast.emit`. Ceux-ci déclencheront l'événement `userConnected`.
\
Définissons maintenant celui permettant d'obtenir la liste des utilisateurs connectés :

```
io.on("connection", (socket) => {
    ...précedent évenements
    socket.on("getOnlineUsers", () => {
        socket.emit("onlineUsers", connectedUsers);
    });
});
```

Maintenant que nous savons qui est connecté et que leurs pseudos sont renseignés, ajoutons un événement pour démarrer le processus de connexion WebRTC.\
\
Le premier servira à notifier un autre utilisateur qu'il reçoit un appel :

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

Ici, `to`envoie le signal à une connexion particulière grâce à l'attribut `to` de l'objet `data`, qui représente l'ID de l'utilisateur appelé. Nous recevons ces informations avec l'objet `data`, qui contient les données envoyées par le client. Le deuxième paramètre de `emit` correspond aux données transmises à l'autre client. Ici, nous envoyons l'ID de l'appelant et son pseudo, ce qui permettra à l'utilisateur appelé de démarrer le processus de connexion WebRTC.\
\

Enfin, définissons comment la déconnexion est gérée :

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

Ici, on retire l'utilisateur de la liste des connectés et on notifie tous les autres.

### WebRTC

Nous avons parlé de nombreux événements, mais qu'en est-il de WebRTC ? Eh bien, allons-y !

Les premiers événements concernent les offres SDP :

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

io.on("connection", (socket) => {
...événements précédents
socket.on("offer", (data) => {
socket.to(data.to).emit("offer", { sdp: data.sdp, socketId: socket.id });
});

    socket.on("answer", (data) => {
        socket.to(data.to).emit("answer", { sdp: data.sdp, socketId: socket.id });
    });

});

Comme nous l'avons vu précédemment, il s'agit d'une description de la connexion WebRTC en cours de création. Celui qui répond à `call` enverra l'offre SDP, suivie d'une réponse de l'autre client.

Ajoutons maintenant l'événement pour les « ICE candidates » :

```
io.on("connection", (socket) => {
    ...précedent évenements
    socket.on("candidate", (data) => {
        socket.to(data.to).emit("candidate", { candidate: data.candidate });
    });
});
```

Comme pour les précédents événements, les données sont transférées au destinataire via `to`.

Il s'agissait du dernier événement nécessaire pour permettre la connexion WebRTC.

## Conclusion

En conclusion, nous avons vu comment créer un serveur de signal pour WebRTC. Il s'agit d'un serveur très simple, mais il nous servira pour la suite. Dans le prochain article, nous le connecterons à un client pour réaliser un appel en un-à-un.

---

## Sources

1. Sude Kılıç, « Socket.IO with Node.Js + Express », dans medium, 16 Décembre 2021, [https://medium.com/kocfinanstech/socket-io-with-node-js-express-5cc75aa67cae](https://medium.com/kocfinanstech/socket-io-with-node-js-express-5cc75aa67cae)

2. videosdk, « How to Build Real-time Apps using Socket.IO and WebRTC? », 2024, [https://www.videosdk.live/developer-hub/socketio/socketio-webrtc](https://www.videosdk.live/developer-hub/socketio/socketio-webrtc)
