# ÉCHO •°

Une IA locale résonante, pour expérimenter une médiation projective conversationnelle entre un patient et un psychologue présent.

**Prototype expérimental, non validé cliniquement.** Utiliser des situations fictives pour la prise en main. La qualité du dialogue et la pertinence clinique ne sont pas établies par les tests techniques.

## Démarrer

Node.js 22.12 ou supérieur ; Node 24 conseillé. Un navigateur avec WebGPU, Web Crypto, IndexedDB, Cache Storage et Web Locks est nécessaire. L’application doit être servie en **HTTPS ou sur localhost**. Ouvrir `index.html` directement ne fonctionne pas.

```bash
npm ci
npm run dev
```

Ouvrir l’adresse localhost indiquée par Vite, généralement `http://localhost:5173`.

1. Le psychologue crée une phrase secrète d’au moins 12 caractères. Une phrase longue et unique est préférable. Aucune phrase n’est fournie par défaut.
2. Cliquer sur **Préparer l’IA**. La détection vérifie l’adaptateur WebGPU et `shader-f16`.
3. Choisir un modèle et lancer son téléchargement. Garder la page ouverte. La progression inclut téléchargement, compilation et préparation du GPU.
4. Ouvrir une séance et accepter le cadre avec le patient. Écrire un message, puis envoyer. La réponse est produite réellement par WebLLM et apparaît progressivement.
5. **Le psychologue** demande à nouveau la phrase secrète. Cet espace donne accès aux séances, aux citations, aux enchaînements et à la synthèse locale.

Il n’y a aucun backend d’inférence, aucune clé API, aucun compte et aucun service de télémétrie. Si WebGPU ou le modèle est indisponible, aucune réponse n’est fabriquée.

## Modèles proposés

Le catalogue provient des entrées officielles de `@mlc-ai/web-llm` **0.2.87**, version figée dans le projet. Les URL WASM compatibles sont celles de ce catalogue, pas des URL reconstruites manuellement.

| Modèle                       | Usage proposé                | Téléchargement indicatif | Mémoire GPU indicative du catalogue |
| ---------------------------- | ---------------------------- | -----------------------: | ----------------------------------: |
| Qwen3 0,6 B q4f16            | Choix initial multilingue    |                 ≈ 450 Mo |                            ≈ 1,4 Go |
| Qwen3 1,7 B q4f16            | Essayer un modèle plus ample |               ≈ 1 150 Mo |                            ≈ 2,0 Go |
| Qwen2.5 0,5 B Instruct q4f16 | Réduire la mémoire           |                 ≈ 400 Mo |                           ≈ 0,95 Go |
| Qwen2.5 0,5 B Instruct q4f32 | GPU sans `shader-f16`        |                 ≈ 500 Mo |                            ≈ 1,1 Go |

Ces tailles ne constituent pas une mesure de mémoire libre ou une garantie de compatibilité. Le navigateur expose parfois une estimation grossière de RAM système, jamais la mémoire GPU libre. Le panneau affiche le quota de stockage et la limite d’un buffer GPU ; les erreurs mémoire déclenchent un message et un arrêt propre.

Qwen3 est utilisé sans mode de réflexion (`enable_thinking: false`). La pertinence du français et le respect des gestes doivent être évalués sur votre matériel avec des dialogues fictifs ; un petit modèle peut produire une formulation inappropriée.

## Production et PWA

```bash
npm test
npm run build
npm run preview
```

Ouvrir `http://localhost:4173`. Le service worker est destiné au **build de production**, pas au serveur de développement.

- Le service worker précache l’interface, les icônes et les deux bundles JavaScript incluant le Worker WebLLM.
- WebLLM conserve séparément les poids, le tokenizer, la configuration et la bibliothèque WASM via Cache Storage.
- Le panneau vérifie ces quatre familles de ressources. Il ne se contente pas de `hasModelInCache`, qui vérifie les poids.
- Après téléchargement réussi, cocher **Chargement hors ligne strict**, charger le modèle, couper le réseau et recharger la page pour l’essai final. Le cache ne dispense pas de recharger le modèle en mémoire après fermeture.
- L’installation PWA dépend du navigateur. Le bouton apparaît si `beforeinstallprompt` est disponible ; sinon utiliser le menu du navigateur.
- Le stockage persistant peut être demandé, sans garantie d’acceptation. Un navigateur peut supprimer des données locales ; des exports conservés par le psychologue peuvent être nécessaires.
- Une nouvelle version propose une mise à jour explicite, après verrouillage, pour éviter de recharger en pleine séance.

