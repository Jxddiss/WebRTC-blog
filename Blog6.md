Nous voila arrivés au dernier article sur WebRTC, j'éspère ne pas vous avoir perdu avec l'énorme article de la semaine dernière.
Après avoir vu les concepts clés de cette technologie et implémenté notre propre système d'appel vidéo un-à-un, nous allons ajoutés la possibilité
de partager notre écran. Ensuite, je ferrai un très bref retour sur ce que nous avons vu et je conclurai cette séries de blogs.

## Contexte

Voici le résultat du blog précédent :

![gif demo](./images/webrtc.gif)

Comme nous pouvons le voir nous avons une applications web communicant avec un serveur de signal qui nous permet de faire un appel entre deux utilisateurs. Aujourd'hui, dans l'optique de faire un article un peu plus léger, nous allons voir comment ajouter la possibilité de faire un partage d'écran.

## Avant de commencer

Le projet sur le quel nous traillerons est accessible à ce [lien](https://github.com/Jxddiss/WebRTC-blog)

Vous pouvez le cloner dans votre espace et accéder à la branche pour l'article avec les commandes suivantes :

```
git clone https://github.com/Jxddiss/WebRTC-blog.git
cd webrtc-blog
git switch screen
```

Le fichier à modifier est au chemin `webrtc-blog/WebApp/simple-webrtc-client/src/main.ts`

Par contre, avant de plonger dans le code, je voulais vous parler de ce qui nous permet d'avoir accès à la vidéo qui vas aussi nous permettre d'implémenter le partage d'écran.

### « mediaDevices »

Je parle de l'interface `navigator.mediaDevices`. Même si nous l'avons utilisé lors du dernier blog, je ne l'ai pas expliqué. Cette interface, permet au navigateur d'avoir accès au dispositifs média connéctées à la machine. Par exemple, il pourrait s'agir de la webcam ou du microphone, ou même l'écran.¹

Voici un exemple de son utilisation :

```
const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
});
```

Ici, `getUserMedia` donne l'accès aux dispositif de médias produisant déjà un objet `MediaStream`, avec plusieurs pistes audio ou vidéo. On pourrait donc parler ici d'une webcam ou d'un microphone.²

On peut aussi remarquer un objet en paramètre qui nous sert à configurer quel pistes demandés et configurer le `MediaStream`.

Il s'agit de ce que nous avons déjà utilisé. Par contre, aujourd'hui nous allons nous intéresser à une autre méthode. Il s'agit de `getDisplayMedia` qui elle permet de construire un flux de média à partir de l'écran.³

## Ajout de la fonctionnalité

Maintenant que nous en savons un peu plus sur `navigator.mediaDevices`, nous pouvons commencer à travailler sur l'implémentation de cette nouvelle fonctionnalité. Comme pour la fois précédente, le code sera dans le fichier `main.ts`.

Commencons par définir aller chercher le boutons utiliser pour basculer entre vidéo et partage d'écran dans la section `Éléments du DOM`:

```
const toggleScreenSharingButton = document.getElementById(
  "share-screen"
) as HTMLButtonElement;
```

Continuons en ajoutant un états dans la section `états` qui nous servira à déterminer si nous partageons à partir de la webcam ou de l'écran et un autre qui contiendra le la piste vidéo de l'écran

```
let localDisplayStream: MediaStream | null = null;
let isSharingScreen = false;
```

Ensuite, nous allons créer une fonctions dans la sections `Fonctions WebRTC` que nous appellerons `toggleScreenSharing`, elle nous permettra de changer entre la webcam et l'écran.

```
async function toggleScreenSharing() {

}
```

À l'intèrieur de celle-ci nous devons commencer par verifier si nous sommes déjà en train de pârtager notre écran, si c'est le cas, nous appelerons `switchStream`, une fonction que je vais détaillé juste après, dans cet appel on lui passe `localStream`, qui représente les pistes de la webcam.

```
async function toggleScreenSharing() {
    if (isSharingScreen) {
        if (localStream) {
        switchStream(localStream);
        }
    }
}
```

Dans le cas ou nous ne sommes pas déjà un partage d'écran, nous utiliserons `getDisplayMedia` pour aller chercher l'écran de l'utilisateur.

```
async function toggleScreenSharing() {
    ......

    else {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
        });
        switchStream(stream);
    }
}
```

Pour finir, nous inversons la valeur de l'état `isStreaming`

```
async function toggleScreenSharing() {
    ......
    isSharingScreen = !isSharingScreen;
}
```

Continuons avec la fonction `switchStream`, elle servira a mettre à jour la connection WebRTC ainsi que l'interface

Pour commencer, remplacons les piste vidéo envoyé à l'autre pair par celle passé en paramêtre à la méthôde

```
function switchStream(stream: MediaStream) {
    peerConnection.getSenders().forEach((sender) => {
        if (sender.track?.kind === "video") {
            sender.replaceTrack(stream.getVideoTracks()[0]);
        }
    });
}
```

Si nous étions en train de partager notre écran, arrêtons le partage<

```
function switchStream(stream: MediaStream) {
    ....
    if (isSharingScreen) {
        localDisplayStream?.getTracks().forEach((track) => track.stop());
    }
}
```

Finissons en changant la source vidéo locale dans l'interface

```
function switchStream(stream: MediaStream) {
    ....
    localVideo.srcObject = stream;
}
```

Pour terminer l'implémentation de la fonctionnalité, nous devons l'associer au boutton dans la section `Évènements UI`.

```
toggleScreenSharingButton.onclick = toggleScreenSharing;
```

## Démonstration

![gif demo](./images/webrtc-screen.gif)

## Conclusion

Voila, nous avons une application qui nous permet de faire des appels un-à-un, et qui en plus nous permet de partager son écran! C'est ici que ce conclu notre aventure sur WebRTC. Ce fut bref. Il en retse encore tellement à voir alors je vous conseil d'explorer de votre côté tout ce qu'on peut faire avec cette technologies, comme par exemple le transfert de fichiers, l'intégration à un serveur de médias pour ne citer que ceux là. J'éspère que vous avez apprécié ma série et je vous souhaite une bonne continuation, et peut être même à la prochjaine dans une nouvelle série d'articles sur un autre sujet.

## Sources

1. mdn web docs, « MediaDevices », dans mdn web docs, consulté le 21 mars 2025, [https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)

2. mdn web docs, « MediaDevices: getUserMedia() method », dans mdn web docs, consulté le 21 mars 2025, [https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

3. mdn web docs, « MediaDevices: getDisplayMedia() method », dans mdn web docs, consulté le 21 mars 2025, [https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)

4. Muhammad Aamir, « Understanding WebRTC Screen Sharing with JavaScript​: A Simple Guide », dans medium, 15 Août 2024, [https://medium.com/@amirk3321/understanding-webrtc-screen-sharing-with-javascript-a-simple-guide-854d94ef7a59](https://medium.com/@amirk3321/understanding-webrtc-screen-sharing-with-javascript-a-simple-guide-854d94ef7a59)
