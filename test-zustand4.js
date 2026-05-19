const { create } = require('zustand');
const { persist, createJSONStorage } = require('zustand/middleware');

const dummyStorage = {
  getItem: (name) => '{"state":{"val":1},"version":0}',
  setItem: (name, value) => {},
  removeItem: (name) => {}
};

const useStore = create(
  persist(
    (set) => ({ val: 0, hydrated: false }),
    {
      name: 'test',
      storage: createJSONStorage(() => dummyStorage),
      onRehydrateStorage: () => (state) => {
        setTimeout(() => {
          useStore.setState({ hydrated: true });
          console.log("Hydrated state set! State is now:", useStore.getState());
        }, 0);
      }
    }
  )
);
