// CRM Impulsion - Tableau de bord référent / manager
class ImpulsionCRM {
    constructor() {
        this.prescriptions = [];
        this.filteredPrescriptions = [];
        this.referents = {};
        this.sortField = 'date';
        this.sortAsc = false;
        this.isManager = false;
        this.init();
    }

    async init() {
        // Auth guard
        const profile = await auth.requireAuth();
        if (!profile) return;

        this.isManager = auth.isManager();

        // Afficher la nav utilisateur
        auth.renderUserNav(document.getElementById('user-nav'));

        // Configurer l'interface selon le rôle
        this.setupRoleUI();

        // Charger les données
        await this.loadPrescriptions();

        this.setupEventListeners();
        this.applyFilters();
    }

    // ==================== CONFIGURATION PAR RÔLE ====================

    setupRoleUI() {
        if (this.isManager) {
            // Manager : afficher le filtre référent, la colonne référent et le lien admin
            document.getElementById('filter-referent-wrapper').style.display = '';
            document.getElementById('col-referent').style.display = '';
            const adminLink = document.getElementById('admin-link');
            if (adminLink) adminLink.style.display = '';
            this.loadReferentsList();
        }
    }

    async loadReferentsList() {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, nom, email')
            .eq('role', 'referent')
            .order('nom');

        if (error || !data) return;

        const select = document.getElementById('filter-referent');
        data.forEach(r => {
            this.referents[r.id] = r;
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.nom;
            select.appendChild(opt);
        });
    }

    // ==================== CHARGEMENT SUPABASE ====================

    async loadPrescriptions() {
        let query = supabase
            .from('prescriptions')
            .select('*')
            .order('created_at', { ascending: false });

        // RLS gère déjà le filtrage : les référents ne voient que les leurs
        const { data, error } = await query;

        if (error) {
            console.error('Erreur chargement prescriptions:', error);
            this.prescriptions = [];
        } else {
            this.prescriptions = data || [];
        }

        // Si manager, charger les noms des référents pour l'affichage
        if (this.isManager && Object.keys(this.referents).length === 0) {
            const ids = [...new Set(this.prescriptions.map(p => p.referent_id))];
            if (ids.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, nom')
                    .in('id', ids);
                if (profiles) {
                    profiles.forEach(p => { this.referents[p.id] = p; });
                }
            }
        }
    }

    // ==================== FILTRES ====================

