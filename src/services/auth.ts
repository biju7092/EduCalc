import { auth } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "firebase/auth";

/* convert register number → fake email */
const makeEmail = (registerNumber: string) => {
  return `${registerNumber}@educalc.com`;
};


/* =========================
   REGISTER
========================= */
export const registerStudent = async (
  registerNumber: string,
  password: string
) => {
  const email = makeEmail(registerNumber);

  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  return userCredential.user;
};


/* =========================
   LOGIN
========================= */
export const loginStudent = async (
  registerNumber: string,
  password: string
) => {
  const email = makeEmail(registerNumber);

  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  return userCredential.user;
};


/* =========================
   LOGOUT
========================= */
export const logoutStudent = async () => {
  await signOut(auth);
};