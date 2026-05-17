import { createContext, useContext, useState, ReactNode } from 'react';

export type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  created_at: string;
};

export const SUCURSALES = ['Pettirossi', 'Azara', 'Lambaré', 'Acceso Sur', 'Capiatá'];

const BRANCHES_FIJAS: Branch[] = SUCURSALES.map(name => ({
  id: name.toLowerCase().replace(/ /g, '_'),
  name,
  address: '',
  phone: '',
  created_at: '',
}));

type BranchContextType = {
  branches: Branch[];
  activeBranch: Branch | null;
  setActiveBranchId: (id: string) => void;
};

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [activeBranchId, setActiveBranchId] = useState<string>(BRANCHES_FIJAS[0].id);
  const activeBranch = BRANCHES_FIJAS.find(b => b.id === activeBranchId) ?? null;

  return (
    <BranchContext.Provider value={{ branches: BRANCHES_FIJAS, activeBranch, setActiveBranchId }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
}
