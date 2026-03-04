// CRM Impulsion - Tableau de bord référent
class ImpulsionCRM {
    constructor() {
        this.prescriptions = [];
        this.filteredPrescriptions = [];
        this.sortField = 'date';
        this.sortAsc = false;
        this.init();
    }

    init() {
        this.loadPrescriptions();
        this.setupEventListeners();
        this.applyFilters();
    }

    // ==================== CHARGEMENT ====================

    loadPrescriptions() {
        try {
            this.prescriptions = JSON.parse(localStorage.getItem('impulsion_prescriptions') || '[]');
        } catch (e) {
            this.prescriptions = [];
        }
    }

    // ==================== FILTRES ====================

    setupEventListeners() {
        document.getElementById('filter-referent').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-priorite').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-maturite').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-search').addEventListener('input', () => this.applyFilters());
        document.getElementById('filter-date-from').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-date-to').addEventListener('change', () => this.applyFilters());

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
        const referent = document.getElementById('filter-referent').value;
        const priorite = document.getElementById('filter-priorite').value;
        const maturite = document.getElementById('filter-maturite').value;
        const search = document.getElementById('filter-search').value.toLowerCase().trim();
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;

        this.filteredPrescriptions = this.prescriptions.filter(p => {
            if (referent && p.referent.id !== referent) return false;
            if (priorite && p.results.priorite.niveau !== priorite) return false;
            if (maturite && p.results.maturite.status !== maturite) return false;
            if (search) {
                const haystack = [
                    p.beneficiaire.prenom,
                    p.beneficiaire.nom,
                    p.beneficiaire.employeur,
                    p.beneficiaire.codeInterne,
                    p.referent.nom
                ].join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            if (dateFrom) {
                const pDate = p.date.substring(0, 10);
                if (pDate < dateFrom) return false;
            }
            if (dateTo) {
                const pDate = p.date.substring(0, 10);
                if (pDate > dateTo) return false;
            }
            return true;
        });

        // Tri
        this.filteredPrescriptions.sort((a, b) => {
            let va, vb;
            switch (this.sortField) {
                case 'date':
                    va = a.date; vb = b.date; break;
                case 'beneficiaire':
                    va = (a.beneficiaire.nom + a.beneficiaire.prenom).toLowerCase();
                    vb = (b.beneficiaire.nom + b.beneficiaire.prenom).toLowerCase();
                    break;
                case 'referent':
                    va = a.referent.nom.toLowerCase();
                    vb = b.referent.nom.toLowerCase();
                    break;
                case 'priorite':
                    const ordreP = { 'Très haute': 5, 'Haute': 4, 'Moyenne': 3, 'Faible': 2, 'Très faible': 1 };
                    va = ordreP[a.results.priorite.niveau] || 0;
                    vb = ordreP[b.results.priorite.niveau] || 0;
                    break;
                case 'maturite':
                    const ordreM = { 'Projet mature': 3, 'Projet en développement': 2, 'Projet à construire': 1 };
                    va = ordreM[a.results.maturite.status] || 0;
                    vb = ordreM[b.results.maturite.status] || 0;
                    break;
                default:
                    va = a.date; vb = b.date;
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

        const haute = data.filter(p => p.results.priorite.niveau === 'Très haute' || p.results.priorite.niveau === 'Haute').length;
        const moyenne = data.filter(p => p.results.priorite.niveau === 'Moyenne').length;
        const faible = data.filter(p => p.results.priorite.niveau === 'Faible' || p.results.priorite.niveau === 'Très faible').length;
        const mature = data.filter(p => p.results.maturite.status === 'Projet mature').length;

        document.getElementById('stat-haute').textContent = haute;
        document.getElementById('stat-moyenne').textContent = moyenne;
        document.getElementById('stat-faible').textContent = faible;
        document.getElementById('stat-mature').textContent = mature;

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
            const date = new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const heure = new Date(p.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const nom = `${p.beneficiaire.prenom} ${p.beneficiaire.nom}`;
            const employeur = p.beneficiaire.employeur || '-';
            const referent = p.referent.nom || '-';
            const prioriteBadge = this.getPrioriteBadge(p.results.priorite.niveau);
            const maturiteBadge = this.getMaturiteBadge(p.results.maturite.status);
            const duree = this.formatDuree(p.timerSeconds);

            return `<tr>
                <td><span style="white-space:nowrap;">${date}</span><br><span style="font-size:0.75rem;color:var(--text-light);">${heure}</span></td>
                <td><strong>${this.escapeHtml(nom)}</strong>${p.beneficiaire.codeInterne ? `<br><span style="font-size:0.75rem;color:var(--text-light);">${this.escapeHtml(p.beneficiaire.codeInterne)}</span>` : ''}</td>
                <td>${this.escapeHtml(employeur)}</td>
                <td>${this.escapeHtml(referent)}</td>
                <td>${prioriteBadge}</td>
                <td>${maturiteBadge}</td>
                <td>${duree}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-icon" onclick="crm.showDetail('${p.id}')">Detail</button>
                        <button class="btn-icon btn-delete" onclick="crm.deletePrescription('${p.id}')">Suppr.</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    getPrioriteBadge(niveau) {
        const classes = {
            'Très haute': 'badge-tres-haute',
            'Haute': 'badge-haute',
            'Moyenne': 'badge-moyenne',
            'Faible': 'badge-faible',
            'Très faible': 'badge-tres-faible'
        };
        return `<span class="badge ${classes[niveau] || ''}">${niveau}</span>`;
    }

    getMaturiteBadge(status) {
        const labels = {
            'Projet mature': 'Mature',
            'Projet en développement': 'En dev.',
            'Projet à construire': 'A construire'
        };
        const classes = {
            'Projet mature': 'badge-mature',
            'Projet en développement': 'badge-developpement',
            'Projet à construire': 'badge-construire'
        };
        return `<span class="badge ${classes[status] || ''}">${labels[status] || status}</span>`;
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

        const date = new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        document.getElementById('modal-title').textContent = `${p.beneficiaire.prenom} ${p.beneficiaire.nom}`;

        let html = `
            <div class="detail-section">
                <h3>Informations generales</h3>
                <div class="detail-row"><span class="label">Date</span><span class="value">${date}</span></div>
                <div class="detail-row"><span class="label">Referent</span><span class="value">${this.escapeHtml(p.referent.nom)}</span></div>
                ${p.beneficiaire.codeInterne ? `<div class="detail-row"><span class="label">Code interne</span><span class="value">${this.escapeHtml(p.beneficiaire.codeInterne)}</span></div>` : ''}
                ${p.beneficiaire.employeur ? `<div class="detail-row"><span class="label">Employeur</span><span class="value">${this.escapeHtml(p.beneficiaire.employeur)}</span></div>` : ''}
                ${p.beneficiaire.siret ? `<div class="detail-row"><span class="label">SIRET</span><span class="value">${p.beneficiaire.siret}</span></div>` : ''}
                <div class="detail-row"><span class="label">Duree de l'entretien</span><span class="value">${this.formatDuree(p.timerSeconds)}</span></div>
            </div>
            <div class="detail-section">
                <h3>Resultats</h3>
                <div class="detail-row"><span class="label">Eligibilite</span><span class="value">${p.results.eligibilite.status}</span></div>
                <div class="detail-row"><span class="label">Priorite</span><span class="value">${this.getPrioriteBadge(p.results.priorite.niveau)} (${p.results.priorite.score}/${p.results.priorite.maxScore} pts)</span></div>
                <div class="detail-row"><span class="label">Maturite</span><span class="value">${this.getMaturiteBadge(p.results.maturite.status)}</span></div>
            </div>
        `;

        // Detail des points de priorite
        if (p.results.priorite.details && p.results.priorite.details.length > 0) {
            html += `<div class="detail-section"><h3>Detail des points de priorite</h3>`;
            p.results.priorite.details.forEach(d => {
                html += `<div class="detail-row"><span class="label">${d.code} - ${d.libelle}</span><span class="value">+${d.points} pt${d.points > 1 ? 's' : ''}</span></div>`;
            });
            html += `</div>`;
        }

        // Reponses au questionnaire
        if (p.answers && Object.keys(p.answers).length > 0) {
            html += `<div class="detail-section"><h3>Reponses</h3>`;
            Object.entries(p.answers).forEach(([qId, answer]) => {
                const displayAnswer = answer.length > 80 ? answer.substring(0, 80) + '...' : answer;
                html += `<div class="detail-row"><span class="label">${qId}</span><span class="value">${this.escapeHtml(displayAnswer)}</span></div>`;
            });
            html += `</div>`;
        }

        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('detail-modal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('detail-modal').style.display = 'none';
    }

    // ==================== SUPPRESSION ====================

    deletePrescription(id) {
        if (!confirm('Supprimer cette prescription ?')) return;
        this.prescriptions = this.prescriptions.filter(p => p.id !== id);
        try {
            localStorage.setItem('impulsion_prescriptions', JSON.stringify(this.prescriptions));
        } catch (e) {}
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
            'Maturite', 'Duree (min)'
        ];

        const rows = this.filteredPrescriptions.map(p => {
            const d = new Date(p.date);
            return [
                d.toLocaleDateString('fr-FR'),
                d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                p.beneficiaire.civilite || '',
                p.beneficiaire.prenom || '',
                p.beneficiaire.nom || '',
                p.beneficiaire.codeInterne || '',
                p.beneficiaire.employeur || '',
                p.beneficiaire.siret || '',
                p.referent.nom || '',
                p.results.eligibilite.status || '',
                p.results.priorite.niveau || '',
                p.results.priorite.score || 0,
                p.results.maturite.status || '',
                p.timerSeconds ? Math.round(p.timerSeconds / 60) : 0
            ];
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
            .join('\n');

        // BOM UTF-8 pour Excel
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().substring(0, 10);
        link.download = `impulsion-export-${dateStr}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// Initialiser le CRM
let crm;
document.addEventListener('DOMContentLoaded', () => {
    crm = new ImpulsionCRM();
});
