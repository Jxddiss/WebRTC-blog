Nous voilà arrivés au dernier article sur WebRTC, j'espère ne pas vous avoir perdus avec l'énorme article de la semaine dernière. Après avoir vu les concepts clés de cette technologie et implémenté notre propre système d'appel vidéo un-à-un, nous allons ajouter la possibilité de partager notre écran. Ensuite, je ferai un très bref retour sur ce que nous avons vu et je conclurai cette série de blogs.

## Contexte

Voici le résultat du blog précédent :

![gif demo](./images/webrtc.gif)

Comme nous pouvons le voir, nous avons une application web communiquant avec un serveur de signal qui nous permet de faire un appel entre deux utilisateurs. Aujourd'hui, dans l'optique de faire un article un peu plus léger, nous allons voir comment ajouter la possibilité de faire un partage d'écran.

## Avant de commencer

Le projet sur lequel nous travaillerons est accessible à ce [lien](https://github.com/Jxddiss/WebRTC-blog)

Vous pouvez le cloner dans votre espace et accéder à la branche pour l'article avec les commandes suivantes :

```
git clone https://github.com/Jxddiss/WebRTC-blog.git
cd webrtc-blog
git switch screen
```

Le fichier à modifier est au chemin `webrtc-blog/WebApp/simple-webrtc-client/src/main.ts`

Par contre, avant de plonger dans le code, je voulais vous parler de ce qui nous permet d'avoir accès à la vidéo et qui va aussi nous permettre d'implémenter le partage d'écran.

### « mediaDevices »

Je parle de l'interface `navigator.mediaDevices`. Même si nous l'avons utilisée lors du dernier blog, je ne l'ai pas expliquée. Cette interface permet au navigateur d'avoir accès aux dispositifs médias connectés à la machine. Par exemple, il pourrait s'agir de la webcam, du microphone ou même de l'écran.¹

Voici un exemple de son utilisation :

```
const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
});
```

Ici, `getUserMedia` donne l'accès aux dispositifs de médias en produisant déjà un objet `MediaStream`, avec plusieurs pistes audio ou vidéo. On pourrait donc parler ici d'une webcam ou d'un microphone.²

On peut aussi remarquer un objet en paramètre qui nous sert à configurer quelles pistes demander et configurer le `MediaStream`.

Il s'agit de ce que nous avons déjà utilisé. Par contre, aujourd'hui nous allons nous intéresser à une autre méthode. Il s'agit de `getDisplayMedia`, qui permet de construire un flux de médias à partir de l'écran.³

## Ajout de la fonctionnalité

Maintenant que nous en savons un peu plus sur `navigator.mediaDevices`, nous pouvons commencer à travailler sur l'implémentation de cette nouvelle fonctionnalité. Comme pour la fois précédente, le code sera dans le fichier `main.ts`.

Commençons par aller chercher le bouton utilisé pour basculer entre vidéo et partage d'écran dans la section `Éléments du DOM` :

```
const toggleScreenSharingButton = document.getElementById(
  "share-screen"
) as HTMLButtonElement;
```

Continuons en ajoutant un état dans la section `états` qui nous servira à déterminer si nous partageons à partir de la webcam ou de l'écran, et un autre qui contiendra la piste vidéo de l'écran :

```
let localDisplayStream: MediaStream | null = null;
let isSharingScreen = false;
```

Ensuite, nous allons créer une fonction dans la section `Fonctions WebRTC` que nous appellerons `toggleScreenSharing`. Elle nous permettra de changer entre la webcam et l'écran.

```
async function toggleScreenSharing() {

}
```

À l'intérieur de celle-ci, nous devons commencer par vérifier si nous sommes déjà en train de partager notre écran. Si c'est le cas, nous appellerons `switchStream`, une fonction que je vais détailler juste après. Dans cet appel, on lui passe `localStream`, qui représente les pistes de la webcam.

```
async function toggleScreenSharing() {
    if (isSharingScreen) {
        if (localStream) {
            switchStream(localStream);
        }
    }
}
```

Dans le cas où nous ne sommes pas déjà en partage d'écran, nous utiliserons `getDisplayMedia` pour aller chercher l'écran de l'utilisateur.

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

Pour finir, nous inverserons la valeur de l'état `isSharingScreen`

```
async function toggleScreenSharing() {
    ......
    isSharingScreen = !isSharingScreen;
}
```

Continuons avec la fonction `switchStream`, qui servira à mettre à jour la connexion WebRTC ainsi que l'interface.

Pour commencer, remplaçons les pistes vidéo envoyées à l'autre pair par celle passée en paramètre à la méthode :

```
function switchStream(stream: MediaStream) {
    peerConnection.getSenders().forEach((sender) => {
        if (sender.track?.kind === "video") {
            sender.replaceTrack(stream.getVideoTracks()[0]);
        }
    });
}
```

Si nous étions en train de partager notre écran, arrêtons le partage :

```
function switchStream(stream: MediaStream) {
    ....
    if (isSharingScreen) {
        localDisplayStream?.getTracks().forEach((track) => track.stop());
    }
}
```

Finissons en changeant la source vidéo locale dans l'interface :

```
function switchStream(stream: MediaStream) {
    ....
    localVideo.srcObject = stream;
}
```

Pour terminer l'implémentation de la fonctionnalité, nous devons l'associer au bouton dans la section `Évènements UI`.

```
toggleScreenSharingButton.onclick = toggleScreenSharing;
```

## Démonstration

![gif demo](./images/webrtc-screen.gif)

## Conclusion

Voilà, nous avons une application qui nous permet de faire des appels un-à-un, et qui en plus nous permet de partager son écran ! C'est ici que se conclut notre aventure sur WebRTC. Ce fut bref. Il en reste encore tellement à voir, alors je vous conseille d'explorer de votre côté tout ce qu'on peut faire avec cette technologie, comme par exemple le transfert de fichiers ou l'intégration à un serveur de médias, pour ne citer que ceux-là. J'espère que vous avez apprécié ma série et je vous souhaite une bonne continuation, et peut-être même à la prochaine dans une nouvelle série d'articles sur un autre sujet.

---

## Sources

1. mdn web docs, « MediaDevices », dans mdn web docs, consulté le 21 mars 2025, [https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)

2. mdn web docs, « MediaDevices: getUserMedia() method », dans mdn web docs, consulté le 21 mars 2025, [https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

3. mdn web docs, « MediaDevices: getDisplayMedia() method », dans mdn web docs, consulté le 21 mars 2025, [https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)

4. Muhammad Aamir, « Understanding WebRTC Screen Sharing with JavaScript​: A Simple Guide », dans medium, 15 Août 2024, [https://medium.com/@amirk3321/understanding-webrtc-screen-sharing-with-javascript-a-simple-guide-854d94ef7a59](https://medium.com/@amirk3321/understanding-webrtc-screen-sharing-with-javascript-a-simple-guide-854d94ef7a59)
