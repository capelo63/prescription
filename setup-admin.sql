-- =============================================================
-- Impulsion - Fonctions d'administration (à exécuter APRÈS setup.sql)
-- =============================================================
-- Ces fonctions permettent aux managers de gérer les utilisateurs
-- directement depuis l'interface, sans passer par la console Supabase.
-- =============================================================

-- 1. Créer un utilisateur (manager uniquement)
CREATE OR REPLACE FUNCTION admin_create_user(
    user_email TEXT,
    user_password TEXT,
    user_nom TEXT,
    user_role TEXT DEFAULT 'referent'
) RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Vérifier que l'appelant est manager
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager') THEN
        RAISE EXCEPTION 'Seuls les managers peuvent creer des utilisateurs';
    END IF;

    -- Vérifier que l'email n'existe pas déjà
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
        RAISE EXCEPTION 'Un utilisateur avec cet email existe deja';
    END IF;

    -- Vérifier le rôle
    IF user_role NOT IN ('referent', 'manager') THEN
        RAISE EXCEPTION 'Role invalide. Utilisez referent ou manager';
    END IF;

    -- Créer l'utilisateur dans auth.users
    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_user_meta_data, raw_app_meta_data,
        aud, role
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        user_email,
        crypt(user_password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        jsonb_build_object('nom', user_nom, 'role', user_role),
        '{"provider":"email","providers":["email"]}'::jsonb,
        'authenticated',
        'authenticated'
    );

    -- Le trigger handle_new_user crée automatiquement le profil

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Modifier le rôle et/ou le nom d'un utilisateur (manager uniquement)
CREATE OR REPLACE FUNCTION admin_update_user(
    target_user_id UUID,
    new_nom TEXT DEFAULT NULL,
    new_role TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Vérifier que l'appelant est manager
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager') THEN
        RAISE EXCEPTION 'Seuls les managers peuvent modifier les utilisateurs';
    END IF;

    -- Empêcher de se retirer son propre rôle manager
    IF target_user_id = auth.uid() AND new_role = 'referent' THEN
        RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre role manager';
    END IF;

    -- Vérifier le rôle si spécifié
    IF new_role IS NOT NULL AND new_role NOT IN ('referent', 'manager') THEN
        RAISE EXCEPTION 'Role invalide';
    END IF;

    -- Mettre à jour le profil
    UPDATE profiles SET
        nom = COALESCE(new_nom, nom),
        role = COALESCE(new_role, role)
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Réinitialiser le mot de passe d'un utilisateur (manager uniquement)
CREATE OR REPLACE FUNCTION admin_reset_password(
    target_user_id UUID,
    new_password TEXT
) RETURNS VOID AS $$
BEGIN
    -- Vérifier que l'appelant est manager
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager') THEN
        RAISE EXCEPTION 'Seuls les managers peuvent reinitialiser les mots de passe';
    END IF;

    -- Mettre à jour le mot de passe
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Supprimer un utilisateur (manager uniquement)
CREATE OR REPLACE FUNCTION admin_delete_user(
    target_user_id UUID
) RETURNS VOID AS $$
BEGIN
    -- Vérifier que l'appelant est manager
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager') THEN
        RAISE EXCEPTION 'Seuls les managers peuvent supprimer des utilisateurs';
    END IF;

    -- Empêcher de se supprimer soi-même
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte';
    END IF;

    -- Supprimer le profil (cascade depuis auth.users)
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Permettre aux managers de lire tous les profils (politique RLS déjà en place)
-- Déjà couvert par la policy "profiles_select_manager" dans setup.sql
