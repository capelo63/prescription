// Application de questionnaire CEP - Mode page unique
class CEPQuestionnaire {
    constructor() {
        this.questions = [];
        this.alertes = [];
        this.answers = {};
        this.metiersPrioritaires = [];
        this.secteursDeclin = [];
        this.userInfo = { prenom: '', nom: '' };
        this.chargeProjets = { id: '', nom: '', email: '' };
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
        this.restoreChargeProjets();
        this.renderAllQuestions();
        this.setupEventListeners();
        this.updateProgress();
    }

    // ==================== CHARGEMENT DES DONNÉES ====================

    async loadData() {
        try {
            const [dataRes, metiersRes, secteursRes, baremeRes] = await Promise.all([
                fetch('data.json'),
                fetch('metiers-prioritaires.json'),
                fetch('secteurs-declin.json'),
                fetch('bareme-priorites.json')
            ]);
            const data = await dataRes.json();
            const metiersData = await metiersRes.json();
            const secteursData = await secteursRes.json();
            const baremeData = await baremeRes.json();

            this.allQuestions = data.questions.filter(q => q.id.startsWith('Q'));
            this.alertes = data.alertes;
            this.metiersPrioritaires = metiersData.metiers;
            this.secteursDeclin = secteursData.secteurs;
            this.baremePriorites = baremeData.priorites;
        } catch (error) {
            console.error('Erreur de chargement des données:', error);
        }
    }

    restoreChargeProjets() {
        const saved = localStorage.getItem('cep_charge_projets');
        if (saved) {
            document.getElementById('charge-projets-select').value = saved;
            this.selectChargeProjets(saved);
        }
    }

    selectChargeProjets(id) {
        if (id && this.chargesProjetsData[id]) {
            this.chargeProjets.id = id;
            this.chargeProjets.nom = this.chargesProjetsData[id].nom;
            this.chargeProjets.email = this.chargesProjetsData[id].email;
            localStorage.setItem('cep_charge_projets', id);
        }
    }

    // ==================== RENDU DE TOUTES LES QUESTIONS ====================

    renderAllQuestions() {
        const container = document.getElementById('questions-container');
        container.innerHTML = '';

        let currentSection = '';

        this.allQuestions.forEach(question => {
            // Titre de section si changement
            if (question.section && question.section !== currentSection) {
                currentSection = question.section;
                const sectionDiv = document.createElement('div');
                sectionDiv.className = 'section-header';
                sectionDiv.innerHTML = `
                    <h2 class="section-title">${question.section}</h2>
                `;
                container.appendChild(sectionDiv);
            }

            // Bloc question
            const qDiv = document.createElement('div');
            qDiv.className = 'question-block';
            qDiv.id = `q-block-${question.id}`;
            qDiv.dataset.questionId = question.id;

            qDiv.innerHTML = `
                <div class="question-label">
                    <span class="question-id">${question.id}</span>
                    <span class="question-text-inline">${question.question}</span>
                </div>
                <div class="answer-zone" id="answer-${question.id}"></div>
            `;

            container.appendChild(qDiv);

            // Rendre l'input de réponse
            this.renderAnswerInput(question, qDiv.querySelector('.answer-zone'));
        });

        // Appliquer la visibilité conditionnelle
        this.updateVisibility();
        this.updateProgress();
    }

    getSectionLabel(objectif) {
        const labels = {
            'éligibilité': 'Éligibilité',
            'priorité': 'Priorité',
            'critère 1': 'Maturité - Projet',
            'critère 2': 'Maturité - Formation',
            'critère 3': 'Maturité - Emploi'
        };
        return labels[objectif] || objectif || 'Questionnaire';
    }

    // ==================== RENDU DES INPUTS ====================

    renderAnswerInput(question, container) {
        const qId = question.id;
        const current = this.answers[qId];

        if (qId === 'Q1a') {
            this.createTextInput(container, qId, 'Ex: 2 ans et 3 mois', current);
        } else if (qId === 'Q15a' || qId === 'Q15b' || qId === 'Q22') {
            this.createTextAreaInput(container, qId, 'Votre réponse...', current);
        } else if (this.isYesNoQuestion(question)) {
            this.createInlineButtons(container, qId, ['Oui', 'Non'], current);
        } else if (qId === 'Q2') {
            this.createInlineButtons(container, qId, ['Sans diplôme', 'CAP/BEP', 'Bac', 'Bac+2', 'Bac+3 ou plus'], current);
        } else if (qId === 'Q3b') {
            this.createNumberInput(container, qId, 'Rémunération brute mensuelle (€)', current);
        } else if (qId === 'Q10') {
            this.createInlineButtons(container, qId, ['Démission', 'Rupture conventionnelle', 'Licenciement', 'Autre'], current);
        } else if (qId === 'Q10b') {
            this.createInlineButtons(container, qId, ['Oui', 'Non'], current);
        } else if (qId === 'Q11') {
            this.createSecteurInput(container, qId, current);
        } else if (qId === 'Q12') {
            this.createMetierInput(container, qId, current);
        } else {
            this.createTextAreaInput(container, qId, 'Votre réponse...', current);
        }
    }