Le rechargement entièrement hors ligne et l’installation PWA sur un appareil cible restent à vérifier : voir [le rapport de validation](docs/VALIDATION.md).

## Deux espaces

### L’échange

Réponses courtes, reformulations, images proposées avec prudence, associations et suspension. Les gestes sont sélectionnés par l’orchestrateur ; ils ne constituent pas une analyse psychologique. Une question n’est pas imposée à chaque tour. La consigne de brièveté et la limite de sortie ne garantissent pas à elles seules une réponse appropriée.

Le contexte est limité à 4 096 tokens. Un budget conservateur en octets garde les tours récents et réserve la place des instructions et de la sortie. Le patient voit un avertissement lorsque d’anciens tours sortent du contexte. **Le dialogue complet reste conservé.** Un message très volumineux peut être refusé ; aucune coupe silencieuse de ce message n’est effectuée.

**Interrompre l’IA** envoie l’interruption puis détruit immédiatement le Worker. Cela fonctionne aussi pendant le chargement ou le préremplissage. Pour reprendre : recharger le modèle depuis son cache. Une pause humaine bloque les envois jusqu’à une reprise par le psychologue.

### La relecture

- Liste des séances après vérification de la phrase secrète.
- Dialogue intégral, recherche littérale dans les paroles patient, citations reconstruites exactement depuis leur source.
- Fréquences lexicales dans au moins deux paroles patient : aucune lemmatisation ni interprétation sémantique.
- Enchaînements chronologiques de deux paroles patient : mots identiques et mots introduits. Ces repères ne démontrent aucun mouvement psychique.
- Synthèse réellement produite par le modèle local. Toutes les paroles patient sont traitées par fragments si nécessaire ; les propos de l’IA ne lui sont pas fournis comme paroles patient.
- Séparation des observations descriptives, des citations exactes et des questions facultatives à explorer par le psychologue.
- Validation du JSON, des identifiants de source, refus de citations générées et filtre prudent de formulations interprétatives. Un résultat tronqué ou invalide est refusé, sans synthèse de remplacement.
- Marqueur de relecture humaine, export Markdown/JSON en clair après avertissement, effacement explicite.

Le filtre de sortie ne prouve pas la fidélité sémantique d’une observation. Même correctement sourcé, un texte peut être inexact ou inadéquat. La relecture humaine est indispensable. Une synthèse par fragments n’explore pas automatiquement les liens entre fragments.

Le bouton **Séance fictive** charge un exemple écrit à l’avance, explicitement étiqueté. Il n’est jamais utilisé pour simuler une réponse ou une synthèse du modèle.

## Skills et extension MCP

Les sept fichiers de `/skills` sont du Markdown versionné. `import.meta.glob` les incorpore au build, sans téléchargement au cours d’une séance.

```text
resonance.md    Reprendre les mots sans les expliquer
projection.md   Déployer une image proposée par le patient
metaphores.md   Proposer un léger pas de côté
associations.md Relier deux éléments réellement formulés
suspension.md   Accepter l’incertitude et le silence
synthese.md     Décrire et sourcer, sans diagnostiquer
securite.md     Cadre prioritaire, limites et relais humain
```

`SkillProvider` est le point d’extension pour un futur fournisseur MCP. **Aucun client MCP ni serveur MCP n’est installé dans ce MVP.** Le modèle n’a ni outil réseau, ni accès à d’autres séances. Une extension distante demanderait une nouvelle analyse des permissions, du consentement et des flux de données ; elle ne doit pas recevoir les conversations par défaut.

Modifier un Skill impose de reconstruire l’application. Les tests signalent des instructions trop longues pour le contexte de synthèse.

## Confidentialité

Les données sont regroupées dans une base IndexedDB dédiée, chiffrées en AES-GCM 256 bits. La clé est dérivée par PBKDF2-SHA256, 600 000 itérations, sel aléatoire de 16 octets ; chaque écriture utilise un nouvel IV de 12 octets. La clé n’est pas exportable et reste seulement en mémoire. Les écritures sont sérialisées.

- Aucun texte de séance dans `localStorage`, l’URL, Cache Storage ou les journaux de l’application.
- La persistance de reprise de génération de WebLLM est explicitement désactivée.
- Le cache de conversation du moteur est vidé avant et après chaque génération.
- Le Worker ne permet que des GET de ressources publiques autorisées pendant le chargement. Pendant l’inférence, les sorties `fetch`, `Cache.add` et `Cache.addAll` sont bloquées en cas d’accès réseau.
- La CSP du build limite les connexions à l’origine de l’application et aux hébergeurs des modèles. En développement seulement, Vite a besoin de ses scripts de rechargement et la CSP est retirée.
- Un seul onglet éditeur est autorisé avec Web Locks pour prévenir des écrasements entre deux copies de la base.
- Le verrouillage intervient après 10 minutes d’inactivité et termine le Worker. La relecture se referme dès que l’onglet devient masqué.
- À la réouverture, le dialogue du patient précédent n’est pas affiché automatiquement. Sa reprise passe par le psychologue.
- Effacer une séance réécrit le stockage chiffré ; effacer tout supprime aussi la phrase locale. Le cache des modèles se gère séparément.

