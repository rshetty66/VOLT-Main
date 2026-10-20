import { createContext, useContext } from "react";
import type { User } from "../shared/records";

/** The signed-in user, provided by AuthGate around the whole app. */
export const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext);
/** Viewers can read and download, but not start runs or change anything. */
export const useCanWrite = () => useContext(UserContext)?.role !== "viewer";
export const VIEW_ONLY = "Your account is view-only: you can read and download, but not start runs or make changes.";
