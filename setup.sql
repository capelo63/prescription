-- =============================================================
-- Impulsion - Setup Supabase
-- =============================================================
-- Exécuter ce script dans l'éditeur SQL de Supabase (SQL Editor)
-- après avoir créé le projet.
-- =============================================================

-- 1. Table des profils (étend auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    nom TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'referent' CHECK (role IN ('referent', 'manager')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des prescriptions
CREATE TABLE prescriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referent_id UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    beneficiaire JSONB NOT NULL DEFAULT '{}',
    answers JSONB NOT NULL DEFAULT '{}',
    results JSONB NOT NULL DEFAULT '{}',
    statut TEXT DEFAULT 'prescrit' CHECK (statut IN (
        'prescrit',
        'oriente_cep',
        'dossier_en_cours',
        'commission',
        'valide',
        'refuse'
    )),
    notes TEXT DEFAULT '',
    timer_seconds INTEGER DEFAULT 0
);

-- 3. Index pour les requêtes fréquentes
CREATE INDEX idx_prescriptions_referent ON prescriptions(referent_id);
CREATE INDEX idx_prescriptions_statut ON prescriptions(statut);
CREATE INDEX idx_prescriptions_created ON prescriptions(created_at DESC);

-- 4. Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prescriptions_updated_at
    BEFORE UPDATE ON prescriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Fonction pour créer un profil automatiquement à l'inscription
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, nom, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nom', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'referent')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- Profiles : chacun voit son profil, les managers voient tout
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_manager" ON profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
    );

-- Prescriptions : référents CRUD sur les leurs, managers lecture + update sur tout
CREATE POLICY "prescriptions_select" ON prescriptions
    FOR SELECT USING (
        referent_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "prescriptions_insert" ON prescriptions
    FOR INSERT WITH CHECK (referent_id = auth.uid());

CREATE POLICY "prescriptions_update_own" ON prescriptions
    FOR UPDATE USING (referent_id = auth.uid());

CREATE POLICY "prescriptions_update_manager" ON prescriptions
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
    );

CREATE POLICY "prescriptions_delete_own" ON prescriptions
    FOR DELETE USING (referent_id = auth.uid());

-- =============================================================
-- 7. Créer les comptes utilisateurs
-- =============================================================
-- IMPORTANT : créer les utilisateurs dans Authentication > Users
-- de la console Supabase, puis mettre à jour leurs rôles ici :
--
-- UPDATE profiles SET role = 'manager', nom = 'Nom du manager'
-- WHERE email = 'manager@transitionspro-paca.fr';
--
-- Les référents sont créés automatiquement avec le rôle 'referent'
-- grâce au trigger handle_new_user.
-- =============================================================
