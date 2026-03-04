// =============================================================
// Authentification - Impulsion
// =============================================================

class ImpulsionAuth {
    constructor() {
        this.user = null;
        this.profile = null;
    }

    // Vérifier si l'utilisateur est connecté, sinon rediriger vers login
    async requireAuth() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) {
                window.location.href = 'login.html';
                return null;
            }
            this.user = session.user;
            await this.loadProfile();
            // Auth réussie : afficher le contenu de la page
            document.body.style.display = '';
            return this.profile;
        } catch (err) {
            console.error('Erreur auth:', err);
            window.location.href = 'login.html';
            return null;
        }
    }

    // Charger le profil (rôle, nom) depuis la table profiles
    async loadProfile() {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', this.user.id)
            .single();

        if (error || !data) {
            console.error('Erreur chargement profil:', error);
            // Afficher l'erreur au lieu de déconnecter silencieusement
            document.body.style.display = '';
            document.body.innerHTML = `
                <div style="max-width:500px;margin:80px auto;padding:32px;background:#fee2e2;border-radius:12px;font-family:system-ui;text-align:center;">
                    <h2 style="color:#991b1b;">Erreur de profil</h2>
                    <p>Votre compte utilisateur existe mais votre profil est introuvable ou inaccessible.</p>
                    <p style="font-size:0.85rem;color:#666;">Erreur : ${error?.message || 'Profil inexistant'}</p>
                    <p style="font-size:0.85rem;color:#666;">ID utilisateur : ${this.user.id}</p>
                    <button onclick="auth.logout()" style="margin-top:16px;padding:10px 24px;background:#991b1b;color:white;border:none;border-radius:8px;cursor:pointer;">
                        Retour à la connexion
                    </button>
                </div>`;
            return null;
        }
        this.profile = data;
        return data;
    }

    // Connexion par email/mot de passe
    async login(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        this.user = data.user;
        await this.loadProfile();
        return this.profile;
    }

    // Déconnexion
    async logout() {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    }

    // Vérifier le rôle
    isManager() {
        return this.profile?.role === 'manager';
    }

    isReferent() {
        return this.profile?.role === 'referent';
    }

    // Afficher les infos utilisateur dans la nav
    renderUserNav(container) {
        const roleLabel = this.isManager() ? 'Manager' : 'Referent';
        const roleBadge = this.isManager() ? 'badge-manager' : 'badge-referent';
        container.innerHTML = `
            <span class="user-nav-name">${this.escapeHtml(this.profile.nom)}</span>
            <span class="badge ${roleBadge}">${roleLabel}</span>
            <button id="logout-btn" class="btn-logout" title="Se deconnecter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Deconnexion
            </button>
        `;
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

const auth = new ImpulsionAuth();
