import React, { createContext, useContext, useEffect, useState } from "react";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
} from "firebase/auth";
import type { User, UserCredential } from "firebase/auth";
import {
    doc,
    getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = "admin" | "user";

export interface UserProfile {
    uid: string;
    email: string;
    username: string;
    role: UserRole;
    quarryId?: string;
    quarryName?: string;
    quarryMunicipality?: string;
    displayName?: string;
    createdAt?: string;
}

interface AuthContextType {
    currentUser: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<UserCredential>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    async function login(username: string, password: string): Promise<UserCredential> {
        // 1. Try the "usernames" lookup collection first (legacy / admin accounts)
        const usernameDoc = await getDoc(doc(db, "usernames", username.trim()));
        let email: string;
        if (usernameDoc.exists()) {
            email = usernameDoc.data().email as string;
        } else {
            // 2. Fall back to the synthetic email used when creating user accounts
            email = `${username.trim().toLowerCase().replace(/\s+/g, ".")}@pgb-quarry.local`;
        }
        return signInWithEmailAndPassword(auth, email, password);
    }

    async function logout() {
        await signOut(auth);
        setUserProfile(null);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                try {
                    const profileDoc = await getDoc(doc(db, "users", user.uid));
                    if (profileDoc.exists()) {
                        setUserProfile(profileDoc.data() as UserProfile);
                    }
                } catch (err) {
                    console.error("Failed to fetch user profile", err);
                }
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const value: AuthContextType = {
        currentUser,
        userProfile,
        loading,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
