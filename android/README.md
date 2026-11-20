# Drift Zone — appli Android

Enveloppe Android (WebView plein écran, paysage) du jeu complet : les fichiers du jeu sont copiés
dans `app/src/main/assets/www/` au moment de la construction (ils ne sont pas dans ce dossier) et
servis par `WebViewAssetLoader` sous `https://appassets.androidplatform.net/assets/www/`.

Construction : copier le jeu publié dans `app/src/main/assets/www/` (sans `sw.js` ni les fichiers
Windows), ajouter `window.DZ_APK = true` dans `index.html`, puis
`gradle assembleRelease -PdzCode=331 -PdzName=3.3.1` avec un fichier `signing.properties`
(storeFile, storePassword, keyAlias, keyPassword) à la racine. La clé de signature n'est pas publiée.

L'APK de chaque version est attaché aux « Releases » du dépôt :
https://github.com/abdoulhamadywone-dot/drift-zone/releases/latest/download/DriftZone.apk
