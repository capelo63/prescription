# Documentation technique — Application Impulsion

> Transitions Pro PACA — Document destiné au chargé de projets informatiques

---

## Table des matières

1. [Architecture technique](#1-architecture-technique)
2. [Structure des fichiers](#2-structure-des-fichiers)
3. [Base de données — Schéma](#3-base-de-données--schéma)
4. [Politiques d'accès (RLS)](#4-politiques-daccès-rls)
5. [Authentification & rôles](#5-authentification--rôles)
6. [Questionnaire de prescription](#6-questionnaire-de-prescription)
7. [Tableau de bord CRM](#7-tableau-de-bord-crm)
8. [Page statistiques](#8-page-statistiques)
9. [Intégration CEP — Avenir Actifs](#9-intégration-cep--avenir-actifs)
10. [Services externes](#10-services-externes)
11. [Déploiement](#11-déploiement)
12. [Gestion des utilisateurs](#12-gestion-des-utilisateurs)
13. [Transfert de propriété](#13-transfert-de-propriété)
14. [Maintenance](#14-maintenance)

---

## 1. Architecture technique

Impulsion est une application web **entièrement statique côté client** (HTML/CSS/JavaScript vanilla, sans framework ni bundler). Elle communique avec **Supabase** comme backend (base de données PostgreSQL + authentification) et est hébergée sur **Vercel**.

```
Navigateur  →  Vercel (fichiers statiques)  →  Supabase (PostgreSQL + Auth)
```

> **Point clé** : il n'y a aucun serveur applicatif à maintenir. Tout s'exécute dans le navigateur du client. La sécurité des données est assurée par les politiques RLS de Supabase au niveau de la base de données.

### Technologies utilisées

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | HTML5 / CSS3 / JavaScript ES2020 | Interface utilisateur — aucune dépendance de build |
| Base de données | Supabase (PostgreSQL 15) | Stockage, authentification, API REST automatique |
| Hébergement | Vercel (Free plan) | Serveur de fichiers statiques, CDN mondial, HTTPS |
| Code source | GitHub (`capelo63/prescription`) | Versionnement, déploiement continu sur Vercel |
| Client Supabase | supabase-js v2 (CDN jsDelivr) | Chargé via `<script>` dans chaque page HTML |

---

## 2. Structure des fichiers

Le dépôt GitHub contient tous les fichiers servis directement à la racine du site.

```
prescription/
├── index.html               — Questionnaire de prescription (page principale)
├── crm.html                 — Tableau de bord de gestion des dossiers
├── stats.html               — Page statistiques pour la direction
├── login.html               — Page de connexion
├── admin.html               — Interface administrateur (réservée managers)
│
├── app.js                   — Logique du questionnaire (classe ImpulsionApp)
├── crm.js                   — Logique du tableau de bord (classe ImpulsionCRM)
├── stats.js                 — Logique des statistiques (classe ImpulsionStats)
├── auth.js                  — Authentification partagée (classe ImpulsionAuth)
├── supabase-config.js       — URL et clé publique Supabase
│
├── style.css                — Styles globaux (variables CSS, formulaire)
├── crm.css                  — Styles tableau de bord
├── stats.css                — Styles page statistiques
│
├── data.json                — Définition des questions du questionnaire
├── bareme-priorites.json    — Barème de calcul du niveau de priorité
├── metiers-prioritaires.json— Liste des métiers prioritaires CPF-T
├── secteurs-declin.json     — Secteurs en déclin (données métier)
│
└── setup.sql                — Script SQL de création (tables, triggers, RLS)
```

> **Fichier sensible** : `supabase-config.js` contient la clé publique anonyme (anon key) de Supabase. Cette clé est conçue pour être publique — elle n'offre aucun accès administrateur. Ne jamais y placer la `service_role key` (qui contourne toutes les politiques RLS).

---

## 3. Base de données — Schéma

### Table `profiles`

Créée automatiquement pour chaque compte via un trigger Supabase. Étend `auth.users`.

| Colonne | Type | Description |
|---|---|---|
| `id` | `UUID` | Identifiant unique — référence `auth.users.id` |
| `email` | `TEXT` | Adresse e-mail de l'utilisateur |
| `nom` | `TEXT` | Nom affiché dans l'interface |
| `role` | `TEXT` | `'referent'` ou `'manager'` |
| `created_at` | `TIMESTAMPTZ` | Date de création du compte |

### Table `prescriptions`

Un enregistrement par dossier de prescription. Les données du formulaire sont stockées en JSON.

| Colonne | Type | Description |
|---|---|---|
| `id` | `UUID` | Identifiant unique du dossier |
| `referent_id` | `UUID` | Référence vers `profiles.id` — chargé de projets propriétaire |
| `created_at` | `TIMESTAMPTZ` | Date de création |
| `updated_at` | `TIMESTAMPTZ` | Mise à jour automatique par trigger |
| `beneficiaire` | `JSONB` | Nom, prénom, email, téléphone, employeur… |
| `answers` | `JSONB` | Réponses au questionnaire (Q1–Q26d) |
| `results` | `JSONB` | Résultats calculés (priorité, maturité…) |
| `statut` | `TEXT` | État du dossier — voir valeurs ci-dessous |
| `notes` | `TEXT` | Notes internes libres |
| `timer_seconds` | `INTEGER` | Durée de l'entretien en secondes |

### Valeurs du champ `statut`

| Valeur | Signification |
|---|---|
| `prescrit` | Entretien réalisé, dossier ouvert |
| `oriente_cep` | Bénéficiaire orienté vers un CEP |
| `dossier_en_cours` | Dossier CPF-T en cours de constitution |
| `commission` | Dossier passé en commission |
| `valide` | Dossier validé par la commission |
| `refuse` | Dossier refusé |

### Script de création

Le fichier `setup.sql` à la racine du dépôt contient l'intégralité du script de création : tables, index, triggers, politiques RLS. Il est à exécuter une seule fois dans l'éditeur SQL de Supabase.

---

## 4. Politiques d'accès (RLS)

Supabase applique les politiques RLS **au niveau de la base de données**, indépendamment du code client. Même si le code JavaScript est modifié dans le navigateur, un utilisateur ne peut jamais accéder aux données d'un autre chargé de projets.

### Règles sur `profiles`

| Opération | Qui peut |
|---|---|
| SELECT | Chaque utilisateur voit son propre profil. Les managers voient tous les profils. |
| INSERT / UPDATE / DELETE | Géré uniquement via les triggers Supabase (`handle_new_user`). |

### Règles sur `prescriptions`

| Opération | Référent | Manager |
|---|---|---|
| SELECT | Ses propres dossiers uniquement | Tous les dossiers |
| INSERT | Oui (`referent_id` = son propre id) | Non |
| UPDATE | Ses propres dossiers | Tous les dossiers |
| DELETE | Ses propres dossiers | Tous les dossiers |

> **Comportement à connaître** : quand Supabase bloque une opération via RLS, il ne retourne pas d'erreur — il retourne simplement 0 lignes affectées. L'application est codée pour détecter ce cas et afficher un message approprié.

---

## 5. Authentification & rôles

L'authentification est gérée par Supabase Auth (email + mot de passe). La classe `ImpulsionAuth` dans `auth.js` est incluse dans chaque page. Les pages commencent avec `body style="display:none;"` et sont affichées uniquement après vérification de la session — empêchant tout affichage non authentifié.

### Rôle `referent`

- Créer et remplir des questionnaires
- Voir ses propres dossiers dans le CRM
- Modifier le statut de ses dossiers
- Supprimer ses propres dossiers
- Accéder à la page statistiques (ses données uniquement)

### Rôle `manager`

- Tout ce que peut faire un référent
- Voir tous les dossiers (tous référents)
- Filtrer par chargé de projets
- Modifier et supprimer tous les dossiers
- Accéder aux statistiques globales toutes équipes

### Créer un compte utilisateur

1. Dans le dashboard Supabase → **Authentication → Users → Invite user**, créer le compte avec l'email et un mot de passe temporaire.
2. Le trigger `handle_new_user` crée automatiquement l'entrée dans `profiles` avec le rôle `'referent'` par défaut.
3. Pour un manager, exécuter dans le SQL Editor :
   ```sql
   UPDATE profiles SET role = 'manager', nom = 'Prénom Nom'
   WHERE email = 'adresse@email.fr';
   ```
4. Transmettre les identifiants à l'utilisateur et lui demander de changer son mot de passe.

---

## 6. Questionnaire de prescription

La page `index.html` / `app.js` gère le questionnaire interactif. Les questions sont définies dans `data.json`, les règles de scoring dans `bareme-priorites.json`.

### Fonctionnement

- Les questions s'affichent dynamiquement selon les réponses précédentes (visibilité conditionnelle)
- Un timer mesure la durée de l'entretien (`timer_seconds`)
- La sauvegarde automatique (*autosave*) préserve la saisie dans `localStorage` en cas de fermeture accidentelle
- Au clic sur « Voir les résultats », la prescription est enregistrée dans Supabase
- Un PDF récapitulatif peut être généré et imprimé depuis la page de résultats

### Questions conditionnelles (Q24a–Q26d)

| Question | Condition d'affichage | Objet |
|---|---|---|
| Q24a | Q10d = « Oui » (a un CEP) | Questions déjà abordées avec le CEP |
| Q24b | Q10d = « Oui » et Q24a ≠ « Non » | Apport de l'entretien vs. suivi CEP |
| Q26a | Q10d = « Non » (pas de CEP) | Tentative de prise de RDV CEP |
| Q26b | Q26a = « Oui » | RDV obtenu ? |
| Q26c | Q26a = « Oui » et Q26b = « Oui » | Délai d'attente (jours) |
| Q26d | Q26a = « Non » | Raison de non-initiation |
| Q25 | Toujours affichée (fin de questionnaire) | Satisfaction du bénéficiaire |

### Modifier les questions

Toute modification du questionnaire se fait en éditant `data.json`. Chaque entrée contient un `id`, un `label`, un `type`, les `options` éventuelles et la `section` d'appartenance. Les règles de visibilité conditionnelle sont codées dans la méthode `shouldShowQuestion()` de `app.js`.

---

## 7. Tableau de bord CRM

La page `crm.html` / `crm.js` affiche la liste de tous les dossiers accessibles selon le rôle de l'utilisateur connecté. Elle permet de filtrer, trier, modifier les statuts, ajouter des notes et supprimer des dossiers.

### Niveaux de priorité

Les libellés ont évolué. Les deux nomenclatures coexistent en base de données :

| Ancienne valeur (legacy) | Nouvelle valeur |
|---|---|
| Très haute | Priorité renforcée |
| Haute | Priorité confirmée |
| Moyenne | En bonne voie |
| Faible | À consolider |
| Très faible | À renforcer |

Le code de `crm.js` et `stats.js` reconnaît les deux jeux de libellés pour assurer la rétrocompatibilité.

---

## 8. Page statistiques

La page `stats.html` / `stats.js` est accessible depuis le tableau de bord. Les managers voient les statistiques globales (avec filtre par chargé de projets) ; les référents voient uniquement leurs propres données.

### Indicateurs disponibles

- Vue d'ensemble : nombre total de dossiers, actifs, validés
- Durée moyenne / min / max des entretiens
- Taux de bénéficiaires ayant déjà un CEP (Q10d)
- Recours au formulaire de rappel CEP (Avenir Actifs)
- Démarche RDV CEP pour les bénéficiaires sans CEP (Q26a–d)
- Satisfaction des bénéficiaires (Q25)
- Répartition des niveaux de priorité
- Répartition des statuts de dossiers
- Maturité des projets
- Entonnoir de transformation (prescrit → validé)

---

## 9. Intégration CEP — Avenir Actifs

Depuis la page de résultats, un bouton « Formulaire de rappel CEP » ouvre le portail Avenir Actifs (sirom.net) avec les coordonnées du bénéficiaire pré-remplies dans l'URL :

```
https://web.sirom.net/portail_cep/public/engagement-cep-form/17
```

Ce clic est enregistré dans `answers['cep_callback'] = 'Oui'` et sauvegardé en base, permettant le suivi statistique.

> **Script Tampermonkey** : un userscript Tampermonkey permet l'auto-remplissage du formulaire CEP depuis les paramètres d'URL passés par l'application. Il est installé une fois par navigateur utilisateur et ne nécessite pas de maintenance serveur.

---

## 10. Services externes

### Supabase (base de données + authentification)

- **Référence projet** : `nhkkqmrlsjebiutijdae`
- **Dashboard** : https://supabase.com/dashboard/project/nhkkqmrlsjebiutijdae
- **Plan actuel** : Free

Limites du plan Free :

- 500 Mo de stockage base de données
- 50 000 utilisateurs actifs par mois
- 2 Go de bande passante
- **Le projet est mis en pause après 1 semaine d'inactivité**

> **Recommandation** : passer au plan **Pro (25 $/mois)** lors du transfert pour éviter les mises en veille automatiques et bénéficier des sauvegardes quotidiennes.

### Vercel (hébergement)

- **URL production** : https://prescription-iota.vercel.app
- **Plan** : Free (Hobby)

Vercel est connecté au dépôt GitHub. Chaque push sur la branche principale déclenche automatiquement un déploiement. Aucune configuration de build n'est nécessaire (fichiers statiques).

### GitHub (code source)

- **Dépôt** : https://github.com/capelo63/prescription
- Dépôt privé. La branche `main` est la branche de production.

---

## 11. Déploiement

Grâce à l'intégration Vercel ↔ GitHub, le processus est entièrement automatisé.

1. Cloner le dépôt localement :
   ```bash
   git clone https://github.com/capelo63/prescription.git
   ```
2. Modifier les fichiers souhaités avec un éditeur de texte (VS Code recommandé)
3. Valider les modifications :
   ```bash
   git add . && git commit -m "Description du changement"
   ```
4. Pousser sur GitHub :
   ```bash
   git push origin main
   ```
5. Vercel détecte le push et déploie automatiquement en 1–2 minutes.

> Aucun outil de compilation (npm, webpack, etc.) n'est requis. Les fichiers sont servis tels quels.

---

## 12. Gestion des utilisateurs

### Créer un utilisateur

Via Supabase Dashboard → Authentication → Users → « Invite user » ou « Add user ».

```sql
-- Après création dans l'interface, mettre à jour le nom et le rôle :
UPDATE profiles
SET nom = 'Prénom Nom', role = 'referent'
WHERE email = 'prenom.nom@transitionspro-paca.fr';
```

### Passer un utilisateur manager

```sql
UPDATE profiles
SET role = 'manager'
WHERE email = 'prenom.nom@transitionspro-paca.fr';
```

### Désactiver un compte

Dans Supabase → Authentication → Users → sélectionner l'utilisateur → « Disable user ».

### Identifier les doublons

En cas de soupçon de dossiers dupliqués, cette requête liste les paires de prescriptions pour un même bénéficiaire et référent :

```sql
SELECT
  p1.id AS id_a_garder,
  p2.id AS id_a_supprimer,
  p1.beneficiaire->>'nom'    AS nom,
  p1.beneficiaire->>'prenom' AS prenom,
  p1.created_at,
  p2.created_at,
  p2.created_at - p1.created_at AS ecart
FROM prescriptions p1
JOIN prescriptions p2
  ON p1.referent_id = p2.referent_id
  AND p1.beneficiaire->>'nom'    = p2.beneficiaire->>'nom'
  AND p1.beneficiaire->>'prenom' = p2.beneficiaire->>'prenom'
  AND p1.created_at < p2.created_at
ORDER BY nom, prenom;
```

---

## 13. Transfert de propriété

> **Action requise avant le départ** : trois comptes doivent être transférés à Transitions Pro PACA. Sans ces transferts, l'accès à l'application et aux données sera perdu.

### 1. Compte GitHub — dépôt `capelo63/prescription`

1. Le responsable informatique crée un compte GitHub (ou utilise un compte existant).
2. Dans le dépôt → Settings → Collaborators → inviter le nouveau compte comme **Owner**, ou transférer le dépôt via Settings → Transfer repository.
3. Une fois le transfert accepté, le créateur peut retirer ses droits.

### 2. Compte Vercel — hébergement

1. Créer un compte Vercel avec l'adresse e-mail de l'organisation (vercel.com).
2. Demander au créateur de transférer le projet via Vercel Dashboard → Settings → Transfer Project.
3. Reconnecter le dépôt GitHub si nécessaire.

### 3. Compte Supabase — base de données

1. Créer un compte Supabase avec l'adresse e-mail de l'organisation (supabase.com).
2. Dans le projet Supabase → Settings → Team → inviter le nouveau compte comme **Owner**.
3. Le créateur peut ensuite retirer son propre accès.
4. Mettre à jour les informations de paiement (Settings → Billing).
5. **Recommandé** : passer au plan Pro (25 $/mois) pour éviter les mises en veille automatiques.

> Toutes les données sont déjà dans Supabase. Le transfert est uniquement un changement de propriétaire des comptes — les données ne bougent pas.

---

## 14. Maintenance

### Sauvegardes

Le plan Free de Supabase ne propose pas de sauvegardes automatiques. Sur le plan Pro, des sauvegardes quotidiennes sont activées. En attendant, exporter manuellement depuis l'éditeur SQL :

```sql
SELECT * FROM prescriptions ORDER BY created_at DESC;
```

Puis cliquer sur « Download CSV » dans l'interface de l'éditeur SQL de Supabase.

### Modifier les données métier

Les fichiers JSON à la racine du dépôt contrôlent les données métier. Modifier directement dans GitHub via l'interface web, ou en local puis pousser :

| Fichier | Contenu |
|---|---|
| `bareme-priorites.json` | Seuils et règles de calcul du niveau de priorité |
| `metiers-prioritaires.json` | Liste des métiers éligibles CPF-T |
| `secteurs-declin.json` | Secteurs économiques en déclin |
| `data.json` | Libellés et structure des questions du questionnaire |

### Mettre à jour les clés Supabase

Si les clés d'API sont régénérées, mettre à jour `supabase-config.js` avec les nouvelles valeurs (Settings → API dans le dashboard Supabase) et pousser sur GitHub.

### Diagnostic des problèmes courants

| Symptôme | Vérification |
|---|---|
| Page blanche ou non chargée | Statut Vercel (vercel.com/status) et Supabase (status.supabase.com) |
| Projet Supabase inaccessible | Se connecter au dashboard et cliquer « Restore project » |
| Erreur d'authentification | Vérifier que le compte existe dans Authentication → Users et n'est pas désactivé |
| Données invisibles | Vérifier le rôle dans la table `profiles` et l'état des politiques RLS |
| Suppression silencieuse | Vérifier les politiques RLS DELETE — un blocage RLS retourne 0 lignes sans erreur |

---

*Documentation rédigée en août 2026 — Application Impulsion v1.0 — Transitions Pro PACA*
