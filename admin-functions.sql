-- =============================================================
-- Impulsion - Fonctions d'administration des utilisateurs
-- =============================================================
-- Exécuter ce script dans l'éditeur SQL de Supabase pour
-- corriger / mettre à jour les fonctions d'administration.
-- Ces fonctions sont appelées depuis admin.html via supabaseClient.rpc()
-- =============================================================

-- Supprimer les versions précédentes (nécessaire si la signature change)
DROP FUNCTION IF EXISTS admin_create_user(text, text, text, text);
DROP FUNCTION IF EXISTS admin_create_user(text, text, text);
DROP FUNCTION IF EXISTS admin_update_user(uuid, text, text);
DROP FUNCTION IF EXISTS admin_reset_password(uuid, text);
DROP FUNCTION IF EXISTS admin_delete_user(uuid);

-- 1. Créer un utilisateur (auth + profil)
-- Crée l'entrée dans auth.users, auth.identities,
-- et déclenche automatiquement le trigger handle_new_user
-- qui crée le profil dans la table profiles.
-- Aucun mot de passe n'est demandé à l'admin : un mot de passe aléatoire
-- est généré, et l'utilisateur reçoit un e-mail pour définir le sien.
CREATE OR REPLACE FUNCTION admin_create_user(
    user_email TEXT,
    user_nom TEXT,
    user_role TEXT DEFAULT 'referent'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    new_user_id UUID;
    random_password TEXT;
BEGIN
    -- Seuls les managers peuvent créer des comptes
    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'
    ) THEN
        RAISE EXCEPTION 'Accès refusé : vous devez être manager pour créer des comptes.';
    END IF;

    -- Vérifier que l'e-mail n'est pas déjà utilisé
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(user_email))) THEN
        RAISE EXCEPTION 'Un compte existe déjà avec cette adresse e-mail.';
    END IF;

    new_user_id := gen_random_uuid();
    -- Mot de passe temporaire aléatoire (l'utilisateur le remplacera via l'e-mail envoyé)
    random_password := encode(gen_random_bytes(32), 'hex');

    -- Créer l'utilisateur dans auth.users
    -- email_confirmed_at = NOW() : compte actif immédiatement, sans e-mail de confirmation
    -- Les champs token doivent être des chaînes vides (pas NULL) pour que GoTrue
    -- puisse traiter la connexion sans erreur 500.
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    ) VALUES (
        new_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        lower(trim(user_email)),
        crypt(random_password, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nom', user_nom, 'role', user_role),
        FALSE,
        '',
        '',
        '',
        ''
    );

    -- Enregistrer l'identité email dans auth.identities
    -- (nécessaire pour que la colonne "Providers" affiche "Email" dans Supabase)
    INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        new_user_id,
        lower(trim(user_email)),
        jsonb_build_object('sub', new_user_id::text, 'email', lower(trim(user_email))),
        'email',
        NOW(),
        NOW(),
        NOW()
    );

    -- Le trigger handle_new_user crée automatiquement le profil dans profiles
    -- en lisant raw_user_meta_data->>'nom' et raw_user_meta_data->>'role'

    RETURN json_build_object('id', new_user_id, 'email', user_email);
END;
$$;


-- 2. Modifier nom et rôle d'un utilisateur
CREATE OR REPLACE FUNCTION admin_update_user(
    target_user_id UUID,
    new_nom TEXT,
    new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Seuls les managers peuvent modifier des comptes
    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'
    ) THEN
        RAISE EXCEPTION 'Accès refusé.';
    END IF;

    -- Mettre à jour le profil
    UPDATE profiles
    SET nom  = new_nom,
        role = new_role
    WHERE id = target_user_id;

    -- Synchroniser les métadonnées Supabase Auth
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_build_object('nom', new_nom, 'role', new_role),
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$;


-- 3. Réinitialiser le mot de passe d'un utilisateur
CREATE OR REPLACE FUNCTION admin_reset_password(
    target_user_id UUID,
    new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
    -- Seuls les managers peuvent réinitialiser un mot de passe
    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'
    ) THEN
        RAISE EXCEPTION 'Accès refusé.';
    END IF;

    IF length(new_password) < 6 THEN
        RAISE EXCEPTION 'Le mot de passe doit contenir au moins 6 caractères.';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf')),
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$;


-- 4. Supprimer un utilisateur (profil + compte auth)
-- Bloqué si l'utilisateur a des dossiers de prescription associés.
CREATE OR REPLACE FUNCTION admin_delete_user(
    target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    prescription_count INTEGER;
BEGIN
    -- Seuls les managers peuvent supprimer des comptes
    IF NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'
    ) THEN
        RAISE EXCEPTION 'Accès refusé.';
    END IF;

    -- Empêcher l'auto-suppression
    IF target_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Vous ne pouvez pas supprimer votre propre compte.';
    END IF;

    -- Bloquer si l'utilisateur a des dossiers de prescription
    SELECT COUNT(*) INTO prescription_count
    FROM prescriptions WHERE referent_id = target_user_id;

    IF prescription_count > 0 THEN
        RAISE EXCEPTION 'Impossible de supprimer ce compte : % dossier(s) sont associés à cet utilisateur. Veuillez les réassigner ou les supprimer d''abord.', prescription_count;
    END IF;

    -- Supprimer les identités auth (auth.identities)
    DELETE FROM auth.identities WHERE user_id = target_user_id;

    -- Supprimer le compte auth (la FK CASCADE supprime le profil)
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;


-- =============================================================
-- NETTOYAGE (optionnel)
-- Si un profil orphelin a été créé sans compte auth correspondant,
-- le supprimer avant de recréer le compte via l'interface :
--
-- DELETE FROM profiles
-- WHERE email = 'adresse@email.fr'
--   AND id NOT IN (SELECT id FROM auth.users);
-- =============================================================
