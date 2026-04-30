import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, Branch } from '../lib/supabase';

type BranchContextType = {
  branches: Branch[];
  activeBranch: Branch | null;
  setActiveBranchId: (id: string) => void;
};

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string>('');

  useEffect(() => {
    supabase.from('branches').select('*').order('name').then(({ data }) => {
      if (data && data.length > 0) {
        setBranches(data);
        setActiveBranchId(prev => prev || data[0].id);
      }
    });
  }, []);

  const activeBranch = branches.find(b => b.id === activeBranchId) ?? null;

  return (
    <BranchContext.Provider value={{ branches, activeBranch, setActiveBranchId }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
}
