import { IAccountsStorage, MemAccountsStorage, DbAccountsStorage } from './accounts';
import { IAssetsStorage, MemAssetsStorage, DbAssetsStorage } from './assets';
import { StorageFacade } from './facade';
import { IStorage } from '../storage';

/**
 * Storage services composition root
 * Bundles domain-specific storage adapters
 */
export interface IStorageServices {
  accounts: IAccountsStorage;
  assets: IAssetsStorage;
  // Legacy interface for gradual migration
  legacy: IStorage;
}

/**
 * Create memory-based storage services for testing
 */
export function createMemStorage(legacyStorage: IStorage): IStorageServices {
  return {
    accounts: new MemAccountsStorage(),
    assets: new MemAssetsStorage(),
    legacy: legacyStorage
  };
}

/**
 * Create database-backed storage services for production
 */
export function createDbStorage(legacyStorage: IStorage): IStorageServices {
  return {
    accounts: new DbAccountsStorage(),
    assets: new DbAssetsStorage(),
    legacy: legacyStorage
  };
}

/**
 * Create a storage facade that delegates to domain adapters
 * This provides a migration path from the monolithic IStorage
 */
export function createStorageFacade(useMemStorage: boolean, legacyStorage: IStorage): StorageFacade {
  const services = useMemStorage 
    ? createMemStorage(legacyStorage)
    : createDbStorage(legacyStorage);
    
  return new StorageFacade(services.accounts, services.assets, services.legacy);
}

// Re-export interfaces for convenience
export { IAccountsStorage, IAssetsStorage, StorageFacade };
export { MemAccountsStorage, DbAccountsStorage, MemAssetsStorage, DbAssetsStorage };