    isYesNoQuestion(question) {
        const yesNoIds = ['Q1b', 'Q1c', 'Q3a', 'Q4', 'Q5', 'Q6', 'Q7', 'Q11b', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q19', 'Q21'];
        return yesNoIds.includes(question.id);
    }

    createInlineButtons(container, qId, options, currentAnswer) {
        const wrapper = document.createElement('div');
        wrapper.className = 'inline-buttons';
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'answer-chip' + (currentAnswer === option ? ' selected' : '');
            btn.textContent = option;
            btn.addEventListener('click', () => {
                wrapper.querySelectorAll('.answer-chip').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.saveAnswer(qId, option);
            });
            wrapper.appendChild(btn);
        });
        container.appendChild(wrapper);
    }

    createTextInput(container, qId, placeholder, currentAnswer) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-input';
        input.placeholder = placeholder;
        input.value = currentAnswer || '';
        input.addEventListener('input', () => this.saveAnswer(qId, input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.focusNextQuestion(qId);
        });
        container.appendChild(input);
    }

    createNumberInput(container, qId, placeholder, currentAnswer) {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'inline-input';
        input.placeholder = placeholder;
        input.value = currentAnswer || '';
        input.min = 0;
        input.addEventListener('input', () => this.saveAnswer(qId, input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.focusNextQuestion(qId);
        });
        container.appendChild(input);
    }

    createTextAreaInput(container, qId, placeholder, currentAnswer) {
        const textarea = document.createElement('textarea');
        textarea.className = 'inline-textarea';
        textarea.placeholder = placeholder;
        textarea.value = currentAnswer || '';
        textarea.rows = 2;
        textarea.addEventListener('input', () => {
            this.saveAnswer(qId, textarea.value);
            // Auto-resize
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
        container.appendChild(textarea);
    }

    createSecteurInput(container, qId, currentAnswer) {
        const wrapper = document.createElement('div');
        wrapper.className = 'autocomplete-wrapper';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-input';
        input.placeholder = 'Saisissez le secteur d\'activité (code APE ou intitulé)';
        input.value = currentAnswer || '';
        input.id = 'secteur-input';

        const dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        dropdown.id = 'secteur-dropdown';

        const resultBadge = document.createElement('span');
        resultBadge.className = 'match-badge';
        resultBadge.id = 'secteur-badge';

        input.addEventListener('input', () => {
            const term = input.value.toLowerCase().trim();
            this.saveAnswer(qId, input.value);
            if (term.length >= 2) {
                this.showSecteurSuggestions(term, dropdown, input, resultBadge);
            } else {
                dropdown.style.display = 'none';
                resultBadge.textContent = '';
                resultBadge.className = 'match-badge';
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                dropdown.style.display = 'none';
                this.focusNextQuestion(qId);
            }
        });

        wrapper.appendChild(input);
        wrapper.appendChild(resultBadge);
        wrapper.appendChild(dropdown);

        // Bouton pour voir la liste complète
        const listBtn = document.createElement('button');
        listBtn.type = 'button';
        listBtn.className = 'btn-link';
        listBtn.textContent = 'Voir la liste complète des secteurs en déclin';
        listBtn.addEventListener('click', () => this.toggleFullList('secteur', wrapper));
        wrapper.appendChild(listBtn);

        container.appendChild(wrapper);

        // Vérifier si la valeur actuelle matche
        if (currentAnswer) {
            const term = currentAnswer.toLowerCase().trim();
            if (term.length >= 2) {
                const matches = this.findSecteurMatches(term);
                if (matches.length > 0) {
                    resultBadge.textContent = 'Secteur prioritaire';
                    resultBadge.className = 'match-badge match-yes';
                }
            }
        }
    }

    createMetierInput(container, qId, currentAnswer) {
        const wrapper = document.createElement('div');
        wrapper.className = 'autocomplete-wrapper';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-input';
        input.placeholder = 'Saisissez le métier visé (code ROME ou intitulé)';
        input.value = currentAnswer || '';
        input.id = 'metier-input';

        const dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        dropdown.id = 'metier-dropdown';

        const resultBadge = document.createElement('span');
        resultBadge.className = 'match-badge';
        resultBadge.id = 'metier-badge';

        input.addEventListener('input', () => {
            const term = input.value.toLowerCase().trim();
            this.saveAnswer(qId, input.value);
            if (term.length >= 2) {
                this.showMetierSuggestions(term, dropdown, input, resultBadge);
            } else {
                dropdown.style.display = 'none';
                resultBadge.textContent = '';
                resultBadge.className = 'match-badge';
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                dropdown.style.display = 'none';
                this.focusNextQuestion(qId);
            }
        });

        wrapper.appendChild(input);
        wrapper.appendChild(resultBadge);
        wrapper.appendChild(dropdown);

        // Bouton pour voir la liste complète
        const listBtn = document.createElement('button');
        listBtn.type = 'button';
        listBtn.className = 'btn-link';
        listBtn.textContent = 'Voir la liste complète des métiers prioritaires PACA';
        listBtn.addEventListener('click', () => this.toggleFullList('metier', wrapper));
        wrapper.appendChild(listBtn);

        container.appendChild(wrapper);

        // Vérifier si la valeur actuelle matche
        if (currentAnswer) {
            const term = currentAnswer.toLowerCase().trim();
            if (term.length >= 2) {
                const matches = this.findMetierMatches(term);
                if (matches.length > 0) {
                    resultBadge.textContent = 'Métier prioritaire PACA';
                    resultBadge.className = 'match-badge match-yes';
                }
            }
        }
    }

    // ==================== AUTOCOMPLÉTION ====================

    findSecteurMatches(term) {
        return this.secteursDeclin.filter(s =>
            s.intitule.toLowerCase().includes(term) ||
            s.section.toLowerCase().includes(term) ||
            s.code_ape.toLowerCase().includes(term)
        );
    }

    findMetierMatches(term) {
        return this.metiersPrioritaires.filter(m =>
            m.metier.toLowerCase().includes(term) ||
            m.domaine.toLowerCase().includes(term) ||
            m.code_rome.toLowerCase().includes(term)
        );
    }

    showSecteurSuggestions(term, dropdown, input, badge) {
        const matches = this.findSecteurMatches(term);
        if (matches.length > 0) {
            badge.textContent = 'Secteur prioritaire';
            badge.className = 'match-badge match-yes';
            dropdown.innerHTML = matches.map(s =>
                `<div class="autocomplete-item" data-value="${s.intitule} (${s.code_ape})">${s.intitule} <span class="autocomplete-code">${s.code_ape}</span></div>`
            ).join('');
            dropdown.style.display = 'block';
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = item.dataset.value;
                    this.saveAnswer('Q11', input.value);
                    dropdown.style.display = 'none';
                });
            });
        } else {
            badge.textContent = 'Non prioritaire';
            badge.className = 'match-badge match-no';
            dropdown.style.display = 'none';
        }
    }

    showMetierSuggestions(term, dropdown, input, badge) {
        const matches = this.findMetierMatches(term);
        if (matches.length > 0) {
            badge.textContent = 'Métier prioritaire PACA';
            badge.className = 'match-badge match-yes';
            dropdown.innerHTML = matches.map(m =>
                `<div class="autocomplete-item" data-value="${m.metier} (${m.code_rome})">${m.metier} <span class="autocomplete-code">${m.code_rome} — ${m.domaine}</span></div>`
            ).join('');
            dropdown.style.display = 'block';
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = item.dataset.value;
                    this.saveAnswer('Q12', input.value);
                    dropdown.style.display = 'none';
                });
            });
        } else {
            badge.textContent = 'Non prioritaire';
            badge.className = 'match-badge match-no';
            dropdown.style.display = 'none';
        }
    }

    toggleFullList(type, wrapper) {
        let existing = wrapper.querySelector('.full-list');
        if (existing) {
            existing.remove();
            return;
        }
        const listDiv = document.createElement('div');
        listDiv.className = 'full-list';

        if (type === 'secteur') {
            const sections = {};
            this.secteursDeclin.forEach(s => {
                if (!sections[s.section]) sections[s.section] = [];
                sections[s.section].push(s);
            });
            let html = '<strong>Secteurs en déclin (priorité n°9)</strong>';
            Object.keys(sections).forEach(section => {
                html += `<div class="list-group"><em>${section}</em>`;
                sections[section].forEach(s => {
                    html += `<div class="list-item">${s.intitule} <span class="autocomplete-code">${s.code_ape}</span></div>`;
                });
                html += '</div>';
            });
            listDiv.innerHTML = html;
        } else {
            const domaines = {};
            this.metiersPrioritaires.forEach(m => {
                if (!domaines[m.domaine]) domaines[m.domaine] = [];
                domaines[m.domaine].push(m);
            });
            let html = '<strong>Métiers prioritaires PACA (priorité n°8)</strong>';
            Object.keys(domaines).forEach(domaine => {
                html += `<div class="list-group"><em>${domaine}</em>`;
                domaines[domaine].forEach(m => {
                    html += `<div class="list-item">${m.metier} <span class="autocomplete-code">${m.code_rome}</span></div>`;
                });
                html += '</div>';
            });
            listDiv.innerHTML = html;
        }
        wrapper.appendChild(listDiv);
    }

    // ==================== LOGIQUE CONDITIONNELLE ====================

    shouldShowQuestion(questionId) {
        if (questionId === 'Q3a') {
            const q2 = this.answers['Q2'];
            return q2 === 'Sans diplôme' || q2 === 'CAP/BEP';
        }
        if (questionId === 'Q3b') {
            const q2 = this.answers['Q2'];
            return q2 === 'Bac' || q2 === 'Bac+2' || q2 === 'Bac+3 ou plus';
        }
        if (questionId === 'Q15a' || questionId === 'Q15b') {
            return this.answers['Q15'] === 'Oui';
        }
        if (questionId === 'Q19a' || questionId === 'Q19b') {
            return this.answers['Q19'] === 'Oui';
        }
        if (questionId === 'Q21a' || questionId === 'Q22') {
            return this.answers['Q21'] === 'Oui';
        }
        return true;
    }

    updateVisibility() {
        this.allQuestions.forEach(q => {
            const block = document.getElementById(`q-block-${q.id}`);
            if (!block) return;
            const visible = this.shouldShowQuestion(q.id);
            block.style.display = visible ? '' : 'none';
            if (!visible && this.answers[q.id]) {
                // Effacer les réponses des questions masquées
                delete this.answers[q.id];
            }
        });
        this.updateProgress();
    }

    // ==================== SAUVEGARDE & PROGRESSION ====================

    saveAnswer(questionId, answer) {
        this.answers[questionId] = answer;
        this.updateVisibility();
        this.updateProgress();
    }

    updateProgress() {
        const visible = this.allQuestions.filter(q => this.shouldShowQuestion(q.id));
        const answered = visible.filter(q => {
            const a = this.answers[q.id];
            return a && a.trim && a.trim().length > 0;
        });
        const pct = visible.length > 0 ? (answered.length / visible.length) * 100 : 0;

        document.getElementById('progress-fill').style.width = `${pct}%`;
        document.getElementById('answered-count').textContent = answered.length;
        document.getElementById('total-questions').textContent = visible.length;

        // Afficher le bouton résultats si tout est rempli (ou presque)
        const trigger = document.getElementById('results-trigger');
        if (answered.length === visible.length && answered.length > 0) {
            trigger.style.display = 'block';
        } else {
            trigger.style.display = 'none';
        }
    }

    focusNextQuestion(currentQId) {
        const visible = this.allQuestions.filter(q => this.shouldShowQuestion(q.id));
        const idx = visible.findIndex(q => q.id === currentQId);
        if (idx >= 0 && idx < visible.length - 1) {
            const nextBlock = document.getElementById(`q-block-${visible[idx + 1].id}`);
            if (nextBlock) {
                const input = nextBlock.querySelector('input, textarea, button.answer-chip');
                if (input) input.focus();
                nextBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    // ==================== EVENT LISTENERS ====================

    setupEventListeners() {
        // Chargé de projets
        document.getElementById('charge-projets-select').addEventListener('change', (e) => {
            this.selectChargeProjets(e.target.value);
        });

        // Identité
        document.getElementById('user-prenom').addEventListener('input', (e) => {
            this.userInfo.prenom = e.target.value.trim();
        });
        document.getElementById('user-nom').addEventListener('input', (e) => {
            this.userInfo.nom = e.target.value.trim();
        });

        // Résultats
        document.getElementById('show-results-btn').addEventListener('click', () => this.showResults());
        document.getElementById('download-pdf-btn').addEventListener('click', () => this.downloadPDF());
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());

        // Fermer les dropdowns autocomplete en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-wrapper')) {
                document.querySelectorAll('.autocomplete-dropdown').forEach(d => d.style.display = 'none');
            }
        });
    }

    // ==================== RÉSULTATS ====================

    showResults() {
        if (!this.userInfo.prenom || !this.userInfo.nom) {
            alert('Veuillez renseigner le prénom et le nom du bénéficiaire.');
            document.getElementById('user-prenom').focus();
            return;
        }
        if (!this.chargeProjets.id) {
            alert('Veuillez sélectionner un chargé de projets.');
            document.getElementById('charge-projets-select').focus();
            return;
        }

        document.getElementById('result-screen').style.display = 'block';
        this.generateResults();
        document.getElementById('result-screen').scrollIntoView({ behavior: 'smooth' });
    }

    generateResults() {
        const summaryDiv = document.getElementById('result-summary');
        const prescriptionDiv = document.getElementById('prescription-content');
        const analysis = this.analyzeAnswers();

        let prioriteDetailsHTML = '';
        if (analysis.priorite.details && analysis.priorite.details.length > 0) {
            prioriteDetailsHTML = '<ul style="margin-top: 10px; font-size: 0.9em;">';
            analysis.priorite.details.forEach(detail => {
                prioriteDetailsHTML += `<li><strong>${detail.code}</strong> — ${detail.libelle} : +${detail.points} pt${detail.points > 1 ? 's' : ''}</li>`;
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
                ${this.generateEligibiliteCDDCDIHTML(analysis.eligibilite.eligibiliteCDDCDI)}
                ${this.generateQ1aAlertHTML(analysis.eligibilite.q1aAnalysis)}
                ${this.generateQ1bAlertHTML(analysis.eligibilite.q1bAnalysis)}
                ${this.generateQ3bAlertHTML(analysis.eligibilite.q3bAnalysis)}
                ${this.generateQ9AlertHTML(analysis.eligibilite.q9Analysis)}
                ${this.generateQ10bAlertHTML(analysis.eligibilite.q10bAnalysis)}
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
                ${this.generateMaturiteContextuelHTML('Connaissance du métier', analysis.maturite.q15Analysis)}
                ${this.generateMaturiteContextuelHTML('Rémunération débutant', analysis.maturite.q16Analysis)}
                ${this.generateMaturiteContextuelHTML('Expérience requise', analysis.maturite.q17Analysis)}
                ${this.generateMaturiteContextuelHTML('Inconvénients du métier', analysis.maturite.q19Analysis)}
                ${this.generateQ21AlertHTML(analysis.maturite.q21Analysis)}
                ${this.generateQ22AnalysisHTML(analysis.maturite.q22Analysis)}
                ${this.generateQ23AlertHTML(analysis.maturite.q23Analysis)}
            </div>
        `;

        prescriptionDiv.innerHTML = `
            <h3>Prescription personnalisée</h3>
            ${this.generatePrescription(analysis)}
        `;
    }

    analyzeAnswers() {
        return {
            eligibilite: this.checkEligibilite(),
            priorite: this.calculatePriorite(),
            maturite: this.checkMaturite()
        };
    }

    // ==================== ANALYSE D'ÉLIGIBILITÉ ====================

    checkEligibilite() {
        const q1c = this.answers['Q1c'];
        let status = 'Éligible';
        let details = 'Vous remplissez les conditions d\'éligibilité de base.';
        if (q1c === 'Oui') {
            details += ' Attention: vous êtes actuellement en arrêt, cela peut impacter votre dossier.';
        }
        return {
            status, details,
            q1aAnalysis: this.analyzeQ1a(),
            q1bAnalysis: this.analyzeQ1b(),
            q3bAnalysis: this.analyzeQ3b(),
            q9Analysis: this.analyzeQ9(),
            q10bAnalysis: this.analyzeQ10b(),
            eligibiliteCDDCDI: this.analyzeEligibiliteCDDCDI()
        };
    }

    analyzeQ1a() {
        const q1a = this.answers['Q1a'] ? this.answers['Q1a'].toLowerCase() : '';
        if (!q1a) return { ancienneteInsuffisante: false };

        const moisMatch = q1a.match(/(\d+)\s*mois/);
        const ansMatch = q1a.match(/(\d+)\s*an/);
        let totalMois = 0;
        if (ansMatch) totalMois += parseInt(ansMatch[1]) * 12;
        if (moisMatch) totalMois += parseInt(moisMatch[1]);
        if (totalMois === 0) {
            const directMatch = q1a.match(/\b(\d+)\b/);
            if (directMatch) {
                const n = parseInt(directMatch[1]);
                if (n < 50) totalMois = n;
            }
        }
        return {
            ancienneteInsuffisante: totalMois > 0 && totalMois < 12,
            ancienneteElevee: totalMois > 60,
            totalMois
        };
    }

    analyzeQ1b() {
        return { travailleurHandicape: this.answers['Q1b'] === 'Oui' };
    }

    analyzeQ3b() {
        const q3b = this.answers['Q3b'];
        if (!q3b) return { remunerationElevee: false };
        const rem = parseFloat(q3b);
        return { remunerationElevee: !isNaN(rem) && rem > 21417 };
    }

    analyzeQ9() {
        const q9 = this.answers['Q9'] ? this.answers['Q9'].toLowerCase() : '';
        const penibilite = q9.match(/pénible|difficile|épuisant|fatigue|usure|douleur|mal de dos|mal au dos|port de charge|horaire.*difficile|rythme.*difficile|condition.*travail.*difficile|travail.*physique|exposition|produit.*dangereux|bruit|stress.*intense|burn.*out|burnout|souffrance|santé.*dégradée|problème.*santé|risque.*professionnel|accident.*travail/);
        return { penibiliteDetectee: !!penibilite };
    }

    analyzeQ10b() {
        return { nonParleEmployeur: this.answers['Q10b'] === 'Non' };
    }

    analyzeEligibiliteCDDCDI() {
        const isCDD = this.answers['Q5'] === 'Oui';
        return { isCDD };
    }

    // ==================== CALCUL DE PRIORITÉ ====================

    calculatePriorite() {
        let score = 0;
        const details = [];

        if (this.answers['Q3a'] === 'Oui') {
            score += 5;
            details.push({ code: 'P1', libelle: 'Ouvrier/employé peu qualifié', points: 5 });
        }
        if (this.answers['Q7'] === 'Oui') {
            score += 1;
            details.push({ code: 'P2', libelle: 'Reconnu inapte', points: 1 });
        }
        if (this.answers['Q4'] === 'Non') {
            score += 1;
            details.push({ code: 'P3', libelle: 'Entreprise < 50 salariés', points: 1 });
        }

        const q13 = this.answers['Q13'] ? this.answers['Q13'].toLowerCase() : '';
        const q23 = this.answers['Q23'] ? this.answers['Q23'].toLowerCase() : '';
        if (q13.includes('oui') || q13.includes('cléa') || q13.includes('vae') || q13.includes('cep') ||
            q23.includes('oui') || q23.length > 10) {
            score += 1;
            details.push({ code: 'P6', libelle: 'Ingénierie de formation valorisée (CEP, VAE, CléA, recruteur...)', points: 1 });
        }

        if (this.answers['Q14'] === 'Oui') {
            score += 2;
            details.push({ code: 'P7', libelle: 'Cofinancement mobilisé', points: 2 });
        }

        const q12 = this.answers['Q12'] ? this.answers['Q12'].toLowerCase() : '';
        if (q12) {
            const metierTrouve = this.metiersPrioritaires.some(m =>
                m.metier.toLowerCase().includes(q12) || m.code_rome.toLowerCase().includes(q12) ||
                q12.includes(m.metier.toLowerCase()) || q12.includes(m.code_rome.toLowerCase())
            );
            if (metierTrouve) {
                score += 3;
                details.push({ code: 'P8', libelle: 'Métier à forte perspective d\'emploi', points: 3 });
            }
        }

        const q11 = this.answers['Q11'] ? this.answers['Q11'].toLowerCase() : '';
        if (q11) {
            const secteurTrouve = this.secteursDeclin.some(s =>
                s.intitule.toLowerCase().includes(q11) || s.code_ape.toLowerCase().includes(q11) ||
                q11.includes(s.intitule.toLowerCase()) || q11.includes(s.code_ape.toLowerCase())
            );
            if (secteurTrouve) {
                score += 3;
                details.push({ code: 'P9', libelle: 'Secteur dont le taux d\'emploi diminue', points: 3 });
            }
        }

        if (this.answers['Q5'] === 'Oui' || this.answers['Q6'] === 'Oui') {
            score += 1;
            const type = this.answers['Q5'] === 'Oui' && this.answers['Q6'] === 'Oui' ? 'CDD et temps partiel' :
                         this.answers['Q5'] === 'Oui' ? 'CDD' : 'Temps partiel';
            details.push({ code: 'P10', libelle: type, points: 1 });
        }

        const maxScore = 20;
        let status = score >= 15 ? 'Priorité très élevée' :
                     score >= 10 ? 'Priorité élevée' :
                     score >= 7 ? 'Priorité moyenne' : 'Priorité standard';

        return { score, maxScore, status, details, q3aAnalysis: this.analyzeQ3a() };
    }

    analyzeQ3a() {
        return { ouvrierEmploye: this.answers['Q3a'] === 'Oui' };
    }

    // ==================== ANALYSE DE MATURITÉ ====================

    checkMaturite() {
        let maturiteScore = 0;
        const maturiteQuestions = ['Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20', 'Q21', 'Q22', 'Q23'];
        maturiteQuestions.forEach(qId => {
            if (this.answers[qId] && this.answers[qId].trim().length > 10) maturiteScore++;
        });
        const pct = (maturiteScore / maturiteQuestions.length) * 100;

        let status, details;
        if (pct >= 70) {
            status = 'Projet mature';
            details = 'Votre projet est bien avancé et structuré.';
        } else if (pct >= 40) {
            status = 'Projet en développement';
            details = 'Votre projet nécessite encore quelques approfondissements.';
        } else {
            status = 'Projet à construire';
            details = 'Votre projet est encore au stade de réflexion et nécessite un accompagnement approfondi.';
        }

        return {
            status, details, score: maturiteScore,
            critere1Analysis: this.analyzeCritere1(),
            q15Analysis: this.analyzeQ15(),
            q16Analysis: this.analyzeQ16(),
            q17Analysis: this.analyzeQ17(),
            q19Analysis: this.analyzeQ19(),
            q21Analysis: this.analyzeQ21(),
            q22Analysis: this.analyzeQ22(),
            q23Analysis: this.analyzeQ23()
        };
    }

    analyzeCritere1() {
        const critere1Questions = ['Q15', 'Q16', 'Q17', 'Q19'];
        let nombreReponseNon = 0;
        critere1Questions.forEach(qId => {
            if (this.answers[qId] === 'Non') nombreReponseNon++;
        });
        return { renseignementNecessaire: nombreReponseNon > 0, nombreReponseNon };
    }

    analyzeQ15() {
        const q15 = this.answers['Q15'];
        const q15a = this.answers['Q15a'] ? this.answers['Q15a'].toLowerCase() : '';
        if (q15 === 'Non') {
            return { niveau: 'faible', message: 'Le·la salarié·e ne connaît pas les caractéristiques du métier visé. Il est fortement recommandé de réaliser des enquêtes métiers, des immersions professionnelles (PMSMP) ou de consulter les fiches ROME de France Travail avant de poursuivre le projet.' };
        }
        if (q15 === 'Oui' && q15a) {
            const hasImmersion = q15a.match(/immersion|stage|pmsmp|terrain|entreprise|professionnel/);
            const hasEnquete = q15a.match(/enquête|interview|rencontr|échange|professionnel|réseau/);
            const hasRecherche = q15a.match(/internet|site|rome|fiche|recherche|lu|article|vidéo/);
            const nbDemarches = (hasImmersion ? 1 : 0) + (hasEnquete ? 1 : 0) + (hasRecherche ? 1 : 0);
            if (nbDemarches >= 2) {
                return { niveau: 'bon', message: 'Le·la salarié·e a mené plusieurs démarches pour connaître le métier visé (recherches, enquêtes, immersions). La connaissance du métier semble solide.' };
            }
            if (nbDemarches === 1) {
                return { niveau: 'moyen', message: 'Le·la salarié·e s\'est renseigné·e sur le métier, mais par un seul canal. Il serait bénéfique de compléter par une immersion professionnelle (PMSMP) ou des enquêtes métiers auprès de professionnels en activité.' };
            }
            return { niveau: 'moyen', message: 'Le·la salarié·e indique connaître le métier. Il serait utile de vérifier la profondeur de cette connaissance par des enquêtes métiers ou une immersion professionnelle.' };
        }
        return null;
    }

    analyzeQ16() {
        const q16 = this.answers['Q16'];
        if (q16 === 'Non') {
            return { niveau: 'faible', message: 'Le·la salarié·e ne connaît pas les conditions de rémunération d\'un débutant dans ce métier. Il est important de se renseigner pour éviter toute déception : consulter les grilles salariales conventionnelles, les offres d\'emploi, ou interroger des professionnels en poste.' };
        }
        if (q16 === 'Oui') {
            return { niveau: 'bon', message: 'Le·la salarié·e connaît les conditions de rémunération pour un débutant. C\'est un indicateur positif de maturité du projet.' };
        }
        return null;
    }

    analyzeQ17() {
        const q17 = this.answers['Q17'];
        if (q17 === 'Non') {
            return { niveau: 'faible', message: 'Le·la salarié·e ne connaît pas le niveau d\'expérience exigé par les recruteurs. Il est essentiel de se renseigner sur les attentes du marché : certains métiers privilégient les profils expérimentés, d\'autres sont plus ouverts aux reconversions. Consulter les offres d\'emploi et interroger des recruteurs permettrait de mieux évaluer les chances d\'insertion.' };
        }
        if (q17 === 'Oui') {
            return { niveau: 'bon', message: 'Le·la salarié·e connaît le niveau d\'expérience attendu par les recruteurs. Cette connaissance est un atout pour anticiper les conditions d\'accès à l\'emploi après la formation.' };
        }
        return null;
    }

    analyzeQ19() {
        const q19 = this.answers['Q19'];
        const q19a = this.answers['Q19a'] ? this.answers['Q19a'].toLowerCase() : '';
        const q19b = this.answers['Q19b'] ? this.answers['Q19b'].toLowerCase() : '';
        if (q19 === 'Non') {
            return { niveau: 'faible', message: 'Le·la salarié·e n\'a pas identifié d\'inconvénients au métier visé. Un projet réaliste intègre aussi les contraintes du futur métier. Il est recommandé de réaliser une immersion professionnelle ou des enquêtes métiers pour avoir une vision complète (horaires, conditions de travail, contraintes physiques, rémunération de départ...).' };
        }
        if (q19 === 'Oui') {
            if (q19b && q19b.length > 5) {
                return { niveau: 'bon', message: 'Le·la salarié·e a identifié des inconvénients et réfléchi à des solutions d\'adaptation. C\'est un signe de maturité du projet.' };
            }
            if (q19a && q19a.length > 5) {
                return { niveau: 'moyen', message: 'Le·la salarié·e a identifié des inconvénients mais n\'a pas encore élaboré de stratégie d\'adaptation. Il serait utile de travailler sur les solutions possibles avec un conseiller CEP.' };
            }
            return { niveau: 'moyen', message: 'Le·la salarié·e dit avoir identifié des inconvénients. Il est utile d\'approfondir cette réflexion pour s\'assurer d\'une vision réaliste du métier.' };
        }
        return null;
    }

    analyzeQ21() {
        const q21 = this.answers['Q21'];
        return { afficherInfoFormation: q21 === 'Oui' || q21 === 'Non' };
    }

    analyzeQ22() {
        const q22 = this.answers['Q22'] ? this.answers['Q22'].toLowerCase() : '';
        const criteres = {
            observationGroupe: !!q22.match(/observ\w*\s+(un\s+)?groupe|assist\w*\s+.*\s+cours|vu\s+(un\s+)?groupe|groupe\s+en\s+situation|formation\s+en\s+cours/),
            visiteCentre: !!q22.match(/visit\w*\s+(le\s+)?centre|visit\w*\s+(l')?organisme|visit\w*\s+(les\s+)?locaux|allé\s+sur\s+place|rendu\s+sur\s+place/),
            visitePlateau: !!q22.match(/plateau\s+technique|visit\w*\s+(le\s+)?plateau|équipements?\s+technique|atelier/),
            moyensPedagogiques: !!q22.match(/moyens?\s+pédagogique|matériel\s+pédagogique|outils?\s+pédagogique|ressources?\s+pédagogique|support|méthode\s+pédagogique/)
        };
        const nombreCriteres = Object.values(criteres).filter(v => v).length;
        const detailsList = [];
        if (criteres.observationGroupe) detailsList.push('Observation d\'un groupe en situation');
        if (criteres.visiteCentre) detailsList.push('Visite du centre de formation');
        if (criteres.visitePlateau) detailsList.push('Visite du plateau technique');
        if (criteres.moyensPedagogiques) detailsList.push('Vérification des moyens pédagogiques');
        return { criteres, nombreCriteres, details: detailsList };
    }

    analyzeQ23() {
        const q23 = this.answers['Q23'] ? this.answers['Q23'].trim() : '';
        const q23lower = q23.toLowerCase();
        if (q23lower === 'non' || q23.length < 5) {
            return {
                recruteurNonIdentifie: true,
                niveau: 'faible',
                message: 'Le·la salarié·e n\'a pas encore identifié de recruteurs potentiels. Il est vivement recommandé de mettre en place une démarche tactique : solliciter des immersions facilitées (PMSMP) ou des stages chez un employeur susceptible de recruter à l\'issue de la formation. À noter : 50% des personnes en stage se font embaucher dans la même entreprise. Cette démarche renforce considérablement le dossier et les chances de retour à l\'emploi.'
            };
        }
        if (q23.length >= 5) {
            const hasContact = q23lower.match(/contact|rencontr|échange|entretien|candidat|postuler|cv|mail|téléphone/);
            const hasStage = q23lower.match(/stage|immersion|pmsmp/);
            if (hasStage) {
                return {
                    recruteurNonIdentifie: false,
                    niveau: 'bon',
                    message: 'Le·la salarié·e a identifié des recruteurs et envisage une immersion ou un stage. Excellente démarche qui maximise les chances d\'embauche à l\'issue de la formation.'
                };
            }
            if (hasContact) {
                return {
                    recruteurNonIdentifie: false,
                    niveau: 'moyen',
                    message: 'Le·la salarié·e a identifié des recruteurs et pris contact. Pour aller plus loin, il serait pertinent de solliciter une immersion facilitée (PMSMP) ou un stage chez l\'un d\'entre eux : 50% des personnes en stage se font embaucher dans la même entreprise.'
                };
            }
            return {
                recruteurNonIdentifie: false,
                niveau: 'moyen',
                message: 'Le·la salarié·e a identifié des recruteurs potentiels. Il est recommandé d\'aller au-delà de l\'identification : solliciter une immersion facilitée (PMSMP) ou un stage permettrait de concrétiser cette perspective. 50% des personnes en stage se font embaucher dans la même entreprise.'
            };
        }
        return { recruteurNonIdentifie: true, niveau: 'faible' };
    }

    // ==================== GÉNÉRATION HTML DES ALERTES ====================

    generateQ1aAlertHTML(a) {
        if (!a) return '';
        let html = '';
        if (a.ancienneteInsuffisante) {
            html += '<div class="alert alert-warning"><strong>Alerte :</strong> Il faudra avoir 12 mois d\'ancienneté à la date d\'entrée en formation</div>';
        }
        if (a.ancienneteElevee) {
            html += '<div class="alert alert-warning"><strong>Alerte :</strong> Le taux de mise en oeuvre de la reconversion décline après 5 ans d\'ancienneté. Compte tenu de votre ancienneté, nous vous invitons à faire preuve de la plus grande vigilance lors de votre demande d\'autorisation d\'absence et à anticiper les futurs freins : mettre votre CV à jour, vous préparer pour les entretiens d\'embauche, envisager une perte des indemnités de licenciement, vous préparer à vivre une nouvelle période d\'essai, à perdre des congés, à voir votre rémunération baisser...</div>';
        }
        return html;
    }

    generateQ1bAlertHTML(a) {
        if (!a || !a.travailleurHandicape) return '';
        return '<div class="alert alert-info"><strong>Information :</strong> Du fait de la reconnaissance de votre statut de travailleur handicapé, nous vous invitons à solliciter un accompagnement renforcé auprès de Cap Emploi, de la médecine du travail ou encore de l\'éventuel référent au sein de l\'organisme de formation.</div>';
    }

    generateQ3bAlertHTML(a) {
        if (!a || !a.remunerationElevee) return '';
        return '<div class="alert alert-warning"><strong>Attention :</strong> Votre rémunération est supérieure à la moyenne des rémunérations prises en charge par Transitions Pro PACA. Cet élément risque de faire réagir négativement la commission. Pistes de compensation : formation partiellement hors temps de travail, organisme plus compétitif en coût/durée, solutions de cofinancement...</div>';
    }

    generateQ9AlertHTML(a) {
        if (!a || !a.penibiliteDetectee) return '';
        return '<div class="alert alert-warning"><strong>Alerte chargé de projets :</strong> Conditions de travail pénibles détectées — Interroger les dispositifs C2P/FIPU</div>';
    }

    generateEligibiliteCDDCDIHTML(a) {
        if (!a) return '';
        if (a.isCDD) {
            return '<div class="alert alert-warning"><strong>Conditions d\'éligibilité CDD :</strong> À la date du départ en formation, le·la salarié·e doit justifier d\'une ancienneté d\'au moins 24 mois, consécutifs ou non, en qualité de salarié de droit privé au cours des 5 dernières années, dont 120 jours (ou 4 mois) en CDD. Il doit être encore sous contrat CDD au moment du dépôt du dossier et débuter sa formation au plus tard 6 mois après la fin de son contrat.</div>';
        }
        return '<div class="alert alert-warning"><strong>Conditions d\'éligibilité CDI :</strong> À la date du départ en formation, le·la salarié·e doit justifier d\'une ancienneté d\'au moins 24 mois, consécutifs ou non, en qualité de salarié de droit privé, dont 12 mois dans l\'entreprise, quelle qu\'ait été la nature des contrats de travail successifs.</div>';
    }

    generateQ10bAlertHTML(a) {
        if (!a || !a.nonParleEmployeur) return '';
        return '<div class="alert alert-warning"><strong>Alerte chargé·e de projets :</strong> Le·la salarié·e n\'a pas encore informé son employeur. Il est essentiel de l\'alerter sur les points suivants :<ul style="margin-top:8px;margin-bottom:0;"><li>Ne <strong>surtout pas</strong> signer de rupture conventionnelle ou solliciter une démission avant le passage du dossier devant la commission.</li><li>Ne pas non plus le faire trop tôt pendant la période de formation.</li><li>En revanche, il serait bienvenu d\'évoquer ces possibilités avec son employeur au moment de la <strong>demande d\'autorisation d\'absence</strong>.</li></ul></div>';
    }

    generateQ3aAlertHTML(a) {
        if (!a || !a.ouvrierEmploye) return '';
        return '<div class="alert alert-info"><strong>Information :</strong> Du fait de votre statut d\'ouvrier ou employé, vous avez de grandes chances d\'obtenir la prise en charge. Cependant, l\'accompagnement d\'un conseiller en évolution professionnelle est vivement encouragé pour formaliser votre projet.</div>';
    }

    generateCritere1AlertHTML(a) {
        if (!a || !a.renseignementNecessaire) return '';
        return '<div class="alert alert-warning"><strong>Attention :</strong> Nous vous suggérons de renforcer la cohérence de votre projet : enquêtes métiers, immersion facilitée, stages...</div>';
    }

    generateMaturiteContextuelHTML(label, analysis) {
        if (!analysis) return '';
        const alertClass = analysis.niveau === 'bon' ? 'alert-success' : analysis.niveau === 'moyen' ? 'alert-info' : 'alert-warning';
        const niveauLabel = analysis.niveau === 'bon' ? 'Maturité solide' : analysis.niveau === 'moyen' ? 'Maturité partielle' : 'À approfondir';
        return `<div class="alert ${alertClass}"><strong>${label} — ${niveauLabel} :</strong> ${analysis.message}</div>`;
    }

    generateQ21AlertHTML(a) {
        if (!a || !a.afficherInfoFormation) return '';
        return '<div class="alert alert-info"><strong>Information :</strong> Pour comparer les organismes de formation, nous vous suggérons d\'en interroger plusieurs à l\'aide du <a href="https://www.transitionspro-paca.fr/telechargement/10630/?tmstv=1767013763" target="_blank" style="color: var(--primary-color); text-decoration: underline;">guide Transitions Pro PACA</a>.</div>';
    }

    generateQ22AnalysisHTML(a) {
        if (!a || a.nombreCriteres === 0) return '';
        let html = '<div class="alert alert-success"><strong>Démarche de vérification du choix de l\'organisme :</strong><ul>';
        a.details.forEach(d => { html += `<li>${d}</li>`; });
        html += '</ul></div>';
        return html;
    }

    generateQ23AlertHTML(a) {
        if (!a || !a.message) return '';
        const alertClass = a.niveau === 'bon' ? 'alert-success' : a.niveau === 'moyen' ? 'alert-info' : 'alert-warning';
        const niveauLabel = a.niveau === 'bon' ? 'Maturité solide' : a.niveau === 'moyen' ? 'Maturité partielle' : 'À approfondir';
        return `<div class="alert ${alertClass}"><strong>Recruteurs identifiés — ${niveauLabel} :</strong> ${a.message}</div>`;
    }

    // ==================== PRESCRIPTION ====================

    generatePrescription(analysis) {
        let p = '<div class="prescription-text"><p><strong>Suite à l\'évaluation de votre projet de reconversion professionnelle :</strong></p><ul>';

        if (analysis.eligibilite.status === 'Éligible') {
            p += '<li>Vous êtes éligible au dispositif de reconversion professionnelle</li>';
        }

        p += `<li><strong>Score de priorité : ${analysis.priorite.score}/${analysis.priorite.maxScore} points</strong></li>`;

        if (analysis.priorite.score >= 15) {
            p += '<li>Votre profil bénéficie d\'une priorité très élevée</li>';
            p += '<li>Traitement accéléré de votre dossier recommandé</li>';
        } else if (analysis.priorite.score >= 10) {
            p += '<li>Votre profil est prioritaire pour l\'accès au dispositif</li>';
        } else if (analysis.priorite.score >= 7) {
            p += '<li>Votre profil présente une priorité moyenne</li>';
        } else {
            p += '<li>Envisagez d\'optimiser votre dossier pour augmenter votre score de priorité</li>';
        }

        if (analysis.maturite.status === 'Projet à construire') {
            p += '<li>Accompagnement CEP approfondi recommandé</li>';
            p += '<li>Réalisation d\'un bilan de compétences suggérée</li>';
            p += '<li>Enquêtes métier et immersions professionnelles à prévoir</li>';
        } else if (analysis.maturite.status === 'Projet en développement') {
            p += '<li>Accompagnement CEP pour finaliser le projet</li>';
            p += '<li>Validation du choix de formation et d\'organisme</li>';
        } else {
            p += '<li>Projet suffisamment mature pour constituer un dossier</li>';
            p += '<li>Accompagnement CEP pour la partie administrative et financière</li>';
        }

        if (this.answers['Q1b'] === 'Oui') {
            p += '<li>Mobiliser CAP EMPLOI et le référent handicap</li>';
        }
        if (this.answers['Q14'] && this.answers['Q14'].toLowerCase().includes('oui')) {
            p += '<li>Explorer les possibilités de cofinancement avec l\'employeur et l\'OPCO</li>';
        }

        p += '</ul>';
        p += '<p><strong>Prochaines étapes :</strong></p><ol>';
        p += '<li>Présenter cette prescription à votre conseiller CEP</li>';
        p += '<li>Constituer votre dossier avec les pièces justificatives</li>';
        p += '<li>Finaliser le plan de financement</li>';
        p += '<li>Déposer votre demande d\'autorisation d\'absence</li>';
        p += '</ol></div>';
        return p;
    }

    // ==================== GÉNÉRATION PDF ====================

    downloadPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const margin = 20;
        let y = margin;
        const lineHeight = 7;
        const pageHeight = doc.internal.pageSize.height;

        const logoUrl = 'https://www.transitionspro-paca.fr/wp-content/uploads/2021/04/logo-transitions-pro-paca.png';
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        const buildPDF = (withLogo) => {
            const pageWidth = doc.internal.pageSize.width;
            const contentWidth = pageWidth - margin * 2;

            if (withLogo) {
                const logoWidth = 45;
                const logoHeight = (img.height / img.width) * logoWidth;
                doc.addImage(img, 'PNG', margin, y, logoWidth, logoHeight);
                y += logoHeight + 5;
            }

            // Titre principal
            doc.setFontSize(15);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(37, 99, 235);
            const titleLines = doc.splitTextToSize('Questionnaire préalable au projet de transition professionnelle', contentWidth);
            doc.text(titleLines, margin, y);
            y += lineHeight * titleLines.length + 2;

            // Ligne décorative sous le titre
            doc.setDrawColor(37, 99, 235);
            doc.setLineWidth(1);
            doc.line(margin, y, margin + 60, y);
            doc.setLineWidth(0.3);
            doc.setDrawColor(200, 200, 200);
            doc.line(margin + 60, y, margin + contentWidth, y);
            y += 8;

            // Bloc identité
            const date = new Date().toLocaleDateString('fr-FR');
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(margin - 2, y - 3, contentWidth + 4, 20, 2, 2, 'F');

            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text(`${this.userInfo.prenom} ${this.userInfo.nom}`, margin + 3, y + 4);

            doc.setFontSize(9);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`Chargé·e de projets : ${this.chargeProjets.nom}`, margin + 3, y + 11);
            doc.text(`Date : ${date}`, margin + contentWidth - 35, y + 4);

            y += 24;

            const analysis = this.analyzeAnswers();
            this.generatePDFContent(doc, analysis, y, margin, lineHeight, pageHeight, date);
        };

        img.onload = () => buildPDF(true);
        img.onerror = () => buildPDF(false);
        img.src = logoUrl;
    }

    generatePDFContent(doc, analysis, y, margin, lineHeight, pageHeight, date) {
        const pageWidth = doc.internal.pageSize.width;
        const contentWidth = pageWidth - margin * 2;
        const textWidth = contentWidth - 6;

        const checkPageBreak = (needed) => {
            if (y + needed > pageHeight - 20) { doc.addPage(); y = 20; }
        };

        // Ligne de séparation décorative
        const drawSeparator = (color) => {
            checkPageBreak(8);
            doc.setDrawColor(color.r, color.g, color.b);
            doc.setLineWidth(0.5);
            doc.line(margin, y, margin + contentWidth, y);
            y += 8;
        };

        // Titre de section avec bandeau coloré
        const drawSectionTitle = (title, color, icon) => {
            checkPageBreak(18);
            y += 4;
            doc.setFillColor(color.r, color.g, color.b);
            doc.roundedRect(margin - 2, y - 5, contentWidth + 4, 12, 2, 2, 'F');
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(`${icon}  ${title}`, margin + 3, y + 3);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += 14;
        };

        // Cartouche d'alerte avec calcul de hauteur correct
        const drawAlertBox = (label, message, fillColor, borderColor, labelColor) => {
            doc.setFontSize(8.5);
            const lines = doc.splitTextToSize(message, textWidth - 4);
            // Hauteur = padding top (5) + label (5) + espace après label (3) + lignes * 4.5 + padding bottom (5)
            const contentLineHeight = 4.5;
            const boxHeight = 5 + 5 + 3 + (lines.length * contentLineHeight) + 5;
            checkPageBreak(boxHeight + 4);

            // Fond
            doc.setFillColor(...fillColor);
            doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'F');
            // Bordure gauche épaisse (accent)
            doc.setFillColor(...borderColor);
            doc.rect(margin, y, 3, boxHeight, 'F');

            // Label
            const labelY = y + 8;
            doc.setFontSize(8.5);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(...labelColor);
            doc.text(label, margin + 7, labelY);

            // Contenu
            doc.setFont(undefined, 'normal');
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(8);
            let textY = labelY + 6;
            lines.forEach(line => {
                doc.text(line, margin + 7, textY);
                textY += contentLineHeight;
            });

            y += boxHeight + 4;
        };

        // Cartouche contextuel avec niveau (faible/moyen/bon)
        const drawContextBox = (title, analysis) => {
            if (!analysis || !analysis.message) return;
            const niveauColors = {
                'bon': { fill: [220, 252, 231], border: [22, 163, 74], label: [22, 163, 74], icon: '✓' },
                'moyen': { fill: [219, 234, 254], border: [59, 130, 246], label: [59, 130, 246], icon: '~' },
                'faible': { fill: [254, 242, 232], border: [234, 88, 12], label: [234, 88, 12], icon: '!' }
            };
            const c = niveauColors[analysis.niveau] || niveauColors['moyen'];
            const niveauLabel = analysis.niveau === 'bon' ? 'Maturité solide' : analysis.niveau === 'moyen' ? 'Maturité partielle' : 'À approfondir';
            drawAlertBox(`${title} — ${niveauLabel}`, analysis.message, c.fill, c.border, c.label);
        };

        // Indicateur de statut avec icône
        const drawStatus = (label, value, color) => {
            checkPageBreak(12);
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(color.r, color.g, color.b);
            doc.text(value, margin + 2, y);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight + 2;
        };

        // Texte descriptif
        const drawText = (text, fontSize) => {
            doc.setFontSize(fontSize || 9);
            doc.setTextColor(80, 80, 80);
            const lines = doc.splitTextToSize(text, textWidth);
            lines.forEach(line => {
                checkPageBreak(6);
                doc.text(line, margin + 2, y);
                y += 5;
            });
            doc.setTextColor(0);
            y += 3;
        };

        // Barre de score visuelle
        const drawScoreBar = (score, maxScore, color) => {
            checkPageBreak(20);
            const barWidth = 100;
            const barHeight = 8;
            const barX = margin + 2;
            const pct = Math.min(score / maxScore, 1);

            // Fond gris
            doc.setFillColor(230, 230, 230);
            doc.roundedRect(barX, y, barWidth, barHeight, 3, 3, 'F');
            // Barre de progression
            if (pct > 0) {
                doc.setFillColor(color.r, color.g, color.b);
                doc.roundedRect(barX, y, barWidth * pct, barHeight, 3, 3, 'F');
            }
            // Score texte
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(color.r, color.g, color.b);
            doc.text(`${score} / ${maxScore} points`, barX + barWidth + 8, y + 6);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += barHeight + 8;
        };

        // ========================================
        // SECTION 1 : ÉLIGIBILITÉ
        // ========================================
        drawSectionTitle('ÉLIGIBILITÉ', { r: 37, g: 99, b: 235 }, '§1');
        drawStatus('Statut', analysis.eligibilite.status, { r: 37, g: 99, b: 235 });
        drawText(analysis.eligibilite.details);

        // Cartouche CDI/CDD
        if (analysis.eligibilite.eligibiliteCDDCDI) {
            if (analysis.eligibilite.eligibiliteCDDCDI.isCDD) {
                drawAlertBox('Conditions d\'éligibilité CDD :', 'À la date du départ en formation, le·la salarié·e doit justifier d\'une ancienneté d\'au moins 24 mois, consécutifs ou non, en qualité de salarié de droit privé au cours des 5 dernières années, dont 120 jours (ou 4 mois) en CDD. Il doit être encore sous contrat CDD au moment du dépôt du dossier et débuter sa formation au plus tard 6 mois après la fin de son contrat.', [219, 234, 254], [37, 99, 235], [37, 99, 235]);
            } else {
                drawAlertBox('Conditions d\'éligibilité CDI :', 'À la date du départ en formation, le·la salarié·e doit justifier d\'une ancienneté d\'au moins 24 mois, consécutifs ou non, en qualité de salarié de droit privé, dont 12 mois dans l\'entreprise, quelle qu\'ait été la nature des contrats de travail successifs.', [219, 234, 254], [37, 99, 235], [37, 99, 235]);
            }
        }

        // Alertes Q1a
        if (analysis.eligibilite.q1aAnalysis?.ancienneteInsuffisante) {
            drawAlertBox('Alerte :', 'Il faudra avoir 12 mois d\'ancienneté à la date d\'entrée en formation.', [254, 242, 232], [234, 88, 12], [234, 88, 12]);
        }
        if (analysis.eligibilite.q1aAnalysis?.ancienneteElevee) {
            drawAlertBox('Alerte :', 'Le taux de mise en oeuvre de la reconversion décline après 5 ans d\'ancienneté. Compte tenu de votre ancienneté, nous vous invitons à faire preuve de la plus grande vigilance lors de votre demande d\'autorisation d\'absence et à anticiper les futurs freins : mettre votre CV à jour, vous préparer pour les entretiens d\'embauche, envisager une perte des indemnités de licenciement, vous préparer à vivre une nouvelle période d\'essai, à perdre des congés, à voir votre rémunération baisser...', [254, 242, 232], [234, 88, 12], [234, 88, 12]);
        }

        // Alerte travailleur handicapé
        if (analysis.eligibilite.q1bAnalysis?.travailleurHandicape) {
            drawAlertBox('Information :', 'Du fait de la reconnaissance de votre statut de travailleur handicapé, nous vous invitons à solliciter un accompagnement renforcé auprès de Cap Emploi, de la médecine du travail ou encore de l\'éventuel référent au sein de l\'organisme de formation.', [219, 234, 254], [37, 99, 235], [37, 99, 235]);
        }

        // Alerte rémunération
        if (analysis.eligibilite.q3bAnalysis?.remunerationElevee) {
            drawAlertBox('Attention :', 'Votre rémunération est supérieure à la moyenne des rémunérations prises en charge par Transitions Pro PACA. Cet élément risque de faire réagir négativement la commission. Pistes de compensation : formation partiellement hors temps de travail, organisme plus compétitif en coût/durée, solutions de cofinancement...', [254, 242, 232], [234, 88, 12], [234, 88, 12]);
        }

        // NB : les alertes Q9 (pénibilité/C2P) et Q10b (employeur non informé)
        // sont réservées aux chargés de projets et ne figurent pas dans le PDF bénéficiaire.

        y += 2;

        // ========================================
        // SECTION 2 : PRIORITÉ
        // ========================================
        drawSectionTitle('NIVEAU DE PRIORITÉ', { r: 16, g: 163, b: 129 }, '§2');
        drawStatus('Statut', analysis.priorite.status, { r: 16, g: 163, b: 129 });
        drawScoreBar(analysis.priorite.score, analysis.priorite.maxScore, { r: 16, g: 163, b: 129 });

        // Détail des points
        if (analysis.priorite.details.length > 0) {
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text('Détail des points obtenus :', margin + 2, y);
            doc.setFont(undefined, 'normal');
            y += 6;

            analysis.priorite.details.forEach(detail => {
                checkPageBreak(8);
                // Ligne alternée
                doc.setFillColor(248, 250, 252);
                doc.rect(margin, y - 4, contentWidth, 7, 'F');
                doc.setFontSize(8.5);
                doc.setTextColor(60, 60, 60);
                doc.setFont(undefined, 'bold');
                doc.text(`${detail.code}`, margin + 4, y);
                doc.setFont(undefined, 'normal');
                doc.text(`${detail.libelle}`, margin + 18, y);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(16, 163, 129);
                doc.text(`+${detail.points} pt${detail.points > 1 ? 's' : ''}`, margin + contentWidth - 20, y);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(0);
                y += 7;
            });
            y += 3;
        }

        // Alerte ouvrier/employé
        if (analysis.priorite.q3aAnalysis?.ouvrierEmploye) {
            drawAlertBox('Information :', 'Du fait de votre statut d\'ouvrier ou employé, vous avez de grandes chances d\'obtenir la prise en charge. L\'accompagnement d\'un conseiller en évolution professionnelle est vivement encouragé pour formaliser votre projet.', [219, 234, 254], [37, 99, 235], [37, 99, 235]);
        }
        y += 2;

        // ========================================
        // SECTION 3 : MATURITÉ DU PROJET
        // ========================================
        drawSectionTitle('MATURITÉ DU PROJET', { r: 234, g: 136, b: 0 }, '§3');
        drawStatus('Statut', analysis.maturite.status, { r: 234, g: 136, b: 0 });
        drawText(analysis.maturite.details);

        // Alerte cohérence
        if (analysis.maturite.critere1Analysis?.renseignementNecessaire) {
            drawAlertBox('Attention :', 'Nous vous suggérons de renforcer la cohérence de votre projet : enquêtes métiers, immersion facilitée, stages...', [254, 242, 232], [234, 88, 12], [234, 88, 12]);
        }

        // Cartouches contextuels de maturité
        drawContextBox('Connaissance du métier', analysis.maturite.q15Analysis);
        drawContextBox('Rémunération débutant', analysis.maturite.q16Analysis);
        drawContextBox('Expérience requise', analysis.maturite.q17Analysis);
        drawContextBox('Inconvénients du métier', analysis.maturite.q19Analysis);

        // Formation
        if (analysis.maturite.q21Analysis?.afficherInfoFormation) {
            drawAlertBox('Information :', 'Pour comparer les organismes de formation, nous vous suggérons d\'en interroger plusieurs à l\'aide du guide Transitions Pro PACA (https://www.transitionspro-paca.fr/telechargement/10630/).', [219, 234, 254], [37, 99, 235], [37, 99, 235]);
        }

        // Vérification organisme
        if (analysis.maturite.q22Analysis?.nombreCriteres > 0) {
            const detailsText = analysis.maturite.q22Analysis.details.map(d => `• ${d}`).join('\n');
            drawAlertBox('Vérification du choix de l\'organisme :', detailsText, [220, 252, 231], [22, 163, 74], [22, 163, 74]);
        }

        // Recruteurs (Q23 contextuel)
        if (analysis.maturite.q23Analysis?.message) {
            drawContextBox('Recruteurs identifiés', analysis.maturite.q23Analysis);
        }

        y += 2;

        // ========================================
        // SECTION 4 : RECOMMANDATIONS
        // ========================================
        drawSectionTitle('RECOMMANDATIONS', { r: 99, g: 102, b: 241 }, '§4');

        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const prescText = this.generatePrescriptionText(analysis);
        const prescLines = prescText.split('\n');

        prescLines.forEach(line => {
            if (!line.trim()) { y += 3; return; }
            const wrapped = doc.splitTextToSize(line, textWidth);
            wrapped.forEach(wl => {
                checkPageBreak(7);
                if (wl.trim().startsWith('•')) {
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(99, 102, 241);
                    doc.text('●', margin + 4, y);
                    doc.setTextColor(60, 60, 60);
                    doc.text(wl.replace(/^[\s•]+/, ''), margin + 10, y);
                } else if (wl.match(/^\d+\./)) {
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(99, 102, 241);
                    doc.text(wl.match(/^\d+\./)[0], margin + 4, y);
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(60, 60, 60);
                    doc.text(wl.replace(/^\d+\.\s*/, ''), margin + 12, y);
                } else if (wl.includes('Score de priorité') || wl.includes('Prochaines étapes')) {
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(40, 40, 40);
                    doc.text(wl, margin + 2, y);
                    doc.setFont(undefined, 'normal');
                } else {
                    doc.text(wl, margin + 2, y);
                }
                y += 5.5;
            });
        });
        doc.setTextColor(0);

        // ========================================
        // COORDONNÉES DU CHARGÉ DE PROJETS
        // ========================================
        y += 6;
        const contactBoxHeight = 32;
        checkPageBreak(contactBoxHeight + 10);

        // Fond avec bordure
        doc.setFillColor(245, 245, 255);
        doc.roundedRect(margin - 2, y - 2, contentWidth + 4, contactBoxHeight, 3, 3, 'F');
        doc.setFillColor(99, 102, 241);
        doc.rect(margin - 2, y - 2, 3, contactBoxHeight, 'F');

        doc.setFontSize(8.5);
        doc.setFont(undefined, 'italic');
        doc.setTextColor(80, 80, 80);
        const contactLines = doc.splitTextToSize('Après avoir rencontré un conseiller en évolution professionnelle, nous vous invitons à revenir vers votre chargé·e de projets Transitions Pro PACA :', textWidth - 10);
        contactLines.forEach(line => { doc.text(line, margin + 7, y + 4); y += 4.5; });
        y += 4;
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        doc.setTextColor(99, 102, 241);
        doc.text(this.chargeProjets.nom, margin + 7, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text(this.chargeProjets.email, margin + 7, y);

        // ========================================
        // PIED DE PAGE
        // ========================================
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            // Ligne de séparation
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, pageHeight - 15, margin + contentWidth, pageHeight - 15);
            // Texte
            doc.setFontSize(7);
            doc.setTextColor(160, 160, 160);
            doc.text('Transitions Pro PACA — Questionnaire préalable au PTP', margin, pageHeight - 10);
            doc.text(`Page ${i}/${pageCount}`, margin + contentWidth - 15, pageHeight - 10);
            doc.text(date, margin + contentWidth / 2 - 8, pageHeight - 10);
        }

        doc.save(`prescription-cep-${date.replace(/\//g, '-')}.pdf`);
    }

    generatePrescriptionText(analysis) {
        let text = 'Suite à l\'évaluation de votre projet de reconversion professionnelle :\n\n';

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

    // ==================== ACTIONS ====================

    restart() {
        if (confirm('Êtes-vous sûr de vouloir recommencer ? Vos réponses actuelles seront perdues.')) {
            this.answers = {};
            localStorage.removeItem('cep_answers');
            document.getElementById('user-prenom').value = '';
            document.getElementById('user-nom').value = '';
            this.userInfo = { prenom: '', nom: '' };
            document.getElementById('result-screen').style.display = 'none';
            this.renderAllQuestions();
            window.scrollTo(0, 0);
        }
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    new CEPQuestionnaire();
});
