use soroban_sdk::{
    symbol_short,
    testutils::Address as _,
    Address, Env,
};

use crate::{
    ChitChainContract, ChitChainContractClient,
    types::{CircleConfig, CircleStatus},
};

fn base_setup(env: &Env) -> (ChitChainContractClient, Address, Address) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let token = env.register_stellar_asset_contract(admin.clone());
    let registry = env.register_contract(
        None,
        crate::tests::circle_lifecycle_test::mock_registry::MockRegistry,
    );

    let contract_id = env.register_contract(None, ChitChainContract);
    let client = ChitChainContractClient::new(env, &contract_id);

    let config = CircleConfig {
        name: symbol_short!("AclTest"),
        contribution_amount: 10_000_000,
        max_members: 2,
        total_rounds: 2,
        round_duration_ledgers: 17_280,
        token_address: token.clone(),
    };

    client.initialize(&admin, &config, &registry);
    (client, admin, token)
}

#[test]
fn test_admin_can_add_operator() {
    let env = Env::default();
    let (client, admin, _) = base_setup(&env);

    let operator = Address::generate(&env);
    client.add_operator(&admin, &operator);

    let ops = client.get_operators();
    assert!(ops.contains(&operator));
}

#[test]
fn test_non_admin_cannot_add_operator() {
    let env = Env::default();
    let (client, _, _) = base_setup(&env);

    let rando = Address::generate(&env);
    let operator = Address::generate(&env);
    let result = client.try_add_operator(&rando, &operator);
    assert!(result.is_err());
}

#[test]
fn test_admin_can_remove_operator() {
    let env = Env::default();
    let (client, admin, _) = base_setup(&env);

    let operator = Address::generate(&env);
    client.add_operator(&admin, &operator);
    client.remove_operator(&admin, &operator);

    let ops = client.get_operators();
    assert!(!ops.contains(&operator));
}

#[test]
fn test_emergency_exit_admin_only() {
    let env = Env::default();
    let (client, admin, _) = base_setup(&env);

    let rando = Address::generate(&env);
    let result = client.try_emergency_exit(&rando);
    assert!(result.is_err());

    client.emergency_exit(&admin);
    let state = client.get_circle_state().unwrap();
    assert_eq!(state.status, CircleStatus::Disputed);
}

#[test]
fn test_cannot_reinitialize() {
    let env = Env::default();
    let (client, admin, token) = base_setup(&env);

    let registry = env.register_contract(
        None,
        crate::tests::circle_lifecycle_test::mock_registry::MockRegistry,
    );
    let config = CircleConfig {
        name: symbol_short!("Dup"),
        contribution_amount: 10_000_000,
        max_members: 2,
        total_rounds: 2,
        round_duration_ledgers: 17_280,
        token_address: token,
    };

    let result = client.try_initialize(&admin, &config, &registry);
    assert!(result.is_err());
}