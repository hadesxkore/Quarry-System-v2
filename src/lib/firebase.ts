// Firebase configuration
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
    apiKey: "AIzaSyD5tHrEnxa5ng5RYND77DIOWk5EeTJDimw",
    authDomain: "quarry-system.firebaseapp.com",
    projectId: "quarry-system",
    storageBucket: "quarry-system.firebasestorage.app",
    messagingSenderId: "898890782972",
    appId: "1:898890782972:web:42a76767e1bbd55d869f79",
    measurementId: "G-5DNWQ1YH7Z",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
