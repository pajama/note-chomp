import { createContext, useContext, type ReactNode } from 'react';
import type { KeyValueStorage, SongRepository } from '../persistence/SongRepository';

export interface Services {
  repository: SongRepository;
  storage: KeyValueStorage;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}
