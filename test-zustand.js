const { create } = require('zustand');
const { persist, createJSONStorage } = require('zustand/middleware');

const dummyStorage = {
  getItem: (name) => '{"state":{"val":1},"version":0}',
  setItem: (name, value) => {},
  removeItem: (name) => {}
};

let store;
store = create(
  persist(
    (set) => ({ val: 0 }),
    {
      name: 'test',
      storage: createJSONStorage(() => dummyStorage),
      onRehydrateStorage: () => (state) => {
        console.log('Store inside callback:', typeof store);
        try {
          if (store) store.setState({ val: 2 });
        } catch(e) {
          console.error("Error:", e.message);
        }
      }
    }
  )
);
console.log('Store after create:', typeof store);