Le verrou est un contrôle local d’interface et un chiffrement au repos, **pas une authentification professionnelle**. Pendant une séance ouverte, la clé et le dialogue existent en mémoire. Il ne protège pas contre un appareil compromis, une extension malveillante, les outils de développement ou une personne utilisant l’espace déjà ouvert. Il n’existe aucune récupération de phrase secrète. Les exports sortent du chiffrement de l’application. L’effacement logique ne garantit pas l’effacement physique de tous les supports ou sauvegardes du navigateur.

Les téléchargements initiaux contactent Hugging Face, son infrastructure de distribution et GitHub. Ces hébergeurs reçoivent les métadonnées habituelles de connexion, jamais les messages. Le contenu conversationnel n’est pas envoyé au serveur qui héberge l’interface.

Changer d’origine (domaine, protocole ou port), de navigateur ou de profil crée un stockage distinct. Une archive du code n’inclut aucune séance.

## Détresse et cadre d’utilisation

Une détection lexicale prudente suspend le modèle devant certaines formulations de danger. Elle peut manquer une détresse ou déclencher une pause à tort. Ce n’est ni un outil de dépistage ni une évaluation du risque. L’interruption manuelle reste toujours accessible pendant le travail du modèle ; une aide humaine doit prendre le relais si nécessaire.

Ce prototype ne certifie aucune conformité réglementaire et n’est pas prêt à recueillir des données de soin réelles sans travaux complémentaires. Aucun diagnostic automatique, aucun traitement ou conseil clinique n’est visé.

## Arborescence

```text
echo/
  .github/workflows/check.yml
  skills/                  # 7 consignes Markdown
  public/                  # icône abstraite et icônes PWA
  src/
    engine/                # moteur réel, Worker, modèles, cache, budget de contexte
    skills/orchestrator.ts # chargement et sélection des Skills
    storage/               # IndexedDB, chiffrement, exports
    analysis/              # repères lexicaux et synthèse sourcée
    security/              # pause humaine et politique réseau
    components/            # patient, psychologue, moteur et modales
    hooks/usePwa.ts
    fixtures.ts            # unique exemple fictif, étiqueté dans l’interface
    App.tsx
    main.tsx
    styles.css
    sw.ts
    types.ts
  tests/                   # tests sur conversations fictives
  docs/                    # architecture et validation
  scripts/package.py       # ZIP sources + build, Python standard
  scripts/generate-icons.py# régénération facultative des icônes, Pillow
  dist/                    # build de production fourni dans l’archive
  index.html
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
```

## Exporter pour GitHub

```bash
npm test
npm run build
npm run package
```

La dernière commande demande Python 3 et crée `release/ECHO-local-GitHub.zip`. Le ZIP contient les sources, les tests, la documentation, le verrou des dépendances et `dist/`. Il exclut `node_modules`, tout dépôt Git, tout export de séance et les fichiers locaux d’environnement.

Décompresser, ouvrir le dossier `echo/` dans un terminal et exécuter `npm ci`. Pour GitHub, déposer le contenu de ce dossier dans un nouveau dépôt. Le workflow fourni teste et construit chaque push/PR ; il ne déploie rien.

Un hébergement statique HTTPS peut servir `dist/`, y compris GitHub Pages. La configuration `base: './'` prend en charge un chemin de sous-projet. Ne publiez pas de données ni d’exports de séance avec le code.

## Documentation technique

- [Architecture et décisions](docs/ARCHITECTURE.md)
- [Validation et essais manuels restants](docs/VALIDATION.md)
- [Sécurité et signalement](SECURITY.md)
- [Documentation officielle WebLLM](https://webllm.mlc.ai/docs/)
- [API officielle WebLLM](https://webllm.mlc.ai/docs/user/api_reference.html)
- [Catalogue officiel des modèles](https://github.com/mlc-ai/web-llm/blob/main/src/config.ts)

Le code du projet est fourni sous licence MIT. Les bibliothèques et les poids des modèles gardent leurs propres licences. Les poids ne sont pas inclus dans l’archive.
