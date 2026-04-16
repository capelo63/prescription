// Application Impulsion - Transitions Pro PACA
class CEPQuestionnaire {
    constructor() {
        this.questions = [];
        this.alertes = [];
        this.answers = {};
        this.metiersPrioritaires = [];
        this.secteursDeclin = [];
        this.userInfo = { civilite: '', prenom: '', nom: '', codeInterne: '', employeur: '', siret: '', email: '', tel: '', cp: '' };
        this.employeurSearchTimeout = null;
        this.referent = { id: '', nom: '', email: '', tel: '' };
        this.referentsData = {
            'nathalie': { nom: 'Nathalie Cornet', email: 'n.cornet@transitionspro-paca.fr', tel: '04 91 13 23 15' },
            'cindy': { nom: 'Cindy Lecouf', email: 'c.lecouf@transitionspro-paca.fr', tel: '04 91 13 94 16' },
            'elies': { nom: 'Eliès Lemhani', email: 'e.lemhani@transitionspro-paca.fr', tel: '04 91 13 94 12' },
            'maurine': { nom: 'Maurine Loubeau', email: 'm.loubeau@transitionspro-paca.fr', tel: '04 91 13 20 73' },
            'zacharie': { nom: 'Zacharie Pinton', email: 'z.pinton@transitionspro-paca.fr', tel: '04 91 13 94 15' },
            'domoina': { nom: 'Domoina Rakotoarimanana', email: 'd.rakotoarimanana@transitionspro-paca.fr', tel: '04 91 13 93 83' },
            'sylvie': { nom: 'Sylvie Troubat', email: 's.troubat@transitionspro-paca.fr', tel: '04 91 13 20 72' },
            'marie': { nom: 'Marie-Josée Verdu-Saglietto', email: 'm.verdu-saglietto@transitionspro-paca.fr', tel: '04 91 13 94 13' },
            'marion': { nom: 'Marion Turck', email: 'm.turck@transitionspro-paca.fr', tel: '04 91 13 21 63' }
        };
        this.timerSeconds = 0;
        this.timerInterval = null;
        this.editingPrescriptionId = null;
        this.init();
    }

    async init() {
        // Auth guard : vérifier la connexion
        this.authProfile = await auth.requireAuth();
        if (!this.authProfile) return;

        // Afficher la nav utilisateur
        auth.renderUserNav(document.getElementById('user-nav'));

        // Si le référent est connecté, pré-remplir et verrouiller le champ référent
        this.autoSelectReferent();

        await this.loadData();

        // Vérifier si on charge une prescription existante (mode édition)
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');
        if (editId) {
            await this.loadExistingPrescription(editId);
        } else {
            this.restoreAutoSave();
        }

        this.renderAllQuestions();
        this.setupEventListeners();
        this.startTimer();
        this.updateProgress();
    }

    autoSelectReferent() {
        const email = this.authProfile.email.toLowerCase();
        const emailToId = {};
        Object.entries(this.referentsData).forEach(([id, data]) => {
            emailToId[data.email.toLowerCase()] = id;
        });
        const matchedId = emailToId[email];
        if (matchedId) {
            this.selectReferent(matchedId);
            const select = document.getElementById('referent-select');
            select.value = matchedId;
            select.disabled = true;
        }
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

    selectReferent(id) {
        if (id && this.referentsData[id]) {
            this.referent.id = id;
            this.referent.nom = this.referentsData[id].nom;
            this.referent.email = this.referentsData[id].email;
            this.referent.tel = this.referentsData[id].tel;
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            const m = Math.floor(this.timerSeconds / 60).toString().padStart(2, '0');
            const s = (this.timerSeconds % 60).toString().padStart(2, '0');
            document.getElementById('timer-display').textContent = `${m}:${s}`;
        }, 1000);
    }

    // ==================== RECHERCHE ENTREPRISE (API GOUV) ====================

