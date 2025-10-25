import { create } from 'zustand';

// 1️⃣ Define the shape of a User
interface User {
  name: string;
  coords: [number, number];
}

// 2️⃣ Define the shape of your store
interface StoreState {
  users: User[];
  upsertUser: (user: User) => void;
}

// 3️⃣ Create the store
const useStore = create<StoreState>((set) => ({
  users: [],

  // 🔄 Upsert user logic (insert or update)
  upsertUser: (newUser) =>
    set((state) => {
      const userExists = state.users.some((user) => user.name === newUser.name);

      return {
        users: userExists
          ? state.users.map((user) =>
              user.name === newUser.name
                ? { ...user, coords: newUser.coords } // ✏️ Update if exists
                : user
            )
          : [...state.users, newUser], // ➕ Add if not exists
      };
    }),
}));

export default useStore;
