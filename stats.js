// Statistiques Impulsion
class ImpulsionStats {
    constructor() {
        this.prescriptions = [];
        this.referents = {};
        this.isManager = false;
        this.init();
    }

    async init() {
        const profile = await auth.requireAuth();
        if (!profile) return;

        this.isManager = auth.isManager();
        auth.renderUserNav(document.getElementById('user-nav'));

        if (this.isManager) {
            document.getElementById('filter-referent-wrapper').style.display = '';
            await this.loadReferents();
        }

        await this.loadPrescriptions();
        document.getElementById('apply-filters-btn').addEventListener('click', () => this.render());
        this.render();
        document.body.style.display = '';
    }

    async loadReferents() {
        const { data } = await supabaseClient
            .from('profiles')
            .select('id, nom')
            .eq('role', 'referent')
            .order('nom');
        if (!data) return;
        data.forEach(r => { this.referents[r.id] = r.nom; });
        const sel = document.getElementById('filter-referent');
        data.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.nom;
            sel.appendChild(opt);
        });
    }

    async loadPrescriptions() {
        const { data } = await supabaseClient
            .from('prescriptions')
            .select('*')
            .order('created_at', { ascending: true });
        this.prescriptions = data || [];
    }

    getFiltered() {
        const referent = document.getElementById('filter-referent')?.value || '';
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;
        return this.prescriptions.filter(p => {
            if (referent && p.referent_id !== referent) return false;
            if (dateFrom && p.created_at.substring(0, 10) < dateFrom) return false;
            if (dateTo && p.created_at.substring(0, 10) > dateTo) return false;
            return true;
        });
    }

    render() {
        const data = this.getFiltered();
        this.renderOverview(data);
        this.renderDuree(data);
        this.renderCEP(data);
        this.renderSatisfaction(data);
        this.renderPriorites(data);
        this.renderStatuts(data);
        this.renderMaturite(data);
        this.renderTransformation(data);
    }

    // ==================== UTILITAIRES ====================

    formatDuree(seconds) {
        if (!seconds) return '-';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}min${s > 0 ? ` ${s}s` : ''}`;
    }

    pct(count, total) {
        if (!total) return 0;
        return Math.round((count / total) * 100);
    }

    referentNom(id) {
        return this.referents[id] || (this.isManager ? 'Inconnu' : 'Vous');
    }

    bar(label, count, total, colorClass) {
        const p = this.pct(count, total);
        return `
            <div class="stats-bar-row">
                <span class="stats-bar-label">${label}</span>
                <div class="stats-bar-track">
                    <div class="stats-bar-fill ${colorClass}" style="width:${p}%"></div>
                </div>
                <span class="stats-bar-count">${count} <span class="stats-bar-pct">(${p}%)</span></span>
            </div>`;
    }

    // ==================== VUE D'ENSEMBLE ====================

    renderOverview(data) {
        const total = data.length;
        const withTimer = data.filter(p => p.timer_seconds > 0);
        const avgDuree = withTimer.length
            ? Math.round(withTimer.reduce((s, p) => s + p.timer_seconds, 0) / withTimer.length)
            : 0;
        const tauxCEP = this.pct(data.filter(p => p.answers?.Q10d === 'Oui').length, total);
        const tauxMature = this.pct(
            data.filter(p => p.results?.maturite?.status === 'Projet mature').length, total
        );

        document.getElementById('overview-cards').innerHTML = `
            <div class="stat-card stat-total">
                <span class="stat-value">${total}</span>
                <span class="stat-label">Prescriptions</span>
            </div>
            <div class="stat-card" style="border-top-color:#6366f1;">
                <span class="stat-value">${this.formatDuree(avgDuree)}</span>
                <span class="stat-label">Durée moyenne</span>
            </div>
            <div class="stat-card stat-haute">
                <span class="stat-value">${tauxCEP}%</span>
                <span class="stat-label">Déjà en contact CEP</span>
            </div>
            <div class="stat-card stat-mature">
                <span class="stat-value">${tauxMature}%</span>
                <span class="stat-label">Projets matures</span>
            </div>`;
    }

    // ==================== DURÉE DES ENTRETIENS ====================

    renderDuree(data) {
        // Par référent
        const byRef = {};
        data.forEach(p => {
            const rid = p.referent_id;
            if (!byRef[rid]) byRef[rid] = { total: 0, times: [] };
            byRef[rid].total++;
            if (p.timer_seconds > 0) byRef[rid].times.push(p.timer_seconds);
        });

        const refRows = Object.entries(byRef)
            .filter(([, d]) => d.times.length > 0)
            .sort((a, b) => this.referentNom(a[0]).localeCompare(this.referentNom(b[0])))
            .map(([rid, d]) => {
                const avg = Math.round(d.times.reduce((s, t) => s + t, 0) / d.times.length);
                return `<tr>
                    <td>${this.referentNom(rid)}</td>
                    <td style="text-align:center;">${d.total}</td>
                    <td style="text-align:center;">${this.formatDuree(avg)}</td>
                    <td style="text-align:center;">${this.formatDuree(Math.min(...d.times))}</td>
                    <td style="text-align:center;">${this.formatDuree(Math.max(...d.times))}</td>
                </tr>`;
            }).join('');

        // Évolution mensuelle
        const byMonth = {};
        data.forEach(p => {
            if (!p.timer_seconds) return;
            const month = p.created_at.substring(0, 7);
            if (!byMonth[month]) byMonth[month] = [];
            byMonth[month].push(p.timer_seconds);
        });

        const monthRows = Object.keys(byMonth).sort().map(month => {
            const times = byMonth[month];
            const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
            const [y, m] = month.split('-');
            const label = new Date(y, parseInt(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            return `<tr>
                <td>${label}</td>
                <td style="text-align:center;">${times.length}</td>
                <td style="text-align:center;">${this.formatDuree(avg)}</td>
            </tr>`;
        }).join('');

        let html = '';

        if (this.isManager && refRows) {
            html += `
                <h3 class="stats-subtitle">Par chargé de projets</h3>
                <div class="stats-table-wrapper">
                    <table class="stats-table">
                        <thead><tr>
                            <th>Chargé de projets</th>
                            <th style="text-align:center;">Entretiens</th>
                            <th style="text-align:center;">Durée moy.</th>
                            <th style="text-align:center;">Min</th>
                            <th style="text-align:center;">Max</th>
                        </tr></thead>
                        <tbody>${refRows}</tbody>
                    </table>
                </div>`;
        }

        if (monthRows) {
            html += `
                <h3 class="stats-subtitle" style="margin-top:${this.isManager ? '24px' : '0'};">Évolution mensuelle</h3>
                <div class="stats-table-wrapper">
                    <table class="stats-table">
                        <thead><tr>
                            <th>Mois</th>
                            <th style="text-align:center;">Entretiens</th>
                            <th style="text-align:center;">Durée moy.</th>
                        </tr></thead>
                        <tbody>${monthRows}</tbody>
                    </table>
                </div>`;
        }

        document.getElementById('duree-content').innerHTML =
            html || '<p class="stats-empty">Aucune donnée de durée disponible.</p>';
    }

    // ==================== TAUX CEP ====================

    renderCEP(data) {
        const total = data.length;
        const oui = data.filter(p => p.answers?.Q10d === 'Oui').length;
        const non = data.filter(p => p.answers?.Q10d === 'Non').length;
        const nc  = total - oui - non;

        let html = '';
        html += this.bar('Oui — avait déjà échangé avec un CEP', oui, total, 'bar-green');
        html += this.bar('Non — pas encore de CEP', non, total, 'bar-blue');
        if (nc > 0) html += this.bar('Non renseigné', nc, total, 'bar-grey');

        // Complémentarité Q24a (si données disponibles)
        const withQ24a = data.filter(p => p.answers?.Q10d === 'Oui' && p.answers?.Q24a);
        if (withQ24a.length > 0) {
            const q24Total = withQ24a.length;
            const q24Oui    = withQ24a.filter(p => p.answers.Q24a === 'Oui').length;
            const q24Non    = withQ24a.filter(p => p.answers.Q24a === 'Non').length;
            const q24Partie = withQ24a.filter(p => p.answers.Q24a === 'En partie').length;
            html += `<h3 class="stats-subtitle" style="margin-top:20px;">
                Complémentarité de l'entretien (parmi les ${q24Total} bénéficiaires avec CEP)
            </h3>`;
            html += this.bar('Oui — questions déjà abordées avec le CEP', q24Oui,    q24Total, 'bar-orange');
            html += this.bar('En partie', q24Partie, q24Total, 'bar-yellow');
            html += this.bar('Non — entretien entièrement complémentaire', q24Non,    q24Total, 'bar-green');
        }

        document.getElementById('cep-content').innerHTML = html;
    }

    // ==================== SATISFACTION ====================

    renderSatisfaction(data) {
        const withSat = data.filter(p => p.answers?.Q25);
        const section = document.getElementById('satisfaction-section');

        if (withSat.length === 0) { section.style.display = 'none'; return; }
        section.style.display = '';

        const total = withSat.length;
        const opts   = ['Très utile', 'Utile', 'Peu utile', 'Inutile'];
        const colors = ['bar-green', 'bar-blue', 'bar-orange', 'bar-red'];

        let html = opts.map((opt, i) => {
            const count = withSat.filter(p => p.answers.Q25 === opt).length;
            return this.bar(opt, count, total, colors[i]);
        }).join('');

        const positive = withSat.filter(p => ['Très utile', 'Utile'].includes(p.answers.Q25)).length;
        html += `<div class="stats-highlight">
            Satisfaction positive (Très utile + Utile) : <strong>${this.pct(positive, total)}%</strong>
            <span style="color:var(--text-light);font-weight:400;"> — ${total} réponse${total > 1 ? 's' : ''}</span>
        </div>`;

        // Croisement CEP × satisfaction
        const satCEP = withSat.filter(p => p.answers?.Q10d === 'Oui');
        const satNoCEP = withSat.filter(p => p.answers?.Q10d !== 'Oui');
        if (satCEP.length > 0 && satNoCEP.length > 0) {
            const posCEP   = satCEP.filter(p => ['Très utile', 'Utile'].includes(p.answers.Q25)).length;
            const posNoCEP = satNoCEP.filter(p => ['Très utile', 'Utile'].includes(p.answers.Q25)).length;
            html += `<div class="stats-highlight" style="margin-top:8px;">
                Satisfaction positive avec CEP préalable : <strong>${this.pct(posCEP, satCEP.length)}%</strong>
                &nbsp;·&nbsp; Sans CEP préalable : <strong>${this.pct(posNoCEP, satNoCEP.length)}%</strong>
            </div>`;
        }

        document.getElementById('satisfaction-content').innerHTML = html;
    }

    // ==================== PRIORITÉS ====================

    renderPriorites(data) {
        const total = data.length;
        // Fusion anciens et nouveaux libellés
        const counts = {};
        data.forEach(p => {
            const n = p.results?.priorite?.niveau;
            if (n) counts[n] = (counts[n] || 0) + 1;
        });

        const niveaux = [
            { label: 'Priorité renforcée', keys: ['Priorité renforcée', 'Très haute'], color: 'bar-green' },
            { label: 'Priorité confirmée',  keys: ['Priorité confirmée',  'Haute'],     color: 'bar-blue'  },
            { label: 'En bonne voie',        keys: ['En bonne voie',       'Moyenne'],   color: 'bar-yellow'},
            { label: 'À consolider',          keys: ['À consolider',        'Faible'],    color: 'bar-orange'},
            { label: 'À renforcer',           keys: ['À renforcer',         'Très faible'], color: 'bar-red'},
        ];

        let html = niveaux.map(n => {
            const count = n.keys.reduce((s, k) => s + (counts[k] || 0), 0);
            return this.bar(n.label, count, total, n.color);
        }).join('');

        const withScore = data.filter(p => p.results?.priorite?.score !== undefined);
        if (withScore.length > 0) {
            const avg = (withScore.reduce((s, p) => s + (p.results.priorite.score || 0), 0) / withScore.length).toFixed(1);
            const max = withScore[0].results.priorite.maxScore || 20;
            html += `<div class="stats-highlight">Score moyen de priorité : <strong>${avg} / ${max} pts</strong></div>`;
        }

        document.getElementById('priorites-content').innerHTML = html;
    }

    // ==================== STATUTS ====================

    renderStatuts(data) {
        const total = data.length;
        const statuts = [
            { key: 'prescrit',          label: 'Prescrit',          color: 'bar-grey'   },
            { key: 'oriente_cep',       label: 'Orienté CEP',       color: 'bar-blue'   },
            { key: 'dossier_en_cours',  label: 'Dossier en cours',  color: 'bar-yellow' },
            { key: 'commission',        label: 'En commission',      color: 'bar-orange' },
            { key: 'valide',            label: 'Validé',             color: 'bar-green'  },
            { key: 'refuse',            label: 'Refusé',             color: 'bar-red'    },
        ];

        document.getElementById('statuts-content').innerHTML = statuts.map(s => {
            const count = data.filter(p => p.statut === s.key).length;
            return this.bar(s.label, count, total, s.color);
        }).join('');
    }

    // ==================== MATURITÉ ====================

    renderMaturite(data) {
        const total = data.length;
        const niveaux = [
            { key: 'Projet mature',           label: 'Projet mature',           color: 'bar-green'  },
            { key: 'Projet en développement', label: 'Projet en développement', color: 'bar-yellow' },
            { key: 'Projet à construire',     label: 'Projet à construire',     color: 'bar-orange' },
        ];

        document.getElementById('maturite-content').innerHTML = niveaux.map(n => {
            const count = data.filter(p => p.results?.maturite?.status === n.key).length;
            return this.bar(n.label, count, total, n.color);
        }).join('');
    }

    // ==================== TAUX DE TRANSFORMATION ====================

    renderTransformation(data) {
        const total = data.length;
        const steps = [
            { keys: ['prescrit','oriente_cep','dossier_en_cours','commission','valide','refuse'],
              label: 'Prescriptions émises', color: 'bar-grey' },
            { keys: ['dossier_en_cours','commission','valide','refuse'],
              label: 'Dossiers constitués', color: 'bar-blue' },
            { keys: ['commission','valide','refuse'],
              label: 'Passés en commission', color: 'bar-yellow' },
            { keys: ['valide'],
              label: 'Validés', color: 'bar-green' },
        ];

        let html = '<div class="stats-funnel">';
        steps.forEach(step => {
            const count = data.filter(p => step.keys.includes(p.statut)).length;
            const p = this.pct(count, total);
            html += `
                <div class="funnel-step">
                    <div class="funnel-bar-wrapper">
                        <div class="funnel-bar ${step.color}" style="width:${Math.max(p, 3)}%;">
                            <span class="funnel-bar-text">${step.label}</span>
                        </div>
                    </div>
                    <span class="funnel-count">${count} <span class="stats-bar-pct">(${p}%)</span></span>
                </div>`;
        });
        html += '</div>';

        const valide = data.filter(p => p.statut === 'valide').length;
        html += `<div class="stats-highlight">
            Taux de transformation : <strong>${this.pct(valide, total)}%</strong> des prescriptions aboutissent à une validation commission
        </div>`;

        document.getElementById('transformation-content').innerHTML = html;
    }
}

document.addEventListener('DOMContentLoaded', () => { new ImpulsionStats(); });
