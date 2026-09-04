import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

// Port de src/context/AuthContext.jsx (site web) : même logique de session/
// rôle/cache, adaptée à React Native. Deux différences volontaires :
// - localStorage -> AsyncStorage (API asynchrone, donc l'hydratation initiale
//   passe par un effet plutôt qu'une lecture synchrone).
// - Les URLs signées avatar/couverture (getSignedAvatarUrl/getSignedCoverUrl
//   côté web) sont laissées de côté : hors périmètre de ce point (session +
//   rôle), à ajouter avec l'écran Profil.
// signOut ne navigue pas lui-même (pas de window.location côté RN) : c'est
// au root layout de rediriger quand `session` devient null.
export type Profile = {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  badges?: string[];
  [key: string]: unknown;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: string;
  isAdmin: boolean;
  isRecruiter: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const ADMIN_EMAIL = 'facilitefacile62@gmail.com';
const CACHE_PROFILE_KEY = 'FACILITE_CACHED_PROFILE_V1';
const CACHE_ROLE_KEY = 'FACILITE_CACHED_ROLE_V1';

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  role: 'visitor',
  isAdmin: false,
  isRecruiter: false,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState('visitor');
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (currentSession: Session | null) => {
    if (!currentSession?.user) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setRole('visitor');
      setLoading(false);
      await AsyncStorage.multiRemove([CACHE_PROFILE_KEY, CACHE_ROLE_KEY]).catch(() => {});
      return;
    }

    const currentUser = currentSession.user;
    setSession(currentSession);
    setUser(currentUser);

    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle(),
        supabase.from('user_roles').select('role, status').eq('user_id', currentUser.id).maybeSingle(),
      ]);

      const profileData = profileRes.data as Profile | null;
      const roleData = roleRes.data as { role?: string; status?: string } | null;

      let userRole = roleData?.role || 'user';
      if (currentUser.email === ADMIN_EMAIL) userRole = 'admin';
      setRole(userRole);

      const resolvedProfile: Profile = profileData ?? {
        id: currentUser.id,
        full_name:
          (currentUser.user_metadata?.full_name as string | undefined) ||
          currentUser.email?.split('@')[0] ||
          'Utilisateur',
        badges: [],
      };
      setProfile(resolvedProfile);

      await AsyncStorage.multiSet([
        [CACHE_PROFILE_KEY, JSON.stringify(resolvedProfile)],
        [CACHE_ROLE_KEY, userRole],
      ]).catch(() => {});
    } catch (err) {
      console.error('Erreur AuthContext fetchUserData:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const cached = await AsyncStorage.multiGet([CACHE_PROFILE_KEY, CACHE_ROLE_KEY]);
        const cachedProfile = cached.find(([k]) => k === CACHE_PROFILE_KEY)?.[1];
        const cachedRole = cached.find(([k]) => k === CACHE_ROLE_KEY)?.[1];
        if (mounted && cachedProfile) setProfile(JSON.parse(cachedProfile));
        if (mounted && cachedRole) setRole(cachedRole);
      } catch {
        // Cache absent ou corrompu : sans gravité, la session réelle suit juste après.
      }
    })();

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (mounted) fetchUserData(initialSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) fetchUserData(newSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`auth-context-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => {
          if (session) fetchUserData(session);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        () => {
          if (session) fetchUserData(session);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, session, fetchUserData]);

  const refreshProfile = useCallback(async () => {
    if (session) await fetchUserData(session);
  }, [session, fetchUserData]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Erreur déconnexion:', e);
    } finally {
      await AsyncStorage.multiRemove([CACHE_PROFILE_KEY, CACHE_ROLE_KEY]).catch(() => {});
    }
  }, []);

  const isAdmin = role === 'admin' || user?.email === ADMIN_EMAIL;
  const isRecruiter =
    role === 'recruiter' || (Array.isArray(profile?.badges) && profile.badges.includes('verified_recruiter'));

  return (
    <AuthContext.Provider
      value={{ session, user, profile, role, isAdmin, isRecruiter, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé au sein d\'un AuthProvider');
  }
  return context;
}
