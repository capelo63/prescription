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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return null;
        }
        this.user = session.user;
        await this.loadProfile();
        return this.profile;
    }

    // Charger le profil (rôle, nom) depuis la table profiles
    async loadProfile() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', this.user.id)
            .single();

        if (error || !data) {
            console.error('Erreur chargement profil:', error);
            await this.logout();
            return null;
        }
        this.profile = data;
        return data;
    }

    // Connexion par email/mot de passe
    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
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
        await supabase.auth.signOut();
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
            <button id="logout-btn" class="btn-icon">Deconnexion</button>
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
