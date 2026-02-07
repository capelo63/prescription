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
                    <span class="section-badge">${this.getSectionLabel(question.objectif)}</span>
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
            'critère 3': 'Maturité - Emploi',
            'à voir si priorité 2026': 'Priorité future'
        };
        return labels[objectif] || 'Questionnaire';
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
        const yesNoIds = ['Q1b', 'Q1c', 'Q3a', 'Q4', 'Q5', 'Q6', 'Q7', 'Q13', 'Q14', 'Q15', 'Q19', 'Q21'];
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
            q9Analysis: this.analyzeQ9()
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
        const q23 = this.answers['Q23'];
        let recruteurNonIdentifie = false;
        if (q23 === 'Non') recruteurNonIdentifie = true;
        else if (!q23 || q23.trim().length < 5) recruteurNonIdentifie = true;
        return { recruteurNonIdentifie };
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

    generateQ3aAlertHTML(a) {
        if (!a || !a.ouvrierEmploye) return '';
        return '<div class="alert alert-info"><strong>Information :</strong> Du fait de votre statut d\'ouvrier ou employé, vous avez de grandes chances d\'obtenir la prise en charge. Cependant, l\'accompagnement d\'un conseiller en évolution professionnelle est vivement encouragé pour formaliser votre projet.</div>';
    }

    generateCritere1AlertHTML(a) {
        if (!a || !a.renseignementNecessaire) return '';
        return '<div class="alert alert-warning"><strong>Attention :</strong> Nous vous suggérons de renforcer la cohérence de votre projet : enquêtes métiers, immersion facilitée, stages...</div>';
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
        if (!a || !a.recruteurNonIdentifie) return '';
        return '<div class="alert alert-warning"><strong>Attention :</strong> Nous vous invitons à solliciter un stage auprès de l\'employeur chez lequel vous souhaiteriez être embauché·e.</div>';
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
            if (withLogo) {
                const logoWidth = 50;
                const logoHeight = (img.height / img.width) * logoWidth;
                doc.addImage(img, 'PNG', margin, y, logoWidth, logoHeight);
                y += logoHeight + 10;
            }

            doc.setFontSize(16);
            doc.setTextColor(37, 99, 235);
            const titleLines = doc.splitTextToSize('Questionnaire préalable au projet de transition professionnelle', 170);
            doc.text(titleLines, margin, y);
            y += lineHeight * titleLines.length + 5;

            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text('Transitions Pro PACA', margin, y);
            y += lineHeight + 5;

            doc.setFontSize(12);
            doc.setTextColor(37, 99, 235);
            doc.text(`${this.userInfo.prenom} ${this.userInfo.nom}`, margin, y);
            y += lineHeight + 5;

            const date = new Date().toLocaleDateString('fr-FR');
            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.text(`Date: ${date}`, margin, y);
            y += lineHeight * 2;

            const analysis = this.analyzeAnswers();
            this.generatePDFContent(doc, analysis, y, margin, lineHeight, pageHeight, date);
        };

        img.onload = () => buildPDF(true);
        img.onerror = () => buildPDF(false);
        img.src = logoUrl;
    }

    generatePDFContent(doc, analysis, y, margin, lineHeight, pageHeight, date) {
        const checkPageBreak = (needed) => {
            if (y + needed > pageHeight - margin) { doc.addPage(); y = margin; }
        };

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

        const drawAlertBox = (label, message, fillColor, borderColor, labelColor) => {
            const lines = doc.splitTextToSize(message, 160);
            const boxHeight = 8 + (lines.length * (lineHeight - 1));
            checkPageBreak(boxHeight + 5);
            doc.setFillColor(...fillColor);
            doc.rect(margin - 2, y - 2, 169, boxHeight, 'F');
            doc.setDrawColor(...borderColor);
            doc.setLineWidth(0.3);
            doc.rect(margin - 2, y - 2, 169, boxHeight);
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(...labelColor);
            doc.text(label, margin + 1, y + 2);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0);
            y += lineHeight;
            lines.forEach(line => { doc.text(line, margin + 1, y); y += lineHeight - 1; });
            y += 8;
        };

        // ÉLIGIBILITÉ
        y = drawSectionTitle('ÉLIGIBILITÉ', {r: 37, g: 99, b: 235});
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(analysis.eligibilite.status, margin, y);
        doc.setFont(undefined, 'normal');
        y += lineHeight;
        const eligDetails = doc.splitTextToSize(analysis.eligibilite.details, 165);
        doc.text(eligDetails, margin, y);
        y += lineHeight * eligDetails.length + 5;

        if (analysis.eligibilite.q1bAnalysis?.travailleurHandicape) {
            drawAlertBox('Information :', 'Du fait de la reconnaissance de votre statut de travailleur handicapé, nous vous invitons à solliciter un accompagnement renforcé auprès de Cap Emploi, de la médecine du travail ou encore de l\'éventuel référent au sein de l\'organisme de formation.', [240, 249, 255], [37, 99, 235], [37, 99, 235]);
        }
        if (analysis.eligibilite.q3bAnalysis?.remunerationElevee) {
            drawAlertBox('Attention :', 'Votre rémunération est supérieure à la moyenne des rémunérations prises en charge par Transitions Pro PACA. Pistes de compensation : formation partiellement hors temps de travail, organisme plus compétitif, solutions de cofinancement...', [254, 243, 199], [245, 158, 11], [245, 158, 11]);
        }
        y += 5;

        // PRIORITÉ
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

        if (analysis.priorite.details.length > 0) {
            doc.setFontSize(9);
            doc.setFont(undefined, 'italic');
            doc.text('Détail des points obtenus :', margin, y);
            doc.setFont(undefined, 'normal');
            y += lineHeight;
            analysis.priorite.details.forEach(detail => {
                checkPageBreak(lineHeight + 2);
                doc.setFillColor(250, 250, 250);
                doc.rect(margin - 1, y - 3, 165, 5, 'F');
                doc.text(`  • ${detail.code} — ${detail.libelle} : +${detail.points} pt${detail.points > 1 ? 's' : ''}`, margin, y);
                y += lineHeight;
            });
        }

        if (analysis.priorite.q3aAnalysis?.ouvrierEmploye) {
            y += 3;
            drawAlertBox('Information :', 'Du fait de votre statut d\'ouvrier ou employé, vous avez de grandes chances d\'obtenir la prise en charge. L\'accompagnement d\'un conseiller en évolution professionnelle est vivement encouragé.', [240, 249, 255], [37, 99, 235], [37, 99, 235]);
        }
        y += 5;

        // MATURITÉ
        y = drawSectionTitle('MATURITÉ DU PROJET', {r: 245, g: 158, b: 11});
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(analysis.maturite.status, margin, y);
        doc.setFont(undefined, 'normal');
        y += lineHeight;
        const matDetails = doc.splitTextToSize(analysis.maturite.details, 165);
        doc.text(matDetails, margin, y);
        y += lineHeight * matDetails.length + 5;

        if (analysis.maturite.critere1Analysis?.renseignementNecessaire) {
            drawAlertBox('Attention :', 'Nous vous suggérons de renforcer la cohérence de votre projet : enquêtes métiers, immersion facilitée, stages...', [254, 243, 199], [245, 158, 11], [245, 158, 11]);
        }
        if (analysis.maturite.q21Analysis?.afficherInfoFormation) {
            drawAlertBox('Information :', 'Pour comparer les organismes de formation, nous vous suggérons d\'en interroger plusieurs à l\'aide du guide Transitions Pro PACA (https://www.transitionspro-paca.fr/telechargement/10630/).', [240, 249, 255], [37, 99, 235], [37, 99, 235]);
        }
        if (analysis.maturite.q22Analysis?.nombreCriteres > 0) {
            const detailsText = analysis.maturite.q22Analysis.details.map(d => `• ${d}`).join('\n');
            drawAlertBox('Démarche de vérification du choix de l\'organisme :', detailsText, [209, 250, 229], [16, 185, 129], [16, 185, 129]);
        }
        if (analysis.maturite.q23Analysis?.recruteurNonIdentifie) {
            drawAlertBox('Attention :', 'Nous vous invitons à solliciter un stage auprès de l\'employeur chez lequel vous souhaiteriez être embauché·e.', [254, 243, 199], [245, 158, 11], [245, 158, 11]);
        }
        y += 5;

        // RECOMMANDATIONS
        y = drawSectionTitle('RECOMMANDATIONS', {r: 99, g: 102, b: 241});
        doc.setFontSize(10);
        const prescText = this.generatePrescriptionText(analysis);
        const lines = doc.splitTextToSize(prescText, 165);
        lines.forEach(line => {
            checkPageBreak(lineHeight + 2);
            if (line.trim().startsWith('•') || line.trim().startsWith('→')) {
                doc.setFont(undefined, 'bold');
                doc.text(line, margin, y);
                doc.setFont(undefined, 'normal');
            } else {
                doc.text(line, margin, y);
            }
            y += lineHeight;
        });

        // COORDONNÉES DU CHARGÉ DE PROJETS
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
        contactText.forEach(line => { doc.text(line, margin, y); y += lineHeight; });
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
