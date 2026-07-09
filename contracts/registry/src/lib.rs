#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CircleEntry {
    pub admin: Address,
    pub name: Symbol,
    pub status_code: u32,
    pub registered_at_ledger: u32,
}

#[contracttype]
pub enum DataKey {
    Admin,
    CircleCount,
    CircleEntry(Address),
    CircleList,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    AlreadyRegistered = 3,
    NotFound = 4,
    Unauthorized = 5,
}

#[contract]
pub struct RegistryContract;

#[contractimpl]
impl RegistryContract {
    /// Initialize the registry with an admin address. Can only be called once.
    pub fn initialize(env: Env, admin: Address) -> Result<(), RegistryError> {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CircleCount, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::CircleList, &Vec::<Address>::new(&env));

        Ok(())
    }

    /// Register a newly-created circle contract. Called by the circle contract
    /// itself (or its admin) right after the circle's `initialize`.
    pub fn register_circle(
        env: Env,
        circle: Address,
        name: Symbol,
        admin: Address,
    ) -> Result<(), RegistryError> {
        admin.require_auth();

        if !env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::NotInitialized);
        }

        let key = DataKey::CircleEntry(circle.clone());
        if env.storage().persistent().has(&key) {
            return Err(RegistryError::AlreadyRegistered);
        }

        let entry = CircleEntry {
            admin,
            name,
            status_code: 0,
            registered_at_ledger: env.ledger().sequence(),
        };
        env.storage().persistent().set(&key, &entry);
        env.storage().persistent().extend_ttl(&key, 432_000, 518_400);

        let mut list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::CircleList)
            .unwrap_or_else(|| Vec::new(&env));
        list.push_back(circle);
        env.storage().instance().set(&DataKey::CircleList, &list);

        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CircleCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::CircleCount, &(count + 1));

        Ok(())
    }

    /// Update a circle's status code. In production this should ideally check
    /// that the caller is the circle contract or its admin; for now we allow
    /// the stored circle admin to authorize the update.
    pub fn update_circle_status(
        env: Env,
        circle: Address,
        status_code: u32,
    ) -> Result<(), RegistryError> {
        let key = DataKey::CircleEntry(circle.clone());
        let mut entry: CircleEntry = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::NotFound)?;

        entry.admin.require_auth();
        entry.status_code = status_code;

        env.storage().persistent().set(&key, &entry);
        env.storage().persistent().extend_ttl(&key, 432_000, 518_400);

        Ok(())
    }

    /// Total number of registered circles.
    pub fn get_circle_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::CircleCount)
            .unwrap_or(0)
    }

    /// The registry admin, if initialized.
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    /// Look up a single circle's registry entry.
    pub fn get_circle(env: Env, circle: Address) -> Option<CircleEntry> {
        env.storage()
            .persistent()
            .get(&DataKey::CircleEntry(circle))
    }

    /// List all circle addresses currently at a given status code.
    pub fn get_circles_by_status(env: Env, status_code: u32) -> Vec<Address> {
        let list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::CircleList)
            .unwrap_or_else(|| Vec::new(&env));

        let mut result = Vec::new(&env);
        for addr in list.iter() {
            if let Some(entry) = env
                .storage()
                .persistent()
                .get::<DataKey, CircleEntry>(&DataKey::CircleEntry(addr.clone()))
            {
                if entry.status_code == status_code {
                    result.push_back(addr);
                }
            }
        }
        result
    }
}
