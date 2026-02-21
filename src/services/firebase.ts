import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/* ==============================
   FIREBASE CONFIG
   (paste your firebase keys here)
============================== */

const firebaseConfig = {
  apiKey: "AIzaSyBtOvSDDxJQi6Q2rbi3UyHTXHciHugeDeI",
  authDomain: "cgpa-calculator-dbs.firebaseapp.com",
  projectId: "cgpa-calculator-dbs",
  storageBucket: "cgpa-calculator-dbs.appspot.com",
  messagingSenderId: "787166659651",
  appId: "1:787166659651:web:ef0fd1ad334a4aa34d80f6"
};

/* ==============================
   INITIALIZE FIREBASE
============================== */

const app = initializeApp(firebaseConfig);

/* services we will use */
export const auth = getAuth(app);
export const db = getFirestore(app);