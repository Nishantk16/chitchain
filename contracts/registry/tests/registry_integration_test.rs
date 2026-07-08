#![cfg(test)]

use soroban_sdk::{
    symbol_short,
    testutils::Address as _,
    Address, Env,
};

use crate::{
    RegistryContract, RegistryContractClient,
};

fn deploy_registry(env: &Env, admin: &Address) -> RegistryContractClient {
    let id = env.register_contract(None, RegistryContract);
    let client = RegistryContractClient::new(env, &id);
    client.initialize(admin);
    client
}

#[test]
fn test_initialize_registry() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let client = deploy_registry(&env, &admin);
    assert_eq!(client.get_circle_count(), 0);
    assert_eq!(client.get_admin().unwrap(), admin);
}

#[test]
fn test_register_circle() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let client = deploy_registry(&env, &admin);

    let circle = Address::generate(&env);
    let name = symbol_short!("MyCircle");

    client.register_circle(&circle, &name, &admin);

    assert_eq!(client.get_circle_count(), 1);
    let entry = client.get_circle(&circle).unwrap();
    assert_eq!(entry.admin, admin);
    assert_eq!(entry.status_code, 0);
}

#[test]
fn test_update_circle_status() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let client = deploy_registry(&env, &admin);

    let circle = Address::generate(&env);
    client.register_circle(&circle, &symbol_short!("C1"), &admin);

    client.update_circle_status(&circle, &1u32);
    assert_eq!(client.get_circle(&circle).unwrap().status_code, 1);

    client.update_circle_status(&circle, &3u32);
    assert_eq!(client.get_circle(&circle).unwrap().status_code, 3);
}

#[test]
fn test_filter_circles_by_status() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let client = deploy_registry(&env, &admin);

    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    let c3 = Address::generate(&env);

    client.register_circle(&c1, &symbol_short!("C1"), &admin);
    client.register_circle(&c2, &symbol_short!("C2"), &admin);
    client.register_circle(&c3, &symbol_short!("C3"), &admin);

    client.update_circle_status(&c1, &1u32);
    client.update_circle_status(&c2, &1u32);

    let active = client.get_circles_by_status(&1u32);
    assert_eq!(active.len(), 2);

    let pending = client.get_circles_by_status(&0u32);
    assert_eq!(pending.len(), 1);
}

#[test]
fn test_cannot_double_register() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let client = deploy_registry(&env, &admin);
    let circle = Address::generate(&env);

    client.register_circle(&circle, &symbol_short!("C1"), &admin);
    let result = client.try_register_circle(&circle, &symbol_short!("C1"), &admin);
    assert!(result.is_err());
}