    async searchEntreprise(term, dropdown, input) {
        try {
            const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(term)}&page=1&per_page=8`;
            const response = await fetch(url);
            if (!response.ok) return;
            const data = await response.json();

            if (!data.results || data.results.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            dropdown.innerHTML = data.results.map(e => {
                const siege = e.siege || {};
                const nom = e.nom_complet || e.nom_raison_sociale || '';
                const siret = siege.siret || '';
                const ville = siege.libelle_commune || '';
                const naf = siege.activite_principale ? `NAF ${siege.activite_principale}` : '';
                const effectif = e.tranche_effectif_salarie ? `${e.tranche_effectif_salarie} sal.` : '';
                const details = [ville, naf, effectif].filter(Boolean).join(' — ');
                return `<div class="autocomplete-item" data-nom="${nom}" data-siret="${siret}">
                    <strong>${nom}</strong>
                    <span class="autocomplete-code">${siret ? `SIRET ${siret}` : ''} ${details ? `· ${details}` : ''}</span>
                </div>`;
            }).join('');

            dropdown.style.display = 'block';
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    const nom = item.dataset.nom;
                    const siret = item.dataset.siret;
                    input.value = nom;
                    this.userInfo.employeur = nom;
                    this.userInfo.siret = siret;
                    document.getElementById('user-siret').value = siret;
                    dropdown.style.display = 'none';
                });
            });
        } catch (err) {
            // En cas d'erreur réseau, l'utilisateur peut saisir manuellement
            dropdown.style.display = 'none';
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

        if (qId === 'Q1d') {
            this.createDateInput(container, qId, current);
        } else if (qId === 'Q1a') {
            this.createTextInput(container, qId, 'Ex: 2 ans et 3 mois', current);
        } else if (qId === 'Q15a' || qId === 'Q15b' || qId === 'Q22') {
            this.createTextAreaInput(container, qId, 'Votre réponse...', current);
        } else if (this.isYesNoQuestion(question)) {
            this.createInlineButtons(container, qId, ['Oui', 'Non'], current);
        } else if (qId === 'Q2') {
            this.createInlineButtons(container, qId, ['Sans diplôme', 'CAP/BEP', 'Bac', 'Bac+2', 'Bac+3 ou plus'], current);
        } else if (qId === 'Q3b') {
            this.createRemunerationInput(container, qId, current);
        } else if (qId === 'Q10') {
            this.createInlineButtons(container, qId, ['Démission', 'Rupture conventionnelle', 'Licenciement', 'Autre'], current);
        } else if (qId === 'Q10b') {
            this.createInlineButtons(container, qId, ['Oui', 'Non'], current);
        } else if (qId === 'Q10e') {
            this.createTextAreaWithGuide(container, qId, [
                'Pourquoi avez-vous initié cette démarche ?',
                'Selon quelles modalités avez-vous échangé avec le CEP ?',
                'Combien de rendez-vous avez-vous déjà obtenus ?',
                'La démarche a-t-elle été facile ?'
            ], current);
        } else if (qId === 'Q11') {
            this.createSecteurInput(container, qId, current);
        } else if (qId === 'Q12') {
            this.createMetierInput(container, qId, current);
        } else if (qId === 'Q12b') {
            this.createInlineButtons(container, qId, ['Salarié', 'Travailleur indépendant / TNS', 'Agent public', 'Autre'], current);
        } else if (qId === 'Q23') {
            this.createInlineButtons(container, qId, ['Oui, via France Travail', 'Oui, via mon réseau', 'Oui, promesse d\'embauche', 'Oui, projet interne (même employeur)', 'Non'], current);
        } else {
            this.createTextAreaInput(container, qId, 'Votre réponse...', current);
        }
    }

    isYesNoQuestion(question) {
        const yesNoIds = ['Q1b', 'Q1c', 'Q3a', 'Q4', 'Q5', 'Q6', 'Q7', 'Q10d', 'Q11b', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q19', 'Q20', 'Q21'];
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

    createTextAreaWithGuide(container, qId, guideItems, currentAnswer) {
        const guide = document.createElement('div');
        guide.className = 'answer-guide';
        guide.innerHTML = '<span class="answer-guide-label">Points à explorer :</span> ' +
            guideItems.map(item => `<span class="answer-guide-item">${item}</span>`).join('');
        container.appendChild(guide);
        this.createTextAreaInput(container, qId, 'Notes...', currentAnswer);
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

    createRemunerationInput(container, qId, currentAnswer) {
        const wrapper = document.createElement('div');

        const inputRow = document.createElement('div');
        inputRow.className = 'inline-buttons';
        inputRow.style.alignItems = 'center';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'inline-input';
        input.style.maxWidth = '250px';
        input.placeholder = 'Rémunération brute mensuelle (€)';
        input.min = 0;

        const optOutBtn = document.createElement('button');
        optOutBtn.type = 'button';
        optOutBtn.className = 'answer-chip';
        optOutBtn.textContent = 'Je préfère ne pas répondre';

        if (currentAnswer === 'Je préfère ne pas répondre') {
            optOutBtn.classList.add('selected');
            input.disabled = true;
        } else {
            input.value = currentAnswer || '';
        }

        input.addEventListener('input', () => {
            optOutBtn.classList.remove('selected');
            this.saveAnswer(qId, input.value);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.focusNextQuestion(qId);
        });

        optOutBtn.addEventListener('click', () => {
            input.value = '';
            input.disabled = true;
            optOutBtn.classList.add('selected');
            this.saveAnswer(qId, 'Je préfère ne pas répondre');
        });

        input.addEventListener('focus', () => {
            if (optOutBtn.classList.contains('selected')) {
                input.disabled = false;
                optOutBtn.classList.remove('selected');
                this.saveAnswer(qId, '');
            }
        });

        inputRow.appendChild(input);
        inputRow.appendChild(optOutBtn);
        wrapper.appendChild(inputRow);
        container.appendChild(wrapper);
    }

    createDateInput(container, qId, currentAnswer) {
        const wrapper = document.createElement('div');

        const input = document.createElement('input');
        input.type = 'date';
        input.className = 'inline-input';
        input.style.maxWidth = '250px';
        input.value = currentAnswer || '';

        const alertDiv = document.createElement('div');
        alertDiv.id = 'alert-date-projet';

        input.addEventListener('input', () => {
            this.saveAnswer(qId, input.value);
            this.checkDateProjet(input.value, alertDiv);
        });

        wrapper.appendChild(input);
        wrapper.appendChild(alertDiv);
        container.appendChild(wrapper);

        // Vérifier si la date actuelle déclenche l'alerte
        if (currentAnswer) {
            this.checkDateProjet(currentAnswer, alertDiv);
        }
    }

    checkDateProjet(dateStr, alertDiv) {
        if (!dateStr) {
            alertDiv.innerHTML = '';
            return;
        }
        const dateProjet = new Date(dateStr);
        const today = new Date();
        const diffMs = dateProjet - today;
        const diffJours = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffJours < 90) {
            alertDiv.innerHTML = '<div class="alert alert-danger"><strong>Alerte :</strong> La date envisagée est à moins de 90 jours. Ce délai est très court pour constituer un dossier complet (autorisation d\'absence, recherche de formation, passage en commission). Il est vivement recommandé d\'anticiper davantage.</div>';
        } else {
            alertDiv.innerHTML = '<div class="alert alert-success"><strong>Délai suffisant :</strong> La date envisagée laisse un délai de ' + diffJours + ' jours pour préparer votre dossier.</div>';
        }
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

        // Restaurer le badge uniquement si un item avait été sélectionné (format "Intitulé (CODE)")
        if (currentAnswer && currentAnswer.match(/\(.+\)$/)) {
            resultBadge.textContent = 'Secteur prioritaire';
            resultBadge.className = 'match-badge match-yes';
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

        // Restaurer le badge uniquement si un item avait été sélectionné (format "Intitulé (CODE)")
        if (currentAnswer && currentAnswer.match(/\(.+\)$/)) {
            resultBadge.textContent = 'Métier prioritaire PACA';
            resultBadge.className = 'match-badge match-yes';
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
        // Réinitialiser le badge pendant la saisie (le badge ne s'affiche qu'au clic sur un item)
        badge.textContent = '';
        badge.className = 'match-badge';
        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(s =>
                `<div class="autocomplete-item" data-value="${s.intitule} (${s.code_ape})">${s.intitule} <span class="autocomplete-code">${s.code_ape}</span></div>`
            ).join('');
            dropdown.style.display = 'block';
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = item.dataset.value;
                    this.saveAnswer('Q11', input.value);
                    dropdown.style.display = 'none';
                    badge.textContent = 'Secteur prioritaire';
                    badge.className = 'match-badge match-yes';
                });
            });
        } else {
            dropdown.style.display = 'none';
        }
    }

    showMetierSuggestions(term, dropdown, input, badge) {
        const matches = this.findMetierMatches(term);
        // Réinitialiser le badge pendant la saisie (le badge ne s'affiche qu'au clic sur un item)
        badge.textContent = '';
        badge.className = 'match-badge';
        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(m =>
                `<div class="autocomplete-item" data-value="${m.metier} (${m.code_rome})">${m.metier} <span class="autocomplete-code">${m.code_rome} — ${m.domaine}</span></div>`
            ).join('');
            dropdown.style.display = 'block';
            dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                item.addEventListener('click', () => {
                    input.value = item.dataset.value;
                    this.saveAnswer('Q12', input.value);
                    dropdown.style.display = 'none';
                    badge.textContent = 'Métier prioritaire PACA';
                    badge.className = 'match-badge match-yes';
                });
            });
        } else {
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
        // Q3b est toujours visible quel que soit le choix à Q2
        if (questionId === 'Q10e') {
            return this.answers['Q10d'] === 'Oui';
        }
        if (questionId === 'Q13a') {
            return this.answers['Q13'] === 'Oui';
        }
        if (questionId === 'Q23a') {
            const q23 = this.answers['Q23'] || '';
            return q23.startsWith('Oui');
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
        this.autoSave();
    }

    // ==================== SAUVEGARDE AUTOMATIQUE (localStorage) ====================

    autoSave() {
        const data = {
            answers: this.answers,
            userInfo: this.userInfo,
            referent: this.referent,
            timerSeconds: this.timerSeconds,
            savedAt: new Date().toISOString()
        };
        try {
            localStorage.setItem('impulsion_autosave', JSON.stringify(data));
        } catch (e) {
            // localStorage plein ou indisponible
        }
    }

    restoreAutoSave() {
        try {
            const raw = localStorage.getItem('impulsion_autosave');
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.answers) this.answers = data.answers;
            if (data.userInfo) {
                this.userInfo = data.userInfo;
                document.getElementById('user-civilite').value = this.userInfo.civilite || '';
                document.getElementById('user-prenom').value = this.userInfo.prenom || '';
                document.getElementById('user-nom').value = this.userInfo.nom || '';
                document.getElementById('user-code-interne').value = this.userInfo.codeInterne || '';
                document.getElementById('user-employeur').value = this.userInfo.employeur || '';
                document.getElementById('user-siret').value = this.userInfo.siret || '';
                document.getElementById('user-email').value = this.userInfo.email || '';
                document.getElementById('user-tel').value = this.userInfo.tel || '';
                document.getElementById('user-cp').value = this.userInfo.cp || '';
                this.updateCepButton();
            }
            if (data.referent && data.referent.id) {
                this.referent = data.referent;
                document.getElementById('referent-select').value = data.referent.id;
            }
            if (data.timerSeconds) this.timerSeconds = data.timerSeconds;
        } catch (e) {
            // Donnée corrompue, on ignore
        }
    }

    clearAutoSave() {
        try { localStorage.removeItem('impulsion_autosave'); } catch (e) {}
    }

    // ==================== CHARGEMENT PRESCRIPTION EXISTANTE ====================

    async loadExistingPrescription(id) {
        try {
            const { data, error } = await supabaseClient
                .from('prescriptions')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !data) {
                console.error('Prescription introuvable:', error);
                alert('Prescription introuvable ou accès refusé.');
                return;
            }

            this.editingPrescriptionId = data.id;

            // Restaurer les réponses
            if (data.answers) this.answers = data.answers;

            // Restaurer les infos bénéficiaire
            if (data.beneficiaire) {
                this.userInfo = { ...this.userInfo, ...data.beneficiaire };
                document.getElementById('user-civilite').value = this.userInfo.civilite || '';
                document.getElementById('user-prenom').value = this.userInfo.prenom || '';
                document.getElementById('user-nom').value = this.userInfo.nom || '';
                document.getElementById('user-code-interne').value = this.userInfo.codeInterne || '';
                document.getElementById('user-employeur').value = this.userInfo.employeur || '';
                document.getElementById('user-siret').value = this.userInfo.siret || '';
                document.getElementById('user-email').value = this.userInfo.email || '';
                document.getElementById('user-tel').value = this.userInfo.tel || '';
                document.getElementById('user-cp').value = this.userInfo.cp || '';
                this.updateCepButton();
            }

            // Restaurer le timer
            if (data.timer_seconds) this.timerSeconds = data.timer_seconds;

        } catch (e) {
            console.error('Erreur chargement prescription:', e);
        }
    }

    // ==================== STOCKAGE DES PRESCRIPTIONS (Supabase) ====================

    async savePrescription(analysis) {
        const prescription = {
            referent_id: this.authProfile.id,
            beneficiaire: { ...this.userInfo },
            answers: { ...this.answers },
            results: {
                eligibilite: { status: analysis.eligibilite.status },
                priorite: { niveau: analysis.priorite.niveau, score: analysis.priorite.score, maxScore: analysis.priorite.maxScore, details: analysis.priorite.details },
                maturite: { status: analysis.maturite.status, score: analysis.maturite.score }
            },
            timer_seconds: this.timerSeconds
        };
        try {
            if (this.editingPrescriptionId) {
                // Mode édition : mettre à jour la prescription existante
                const { error } = await supabaseClient
                    .from('prescriptions')
                    .update(prescription)
                    .eq('id', this.editingPrescriptionId);
                if (error) console.error('Erreur mise à jour prescription:', error);
            } else {
                // Nouveau questionnaire : insérer
                const { error } = await supabaseClient.from('prescriptions').insert(prescription);
                if (error) console.error('Erreur sauvegarde prescription:', error);
            }
        } catch (e) {
            console.error('Erreur sauvegarde prescription:', e);
        }
        return prescription;
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
        // Référent
        document.getElementById('referent-select').addEventListener('change', (e) => {
            this.selectReferent(e.target.value);
            this.autoSave();
        });

        // Identite
        document.getElementById('user-civilite').addEventListener('change', (e) => {
            this.userInfo.civilite = e.target.value;
            this.autoSave();
        });
        document.getElementById('user-prenom').addEventListener('input', (e) => {
            this.userInfo.prenom = e.target.value.trim();
            this.updateCepButton();
            this.autoSave();
        });
        document.getElementById('user-nom').addEventListener('input', (e) => {
            this.userInfo.nom = e.target.value.trim();
            this.updateCepButton();
            this.autoSave();
        });
        document.getElementById('user-code-interne').addEventListener('input', (e) => {
            this.userInfo.codeInterne = e.target.value.trim();
            this.autoSave();
        });
        // Employeur avec autocomplétion API Recherche d'Entreprises
        const employeurInput = document.getElementById('user-employeur');
        const employeurDropdown = document.getElementById('employeur-dropdown');
        employeurInput.addEventListener('input', () => {
            const term = employeurInput.value.trim();
            this.userInfo.employeur = term;
            // Réinitialiser SIRET quand l'utilisateur tape
            document.getElementById('user-siret').value = '';
            this.userInfo.siret = '';
            clearTimeout(this.employeurSearchTimeout);
            if (term.length >= 3) {
                this.employeurSearchTimeout = setTimeout(() => {
                    this.searchEntreprise(term, employeurDropdown, employeurInput);
                }, 300);
            } else {
                employeurDropdown.style.display = 'none';
            }
        });

        document.getElementById('user-email').addEventListener('input', (e) => {
            this.userInfo.email = e.target.value.trim();
            this.updateCepButton();
            this.autoSave();
        });
        document.getElementById('user-tel').addEventListener('input', (e) => {
            this.userInfo.tel = e.target.value.trim();
            this.updateCepButton();
            this.autoSave();
        });
        document.getElementById('user-cp').addEventListener('input', (e) => {
            this.userInfo.cp = e.target.value.trim();
            this.updateCepButton();
            this.autoSave();
        });
        document.getElementById('cep-btn').addEventListener('click', () => this.openCepForm());

        // Resultats
        document.getElementById('show-results-btn').addEventListener('click', () => this.showResults());
        document.getElementById('download-pdf-btn').addEventListener('click', () => this.downloadPDF());
        document.getElementById('new-questionnaire-btn').addEventListener('click', () => this.newQuestionnaire());
        document.getElementById('back-to-dashboard-btn').addEventListener('click', () => this.goToDashboard());

        // Fermer les dropdowns autocomplete en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-wrapper')) {
                document.querySelectorAll('.autocomplete-dropdown').forEach(d => d.style.display = 'none');
            }
        });
    }

    // ==================== DEMANDE CEP AVENIR ACTIFS ====================

    updateCepButton() {
        const { prenom, nom, email, tel } = this.userInfo;
        const visible = prenom && nom && email && tel;
        document.getElementById('cep-block').style.display = visible ? '' : 'none';
    }

    openCepForm() {
        const nom    = document.getElementById('user-nom').value.trim();
        const prenom = document.getElementById('user-prenom').value.trim();
        const email  = document.getElementById('user-email').value.trim();
        const tel    = document.getElementById('user-tel').value.trim();
        const cp     = document.getElementById('user-cp').value.trim();
        const params = new URLSearchParams();
        if (nom)    params.set('nom', nom);
        if (prenom) params.set('prenom', prenom);
        if (email)  params.set('email', email);
        if (tel)    params.set('tel', tel);
        if (cp)     params.set('cp', cp);
        window.open('https://web.sirom.net/portail_cep/public/engagement-cep-form/17?' + params.toString(), '_blank');
    }

    // ==================== RÉSULTATS ====================

    showResults() {
        if (!this.userInfo.prenom || !this.userInfo.nom) {
            alert('Veuillez renseigner le prénom et le nom du bénéficiaire.');
            document.getElementById('user-prenom').focus();
            return;
        }
        if (!this.referent.id) {
            alert('Veuillez sélectionner un référent Transitions Pro PACA.');
            document.getElementById('referent-select').focus();
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

        // Sauvegarder la prescription dans le CRM
        this.savePrescription(analysis);

        let prioriteDetailsHTML = '';
        if (analysis.priorite.details && analysis.priorite.details.length > 0) {
            prioriteDetailsHTML = '<ul style="margin-top: 10px; font-size: 0.9em;">';
            analysis.priorite.details.forEach(detail => {
                prioriteDetailsHTML += `<li><strong>${detail.code}</strong> — ${detail.libelle} : +${detail.points} pt${detail.points > 1 ? 's' : ''}</li>`;
            });
            prioriteDetailsHTML += '</ul>';
        }

        // Déterminer projet interne/externe
        const q23Analysis = analysis.maturite.q23Analysis;
        const projetInterne = q23Analysis?.projetInterne || false;
        const typeProjetLabel = projetInterne ? 'Projet interne (reconversion chez le même employeur)' : 'Projet externe (changement d\'employeur)';
        const typeProjetClass = projetInterne ? 'alert-info' : 'alert-warning';

        // Niveau de priorité avec badge coloré
        const niveauColors = {
            'Priorité renforcée': { bg: '#d1fae5', color: '#065f46' },
            'Priorité confirmée': { bg: '#dbeafe', color: '#1e40af' },
            'En bonne voie': { bg: '#fef3c7', color: '#92400e' },
            'À consolider': { bg: '#fed7aa', color: '#9a3412' },
            'À renforcer': { bg: '#fee2e2', color: '#991b1b' }
        };
        const niveauStyle = niveauColors[analysis.priorite.niveau] || niveauColors['Moyenne'];

        summaryDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: var(--bg-color); border-radius: 8px;">
                <p style="font-size: 1.3em; color: var(--primary-color); margin: 0;"><strong>${this.userInfo.prenom} ${this.userInfo.nom}</strong></p>
                ${this.userInfo.employeur ? `<p style="font-size: 0.95em; color: var(--text-color); margin-top: 4px;">Employeur : ${this.userInfo.employeur}${this.userInfo.siret ? ` <span style="color: var(--text-light); font-size: 0.85em;">(SIRET ${this.userInfo.siret})</span>` : ''}</p>` : ''}
                ${this.userInfo.codeInterne ? `<p style="font-size: 0.9em; color: var(--text-light); margin-top: 4px;">Code interne : ${this.userInfo.codeInterne}</p>` : ''}
            </div>
            <div class="result-card">
                <h3>Éligibilité</h3>
                <p><strong>${analysis.eligibilite.status}</strong></p>
                <p>${analysis.eligibilite.details}</p>
                ${this.generateEligibiliteCDDCDIHTML(analysis.eligibilite.eligibiliteCDDCDI)}
                ${this.generateQ1dAlertHTML()}
                ${this.generateQ1aAlertHTML(analysis.eligibilite.q1aAnalysis)}
                ${this.generateQ1bAlertHTML(analysis.eligibilite.q1bAnalysis)}
                ${this.generateQ3bAlertHTML(analysis.eligibilite.q3bAnalysis)}
                ${this.generateQ9AlertHTML(analysis.eligibilite.q9Analysis)}
                ${this.generateQ10bAlertHTML(analysis.eligibilite.q10bAnalysis)}
            </div>
            <div class="result-card">
                <h3>Niveau de priorité</h3>
                <p><span style="display: inline-block; padding: 4px 16px; border-radius: 20px; background: ${niveauStyle.bg}; color: ${niveauStyle.color}; font-weight: 700; font-size: 1.1em;">${analysis.priorite.niveau}</span></p>
                ${prioriteDetailsHTML}
                ${this.generateQ3aAlertHTML(analysis.priorite.q3aAnalysis)}
            </div>
            <div class="result-card">
                <h3>Type de projet</h3>
                <div class="alert ${typeProjetClass}"><strong>${typeProjetLabel}</strong></div>
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
        if (!q3b || q3b === 'Je préfère ne pas répondre') return { remunerationElevee: false };
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
        const q23 = this.answers['Q23'] || '';
        if (q13.includes('oui') || q13.includes('cléa') || q13.includes('vae') || q13.includes('cep') ||
            q23.startsWith('Oui')) {
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
        let niveau, status;
        if (score >= 15) {
            niveau = 'Priorité renforcée';
            status = 'Priorité renforcée';
        } else if (score >= 10) {
            niveau = 'Priorité confirmée';
            status = 'Priorité confirmée';
        } else if (score >= 7) {
            niveau = 'En bonne voie';
            status = 'En bonne voie';
        } else if (score >= 4) {
            niveau = 'À consolider';
            status = 'À consolider';
        } else {
            niveau = 'À renforcer';
            status = 'À renforcer';
        }

        return { score, maxScore, status, niveau, details, q3aAnalysis: this.analyzeQ3a() };
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
            return { niveau: 'faible', message: 'Le ou la salarie ne connaît pas les caractéristiques du métier visé. Il est fortement recommandé de réaliser des enquêtes métiers, des immersions professionnelles (PMSMP) ou de consulter les fiches ROME de France Travail avant de poursuivre le projet.' };
        }
        if (q15 === 'Oui' && q15a) {
            const hasImmersion = q15a.match(/immersion|stage|pmsmp|terrain|entreprise|professionnel/);
            const hasEnquete = q15a.match(/enquête|interview|rencontr|échange|professionnel|réseau/);
            const hasRecherche = q15a.match(/internet|site|rome|fiche|recherche|lu|article|vidéo/);
            const nbDemarches = (hasImmersion ? 1 : 0) + (hasEnquete ? 1 : 0) + (hasRecherche ? 1 : 0);
            if (nbDemarches >= 2) {
                return { niveau: 'bon', message: 'Le ou la salarie a mené plusieurs démarches pour connaître le métier visé (recherches, enquêtes, immersions). La connaissance du métier semble solide.' };
            }
            if (nbDemarches === 1) {
                return { niveau: 'moyen', message: 'Le ou la salarie s\'est renseigne sur le métier, mais par un seul canal. Il serait bénéfique de compléter par une immersion professionnelle (PMSMP) ou des enquêtes métiers auprès de professionnels en activité.' };
            }
            return { niveau: 'moyen', message: 'Le ou la salarie indique connaître le métier. Il serait utile de vérifier la profondeur de cette connaissance par des enquêtes métiers ou une immersion professionnelle.' };
        }
        return null;
    }

    analyzeQ16() {
        const q16 = this.answers['Q16'];
        if (q16 === 'Non') {
            return { niveau: 'faible', message: 'Le ou la salarie ne connaît pas les conditions de rémunération d\'un débutant dans ce métier. Il est important de se renseigner pour éviter toute déception : consulter les grilles salariales conventionnelles, les offres d\'emploi, ou interroger des professionnels en poste.' };
        }
        if (q16 === 'Oui') {
            return { niveau: 'bon', message: 'Le ou la salarie connaît les conditions de rémunération pour un débutant. C\'est un indicateur positif de maturité du projet.' };
        }
        return null;
    }

    analyzeQ17() {
        const q17 = this.answers['Q17'];
        if (q17 === 'Non') {
            return { niveau: 'faible', message: 'Le ou la salarie ne connaît pas le niveau d\'expérience exigé par les recruteurs. Il est essentiel de se renseigner sur les attentes du marché : certains métiers privilégient les profils expérimentés, d\'autres sont plus ouverts aux reconversions. Consulter les offres d\'emploi et interroger des recruteurs permettrait de mieux évaluer les chances d\'insertion.' };
        }
        if (q17 === 'Oui') {
            return { niveau: 'bon', message: 'Le ou la salarie connaît le niveau d\'expérience attendu par les recruteurs. Cette connaissance est un atout pour anticiper les conditions d\'accès à l\'emploi après la formation.' };
        }
        return null;
    }

    analyzeQ19() {
        const q19 = this.answers['Q19'];
        const q19a = this.answers['Q19a'] ? this.answers['Q19a'].toLowerCase() : '';
        const q19b = this.answers['Q19b'] ? this.answers['Q19b'].toLowerCase() : '';
        if (q19 === 'Non') {
            return { niveau: 'faible', message: 'Le ou la salarie n\'a pas identifié d\'inconvénients au métier visé par rapport à sa situation actuelle. Tout métier comporte des contraintes. Il est essentiel de les identifier pour éviter une déception après la reconversion : horaires, conditions de travail, contraintes physiques, rémunération de départ, éloignement géographique, perte d\'ancienneté, nouvelle période d\'essai... Nous recommandons fortement de réaliser une immersion professionnelle (PMSMP) ou des enquêtes métiers pour avoir une vision réaliste et complète.' };
        }
        if (q19 === 'Oui') {
            if (q19b && q19b.length > 5) {
                return { niveau: 'bon', message: 'Le ou la salarie a identifié des inconvénients et réfléchi à des solutions d\'adaptation. C\'est un signe de maturité du projet.' };
            }
            if (q19a && q19a.length > 5) {
                return { niveau: 'moyen', message: 'Le ou la salarie a identifié des inconvénients mais n\'a pas encore élaboré de stratégie d\'adaptation. Il serait utile de travailler sur les solutions possibles avec un conseiller CEP.' };
            }
            return { niveau: 'moyen', message: 'Le ou la salarie dit avoir identifié des inconvénients. Il est utile d\'approfondir cette réflexion pour s\'assurer d\'une vision réaliste du métier.' };
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
        const q23 = this.answers['Q23'] || '';
        if (q23 === 'Non') {
            return {
                recruteurNonIdentifie: true,
                projetInterne: false,
                niveau: 'faible',
                message: 'Le ou la salarie n\'a pas encore identifié de recruteurs potentiels. Il est vivement recommandé de mettre en place une démarche tactique : solliciter des immersions facilitées (PMSMP) ou des stages chez un employeur susceptible de recruter à l\'issue de la formation. À noter : 50% des personnes en stage se font embaucher dans la même entreprise. Cette démarche renforce considérablement le dossier et les chances de retour à l\'emploi.'
            };
        }
        if (q23.includes('projet interne')) {
            return {
                recruteurNonIdentifie: false,
                projetInterne: true,
                niveau: 'bon',
                message: 'Le ou la salarie envisage un projet interne (reconversion chez le même employeur). Ce type de projet est très favorable : il rassure la commission sur le retour à l\'emploi et peut faciliter le cofinancement par l\'employeur et son OPCO.'
            };
        }
        if (q23.includes('promesse')) {
            return {
                recruteurNonIdentifie: false,
                projetInterne: false,
                niveau: 'bon',
                message: 'Le ou la salarie dispose d\'une promesse d\'embauche. C\'est un élément très favorable pour le dossier, qui démontre la pertinence du projet et sécurise le retour à l\'emploi.'
            };
        }
        if (q23.startsWith('Oui')) {
            return {
                recruteurNonIdentifie: false,
                projetInterne: false,
                niveau: 'moyen',
                message: 'Le ou la salarie a identifié des recruteurs potentiels. Il est recommandé de solliciter une immersion facilitée (PMSMP) ou un stage chez l\'un d\'entre eux : 50% des personnes en stage se font embaucher dans la même entreprise.'
            };
        }
        return null;
    }

    // ==================== GÉNÉRATION HTML DES ALERTES ====================

    generateQ1dAlertHTML() {
        const q1d = this.answers['Q1d'];
        if (!q1d) return '';
        const dateProjet = new Date(q1d);
        const today = new Date();
        const diffMs = dateProjet - today;
        const diffJours = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (diffJours < 90) {
            return '<div class="alert alert-danger"><strong>Alerte :</strong> La date envisagée est à moins de 90 jours. Ce délai est très court pour constituer un dossier complet.</div>';
        }
        return '';
    }

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
        return '<div class="alert alert-internal"><strong>Note référent :</strong> Conditions de travail pénibles détectées. Interroger les dispositifs C2P/FIPU.</div>';
    }

    generateEligibiliteCDDCDIHTML(a) {
        if (!a) return '';
        if (a.isCDD) {
            return '<div class="alert alert-warning"><strong>Conditions d\'éligibilité CDD :</strong> À la date du départ en formation, le ou la salarie doit justifier d\'une ancienneté d\'au moins 24 mois, consécutifs ou non, en qualité de salarié de droit privé au cours des 5 dernières années, dont 120 jours (ou 4 mois) en CDD. Il doit être encore sous contrat CDD au moment du dépôt du dossier et débuter sa formation au plus tard 6 mois après la fin de son contrat.</div>';
        }
        return '<div class="alert alert-warning"><strong>Conditions d\'éligibilité CDI :</strong> À la date du départ en formation, le ou la salarie doit justifier d\'une ancienneté d\'au moins 24 mois, consécutifs ou non, en qualité de salarié de droit privé, dont 12 mois dans l\'entreprise, quelle qu\'ait été la nature des contrats de travail successifs.</div>';
    }

    generateQ10bAlertHTML(a) {
        if (!a || !a.nonParleEmployeur) return '';
        return '<div class="alert alert-internal"><strong>Note référent :</strong> Le ou la salarie n\'a pas encore informé son employeur. Alerter sur les points suivants : ne surtout pas signer de rupture conventionnelle ou solliciter une démission avant le passage du dossier devant la commission ; ne pas non plus le faire trop tôt pendant la période de formation. En revanche, il serait bienvenu d\'évoquer ces possibilités avec son employeur au moment de la demande d\'autorisation d\'absence.</div>';
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
        const niveauLabel = analysis.niveau === 'bon' ? 'Maturité solide' : analysis.niveau === 'moyen' ? 'Maturité partielle' : 'Objectiver les contraintes';
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

        p += `<li><strong>Niveau de priorité : ${analysis.priorite.niveau}</strong></li>`;

        // Type de projet
        const q23Analysis = analysis.maturite.q23Analysis;
        if (q23Analysis?.projetInterne) {
            p += '<li>Projet interne : reconversion chez le même employeur</li>';
        }

        if (analysis.priorite.niveau === 'Priorité renforcée' || analysis.priorite.niveau === 'Priorité confirmée') {
            p += '<li>Votre profil bénéficie d\'une priorité élevée pour l\'accès au dispositif</li>';
        } else if (analysis.priorite.niveau === 'En bonne voie') {
            p += '<li>Votre profil présente une bonne progression vers le dispositif</li>';
        } else {
            p += '<li>Il est recommandé d\'optimiser votre dossier pour renforcer votre priorité</li>';
        }

        if (analysis.maturite.status === 'Projet à construire') {
            p += '<li>Accompagnement CEP approfondi recommandé</li>';
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
        const margin = 15;
        let y = 15;
        const lh = 4.2;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const contentWidth = pageWidth - margin * 2;
        const date = new Date().toLocaleDateString('fr-FR');

        doc.setTextColor(0);
        doc.setDrawColor(0);

        // Titre
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Transitions Pro PACA', margin, y);
        y += 5;
        doc.setLineWidth(0.3);
        doc.line(margin, y, margin + contentWidth, y);
        y += 5;

        // Identité
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        const identLabel = this.userInfo.codeInterne ? `Réf. : ${this.userInfo.codeInterne}` : `${this.userInfo.prenom} ${this.userInfo.nom}`;
        doc.text(identLabel, margin, y);
        doc.text(`Date : ${date}`, margin + contentWidth - 30, y);
        y += lh;
        doc.text(`Référent : ${this.referent.nom}`, margin, y);
        y += lh;
        if (this.userInfo.employeur && this.userInfo.employeur.length > 0) {
            const empText = this.userInfo.siret
                ? `Employeur : ${this.userInfo.employeur} (SIRET ${this.userInfo.siret})`
                : `Employeur : ${this.userInfo.employeur}`;
            doc.text(empText, margin, y);
            y += lh;
        }
        y += 3;

        const analysis = this.analyzeAnswers();
        this.generatePDFContent(doc, analysis, y, margin, lh, pageHeight, contentWidth, date);
    }

    generatePDFContent(doc, analysis, y, margin, lh, pageHeight, contentWidth, date) {
        const textWidth = contentWidth;

        // Titre de section (texte gras souligné, pas de couleur)
        const drawSection = (title) => {
            y += 5;
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.text(title, margin, y);
            y += 1;
            doc.setLineWidth(0.2);
            doc.line(margin, y, margin + contentWidth, y);
            y += 3;
            doc.setFont(undefined, 'normal');
        };

        // Texte simple
        const drawLine = (text, indent) => {
            doc.setFontSize(7.5);
            doc.setFont(undefined, 'normal');
            const x = margin + (indent || 0);
            const lines = doc.splitTextToSize(text, textWidth - (indent || 0));
            lines.forEach(l => {
                doc.text(l, x, y);
                y += lh;
            });
        };

        // Ligne avec label gras + valeur
        const drawField = (label, value) => {
            doc.setFontSize(7.5);
            doc.setFont(undefined, 'bold');
            doc.text(label, margin + 2, y);
            const labelW = doc.getTextWidth(label + ' ');
            doc.setFont(undefined, 'normal');
            doc.text(value, margin + 2 + labelW, y);
            y += lh;
        };

        // Point (bullet)
        const drawBullet = (text) => {
            doc.setFontSize(7.5);
            doc.setFont(undefined, 'normal');
            doc.text('•', margin + 2, y);
            const lines = doc.splitTextToSize(text, textWidth - 8);
            lines.forEach(l => {
                doc.text(l, margin + 6, y);
                y += lh;
            });
        };

        // ---- ÉLIGIBILITÉ ----
        drawSection('1. ÉLIGIBILITÉ');
        drawField('Statut :', analysis.eligibilite.status);
        drawLine(analysis.eligibilite.details, 2);

        if (analysis.eligibilite.eligibiliteCDDCDI) {
            if (analysis.eligibilite.eligibiliteCDDCDI.isCDD) {
                drawBullet('Conditions CDD : ancienneté 24 mois sur 5 ans dont 4 mois en CDD ; sous contrat CDD au dépôt ; formation dans les 6 mois après fin de contrat.');
            } else {
                drawBullet('Conditions CDI : ancienneté 24 mois dont 12 mois dans l\'entreprise.');
            }
        }
        if (analysis.eligibilite.q1aAnalysis?.ancienneteInsuffisante) {
            drawBullet('Alerte : 12 mois d\'ancienneté requis à la date d\'entrée en formation.');
        }
        if (analysis.eligibilite.q1aAnalysis?.ancienneteElevee) {
            drawBullet('Alerte : ancienneté élevée — vigilance sur la mise en œuvre de la reconversion (CV, entretiens, période d\'essai, rémunération...).');
        }
        if (analysis.eligibilite.q1bAnalysis?.travailleurHandicape) {
            drawBullet('Travailleur handicapé : solliciter Cap Emploi, médecine du travail ou référent handicap de l\'organisme de formation.');
        }
        if (analysis.eligibilite.q3bAnalysis?.remunerationElevee) {
            drawBullet('Rémunération supérieure à la moyenne — risque de réaction négative de la commission. Pistes : formation hors temps de travail, organisme plus compétitif, cofinancement.');
        }

        // ---- PRIORITÉ ----
        drawSection('2. NIVEAU DE PRIORITÉ');
        drawField('Niveau :', analysis.priorite.niveau);

        if (analysis.priorite.q3aAnalysis?.ouvrierEmploye) {
            drawBullet('Statut ouvrier/employé : grandes chances de prise en charge. Accompagnement CEP vivement encouragé.');
        }
        const q23Pdf = analysis.maturite.q23Analysis;
        if (q23Pdf?.projetInterne) {
            drawBullet('Projet interne : reconversion chez le même employeur — facilite le cofinancement.');
        }

        // ---- MATURITÉ ----
        drawSection('3. MATURITÉ DU PROJET');
        drawField('Statut :', analysis.maturite.status);
        drawLine(analysis.maturite.details, 2);

        if (analysis.maturite.critere1Analysis?.renseignementNecessaire) {
            drawBullet('Renforcer la cohérence du projet : enquêtes métiers, immersions, stages.');
        }

        // Remarques CEP : titre seul, sans texte
        const cepRemarks = [
            { key: 'q15Analysis', title: 'Connaissance du métier' },
            { key: 'q16Analysis', title: 'Rémunération débutant' },
            { key: 'q17Analysis', title: 'Expérience requise' },
            { key: 'q19Analysis', title: 'Inconvénients du métier' },
            { key: 'q23Analysis', title: 'Recruteurs identifiés' }
        ];
        const activeCepRemarks = cepRemarks.filter(r => {
            const a = analysis.maturite[r.key];
            return a && a.niveau && a.message;
        });
        if (activeCepRemarks.length > 0) {
            doc.setFontSize(7.5);
            doc.setFont(undefined, 'bold');
            doc.text('Points d\'attention CEP :', margin + 2, y);
            y += lh;
            doc.setFont(undefined, 'normal');
            activeCepRemarks.forEach(r => {
                const a = analysis.maturite[r.key];
                const niveauLabel = a.niveau === 'bon' ? 'Maturité solide' : a.niveau === 'moyen' ? 'Maturité partielle' : 'Objectiver les contraintes';
                drawBullet(`${r.title} — ${niveauLabel}`);
            });
        }

        if (analysis.maturite.q21Analysis?.afficherInfoFormation) {
            doc.setFontSize(7.5);
            doc.setFont(undefined, 'normal');
            doc.text('•', margin + 2, y);
            doc.textWithLink('Comparer les organismes de formation via le guide Transitions Pro PACA.', margin + 6, y, { url: 'https://www.transitionspro-paca.fr/telechargement/10630/' });
            y += lh;
        }
        if (analysis.maturite.q22Analysis?.nombreCriteres > 0) {
            const details = analysis.maturite.q22Analysis.details.map(d => d).join(' ; ');
            drawBullet(`Vérification organisme : ${details}`);
        }

        // ---- RECOMMANDATIONS ----
        drawSection('4. RECOMMANDATIONS');
        const prescText = this.generatePrescriptionText(analysis);
        const prescLines = prescText.split('\n');
        prescLines.forEach(line => {
            if (!line.trim()) { y += 1.5; return; }
            if (line.trim().startsWith('-')) {
                drawBullet(line.replace(/^[\s\-]+/, ''));
            } else {
                drawLine(line, 2);
            }
        });

        // ---- CONTACT ----
        y += 2;
        doc.setLineWidth(0.2);
        doc.line(margin, y, margin + contentWidth, y);
        y += 4;
        drawLine('Après avoir rencontré un conseiller en évolution professionnelle (CEP), revenez vers votre référent Transitions Pro PACA :', 0);
        drawField(this.referent.nom, `Tél. : ${this.referent.tel}`);
        doc.setFontSize(7.5);
        doc.setTextColor(0);
        doc.textWithLink('Prendre RDV avec un CEP : mon-cep.org', margin, y, { url: 'https://mon-cep.org' });
        y += lh;

        // QR code mon-cep.org
        try {
            const qr = qrcode(0, 'M');
            qr.addData('https://mon-cep.org');
            qr.make();
            const qrDataUrl = qr.createDataURL(4, 0);
            const qrSize = 18;
            doc.addImage(qrDataUrl, 'PNG', margin, y, qrSize, qrSize);
            doc.setFontSize(6.5);
            doc.text('mon-cep.org', margin + qrSize / 2, y + qrSize + 3, { align: 'center' });
            y += qrSize + 5;
        } catch (e) {
            // qrcode-generator non chargé
        }

        // ---- PIED DE PAGE ----
        doc.setFontSize(6.5);
        doc.setTextColor(120);
        doc.text('Transitions Pro PACA', margin, pageHeight - 8);
        doc.text(date, margin + contentWidth / 2 - 8, pageHeight - 8);
        doc.text('Page 1/1', margin + contentWidth - 12, pageHeight - 8);
        doc.setTextColor(0);

        // Nom du fichier
        const sanitize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const fileIdent = this.userInfo.codeInterne ? sanitize(this.userInfo.codeInterne) : `${sanitize(this.userInfo.prenom)}-${sanitize(this.userInfo.nom)}`;
        const fileName = `impulsion-${fileIdent}-${date.replace(/\//g, '-')}.pdf`;
        doc.save(fileName);
    }

    generatePrescriptionText(analysis) {
        let text = 'Suite à l\'évaluation de votre projet de reconversion professionnelle :\n\n';

        if (analysis.eligibilite.status === 'Éligible') {
            text += '- Vous êtes éligible au dispositif de reconversion professionnelle\n';
        }
        text += `\nNiveau de priorité : ${analysis.priorite.niveau}\n`;

        // Type de projet
        const q23Analysis = analysis.maturite.q23Analysis;
        if (q23Analysis?.projetInterne) {
            text += '- Projet interne : reconversion chez le même employeur\n';
        }

        if (analysis.priorite.niveau === 'Priorité renforcée' || analysis.priorite.niveau === 'Priorité confirmée') {
            text += '- Votre profil bénéficie d\'une priorité élevée pour l\'accès au dispositif\n';
        } else if (analysis.priorite.niveau === 'En bonne voie') {
            text += '- Votre profil présente une priorité moyenne\n';
        }

        if (analysis.maturite.status === 'Projet à construire') {
            text += '- Accompagnement CEP approfondi recommandé\n';
            text += '- Enquêtes métier et immersions professionnelles à prévoir\n';
        } else if (analysis.maturite.status === 'Projet en développement') {
            text += '- Accompagnement CEP pour finaliser le projet\n';
            text += '- Validation du choix de formation et d\'organisme\n';
        } else {
            text += '- Projet suffisamment mature pour constituer un dossier\n';
            text += '- Accompagnement CEP pour la partie administrative et financière\n';
        }

        if (this.answers['Q1b'] === 'Oui') {
            text += '- Mobiliser CAP EMPLOI et le référent handicap\n';
        }

        text += '\nProchaines étapes :\n';
        text += '1. Présenter cette prescription à votre conseiller CEP\n';
        text += '2. Constituer votre dossier avec les pièces justificatives\n';
        text += '3. Finaliser le plan de financement\n';
        text += '4. Déposer votre demande d\'autorisation d\'absence\n';
        return text;
    }

    // ==================== ACTIONS ====================

    newQuestionnaire() {
        this.clearAutoSave();
        window.location.href = 'index.html';
    }

    goToDashboard() {
        this.clearAutoSave();
        window.location.href = 'crm.html';
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    new CEPQuestionnaire();
});
