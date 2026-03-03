# IMPULSION - Plan d'evolution

## Phase 1 : Refonte du questionnaire (front-end, sans Supabase)

### 1.1 Renommage et identite visuelle
- Renommer l'outil "Impulsion" partout (titre, PDF, pied de page)
- Supprimer l'ecriture inclusive avec point median (partout)
- Remplacer "Charge de projets" par "Referent Transitions Pro PACA"

### 1.2 Bloc identite enrichi
- Ajouter un menu deroulant civilite (Mme / M.) avant prenom/nom
- Ajouter un champ "Code interne" (reference ERP)
- Renommer le label "Referent Transitions Pro PACA"

### 1.3 Introduction amelioree
- Message court expliquant pourquoi on pose ces questions sans echanger d'abord
- Rappel des 3 phases du projet (construction, commission, validation)
- Mention du secret professionnel et non-exploitation des donnees
- Timer toujours visible

### 1.4 Modifications des questions
- Q3b : visible quel que soit le choix a Q2, avec option "Je prefere ne pas repondre"
- Q10 : case a cocher horodatee par le referent (certification de l'alerte)
- Q11 : interfacage API Sirene/Pappers pour identifier l'employeur
- Q13 : deja fait (champ libre conditionnel)
- Q18 : remplacer "par rapport a maintenant" par "par rapport a votre emploi actuel"
- Q19 : en cas de Non, insister (par rapport au metier, a la situation actuelle)
- Q23 : completer avec modalites (France Travail, reseau, promesse d'embauche, projet interne)
- Ajouter une question "Date envisagee de debut de projet" dans Eligibilite avec alerte si < 90 jours
- Supprimer le bouton Reinitialiser, proposer "Nouveau questionnaire" avec confirmation renforcee

### 1.5 Page resultats
- Remplacer la note /20 par niveaux : Tres faible / Faible / Moyenne / Haute / Tres haute
- Masquer les contenus detailles dans la prescription CEP
- Differencier projet interne vs projet externe

### 1.6 PDF Prescription
- Tenir sur une seule page (style prescription medicale, moins formel)
- Code interne a la place du prenom/nom
- "Objectiver les contraintes" au lieu de "A approfondir" pour les inconvenients
- Mention projet interne/externe avec orientation CEP
- Supprimer l'email, conserver le telephone
- Lien mon-cep.org + QR code pour prise de RDV CEP

---

## Phase 2 : Backend Supabase (CRM)

### 2.1 Authentification
- Connexion referents (email/mdp via Supabase Auth)
- Roles : referent, manager
- Page de connexion

### 2.2 Modele de donnees
- Table `referents` (id, nom, email, tel)
- Table `beneficiaires` (id, civilite, prenom, nom, code_interne, tel, email)
- Table `projets` (id, beneficiaire_id, referent_id, statut, date_creation, date_modif)
- Table `questionnaires` (id, projet_id, reponses_json, date, version)
- Table `alertes` (id, projet_id, type, date_creation, date_execution, note)
- Table `historique` (id, projet_id, action, details, date, referent_id)

### 2.3 Fonctionnalites referent
- Tableau de bord : liste des projets suivis
- Fiche projet : historique complet, toutes les versions du questionnaire
- Reprise/modification des reponses avec conservation de l'historique
- Rejouer le questionnaire (nouveau questionnaire pour un meme beneficiaire)
- Alertes de rappel telephonique avec suivi

### 2.4 Fonctionnalites manager
- Vue d'ensemble : tous les referents, tous les projets
- KPI : nombre de relances, nombre de projets par referent
- Suivi par etape (construction, commission, validation)
- Filtres et export

---

## Phase 3 : Integrations externes

### 3.1 API Sirene / Pappers
- Recherche employeur par SIRET/SIREN/nom
- Auto-remplissage secteur d'activite (code APE)

### 3.2 QR Code
- Generation dynamique du QR code mon-cep.org dans le PDF

---

## Stack technique proposee
- Frontend : HTML/CSS/JS (actuel) -> migration possible vers React/Vue
- Backend : Supabase (Auth, Database, Row Level Security)
- PDF : jsPDF (actuel) + qrcode.js pour le QR code
- API externes : API Sirene (INSEE) ou Pappers
