# Application Questionnaire CEP

Application web pour le Conseil en Évolution Professionnelle - Compatible smartphones et ordinateurs.

## Fonctionnalités

- ✅ Questionnaire interactif avec 23 questions
- ✅ Navigation pas-à-pas avec barre de progression
- ✅ Logique conditionnelle (questions adaptées selon les réponses)
- ✅ Alertes et recommandations contextuelles
- ✅ Calcul automatique des scores (éligibilité, priorité, maturité)
- ✅ Génération de prescription PDF personnalisée
- ✅ Sauvegarde locale des réponses
- ✅ Interface responsive (mobile-first)

## Structure du projet

```
app/
├── index.html          # Page principale
├── style.css           # Styles responsive
├── app.js              # Logique de l'application
├── data.json           # Données du questionnaire (générées depuis Excel)
└── README.md           # Ce fichier
```

## Installation et utilisation

### Option 1 : Ouvrir directement dans le navigateur

1. Ouvrez le fichier `index.html` dans votre navigateur web
2. L'application fonctionne entièrement en local, pas besoin de serveur

### Option 2 : Avec un serveur local (recommandé pour éviter les problèmes CORS)

```bash
# Avec Python 3
cd /home/cyril/coaching/app
python3 -m http.server 8000

# Puis ouvrez http://localhost:8000 dans votre navigateur
```

Ou avec Node.js :

```bash
# Installer http-server
npm install -g http-server

# Lancer le serveur
cd /home/cyril/coaching/app
http-server -p 8000

# Puis ouvrez http://localhost:8000
```

## Utilisation sur smartphone

1. **Via navigateur mobile** : Accédez à l'URL si hébergée sur un serveur
2. **Mode PWA** : Le navigateur proposera d'ajouter l'app à l'écran d'accueil
3. **Hors-ligne** : L'application fonctionne sans connexion internet une fois chargée

## Déploiement

### GitHub Pages (gratuit)

1. Créez un repository GitHub
2. Uploadez les fichiers dans le dossier `docs/` ou à la racine
3. Activez GitHub Pages dans les paramètres
4. Votre app sera accessible via `https://username.github.io/repo-name`

### Netlify/Vercel (gratuit)

1. Connectez votre repository ou glissez-déposez le dossier
2. L'application sera déployée automatiquement
3. Vous obtiendrez une URL type `https://app-name.netlify.app`

## Personnalisation

### Modifier les questions

Les questions sont dans le fichier `data.json`, généré depuis le fichier Excel.
Pour mettre à jour :

```bash
source ../venv/bin/activate
python3 ../extract_data.py  # À créer pour réextraire depuis Excel
```

### Modifier l'apparence

Éditez `style.css` - toutes les couleurs sont définies dans les variables CSS :

```css
:root {
    --primary-color: #2563eb;  /* Bleu principal */
    --secondary-color: #64748b; /* Gris */
    /* ... */
}
```

### Modifier la logique de scoring

Éditez les fonctions dans `app.js` :
- `checkEligibilite()` : Critères d'éligibilité
- `calculatePriorite()` : Calcul du score de priorité
- `checkMaturite()` : Évaluation de la maturité du projet
- `generatePrescription()` : Contenu de la prescription

## Technologies utilisées

- HTML5
- CSS3 (Flexbox, Grid, Variables CSS)
- JavaScript ES6+ (Classes, Async/Await, LocalStorage)
- jsPDF (génération de PDF)

## Compatibilité

- ✅ Chrome/Edge (desktop & mobile)
- ✅ Firefox (desktop & mobile)
- ✅ Safari (desktop & mobile)
- ✅ Navigateurs modernes (dernières versions)

## Licence

Application développée pour le coaching CEP - 2025
