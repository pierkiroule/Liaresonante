# Architecture d’ÉCHO •°

## Flux local

Le navigateur sert l’interface React. L’état applicatif en mémoire appartient à `App.tsx`. Les mutations de séance passent par `commit`, puis `LocalVault.save`, qui sérialise les écritures chiffrées dans IndexedDB. Les fragments de réponse restent seulement en mémoire jusqu’à leur fin ou leur interruption explicite.

Le dialogue du patient traverse `selectGesture`, `patientPrompt` puis `fitConversation`. `LocalEngine` crée un vrai `WebWorkerMLCEngine` et charge le modèle avec `reload`. La génération utilise `engine.chat.completions.create({ stream: true })`. Le Worker exécute réellement les calculs WebGPU.

Il n’existe aucune route HTTP de conversation, aucune fonction serverless, aucun SDK de télémétrie et aucun fournisseur d’inférence distant.

## Cycle de vie du moteur

États : `idle`, `loading`, `ready`, `generating`, `error`. Une seule opération utilise le GPU à la fois. Le téléchargement possède un délai maximal de 15 minutes, une génération de 120 secondes. Ces délais sont des limites de protection, pas des mesures de vitesse attendue.

Le chargement vérifie le contexte sécurisé, l’adaptateur WebGPU, `shader-f16`, le cache hors ligne et le quota estimé. La bibliothèque gère ensuite les allocations réelles ; leurs erreurs sont traduites en consignes simples. Un modèle plus grand ne remplace jamais automatiquement un modèle échoué.

Le flux mesure le temps total depuis le lancement local et le délai du premier contenu reçu. L’arrêt termine le Worker immédiatement. Un ticket de génération empêche un retour tardif de modifier une séance arrêtée ou verrouillée. Un `AbortController` débloque les promesses en attente après la terminaison du Worker.

Le cache KV est réinitialisé avant et après une génération. La persistance de reprise de WebLLM est désactivée ; elle écrirait un état de conversation distinct du coffre chiffré. Les poids sont conservés sur disque après libération du GPU.

## Réseau

`networkPolicy.ts` autorise uniquement les GET de fichiers publics des modèles sélectionnés via les URL MLC Hugging Face et les bibliothèques WASM MLC sur GitHub. Le téléchargement peut suivre les redirections de distribution de Hugging Face ; les domaines de destination sont autorisés dans la CSP.

Le Worker intercepte `fetch`, `Cache.add` et `Cache.addAll`. Pendant une génération, une tentative d’accès réseau échoue. Le chargement strictement hors ligne interdit également les sorties durant `reload`. Ce garde ne constitue pas un bac à sable contre du code source modifié ou un navigateur compromis.

Les mises à jour de l’application et le téléchargement initial restent des accès réseau de ressources publiques. Aucun transcript n’est placé dans une URL, une requête ou un service worker.

## Synthèse

La synthèse utilise le même moteur, jamais une API distincte. Les entrées ne contiennent que les identifiants et les textes patient. Un budget conservateur découpe le texte en fragments et conserve les points de code Unicode. Chaque fragment est analysé séquentiellement avec un schéma JSON. Tout dépassement de sortie, JSON invalide, identifiant absent, citation générée ou formulation interdite fait échouer la synthèse ; les résultats incomplets ne sont pas enregistrés comme synthèse complète.

La validation de source prouve uniquement qu’un message existe et appartient au patient. Elle ne prouve pas qu’une proposition le décrit fidèlement. Les citations affichées sont donc reconstruites dans les messages originaux, et la synthèse reste présentée comme une proposition à relire.

Les comptages lexicaux et les enchaînements sont déterministes. Ils ne nécessitent pas de modèle, ne catégorisent pas les personnes et ne mesurent aucun état psychique.

## Limites de sécurité

Le psychologue et le patient partagent le même appareil et la même application. Le contrôle de relecture par phrase secrète est local ; il n’établit ni l’identité ni les droits d’un professionnel. Le chiffrement protège les données au repos lorsque l’application est verrouillée. Le système d’exploitation, le profil de navigateur et la situation d’usage doivent être protégés séparément.

Une reprise de séance archivée passe par la relecture protégée. Le consentement doit rester adapté à la situation, à l’âge et au cadre réel ; une case cochée n’établit pas à elle seule la validité d’un accord.

## Extension MCP

Le contrat `SkillProvider` permet de remplacer le fournisseur de Markdown embarqué. Le MVP ne connecte aucun transport MCP et n’envoie pas le texte à un fournisseur distant. Les futures extensions devront conserver un périmètre explicite, des ressources locales par défaut et une revue des transferts éventuels. L’absence de MCP n’empêche ni les Skills ni l’inférence réelle.
