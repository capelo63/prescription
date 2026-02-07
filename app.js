// Application de questionnaire CEP
class CEPQuestionnaire {
    constructor() {
        this.questions = [];
        this.alertes = [];
        this.answers = {};
        this.currentQuestionIndex = 0;
        this.metiersPrioritaires = [];
        this.secteursDeclin = [];
        this.userInfo = {
            prenom: '',
            nom: ''
        };
        this.chargeProjets = {
            id: '',
            nom: '',
            email: ''
        };
        this.chargesProjetsData = {
            'cindy': { nom: 'Cindy Lecouf', email: 'c.lecouf@transitionspro-paca.fr' },
            'elies': { nom: 'Eliès Lemhani', email: 'e.lemhani@transitionspro-paca.fr' },
            'maurine': { nom: 'Maurine Loubeau', email: 'm.loubeau@transitionspro-paca.fr' },
            'zacharie': { nom: 'Zacharie Pinton', email: 'z.pinton@transitionspro-paca.fr' },
            'domoina': { nom: 'Domoïna Rakotoarimanana', email: 'd.rakotoarimanana@transitionspro-paca.fr' },
            'marie': { nom: 'Marie Saglietto', email: 'm.saglietto@transitionspro-paca.fr' }
        };
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.updateProgress();
    }

    async loadData() {
        try {
            // Charger les questions
            const response = await fetch('data.json');
            const data = await response.json();
            this.allQuestions = data.questions.filter(q => q.id.startsWith('Q'));
            this.questions = this.allQuestions; // Will be filtered based on conditions
            this.alertes = data.alertes;

            // Charger les métiers prioritaires
            const metiersResponse = await fetch('metiers-prioritaires.json');
            const metiersData = await metiersResponse.json();
            this.metiersPrioritaires = metiersData.metiers;

            // Charger les secteurs en déclin
            const secteursResponse = await fetch('secteurs-declin.json');
            const secteursData = await secteursResponse.json();
            this.secteursDeclin = secteursData.secteurs;

            // Charger le barème de priorités
            const baremeResponse = await fetch('bareme-priorites.json');
            const baremeData = await baremeResponse.json();
            this.baremePriorites = baremeData.priorites;

            document.getElementById('total-questions').textContent = this.getVisibleQuestionsCount();
        } catch (error) {
            console.error('Erreur de chargement des données:', error);
            alert('Erreur de chargement du questionnaire. Veuillez actualiser la page.');
        }
    }

    getVisibleQuestionsCount() {
        return this.allQuestions.filter(q => this.shouldShowQuestion(q)).length;
    }

    shouldShowQuestion(question) {
        // Q3a: uniquement si Q2 = "Sans diplôme" ou "CAP/BEP"
        if (question.id === 'Q3a') {
            const q2Answer = this.answers['Q2'];
            return q2Answer === 'Sans diplôme' || q2Answer === 'CAP/BEP';
        }

        // Q3b: uniquement si Q2 = "Bac", "Bac+2" ou "Bac+3 ou plus"
        if (question.id === 'Q3b') {
            const q2Answer = this.answers['Q2'];
            return q2Answer === 'Bac' || q2Answer === 'Bac+2' || q2Answer === 'Bac+3 ou plus';
        }

        // Q15a et Q15b: uniquement si Q15 = "Oui"
        if (question.id === 'Q15a' || question.id === 'Q15b') {
            const q15Answer = this.answers['Q15'];
            return q15Answer === 'Oui';
        }

        // Q19a et Q19b: uniquement si Q19 = "Oui"
        if (question.id === 'Q19a' || question.id === 'Q19b') {
            const q19Answer = this.answers['Q19'];
            return q19Answer === 'Oui';
        }

        // Q21a et Q22: uniquement si Q21 = "Oui"
        if (question.id === 'Q21a' || question.id === 'Q22') {
            const q21Answer = this.answers['Q21'];
            return q21Answer === 'Oui';
        }

        // Par défaut, montrer toutes les autres questions
        return true;
    }

