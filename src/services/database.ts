import { db } from "./firebase";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

/* =========================
   SAVE USER PROFILE (first time)
========================= */
export const saveUserProfile = async (
  registerNumber: string,
  name: string,
  department: string
) => {
  await setDoc(doc(db, "students", registerNumber), {
    registerNumber,
    name,
    department,
    gpaHistory: [],
    cgpaHistory: [],
    createdAt: Date.now()
  });
};

/* =========================
   GET USER PROFILE
========================= */
export const getUserProfile = async (registerNumber: string) => {
  const snap = await getDoc(doc(db, "students", registerNumber));
  if (!snap.exists()) return null;
  return snap.data();
};

/* =========================
   SAVE GPA
========================= */
export const saveGPA = async (registerNumber: string, gpa: number) => {
  await updateDoc(doc(db, "students", registerNumber), {
    gpaHistory: arrayUnion({
      value: gpa,
      date: Date.now()
    })
  });
};

/* =========================
   SAVE CGPA
========================= */
export const saveCGPA = async (registerNumber: string, cgpa: number) => {
  await updateDoc(doc(db, "students", registerNumber), {
    cgpaHistory: arrayUnion({
      value: cgpa,
      date: Date.now()
    })
  });
};