    setupEventListeners() {
        const filterIds = ['filter-referent', 'filter-statut', 'filter-priorite', 'filter-search', 'filter-date-from', 'filter-date-to'];
        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', () => this.applyFilters());
        });

        document.getElementById('export-csv-btn').addEventListener('click', () => this.exportCSV());

        // Tri par colonnes
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                if (this.sortField === field) {
                    this.sortAsc = !this.sortAsc;
                } else {
                    this.sortField = field;
                    this.sortAsc = true;
                }
                this.applyFilters();
            });
        });

        // Modal
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('detail-modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('detail-modal')) this.closeModal();
        });
    }

    applyFilters() {
        const referent = document.getElementById('filter-referent')?.value || '';
        const statut = document.getElementById('filter-statut').value;
        const priorite = document.getElementById('filter-priorite').value;
        const search = document.getElementById('filter-search').value.toLowerCase().trim();
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;

        this.filteredPrescriptions = this.prescriptions.filter(p => {
            if (referent && p.referent_id !== referent) return false;
            if (statut && p.statut !== statut) return false;
            if (priorite && p.results?.priorite?.niveau !== priorite) return false;
            if (search) {
                const b = p.beneficiaire || {};
                const haystack = [b.prenom, b.nom, b.employeur, b.codeInterne].join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            if (dateFrom && p.created_at.substring(0, 10) < dateFrom) return false;
            if (dateTo && p.created_at.substring(0, 10) > dateTo) return false;
            return true;
        });

        // Tri
        this.filteredPrescriptions.sort((a, b) => {
            let va, vb;
            switch (this.sortField) {
                case 'date':
                    va = a.created_at; vb = b.created_at; break;
                case 'beneficiaire':
                    va = ((a.beneficiaire?.nom || '') + (a.beneficiaire?.prenom || '')).toLowerCase();
                    vb = ((b.beneficiaire?.nom || '') + (b.beneficiaire?.prenom || '')).toLowerCase();
                    break;
                case 'referent':
                    va = (this.referents[a.referent_id]?.nom || '').toLowerCase();
                    vb = (this.referents[b.referent_id]?.nom || '').toLowerCase();
                    break;
                case 'priorite':
                    const ordreP = { 'Très haute': 5, 'Haute': 4, 'Moyenne': 3, 'Faible': 2, 'Très faible': 1 };
                    va = ordreP[a.results?.priorite?.niveau] || 0;
                    vb = ordreP[b.results?.priorite?.niveau] || 0;
                    break;
                case 'statut':
                    const ordreS = { 'prescrit': 1, 'oriente_cep': 2, 'dossier_en_cours': 3, 'commission': 4, 'valide': 5, 'refuse': 6 };
                    va = ordreS[a.statut] || 0;
                    vb = ordreS[b.statut] || 0;
                    break;
                case 'maturite':
                    const ordreM = { 'Projet mature': 3, 'Projet en développement': 2, 'Projet à construire': 1 };
                    va = ordreM[a.results?.maturite?.status] || 0;
                    vb = ordreM[b.results?.maturite?.status] || 0;
                    break;
                default:
                    va = a.created_at; vb = b.created_at;
            }
            if (va < vb) return this.sortAsc ? -1 : 1;
            if (va > vb) return this.sortAsc ? 1 : -1;
            return 0;
        });

        this.updateStats();
        this.renderTable();
    }

    // ==================== STATISTIQUES ====================

    updateStats() {
        const data = this.filteredPrescriptions;
        document.getElementById('stat-total').textContent = data.length;
        document.getElementById('stat-haute').textContent = data.filter(p => ['Très haute', 'Haute'].includes(p.results?.priorite?.niveau)).length;
        document.getElementById('stat-moyenne').textContent = data.filter(p => p.results?.priorite?.niveau === 'Moyenne').length;
        document.getElementById('stat-faible').textContent = data.filter(p => ['Faible', 'Très faible'].includes(p.results?.priorite?.niveau)).length;
        document.getElementById('stat-mature').textContent = data.filter(p => p.results?.maturite?.status === 'Projet mature').length;
        document.getElementById('crm-count').textContent = `${data.length} resultat(s)`;
    }

    // ==================== RENDU TABLEAU ====================

    renderTable() {
        const tbody = document.getElementById('crm-tbody');
        const emptyMsg = document.getElementById('crm-empty');
        const tableWrapper = document.querySelector('.crm-table-wrapper');

        if (this.filteredPrescriptions.length === 0) {
            tbody.innerHTML = '';
            tableWrapper.style.display = 'none';
            emptyMsg.style.display = 'block';
            return;
        }

        tableWrapper.style.display = '';
        emptyMsg.style.display = 'none';

        tbody.innerHTML = this.filteredPrescriptions.map(p => {
            const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const heure = new Date(p.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const b = p.beneficiaire || {};
            const nom = `${b.prenom || ''} ${b.nom || ''}`.trim();
            const employeur = b.employeur || '-';
            const referentNom = this.referents[p.referent_id]?.nom || '-';
            const prioriteBadge = this.getPrioriteBadge(p.results?.priorite?.niveau);
            const statutBadge = this.getStatutBadge(p.statut);
            const maturiteBadge = this.getMaturiteBadge(p.results?.maturite?.status);
            const referentCol = this.isManager ? `<td>${this.escapeHtml(referentNom)}</td>` : '';

            return `<tr>
                <td><span style="white-space:nowrap;">${date}</span><br><span style="font-size:0.75rem;color:var(--text-light);">${heure}</span></td>
                <td><strong>${this.escapeHtml(nom)}</strong>${b.codeInterne ? `<br><span style="font-size:0.75rem;color:var(--text-light);">${this.escapeHtml(b.codeInterne)}</span>` : ''}</td>
                <td>${this.escapeHtml(employeur)}</td>
                ${referentCol}
                <td>${prioriteBadge}</td>
                <td>${statutBadge}</td>
                <td>${maturiteBadge}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-icon" onclick="crm.showDetail('${p.id}')">Detail</button>
                        <button class="btn-icon" onclick="crm.showEditStatut('${p.id}')">Statut</button>
                        <button class="btn-icon btn-delete" onclick="crm.deletePrescription('${p.id}')">Suppr.</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    getPrioriteBadge(niveau) {
        const classes = {
            'Très haute': 'badge-tres-haute', 'Haute': 'badge-haute',
            'Moyenne': 'badge-moyenne', 'Faible': 'badge-faible', 'Très faible': 'badge-tres-faible'
        };
        return `<span class="badge ${classes[niveau] || ''}">${niveau || '-'}</span>`;
    }

    getStatutBadge(statut) {
        const labels = {
            'prescrit': 'Prescrit', 'oriente_cep': 'Oriente CEP',
            'dossier_en_cours': 'Dossier en cours', 'commission': 'Commission',
            'valide': 'Valide', 'refuse': 'Refuse'
        };
        const classes = {
            'prescrit': 'badge-prescrit', 'oriente_cep': 'badge-oriente',
            'dossier_en_cours': 'badge-dossier', 'commission': 'badge-commission',
            'valide': 'badge-valide', 'refuse': 'badge-refuse'
        };
        return `<span class="badge ${classes[statut] || ''}">${labels[statut] || statut || '-'}</span>`;
    }

    getMaturiteBadge(status) {
        const labels = { 'Projet mature': 'Mature', 'Projet en développement': 'En dev.', 'Projet à construire': 'A construire' };
        const classes = { 'Projet mature': 'badge-mature', 'Projet en développement': 'badge-developpement', 'Projet à construire': 'badge-construire' };
        return `<span class="badge ${classes[status] || ''}">${labels[status] || status || '-'}</span>`;
    }

    formatDuree(seconds) {
        if (!seconds) return '-';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}min${s > 0 ? ` ${s}s` : ''}`;
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== DETAIL ====================

    showDetail(id) {
        const p = this.prescriptions.find(x => x.id === id);
        if (!p) return;

        const date = new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const b = p.beneficiaire || {};
        const referentNom = this.referents[p.referent_id]?.nom || auth.profile.nom;

        document.getElementById('modal-title').textContent = `${b.prenom || ''} ${b.nom || ''}`;

        let html = `
            <div class="detail-section">
                <h3>Informations generales</h3>
                <div class="detail-row"><span class="label">Date</span><span class="value">${date}</span></div>
                <div class="detail-row"><span class="label">Referent</span><span class="value">${this.escapeHtml(referentNom)}</span></div>
                <div class="detail-row"><span class="label">Statut</span><span class="value">${this.getStatutBadge(p.statut)}</span></div>
                ${b.codeInterne ? `<div class="detail-row"><span class="label">Code interne</span><span class="value">${this.escapeHtml(b.codeInterne)}</span></div>` : ''}
                ${b.employeur ? `<div class="detail-row"><span class="label">Employeur</span><span class="value">${this.escapeHtml(b.employeur)}</span></div>` : ''}
                ${b.siret ? `<div class="detail-row"><span class="label">SIRET</span><span class="value">${b.siret}</span></div>` : ''}
                <div class="detail-row"><span class="label">Duree de l'entretien</span><span class="value">${this.formatDuree(p.timer_seconds)}</span></div>
            </div>
            <div class="detail-section">
                <h3>Resultats</h3>
                <div class="detail-row"><span class="label">Eligibilite</span><span class="value">${p.results?.eligibilite?.status || '-'}</span></div>
                <div class="detail-row"><span class="label">Priorite</span><span class="value">${this.getPrioriteBadge(p.results?.priorite?.niveau)} (${p.results?.priorite?.score || 0}/${p.results?.priorite?.maxScore || 20} pts)</span></div>
                <div class="detail-row"><span class="label">Maturite</span><span class="value">${this.getMaturiteBadge(p.results?.maturite?.status)}</span></div>
            </div>
        `;

        // Detail des points de priorité
        const details = p.results?.priorite?.details;
        if (details && details.length > 0) {
            html += `<div class="detail-section"><h3>Detail des points de priorite</h3>`;
            details.forEach(d => {
                html += `<div class="detail-row"><span class="label">${d.code} - ${d.libelle}</span><span class="value">+${d.points} pt${d.points > 1 ? 's' : ''}</span></div>`;
            });
            html += `</div>`;
        }

        // Notes
        html += `
            <div class="detail-section">
                <h3>Notes de suivi</h3>
                <textarea id="detail-notes" class="inline-textarea" rows="3" placeholder="Ajouter des notes de suivi...">${this.escapeHtml(p.notes || '')}</textarea>
                <button class="btn btn-primary" style="margin-top: 8px; padding: 8px 16px; font-size: 0.85rem;" onclick="crm.saveNotes('${p.id}')">Enregistrer les notes</button>
            </div>
        `;

        // Réponses au questionnaire
        if (p.answers && Object.keys(p.answers).length > 0) {
            html += `<div class="detail-section"><h3>Reponses au questionnaire</h3>`;
            Object.entries(p.answers).forEach(([qId, answer]) => {
                const displayAnswer = answer.length > 100 ? answer.substring(0, 100) + '...' : answer;
                html += `<div class="detail-row"><span class="label">${qId}</span><span class="value">${this.escapeHtml(displayAnswer)}</span></div>`;
            });
            html += `</div>`;
        }

        // Modifier le bénéficiaire
        html += `
            <div class="detail-section">
                <h3>Modifier le beneficiaire</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label class="filter-field-label" style="font-size:0.8rem;font-weight:600;color:var(--text-light);">Prenom</label>
                        <input type="text" id="edit-prenom" class="inline-input" value="${this.escapeHtml(b.prenom || '')}">
                    </div>
                    <div>
                        <label class="filter-field-label" style="font-size:0.8rem;font-weight:600;color:var(--text-light);">Nom</label>
                        <input type="text" id="edit-nom" class="inline-input" value="${this.escapeHtml(b.nom || '')}">
                    </div>
                    <div>
                        <label class="filter-field-label" style="font-size:0.8rem;font-weight:600;color:var(--text-light);">Employeur</label>
                        <input type="text" id="edit-employeur" class="inline-input" value="${this.escapeHtml(b.employeur || '')}">
                    </div>
                    <div>
                        <label class="filter-field-label" style="font-size:0.8rem;font-weight:600;color:var(--text-light);">Code interne</label>
                        <input type="text" id="edit-code" class="inline-input" value="${this.escapeHtml(b.codeInterne || '')}">
                    </div>
                </div>
                <button class="btn btn-primary" style="margin-top: 10px; padding: 8px 16px; font-size: 0.85rem;" onclick="crm.saveBeneficiaire('${p.id}')">Enregistrer les modifications</button>
            </div>
        `;

        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('detail-modal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('detail-modal').style.display = 'none';
    }

    // ==================== CHANGEMENT DE STATUT ====================

    showEditStatut(id) {
        const p = this.prescriptions.find(x => x.id === id);
        if (!p) return;

        const b = p.beneficiaire || {};
        document.getElementById('modal-title').textContent = `Statut - ${b.prenom || ''} ${b.nom || ''}`;

        const statuts = [
            { value: 'prescrit', label: 'Prescrit', desc: 'Prescription generee' },
            { value: 'oriente_cep', label: 'Oriente CEP', desc: 'Beneficiaire oriente vers un conseiller CEP' },
            { value: 'dossier_en_cours', label: 'Dossier en cours', desc: 'Constitution du dossier en cours' },
            { value: 'commission', label: 'Commission', desc: 'Dossier soumis a la commission paritaire' },
            { value: 'valide', label: 'Valide', desc: 'Projet valide par la commission' },
            { value: 'refuse', label: 'Refuse', desc: 'Projet refuse par la commission' }
        ];

        let html = '<div class="detail-section"><h3>Changer le statut du dossier</h3><div class="statut-timeline">';
        statuts.forEach(s => {
            const isCurrent = p.statut === s.value;
            html += `
                <button class="statut-step ${isCurrent ? 'statut-current' : ''}"
                        onclick="crm.updateStatut('${p.id}', '${s.value}')">
                    <span class="statut-step-label">${s.label}</span>
                    <span class="statut-step-desc">${s.desc}</span>
                </button>
            `;
        });
        html += '</div></div>';

        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('detail-modal').style.display = 'flex';
    }

    async updateStatut(id, newStatut) {
        const { error } = await supabase
            .from('prescriptions')
            .update({ statut: newStatut })
            .eq('id', id);

        if (error) {
            alert('Erreur lors de la mise a jour du statut.');
            console.error(error);
            return;
        }

        // Mettre à jour localement
        const p = this.prescriptions.find(x => x.id === id);
        if (p) p.statut = newStatut;
        this.closeModal();
        this.applyFilters();
    }

    // ==================== SAUVEGARDE NOTES ====================

    async saveNotes(id) {
        const notes = document.getElementById('detail-notes').value;
        const { error } = await supabase
            .from('prescriptions')
            .update({ notes })
            .eq('id', id);

        if (error) {
            alert('Erreur lors de la sauvegarde des notes.');
            return;
        }

        const p = this.prescriptions.find(x => x.id === id);
        if (p) p.notes = notes;
        alert('Notes enregistrees.');
    }

    // ==================== MODIFICATION BÉNÉFICIAIRE ====================

    async saveBeneficiaire(id) {
        const p = this.prescriptions.find(x => x.id === id);
        if (!p) return;

        const beneficiaire = {
            ...p.beneficiaire,
            prenom: document.getElementById('edit-prenom').value.trim(),
            nom: document.getElementById('edit-nom').value.trim(),
            employeur: document.getElementById('edit-employeur').value.trim(),
            codeInterne: document.getElementById('edit-code').value.trim()
        };

        const { error } = await supabase
            .from('prescriptions')
            .update({ beneficiaire })
            .eq('id', id);

        if (error) {
            alert('Erreur lors de la modification.');
            return;
        }

        p.beneficiaire = beneficiaire;
        this.closeModal();
        this.applyFilters();
    }

    // ==================== SUPPRESSION ====================

    async deletePrescription(id) {
        if (!confirm('Supprimer cette prescription ?')) return;

        const { error } = await supabase
            .from('prescriptions')
            .delete()
            .eq('id', id);

        if (error) {
            alert('Erreur lors de la suppression.');
            return;
        }

        this.prescriptions = this.prescriptions.filter(p => p.id !== id);
        this.applyFilters();
    }

    // ==================== EXPORT CSV ====================

    exportCSV() {
        if (this.filteredPrescriptions.length === 0) {
            alert('Aucune donnee a exporter.');
            return;
        }

        const headers = [
            'Date', 'Heure', 'Civilite', 'Prenom', 'Nom', 'Code interne',
            'Employeur', 'SIRET', 'Referent',
            'Eligibilite', 'Priorite', 'Score priorite',
            'Maturite', 'Statut', 'Notes'
        ];

        const rows = this.filteredPrescriptions.map(p => {
            const d = new Date(p.created_at);
            const b = p.beneficiaire || {};
            const referentNom = this.referents[p.referent_id]?.nom || auth.profile.nom;
            return [
                d.toLocaleDateString('fr-FR'),
                d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                b.civilite || '',
                b.prenom || '',
                b.nom || '',
                b.codeInterne || '',
                b.employeur || '',
                b.siret || '',
                referentNom,
                p.results?.eligibilite?.status || '',
                p.results?.priorite?.niveau || '',
                p.results?.priorite?.score || 0,
                p.results?.maturite?.status || '',
                p.statut || '',
                (p.notes || '').replace(/\n/g, ' ')
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
            .join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `impulsion-export-${new Date().toISOString().substring(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// Initialiser le CRM
let crm;
document.addEventListener('DOMContentLoaded', () => {
    crm = new ImpulsionCRM();
});