    setupEventListeners() {
        document.getElementById('select-charge-btn').addEventListener('click', () => this.validateChargeProjets());
        document.getElementById('start-btn').addEventListener('click', () => this.showIdentityScreen());
        document.getElementById('continue-btn').addEventListener('click', () => this.validateIdentity());
        document.getElementById('next-btn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('prev-btn').addEventListener('click', () => this.previousQuestion());
        document.getElementById('back-to-review-btn').addEventListener('click', () => this.backToReview());
        document.getElementById('show-results-btn').addEventListener('click', () => this.showResults());
        document.getElementById('download-pdf-btn').addEventListener('click', () => this.downloadPDF());
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
    }

    validateChargeProjets() {
        const selectElement = document.getElementById('charge-projets-select');
        const selectedId = selectElement.value;

        if (!selectedId) {
            alert('Veuillez sélectionner un chargé de projets.');
            return;
        }

        const chargeData = this.chargesProjetsData[selectedId];
        this.chargeProjets.id = selectedId;
        this.chargeProjets.nom = chargeData.nom;
        this.chargeProjets.email = chargeData.email;

        this.showScreen('welcome-screen');
    }

    showIdentityScreen() {
        this.showScreen('identity-screen');
    }

    validateIdentity() {
        const prenom = document.getElementById('user-prenom').value.trim();
        const nom = document.getElementById('user-nom').value.trim();

        if (!prenom || !nom) {
            alert('Veuillez renseigner votre prénom et votre nom.');
            return;
        }

        this.userInfo.prenom = prenom;
        this.userInfo.nom = nom;

        this.startQuestionnaire();
    }

    startQuestionnaire() {
        this.showScreen('question-screen');
        this.displayQuestion();
    }

    displayQuestion() {
        // Filtrer pour obtenir uniquement les questions visibles
        const visibleQuestions = this.allQuestions.filter(q => this.shouldShowQuestion(q));
        const question = visibleQuestions[this.currentQuestionIndex];

        if (!question) return;

        // Mettre à jour le badge de section
        const sectionBadge = document.getElementById('section-badge');
        sectionBadge.textContent = this.getSectionLabel(question.objectif);

        // Mettre à jour le texte de la question
        document.getElementById('question-text').textContent = question.question;

        // Générer les options de réponse
        this.renderAnswerInput(question);

        // Mettre à jour les boutons de navigation
        document.getElementById('prev-btn').disabled = this.currentQuestionIndex === 0;

        // Vérifier et afficher les alertes
        this.checkAndDisplayAlerts(question);

        // Mettre à jour la progression
        this.updateProgress();
    }

    getSectionLabel(objectif) {
        const labels = {
            'éligibilité': 'Éligibilité',
            'priorité': 'Priorité',
            'critère 1': 'Maturité - Projet',
            'critère 2': 'Maturité - Formation',
            'critère 3': 'Maturité - Emploi',
            'à voir si priorité 2026': 'Priorité future'
        };
        return labels[objectif] || 'Questionnaire';
    }

    renderAnswerInput(question) {
        const container = document.getElementById('answer-container');
        container.innerHTML = '';

        const questionId = question.id;
        const currentAnswer = this.answers[questionId];

        // Déterminer le type d'input selon la question
        if (questionId === 'Q1a') {
            // Ancienneté - doit être testé avant isYesNoQuestion car contient "êtes-vous"
            this.createTextInput(container, questionId, 'text', 'Ex: 2 ans et 3 mois', currentAnswer);
        } else if (questionId === 'Q15a' || questionId === 'Q15b' || questionId === 'Q22') {
            // Questions ouvertes - doivent être testées avant isYesNoQuestion
            this.createTextAreaInput(container, questionId, 'Votre réponse...', currentAnswer);
        } else if (this.isYesNoQuestion(question)) {
            // Question Oui/Non
            this.createButtonOptions(container, questionId, ['Oui', 'Non'], currentAnswer);
        } else if (questionId === 'Q2') {
            // Diplôme
            this.createButtonOptions(container, questionId, [
                'Sans diplôme',
                'CAP/BEP',
                'Bac',
                'Bac+2',
                'Bac+3 ou plus'
            ], currentAnswer);
        } else if (questionId === 'Q3b') {
            // Rémunération
            this.createNumberInput(container, questionId, 'Rémunération brute mensuelle (€)', currentAnswer);
        } else if (questionId === 'Q10') {
            // Comment quitter l'emploi
            this.createButtonOptions(container, questionId, [
                'Démission',
                'Rupture conventionnelle',
                'Licenciement',
                'Autre'
            ], currentAnswer);
        } else if (questionId === 'Q10b') {
            // En avez-vous parlé à l'employeur
            this.createButtonOptions(container, questionId, ['Oui', 'Non'], currentAnswer);
        } else if (questionId === 'Q11') {
            // Secteur d'activité avec vérification
            this.createSecteurInput(container, questionId, currentAnswer);
        } else if (questionId === 'Q12') {
            // Métier visé avec vérification
            this.createMetierInput(container, questionId, currentAnswer);
        } else {
            // Champ texte libre par défaut
            this.createTextAreaInput(container, questionId, 'Votre réponse...', currentAnswer);
        }
    }

    isYesNoQuestion(question) {
        const yesNoIds = ['Q1b', 'Q1c', 'Q3a', 'Q4', 'Q5', 'Q6', 'Q7', 'Q13', 'Q14', 'Q15', 'Q19', 'Q21'];
        return yesNoIds.includes(question.id) ||
               question.question.toLowerCase().includes('êtes-vous') ||
               question.question.toLowerCase().includes('avez-vous') ||
               question.question.toLowerCase().includes('connaissez-vous');
    }

    createButtonOptions(container, questionId, options, currentAnswer) {
        options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'answer-option';
            button.textContent = option;
            if (currentAnswer === option) {
                button.classList.add('selected');
            }
            button.addEventListener('click', () => {
                container.querySelectorAll('.answer-option').forEach(btn => {
                    btn.classList.remove('selected');
                });
                button.classList.add('selected');
                this.saveAnswer(questionId, option);
            });
            container.appendChild(button);
        });
    }

    createTextInput(container, questionId, type, placeholder, currentAnswer) {
        const input = document.createElement('input');
        input.type = type;
        input.placeholder = placeholder;
        input.value = currentAnswer || '';
        input.addEventListener('change', (e) => {
            this.saveAnswer(questionId, e.target.value);
        });
        container.appendChild(input);
    }

    createNumberInput(container, questionId, placeholder, currentAnswer) {
        const input = document.createElement('input');
        input.type = 'number';
        input.placeholder = placeholder;
        input.value = currentAnswer || '';
        input.min = 0;
        input.addEventListener('change', (e) => {
            this.saveAnswer(questionId, e.target.value);
        });
        container.appendChild(input);
    }

    createTextAreaInput(container, questionId, placeholder, currentAnswer) {
        const textarea = document.createElement('textarea');
        textarea.placeholder = placeholder;
        textarea.value = currentAnswer || '';
        textarea.addEventListener('change', (e) => {
            this.saveAnswer(questionId, e.target.value);
        });
        container.appendChild(textarea);
    }

    createSecteurInput(container, questionId, currentAnswer) {
        // Créer le champ de saisie
        const inputWrapper = document.createElement('div');
        inputWrapper.style.marginBottom = '15px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Saisissez le secteur d\'activité de votre employeur';
        input.value = currentAnswer || '';
        input.id = 'secteur-input';
        inputWrapper.appendChild(input);
        container.appendChild(inputWrapper);

        // Créer le bouton de vérification
        const checkButton = document.createElement('button');
        checkButton.textContent = 'Vérifier si dans la liste prioritaire';
        checkButton.className = 'btn btn-secondary';
        checkButton.type = 'button';
        checkButton.style.marginBottom = '15px';
        checkButton.addEventListener('click', () => {
            const searchTerm = input.value.toLowerCase().trim();
            if (searchTerm) {
                this.checkSecteur(searchTerm);
            } else {
                alert('Veuillez saisir un secteur d\'activité');
            }
        });
        container.appendChild(checkButton);

        // Zone de résultat
        const resultDiv = document.createElement('div');
        resultDiv.id = 'secteur-result';
        container.appendChild(resultDiv);

        // Afficher la liste des secteurs
        const listButton = document.createElement('button');
        listButton.textContent = 'Voir la liste complète des secteurs en déclin';
        listButton.className = 'btn btn-secondary';
        listButton.type = 'button';
        listButton.style.marginTop = '10px';
        listButton.addEventListener('click', () => {
            this.showSecteursList();
        });
        container.appendChild(listButton);

        // Sauvegarder la réponse
        input.addEventListener('change', (e) => {
            this.saveAnswer(questionId, e.target.value);
        });
    }

    createMetierInput(container, questionId, currentAnswer) {
        // Créer le champ de saisie
        const inputWrapper = document.createElement('div');
        inputWrapper.style.marginBottom = '15px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Saisissez le métier visé';
        input.value = currentAnswer || '';
        input.id = 'metier-input';
        inputWrapper.appendChild(input);
        container.appendChild(inputWrapper);

        // Créer le bouton de vérification
        const checkButton = document.createElement('button');
        checkButton.textContent = 'Vérifier si dans la liste PACA';
        checkButton.className = 'btn btn-secondary';
        checkButton.type = 'button';
        checkButton.style.marginBottom = '15px';
        checkButton.addEventListener('click', () => {
            const searchTerm = input.value.toLowerCase().trim();
            if (searchTerm) {
                this.checkMetier(searchTerm);
            } else {
                alert('Veuillez saisir un métier');
            }
        });
        container.appendChild(checkButton);

        // Zone de résultat
        const resultDiv = document.createElement('div');
        resultDiv.id = 'metier-result';
        container.appendChild(resultDiv);

        // Afficher la liste des métiers
        const listButton = document.createElement('button');
        listButton.textContent = 'Voir la liste complète des métiers prioritaires';
        listButton.className = 'btn btn-secondary';
        listButton.type = 'button';
        listButton.style.marginTop = '10px';
        listButton.addEventListener('click', () => {
            this.showMetiersList();
        });
        container.appendChild(listButton);

        // Sauvegarder la réponse
        input.addEventListener('change', (e) => {
            this.saveAnswer(questionId, e.target.value);
        });
    }

    checkSecteur(searchTerm) {
        const resultDiv = document.getElementById('secteur-result');
        const matches = this.secteursDeclin.filter(secteur =>
            secteur.intitule.toLowerCase().includes(searchTerm) ||
            secteur.section.toLowerCase().includes(searchTerm) ||
            secteur.code_ape.toLowerCase().includes(searchTerm)
        );

        if (matches.length > 0) {
            let html = '<div class="alert alert-success" style="margin-top: 15px;">';
            html += '<strong>✓ Secteur trouvé dans la liste !</strong><br>';
            html += '<p>Votre secteur fait partie des secteurs en déclin. Cela augmente votre priorité.</p>';
            html += '<ul style="margin-top: 10px;">';
            matches.forEach(match => {
                html += `<li><strong>${match.intitule}</strong> (${match.code_ape})<br><em>${match.section}</em></li>`;
            });
            html += '</ul></div>';
            resultDiv.innerHTML = html;
        } else {
            resultDiv.innerHTML = '<div class="alert alert-warning" style="margin-top: 15px;"><strong>✗ Secteur non trouvé</strong><br>Ce secteur ne figure pas dans la liste des secteurs en déclin prioritaires.</div>';
        }
    }

    checkMetier(searchTerm) {
        const resultDiv = document.getElementById('metier-result');
        const matches = this.metiersPrioritaires.filter(metier =>
            metier.metier.toLowerCase().includes(searchTerm) ||
            metier.domaine.toLowerCase().includes(searchTerm) ||
            metier.code_rome.toLowerCase().includes(searchTerm)
        );

        if (matches.length > 0) {
            let html = '<div class="alert alert-success" style="margin-top: 15px;">';
            html += '<strong>✓ Métier trouvé dans la liste !</strong><br>';
            html += '<p>Votre métier visé fait partie des métiers prioritaires en PACA.</p>';
            html += '<ul style="margin-top: 10px;">';
            matches.forEach(match => {
                html += `<li><strong>${match.metier}</strong> (${match.code_rome})<br><em>${match.domaine}</em></li>`;
            });
            html += '</ul></div>';
            resultDiv.innerHTML = html;
        } else {
            resultDiv.innerHTML = '<div class="alert alert-warning" style="margin-top: 15px;"><strong>✗ Métier non trouvé</strong><br>Ce métier ne figure pas dans la liste des métiers prioritaires en PACA.</div>';
        }
    }

    showSecteursList() {
        const resultDiv = document.getElementById('secteur-result');
        let html = '<div class="alert alert-info" style="margin-top: 15px; max-height: 400px; overflow-y: auto;">';
        html += '<strong>Liste des secteurs en déclin (priorité n°9)</strong><br>';
        html += '<em>Secteurs d\'activité dont le taux d\'emploi diminue en PACA 2026</em>';
        html += '<ul style="margin-top: 10px; font-size: 0.9em;">';

        // Grouper par section
        const sections = {};
        this.secteursDeclin.forEach(secteur => {
            if (!sections[secteur.section]) {
                sections[secteur.section] = [];
            }
            sections[secteur.section].push(secteur);
        });

        Object.keys(sections).forEach(section => {
            html += `<li style="margin-top: 10px;"><strong>${section}</strong><ul>`;
            sections[section].forEach(secteur => {
                html += `<li>${secteur.intitule} (${secteur.code_ape})</li>`;
            });
            html += '</ul></li>';
        });

        html += '</ul></div>';
        resultDiv.innerHTML = html;
    }

    showMetiersList() {
        const resultDiv = document.getElementById('metier-result');
        let html = '<div class="alert alert-info" style="margin-top: 15px; max-height: 400px; overflow-y: auto;">';
        html += '<strong>Liste des métiers prioritaires (priorité n°8)</strong><br>';
        html += '<em>Métiers à fortes perspectives d\'emploi / émergents en PACA 2026</em>';
        html += '<ul style="margin-top: 10px; font-size: 0.9em;">';

        // Grouper par domaine
        const domaines = {};
        this.metiersPrioritaires.forEach(metier => {
            if (!domaines[metier.domaine]) {
                domaines[metier.domaine] = [];
            }
            domaines[metier.domaine].push(metier);
        });

        Object.keys(domaines).forEach(domaine => {
            html += `<li style="margin-top: 10px;"><strong>${domaine}</strong><ul>`;
            domaines[domaine].forEach(metier => {
                html += `<li>${metier.metier} (${metier.code_rome})</li>`;
            });
            html += '</ul></li>';
        });

        html += '</ul></div>';
        resultDiv.innerHTML = html;
    }

    saveAnswer(questionId, answer) {
        this.answers[questionId] = answer;
        localStorage.setItem('cep_answers', JSON.stringify(this.answers));

        // Recharger les alertes quand une réponse change
        const question = this.questions[this.currentQuestionIndex];
        this.checkAndDisplayAlerts(question);
    }

    checkAndDisplayAlerts(question) {
        const alertContainer = document.getElementById('alert-container');
        alertContainer.innerHTML = '';

        // Alertes désactivées pendant le questionnaire
        // Les alertes apparaissent uniquement dans les résultats finaux pour le chargé de projets
        return;
    }

    shouldShowAlert(alerte) {
        // Pour l'instant, afficher toutes les alertes pertinentes
        // On pourrait ajouter une logique plus complexe ici
        return true;
    }

    checkConditionalAlerts(question, container) {
        // Alertes désactivées pendant le questionnaire
        // Les alertes apparaissent uniquement dans les résultats finaux
        return;
    }

    nextQuestion() {
        // Filtrer pour obtenir uniquement les questions visibles
        const visibleQuestions = this.allQuestions.filter(q => this.shouldShowQuestion(q));
        const currentQuestion = visibleQuestions[this.currentQuestionIndex];

        // Vérifier qu'une réponse a été donnée
        if (!this.answers[currentQuestion.id]) {
            alert('Veuillez répondre à la question avant de continuer.');
            return;
        }

        // Recalculer les questions visibles au cas où la réponse change la logique
        const updatedVisibleQuestions = this.allQuestions.filter(q => this.shouldShowQuestion(q));

        if (this.currentQuestionIndex < updatedVisibleQuestions.length - 1) {
            this.currentQuestionIndex++;
            this.displayQuestion();
            window.scrollTo(0, 0);
        } else {
            // Questionnaire terminé - afficher l'écran de résumé
            this.showSummary();
        }
    }

    showSummary() {
        this.showScreen('summary-screen');

        // Afficher le nombre de questions répondues
        const visibleQuestions = this.allQuestions.filter(q => this.shouldShowQuestion(q));
        document.getElementById('total-answered').textContent = visibleQuestions.length;

        window.scrollTo(0, 0);
    }

    backToReview() {
        // Retourner à la dernière question pour permettre la révision
        this.showScreen('question-screen');
        this.displayQuestion();
        window.scrollTo(0, 0);
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayQuestion();
            window.scrollTo(0, 0);
        }
    }

    updateProgress() {
        const visibleQuestions = this.allQuestions.filter(q => this.shouldShowQuestion(q));
        const progress = ((this.currentQuestionIndex + 1) / visibleQuestions.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('current-question').textContent = this.currentQuestionIndex + 1;
        document.getElementById('total-questions').textContent = visibleQuestions.length;
    }

    showResults() {
        this.showScreen('result-screen');
        this.generateResults();
    }

    generateResults() {
        const summaryDiv = document.getElementById('result-summary');
        const prescriptionDiv = document.getElementById('prescription-content');

        // Analyser les réponses
        const analysis = this.analyzeAnswers();

        // Afficher le résumé
        let prioriteDetailsHTML = '';
        if (analysis.priorite.details && analysis.priorite.details.length > 0) {
            prioriteDetailsHTML = '<ul style="margin-top: 10px; font-size: 0.9em;">';
            analysis.priorite.details.forEach(detail => {
                prioriteDetailsHTML += `<li><strong>${detail.code}</strong> - ${detail.libelle} : +${detail.points} pt${detail.points > 1 ? 's' : ''}</li>`;
            });
            prioriteDetailsHTML += '</ul>';
        }

        summaryDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: var(--bg-color); border-radius: 8px;">
                <p style="font-size: 1.3em; color: var(--primary-color); margin: 0;"><strong>${this.userInfo.prenom} ${this.userInfo.nom}</strong></p>
            </div>
            <div class="result-card">
                <h3>Éligibilité</h3>
                <p><strong>${analysis.eligibilite.status}</strong></p>
                <p>${analysis.eligibilite.details}</p>
                ${this.generateQ1aAlertHTML(analysis.eligibilite.q1aAnalysis)}
                ${this.generateQ1bAlertHTML(analysis.eligibilite.q1bAnalysis)}
                ${this.generateQ3bAlertHTML(analysis.eligibilite.q3bAnalysis)}
                ${this.generateQ9AlertHTML(analysis.eligibilite.q9Analysis)}
            </div>
            <div class="result-card">
                <h3>Niveau de priorité</h3>
                <p><strong>${analysis.priorite.status}</strong></p>
                <p style="font-size: 1.2em; margin: 10px 0;"><strong>Score: ${analysis.priorite.score}/${analysis.priorite.maxScore} points</strong></p>
                ${prioriteDetailsHTML}
                ${this.generateQ3aAlertHTML(analysis.priorite.q3aAnalysis)}
            </div>
            <div class="result-card">
                <h3>Maturité du projet</h3>
                <p><strong>${analysis.maturite.status}</strong></p>
                <p>${analysis.maturite.details}</p>
                ${this.generateCritere1AlertHTML(analysis.maturite.critere1Analysis)}
                ${this.generateQ21AlertHTML(analysis.maturite.q21Analysis)}
                ${this.generateQ22AnalysisHTML(analysis.maturite.q22Analysis)}
                ${this.generateQ23AlertHTML(analysis.maturite.q23Analysis)}
            </div>
        `;

        // Générer la prescription
        prescriptionDiv.innerHTML = `
            <h3>Prescription personnalisée</h3>
            ${this.generatePrescription(analysis)}
        `;
    }

    analyzeAnswers() {
        const analysis = {
            eligibilite: this.checkEligibilite(),
            priorite: this.calculatePriorite(),
            maturite: this.checkMaturite()
        };
        return analysis;
    }

    checkEligibilite() {
        const q1b = this.answers['Q1b']; // Reconnu TH
        const q1c = this.answers['Q1c']; // En arrêt

        let status = 'Éligible';
        let details = 'Vous remplissez les conditions d\'éligibilité de base.';

        if (q1c === 'Oui') {
            details += ' Attention: vous êtes actuellement en arrêt, cela peut impacter votre dossier.';
        }

        // Ajouter l'analyse de Q1a pour vérifier l'ancienneté
        const q1aAnalysis = this.analyzeQ1a();

        // Ajouter l'analyse de Q1b pour travailleur handicapé
        const q1bAnalysis = this.analyzeQ1b();

        // Ajouter l'analyse de Q3b pour la rémunération
        const q3bAnalysis = this.analyzeQ3b();

        // Ajouter l'analyse de Q9 pour détecter la pénibilité
        const q9Analysis = this.analyzeQ9();

        return { status, details, q1aAnalysis, q1bAnalysis, q3bAnalysis, q9Analysis };
    }

    calculatePriorite() {
        let score = 0;
        const details = [];

        // P1 - Salariés les moins qualifiés (5 pts)
        if (this.answers['Q3a'] === 'Oui') {
            score += 5;
            details.push({ code: 'P1', libelle: 'Ouvrier/employé peu qualifié', points: 5 });
        }

        // P2 - Salariés reconnus inaptes (1 pt)
        if (this.answers['Q7'] === 'Oui') {
            score += 1;
            details.push({ code: 'P2', libelle: 'Reconnu inapte', points: 1 });
        }

        // P3 - Entreprises de moins de 50 salariés (1 pt)
        if (this.answers['Q4'] === 'Non') {
            score += 1;
            details.push({ code: 'P3', libelle: 'Entreprise < 50 salariés', points: 1 });
        }

        // P6 - Ingénierie de formation valorisée (1 pt)
        let p6Points = 0;
        const q13 = this.answers['Q13'] ? this.answers['Q13'].toLowerCase() : '';
        const q23 = this.answers['Q23'] ? this.answers['Q23'].toLowerCase() : '';

        if (q13.includes('oui') || q13.includes('cléa') || q13.includes('vae') || q13.includes('cep') ||
            q23.includes('oui') || q23.length > 10) {
            p6Points = 1;
            score += 1;
            details.push({ code: 'P6', libelle: 'Ingénierie de formation valorisée (CEP, VAE, CléA, recruteur...)', points: 1 });
        }

        // P7 - Cofinancement (2 pts)
        if (this.answers['Q14'] === 'Oui') {
            score += 2;
            details.push({ code: 'P7', libelle: 'Cofinancement mobilisé', points: 2 });
        }

        // P8 - Métiers à forte perspective (3 pts)
        const q12 = this.answers['Q12'] ? this.answers['Q12'].toLowerCase() : '';
        if (q12) {
            const metierTrouve = this.metiersPrioritaires.some(metier =>
                metier.metier.toLowerCase().includes(q12) ||
                metier.domaine.toLowerCase().includes(q12) ||
                metier.code_rome.toLowerCase().includes(q12) ||
                q12.includes(metier.metier.toLowerCase()) ||
                q12.includes(metier.code_rome.toLowerCase())
            );
            if (metierTrouve) {
                score += 3;
                details.push({ code: 'P8', libelle: 'Métier à forte perspective d\'emploi', points: 3 });
            }
        }

        // P9 - Secteur en déclin (3 pts)
        const q11 = this.answers['Q11'] ? this.answers['Q11'].toLowerCase() : '';
        if (q11) {
            const secteurTrouve = this.secteursDeclin.some(secteur =>
                secteur.intitule.toLowerCase().includes(q11) ||
                secteur.section.toLowerCase().includes(q11) ||
                secteur.code_ape.toLowerCase().includes(q11) ||
                q11.includes(secteur.intitule.toLowerCase()) ||
                q11.includes(secteur.code_ape.toLowerCase())
            );
            if (secteurTrouve) {
                score += 3;
                details.push({ code: 'P9', libelle: 'Secteur dont le taux d\'emploi diminue', points: 3 });
            }
        }

        // P10 - Contrat court ou temps partiel (1 pt)
        if (this.answers['Q5'] === 'Oui' || this.answers['Q6'] === 'Oui') {
            score += 1;
            const type = this.answers['Q5'] === 'Oui' && this.answers['Q6'] === 'Oui' ? 'CDD et temps partiel' :
                         this.answers['Q5'] === 'Oui' ? 'CDD' : 'Temps partiel';
            details.push({ code: 'P10', libelle: type, points: 1 });
        }

        const maxScore = 20;
        let status = score >= 15 ? 'Priorité très élevée' :
                     score >= 10 ? 'Priorité élevée' :
                     score >= 7 ? 'Priorité moyenne' :
                     'Priorité standard';

        // Ajouter l'analyse de Q3a pour ouvrier/employé
        const q3aAnalysis = this.analyzeQ3a();

        return { score, maxScore, status, details, q3aAnalysis };
    }

    analyzeQ22() {
        const q22 = this.answers['Q22'] ? this.answers['Q22'].toLowerCase() : '';
        const criteres = {
            observationGroupe: false,
            visiteCentre: false,
            visitePlateau: false,
            moyensPedagogiques: false
        };

        // Détecter l'observation d'un groupe en situation
        if (q22.match(/observ\w*\s+(un\s+)?groupe|assist\w*\s+.*\s+cours|vu\s+(un\s+)?groupe|groupe\s+en\s+situation|formation\s+en\s+cours/)) {
            criteres.observationGroupe = true;
        }

        // Détecter la visite du centre
        if (q22.match(/visit\w*\s+(le\s+)?centre|visit\w*\s+(l')?organisme|visit\w*\s+(les\s+)?locaux|allé\s+sur\s+place|rendu\s+sur\s+place/)) {
            criteres.visiteCentre = true;
        }

        // Détecter la visite du plateau technique
        if (q22.match(/plateau\s+technique|visit\w*\s+(le\s+)?plateau|équipements?\s+technique|atelier/)) {
            criteres.visitePlateau = true;
        }

        // Détecter la vérification des moyens pédagogiques
        if (q22.match(/moyens?\s+pédagogique|matériel\s+pédagogique|outils?\s+pédagogique|ressources?\s+pédagogique|support|méthode\s+pédagogique/)) {
            criteres.moyensPedagogiques = true;
        }

        const nombreCriteres = Object.values(criteres).filter(v => v).length;

        return {
            criteres,
            nombreCriteres,
            details: this.getQ22Details(criteres)
        };
    }

    getQ22Details(criteres) {
        const elements = [];
        if (criteres.observationGroupe) elements.push('Observation d\'un groupe en situation');
        if (criteres.visiteCentre) elements.push('Visite du centre de formation');
        if (criteres.visitePlateau) elements.push('Visite du plateau technique');
        if (criteres.moyensPedagogiques) elements.push('Vérification des moyens pédagogiques');

        return elements;
    }

    generateQ22AnalysisHTML(q22Analysis) {
        if (!q22Analysis || q22Analysis.nombreCriteres === 0) {
            return '';
        }

        let html = '<div style="margin-top: 15px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid var(--success-color);">';
        html += '<p style="margin: 0 0 10px 0; font-weight: 600; color: var(--success-color);">✓ Démarche de vérification du choix de l\'organisme de formation détectée :</p>';
        html += '<ul style="margin: 5px 0 0 20px; font-size: 0.95em;">';

        q22Analysis.details.forEach(detail => {
            html += `<li>${detail}</li>`;
        });

        html += '</ul>';
        html += '</div>';

        return html;
    }

    analyzeQ9() {
        const q9 = this.answers['Q9'] ? this.answers['Q9'].toLowerCase() : '';

        // Détecter les mentions de pénibilité du travail
        const penibiliteDetectee = q9.match(/pénible|difficile|épuisant|fatigue|usure|douleur|mal de dos|mal au dos|port de charge|horaire.*difficile|rythme.*difficile|condition.*travail.*difficile|travail.*physique|exposition|produit.*dangereux|bruit|stress.*intense|burn.*out|burnout|souffrance|santé.*dégradée|problème.*santé|risque.*professionnel|accident.*travail/);

        return {
            penibiliteDetectee: !!penibiliteDetectee
        };
    }

    generateQ9AlertHTML(q9Analysis) {
        if (!q9Analysis || !q9Analysis.penibiliteDetectee) {
            return '';
        }

        let html = '<div class="alert alert-warning" style="margin-top: 15px;">';
        html += '<strong>⚠ Alerte pour le chargé de projets :</strong><br>';
        html += 'Conditions de travail pénibles détectées → <strong>Interroger les dispositifs C2P/FIPU</strong>';
        html += '</div>';

        return html;
    }

    analyzeQ1a() {
        const q1a = this.answers['Q1a'] ? this.answers['Q1a'].toLowerCase() : '';

        if (!q1a) {
            return { ancienneteInsuffisante: false };
        }

        // Extraire les nombres de la réponse
        const moisMatch = q1a.match(/(\d+)\s*mois/);
        const ansMatch = q1a.match(/(\d+)\s*an/);

        let totalMois = 0;

        if (ansMatch) {
            totalMois += parseInt(ansMatch[1]) * 12;
        }
        if (moisMatch) {
            totalMois += parseInt(moisMatch[1]);
        }

        // Si aucun nombre trouvé, chercher des termes comme "quelques mois", "6 mois", etc.
        if (totalMois === 0) {
            const directMoisMatch = q1a.match(/\b(\d+)\b/);
            if (directMoisMatch) {
                const nombre = parseInt(directMoisMatch[1]);
                // Si le nombre est petit (< 50), on suppose que c'est des mois
                if (nombre < 50) {
                    totalMois = nombre;
                }
            }
        }

        return {
            ancienneteInsuffisante: totalMois > 0 && totalMois < 12,
            ancienneteElevee: totalMois > 60, // Plus de 5 ans (60 mois)
            totalMois: totalMois
        };
    }

    generateQ1aAlertHTML(q1aAnalysis) {
        if (!q1aAnalysis) {
            return '';
        }

        let html = '';

        // Alerte pour ancienneté insuffisante (< 12 mois)
        if (q1aAnalysis.ancienneteInsuffisante) {
            html += '<div class="alert alert-warning" style="margin-top: 15px;">';
            html += '<strong>⚠ Alerte :</strong><br>';
            html += 'Il faudra avoir 12 mois d\'ancienneté à la date d\'entrée en formation';
            html += '</div>';
        }

        // Alerte pour ancienneté élevée (> 5 ans)
        if (q1aAnalysis.ancienneteElevee) {
            html += '<div class="alert alert-warning" style="margin-top: 15px;">';
            html += '<strong>⚠ Alerte :</strong> Le taux de mise en œuvre de la reconversion décline après 5 ans d\'ancienneté<br><br>';
            html += 'Compte tenu de votre ancienneté, nous vous invitons à faire preuve de la plus grande vigilance lors de votre demande d\'autorisation d\'absence et à anticiper et accepter les futurs freins : ';
            html += 'mettre votre CV à jour, vous préparer pour les entretiens d\'embauche à passer, envisager une perte de vos indemnités de licenciement, ';
            html += 'vous préparer à vivre une nouvelle période d\'essai, à perdre des congés, à voir votre rémunération baisser...';
            html += '</div>';
        }

        return html;
    }

    analyzeQ1b() {
        const q1b = this.answers['Q1b'];
        return {
            travailleurHandicape: q1b === 'Oui'
        };
    }

    generateQ1bAlertHTML(q1bAnalysis) {
        if (!q1bAnalysis || !q1bAnalysis.travailleurHandicape) {
            return '';
        }

        let html = '<div class="alert alert-info" style="margin-top: 15px;">';
        html += '<strong>ℹ Information :</strong><br>';
        html += 'Du fait de la reconnaissance de votre statut de travailleur handicapé, nous vous invitons à solliciter un accompagnement renforcé auprès de Cap Emploi, de la médecine du travail ou encore de l\'éventuel référent au sein de l\'organisme de formation.';
        html += '</div>';

        return html;
    }

    analyzeQ3a() {
        const q3a = this.answers['Q3a'];
        return {
            ouvrierEmploye: q3a === 'Oui'
        };
    }

    generateQ3aAlertHTML(q3aAnalysis) {
        if (!q3aAnalysis || !q3aAnalysis.ouvrierEmploye) {
            return '';
        }

        let html = '<div class="alert alert-info" style="margin-top: 15px;">';
        html += '<strong>ℹ Information :</strong><br>';
        html += 'Du fait de votre statut d\'ouvrier ou employé, vous avez de grandes chances d\'obtenir la prise en charge de votre projet. Cependant, nous vous encourageons vivement à solliciter l\'accompagnement d\'un conseiller en évolution professionnelle pour vous aider à formaliser votre projet.';
        html += '</div>';

        return html;
    }

    analyzeQ3b() {
        const q3b = this.answers['Q3b'];
        if (!q3b) {
            return { remunerationElevee: false };
        }

        const remuneration = parseFloat(q3b);
        return {
            remunerationElevee: !isNaN(remuneration) && remuneration > 21417
        };
    }

    generateQ3bAlertHTML(q3bAnalysis) {
        if (!q3bAnalysis || !q3bAnalysis.remunerationElevee) {
            return '';
        }

        let html = '<div class="alert alert-warning" style="margin-top: 15px;">';
        html += '<strong>⚠ Attention :</strong><br>';
        html += 'Votre rémunération est supérieure à la moyenne des rémunérations prises en charge dans le cadre des projets de transition professionnelle par Transitions Pro PACA. Cet élément risque de faire réagir négativement la commission d\'instruction. Nous vous invitons à étudier différentes pistes pour compenser : suivre une partie de la formation hors temps de travail, identifier un organisme de formation encore plus compétitif en coût et en durée, trouver des solutions de cofinancement y compris chez le recruteur...';
        html += '</div>';

        return html;
    }

    analyzeQ21() {
        const q21 = this.answers['Q21'];
        // Q21 est une question Yes/No, donc on retourne toujours true pour afficher l'info
        // peu importe la réponse (Oui ou Non)
        return {
            afficherInfoFormation: q21 === 'Oui' || q21 === 'Non'
        };
    }

    generateQ21AlertHTML(q21Analysis) {
        if (!q21Analysis || !q21Analysis.afficherInfoFormation) {
            return '';
        }

        let html = '<div class="alert alert-info" style="margin-top: 15px;">';
        html += '<strong>ℹ Information :</strong><br>';
        html += 'Pour comparer et vous aider à trouver l\'organisme de formation qui vous donnera toutes les chances de réussir, nous vous suggérons d\'en interroger plusieurs à l\'aide du guide que nous mettons à votre disposition sur notre site Internet (<a href="https://www.transitionspro-paca.fr/telechargement/10630/?tmstv=1767013763" target="_blank" style="color: var(--primary-color); text-decoration: underline;">télécharger le guide</a>).';
        html += '</div>';

        return html;
    }

    analyzeCritere1() {
        // Questions du critère 1 liées à la connaissance du métier (réponses Oui/Non)
        const critere1Questions = ['Q15', 'Q16', 'Q17', 'Q19'];

        let nombreReponseNon = 0;
        critere1Questions.forEach(qId => {
            if (this.answers[qId] === 'Non') {
                nombreReponseNon++;
            }
        });

        return {
            renseignementNecessaire: nombreReponseNon > 0,
            nombreReponseNon: nombreReponseNon
        };
    }

    generateCritere1AlertHTML(critere1Analysis) {
        if (!critere1Analysis || !critere1Analysis.renseignementNecessaire) {
            return '';
        }

        let html = '<div class="alert alert-warning" style="margin-top: 15px;">';
        html += '<strong>⚠ Attention :</strong><br>';
        html += 'Nous vous suggérons de mettre en place des actions qui vous permettront de renforcer la cohérence de votre projet : enquêtes métiers, immersion facilitée, stages...';
        html += '</div>';

        return html;
    }

    analyzeQ23() {
        const q23 = this.answers['Q23'];
        // Q23 peut être soit "Oui"/"Non" soit un texte libre
        // On considère que si c'est "Non" ou si c'est vide/court, il n'y a pas de recruteur identifié

        let recruteurNonIdentifie = false;

        if (q23 === 'Non') {
            recruteurNonIdentifie = true;
        } else if (!q23 || q23.trim().length < 5) {
            recruteurNonIdentifie = true;
        }

        return {
            recruteurNonIdentifie: recruteurNonIdentifie
        };
    }

    generateQ23AlertHTML(q23Analysis) {
        if (!q23Analysis || !q23Analysis.recruteurNonIdentifie) {
            return '';
        }

        let html = '<div class="alert alert-warning" style="margin-top: 15px;">';
        html += '<strong>⚠ Attention :</strong><br>';
        html += 'Nous vous invitons à solliciter un stage auprès de l\'employeur chez lequel vous souhaiteriez être embauché·e.';
        html += '</div>';

        return html;
    }

    checkMaturite() {
        let maturiteScore = 0;
        const maturiteQuestions = ['Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20', 'Q21', 'Q22', 'Q23'];

        maturiteQuestions.forEach(qId => {
            if (this.answers[qId] && this.answers[qId].trim().length > 10) {
                maturiteScore++;
            }
        });

        const percentage = (maturiteScore / maturiteQuestions.length) * 100;

        let status, details;
        if (percentage >= 70) {
            status = 'Projet mature';
            details = 'Votre projet est bien avancé et structuré.';
        } else if (percentage >= 40) {
            status = 'Projet en développement';
            details = 'Votre projet nécessite encore quelques approfondissements.';
        } else {
            status = 'Projet à construire';
            details = 'Votre projet est encore au stade de réflexion et nécessite un accompagnement approfondi.';
        }

        // Ajouter l'analyse du critère 1 (connaissance du métier)
        const critere1Analysis = this.analyzeCritere1();

        // Ajouter l'analyse de Q21
        const q21Analysis = this.analyzeQ21();

        // Ajouter l'analyse de Q22
        const q22Analysis = this.analyzeQ22();

        // Ajouter l'analyse de Q23 (recruteur identifié)
        const q23Analysis = this.analyzeQ23();

        return { status, details, score: maturiteScore, critere1Analysis, q21Analysis, q22Analysis, q23Analysis };
    }

    generatePrescription(analysis) {
        let prescription = '<div class="prescription-text">';

        prescription += '<p><strong>Suite à l\'évaluation de votre projet de reconversion professionnelle, voici nos recommandations :</strong></p>';
        prescription += '<ul>';

        // Recommandations selon l'éligibilité
        if (analysis.eligibilite.status === 'Éligible') {
            prescription += '<li>✓ Vous êtes éligible au dispositif de reconversion professionnelle</li>';
        }

        // Recommandations selon la priorité
        prescription += `<li><strong>Score de priorité : ${analysis.priorite.score}/${analysis.priorite.maxScore} points</strong></li>`;

        if (analysis.priorite.score >= 15) {
            prescription += '<li>✓ Votre profil bénéficie d\'une priorité très élevée</li>';
            prescription += '<li>→ Nous recommandons un traitement accéléré de votre dossier</li>';
        } else if (analysis.priorite.score >= 10) {
            prescription += '<li>✓ Votre profil est prioritaire pour l\'accès au dispositif</li>';
        } else if (analysis.priorite.score >= 7) {
            prescription += '<li>→ Votre profil présente une priorité moyenne</li>';
        } else {
            prescription += '<li>→ Envisagez d\'optimiser votre dossier pour augmenter votre score de priorité</li>';
        }

        // Recommandations selon la maturité
        if (analysis.maturite.status === 'Projet à construire') {
            prescription += '<li>→ Accompagnement CEP approfondi recommandé</li>';
            prescription += '<li>→ Réalisation d\'un bilan de compétences suggérée</li>';
            prescription += '<li>→ Enquêtes métier et immersions professionnelles à prévoir</li>';
        } else if (analysis.maturite.status === 'Projet en développement') {
            prescription += '<li>→ Accompagnement CEP pour finaliser le projet</li>';
            prescription += '<li>→ Validation du choix de formation et d\'organisme</li>';
        } else {
            prescription += '<li>✓ Projet suffisamment mature pour constituer un dossier</li>';
            prescription += '<li>→ Accompagnement CEP pour la partie administrative et financière</li>';
        }

        // Recommandations spécifiques basées sur les réponses
        if (this.answers['Q1b'] === 'Oui') {
            prescription += '<li>→ Mobiliser CAP EMPLOI et le référent handicap</li>';
        }

        if (this.answers['Q14'] && this.answers['Q14'].toLowerCase().includes('oui')) {
            prescription += '<li>→ Explorer les possibilités de cofinancement avec l\'employeur et l\'OPCO</li>';
        }

        prescription += '</ul>';
        prescription += '<p><strong>Prochaines étapes :</strong></p>';
        prescription += '<ol>';
        prescription += '<li>Présenter cette prescription à votre conseiller CEP</li>';
        prescription += '<li>Constituer votre dossier avec les pièces justificatives</li>';
        prescription += '<li>Finaliser le plan de financement</li>';
        prescription += '<li>Déposer votre demande d\'autorisation d\'absence</li>';
        prescription += '</ol>';
        prescription += '</div>';

        return prescription;
    }

    downloadPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Configuration
        const margin = 20;
        let y = margin;
        const lineHeight = 7;
        const pageHeight = doc.internal.pageSize.height;

        // Charger et ajouter le logo
        const logoUrl = 'https://www.transitionspro-paca.fr/wp-content/uploads/2021/04/logo-transitions-pro-paca.png';
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            // Ajouter le logo
            const logoWidth = 50;
            const logoHeight = (img.height / img.width) * logoWidth;
            doc.addImage(img, 'PNG', margin, y, logoWidth, logoHeight);
            y += logoHeight + 10;

            // En-tête
            doc.setFontSize(16);
            doc.setTextColor(37, 99, 235);
            const titleLines = doc.splitTextToSize('Questionnaire préalable au projet de transition professionnelle', 170);
            doc.text(titleLines, margin, y);
            y += lineHeight * titleLines.length + 5;

            // Mention Transitions Pro PACA
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text('Transitions Pro PACA', margin, y);
            y += lineHeight + 5;

            // Identité du bénéficiaire
            doc.setFontSize(12);
            doc.setTextColor(37, 99, 235);
            doc.text(`${this.userInfo.prenom} ${this.userInfo.nom}`, margin, y);
            y += lineHeight + 5;

            // Date
            const date = new Date().toLocaleDateString('fr-FR');
            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.text(`Date: ${date}`, margin, y);
            y += lineHeight * 2;

            // Analyser les résultats
            const analysis = this.analyzeAnswers();

            this.generatePDFContent(doc, analysis, y, margin, lineHeight, pageHeight, date);
        };

        img.onerror = () => {
            // Si le logo ne charge pas, générer le PDF sans logo
            console.warn('Logo non chargé, génération du PDF sans logo');

            // En-tête sans logo
            doc.setFontSize(16);
            doc.setTextColor(37, 99, 235);
            const titleLines = doc.splitTextToSize('Questionnaire préalable au projet de transition professionnelle', 170);
            doc.text(titleLines, margin, y);
            y += lineHeight * titleLines.length + 5;

            // Mention Transitions Pro PACA
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text('Transitions Pro PACA', margin, y);
            y += lineHeight + 5;

            // Identité du bénéficiaire
            doc.setFontSize(12);
            doc.setTextColor(37, 99, 235);
            doc.text(`${this.userInfo.prenom} ${this.userInfo.nom}`, margin, y);
            y += lineHeight + 5;

            // Date
            const date = new Date().toLocaleDateString('fr-FR');
            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.text(`Date: ${date}`, margin, y);
            y += lineHeight * 2;

            // Analyser les résultats
            const analysis = this.analyzeAnswers();

            this.generatePDFContent(doc, analysis, y, margin, lineHeight, pageHeight, date);
        };

        img.src = logoUrl;
    }

    generatePDFContent(doc, analysis, y, margin, lineHeight, pageHeight, date) {

        // Fonction pour vérifier si on doit ajouter une nouvelle page
        const checkPageBreak = (needed) => {
            if (y + needed > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
        };

        // Fonction pour dessiner un encadré de section
        const drawSectionBox = (startY, endY, color) => {
            doc.setDrawColor(color.r, color.g, color.b);
            doc.setLineWidth(0.5);
            doc.rect(margin - 3, startY - 3, 176, endY - startY + 6);
        };

        // Fonction pour titre de section
        const drawSectionTitle = (title, color) => {
            checkPageBreak(20);
            doc.setFillColor(color.r, color.g, color.b);
            doc.rect(margin - 3, y - 2, 176, 8, 'F');
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(title, margin, y + 4);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight + 3;
            return y;
        };

        // ===== SECTION ÉLIGIBILITÉ =====
        const eligStartY = y;
        y = drawSectionTitle('ÉLIGIBILITÉ', {r: 37, g: 99, b: 235});

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(analysis.eligibilite.status, margin, y);
        doc.setFont(undefined, 'normal');
        y += lineHeight;

        const eligDetails = doc.splitTextToSize(analysis.eligibilite.details, 165);
        doc.text(eligDetails, margin, y);
        y += lineHeight * eligDetails.length + 5;

        // Information Q1b - Travailleur handicapé
        if (analysis.eligibilite.q1bAnalysis && analysis.eligibilite.q1bAnalysis.travailleurHandicape) {
            checkPageBreak(40);
            doc.setFillColor(240, 249, 255);
            const boxHeight = 25;
            doc.rect(margin - 2, y - 2, 169, boxHeight, 'F');
            doc.setDrawColor(37, 99, 235);
            doc.setLineWidth(0.3);
            doc.rect(margin - 2, y - 2, 169, boxHeight);

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text('ℹ Information :', margin + 1, y + 2);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight;

            const infoMessage = doc.splitTextToSize('Du fait de la reconnaissance de votre statut de travailleur handicapé, nous vous invitons à solliciter un accompagnement renforcé auprès de Cap Emploi, de la médecine du travail ou encore de l\'éventuel référent au sein de l\'organisme de formation.', 160);
            infoMessage.forEach(line => {
                doc.text(line, margin + 1, y);
                y += lineHeight - 1;
            });
            y += 8;
        }

        // Alerte Q3b - Rémunération élevée
        if (analysis.eligibilite.q3bAnalysis && analysis.eligibilite.q3bAnalysis.remunerationElevee) {
            checkPageBreak(50);
            doc.setFillColor(254, 243, 199);
            const boxHeight = 40;
            doc.rect(margin - 2, y - 2, 169, boxHeight, 'F');
            doc.setDrawColor(245, 158, 11);
            doc.setLineWidth(0.3);
            doc.rect(margin - 2, y - 2, 169, boxHeight);

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(245, 158, 11);
            doc.text('⚠ Attention :', margin + 1, y + 2);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight;

            const alertMessage = doc.splitTextToSize('Votre rémunération est supérieure à la moyenne des rémunérations prises en charge dans le cadre des projets de transition professionnelle par Transitions Pro PACA. Cet élément risque de faire réagir négativement la commission d\'instruction. Nous vous invitons à étudier différentes pistes pour compenser : suivre une partie de la formation hors temps de travail, identifier un organisme de formation encore plus compétitif en coût et en durée, trouver des solutions de cofinancement y compris chez le recruteur...', 160);
            alertMessage.forEach(line => {
                doc.text(line, margin + 1, y);
                y += lineHeight - 1;
            });
            y += 8;
        }

        y += 5;

        // ===== SECTION PRIORITÉ =====
        y = drawSectionTitle('NIVEAU DE PRIORITÉ', {r: 16, g: 185, b: 129});

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(analysis.priorite.status, margin, y);
        doc.setFont(undefined, 'normal');
        y += lineHeight;

        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(16, 185, 129);
        doc.text(`Score : ${analysis.priorite.score}/${analysis.priorite.maxScore} points`, margin, y);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0);
        y += lineHeight + 3;

        // Détail des points de priorité
        if (analysis.priorite.details && analysis.priorite.details.length > 0) {
            doc.setFontSize(9);
            doc.setFont(undefined, 'italic');
            doc.text('Détail des points obtenus :', margin, y);
            doc.setFont(undefined, 'normal');
            y += lineHeight;

            analysis.priorite.details.forEach(detail => {
                checkPageBreak(lineHeight + 2);
                doc.setFillColor(250, 250, 250);
                doc.rect(margin - 1, y - 3, 165, 5, 'F');
                doc.text(`  • ${detail.code} - ${detail.libelle} : +${detail.points} pt${detail.points > 1 ? 's' : ''}`, margin, y);
                y += lineHeight;
            });
        }
        y += 5;

        // Information Q3a - Ouvrier/Employé
        if (analysis.priorite.q3aAnalysis && analysis.priorite.q3aAnalysis.ouvrierEmploye) {
            checkPageBreak(40);
            doc.setFillColor(240, 249, 255);
            const boxHeight = 25;
            doc.rect(margin - 2, y - 2, 169, boxHeight, 'F');
            doc.setDrawColor(37, 99, 235);
            doc.setLineWidth(0.3);
            doc.rect(margin - 2, y - 2, 169, boxHeight);

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text('ℹ Information :', margin + 1, y + 2);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight;

            const infoMessage = doc.splitTextToSize('Du fait de votre statut d\'ouvrier ou employé, vous avez de grandes chances d\'obtenir la prise en charge de votre projet. Cependant, nous vous encourageons vivement à solliciter l\'accompagnement d\'un conseiller en évolution professionnelle pour vous aider à formaliser votre projet.', 160);
            infoMessage.forEach(line => {
                doc.text(line, margin + 1, y);
                y += lineHeight - 1;
            });
            y += 8;
        }

        y += 5;

        // ===== SECTION MATURITÉ =====
        y = drawSectionTitle('MATURITÉ DU PROJET', {r: 245, g: 158, b: 11});

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(analysis.maturite.status, margin, y);
        doc.setFont(undefined, 'normal');
        y += lineHeight;

        const maturiteDetails = doc.splitTextToSize(analysis.maturite.details, 165);
        doc.text(maturiteDetails, margin, y);
        y += lineHeight * maturiteDetails.length + 5;

        // Alerte Critère 1 - Renseignement nécessaire
        if (analysis.maturite.critere1Analysis && analysis.maturite.critere1Analysis.renseignementNecessaire) {
            checkPageBreak(30);
            doc.setFillColor(254, 243, 199);
            const boxHeight = 18;
            doc.rect(margin - 2, y - 2, 169, boxHeight, 'F');
            doc.setDrawColor(245, 158, 11);
            doc.setLineWidth(0.3);
            doc.rect(margin - 2, y - 2, 169, boxHeight);

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(245, 158, 11);
            doc.text('⚠ Attention :', margin + 1, y + 2);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight;

            const alertMessage = doc.splitTextToSize('Nous vous suggérons de mettre en place des actions qui vous permettront de renforcer la cohérence de votre projet : enquêtes métiers, immersion facilitée, stages...', 160);
            alertMessage.forEach(line => {
                doc.text(line, margin + 1, y);
                y += lineHeight - 1;
            });
            y += 8;
        }

        // Information Q21 - Guide pour choisir l'organisme de formation
        if (analysis.maturite.q21Analysis && analysis.maturite.q21Analysis.afficherInfoFormation) {
            checkPageBreak(35);
            doc.setFillColor(240, 249, 255);
            const boxHeight = 20;
            doc.rect(margin - 2, y - 2, 169, boxHeight, 'F');
            doc.setDrawColor(37, 99, 235);
            doc.setLineWidth(0.3);
            doc.rect(margin - 2, y - 2, 169, boxHeight);

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text('ℹ Information :', margin + 1, y + 2);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight;

            const infoMessage = doc.splitTextToSize('Pour comparer et vous aider à trouver l\'organisme de formation qui vous donnera toutes les chances de réussir, nous vous suggérons d\'en interroger plusieurs à l\'aide du guide que nous mettons à votre disposition sur notre site Internet (https://www.transitionspro-paca.fr/telechargement/10630/?tmstv=1767013763).', 160);
            infoMessage.forEach(line => {
                doc.text(line, margin + 1, y);
                y += lineHeight - 1;
            });
            y += 8;
        }

        // Analyse Q22 - Vérification du choix de l'organisme de formation
        if (analysis.maturite.q22Analysis && analysis.maturite.q22Analysis.nombreCriteres > 0) {
            checkPageBreak(30 + (analysis.maturite.q22Analysis.details.length * lineHeight));

            doc.setFillColor(209, 250, 229);
            const boxHeight = 5 + (analysis.maturite.q22Analysis.details.length * lineHeight);
            doc.rect(margin - 2, y - 2, 169, boxHeight, 'F');
            doc.setDrawColor(16, 185, 129);
            doc.setLineWidth(0.3);
            doc.rect(margin - 2, y - 2, 169, boxHeight);

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(16, 185, 129);
            doc.text('✓ Démarche de vérification du choix de l\'organisme :', margin + 1, y + 2);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight;

            analysis.maturite.q22Analysis.details.forEach(detail => {
                doc.text(`  • ${detail}`, margin + 1, y);
                y += lineHeight - 1;
            });
            y += 8;
        }

        // Alerte Q23 - Recruteur non identifié
        if (analysis.maturite.q23Analysis && analysis.maturite.q23Analysis.recruteurNonIdentifie) {
            checkPageBreak(25);
            doc.setFillColor(254, 243, 199);
            const boxHeight = 15;
            doc.rect(margin - 2, y - 2, 169, boxHeight, 'F');
            doc.setDrawColor(245, 158, 11);
            doc.setLineWidth(0.3);
            doc.rect(margin - 2, y - 2, 169, boxHeight);

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(245, 158, 11);
            doc.text('⚠ Attention :', margin + 1, y + 2);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight;

            const alertMessage = doc.splitTextToSize('Nous vous invitons à solliciter un stage auprès de l\'employeur chez lequel vous souhaiteriez être embauché·e.', 160);
            alertMessage.forEach(line => {
                doc.text(line, margin + 1, y);
                y += lineHeight - 1;
            });
            y += 8;
        }

        y += 5;

        // ===== SECTION RECOMMANDATIONS =====
        y = drawSectionTitle('RECOMMANDATIONS', {r: 99, g: 102, b: 241});

        doc.setFontSize(10);
        const prescriptionText = this.generatePrescriptionText(analysis);
        const lines = doc.splitTextToSize(prescriptionText, 165);

        lines.forEach(line => {
            checkPageBreak(lineHeight + 2);
            // Ajouter un point devant chaque recommandation qui commence par un symbole
            if (line.trim().startsWith('✓') || line.trim().startsWith('→')) {
                doc.setFont(undefined, 'bold');
                doc.text(line, margin, y);
                doc.setFont(undefined, 'normal');
            } else {
                doc.text(line, margin, y);
            }
            y += lineHeight;
        });

        // ===== COORDONNÉES DU CHARGÉ DE PROJETS =====
        y += 10;
        checkPageBreak(35);

        doc.setFillColor(240, 240, 240);
        doc.rect(margin - 3, y - 3, 176, 30, 'F');
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.5);
        doc.rect(margin - 3, y - 3, 176, 30);

        doc.setFontSize(10);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(0);
        const contactText = doc.splitTextToSize('Après avoir rencontré un conseiller en évolution professionnelle, nous vous invitons à revenir vers votre chargé·e de projets Transitions Pro PACA :', 165);
        contactText.forEach(line => {
            doc.text(line, margin, y);
            y += lineHeight;
        });

        y += 3;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(99, 102, 241);
        doc.text(this.chargeProjets.nom, margin, y);
        y += lineHeight;

        doc.setFont(undefined, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.text(this.chargeProjets.email, margin, y);

        // Pied de page
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} sur ${pageCount}`, margin, pageHeight - 10);
        }

        // Télécharger le PDF
        doc.save(`prescription-cep-${date.replace(/\//g, '-')}.pdf`);
    }

    generatePrescriptionText(analysis) {
        let text = '';

        text += 'Suite à l\'évaluation de votre projet de reconversion professionnelle :\n\n';

        if (analysis.eligibilite.status === 'Éligible') {
            text += '• Vous êtes éligible au dispositif de reconversion professionnelle\n';
        }

        text += `\nScore de priorité : ${analysis.priorite.score}/${analysis.priorite.maxScore} points\n`;

        if (analysis.priorite.score >= 15) {
            text += '• Votre profil bénéficie d\'une priorité très élevée\n';
            text += '• Traitement accéléré de votre dossier recommandé\n';
        } else if (analysis.priorite.score >= 10) {
            text += '• Votre profil est prioritaire pour l\'accès au dispositif\n';
        } else if (analysis.priorite.score >= 7) {
            text += '• Votre profil présente une priorité moyenne\n';
        }

        if (analysis.maturite.status === 'Projet à construire') {
            text += '• Accompagnement CEP approfondi recommandé\n';
            text += '• Réalisation d\'un bilan de compétences suggérée\n';
            text += '• Enquêtes métier et immersions professionnelles à prévoir\n';
        } else if (analysis.maturite.status === 'Projet en développement') {
            text += '• Accompagnement CEP pour finaliser le projet\n';
            text += '• Validation du choix de formation et d\'organisme\n';
        } else {
            text += '• Projet suffisamment mature pour constituer un dossier\n';
            text += '• Accompagnement CEP pour la partie administrative et financière\n';
        }

        if (this.answers['Q1b'] === 'Oui') {
            text += '• Mobiliser CAP EMPLOI et le référent handicap\n';
        }

        text += '\nProchaines étapes :\n';
        text += '1. Présenter cette prescription à votre conseiller CEP\n';
        text += '2. Constituer votre dossier avec les pièces justificatives\n';
        text += '3. Finaliser le plan de financement\n';
        text += '4. Déposer votre demande d\'autorisation d\'absence\n';

        return text;
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    restart() {
        if (confirm('Êtes-vous sûr de vouloir recommencer ? Vos réponses actuelles seront perdues.')) {
            this.answers = {};
            this.currentQuestionIndex = 0;
            localStorage.removeItem('cep_answers');
            this.showScreen('welcome-screen');
        }
    }
}

// Initialiser l'application au chargement
document.addEventListener('DOMContentLoaded', () => {
    new CEPQuestionnaire();
});
