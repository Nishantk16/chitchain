use soroban_sdk::{Address, Env};

use crate::{
    storage::{get_circle_state, get_member, get_operator_set},
    types::{ChitError, Role},
};

// ─── Admin / Ownership ────────────────────────────────────────────────────────

pub fn require_admin(env: &Env, caller: &Address) -> Result<(), ChitError> {
    caller.require_auth();
    let state = get_circle_state(env)?;
    if state.admin != *caller {
        return Err(ChitError::Unauthorized);
    }
    Ok(())
}

pub fn require_admin_or_operator(env: &Env, caller: &Address) -> Result<(), ChitError> {
    caller.require_auth();
    let state = get_circle_state(env)?;
    if state.admin == *caller {
        return Ok(());
    }
    let operators = get_operator_set(env);
    if operators.contains(caller) {
        return Ok(());
    }
    Err(ChitError::Unauthorized)
}

pub fn require_member(env: &Env, caller: &Address) -> Result<(), ChitError> {
    caller.require_auth();
    get_member(env, caller).ok_or(ChitError::NotMember)?;
    Ok(())
}

pub fn is_admin(env: &Env, caller: &Address) -> bool {
    get_circle_state(env)
        .map(|s| s.admin == *caller)
        .unwrap_or(false)
}

pub fn is_operator(env: &Env, caller: &Address) -> bool {
    get_operator_set(env).contains(caller)
}

pub fn is_member(env: &Env, caller: &Address) -> bool {
    get_member(env, caller).is_some()
}

pub fn get_caller_role(env: &Env, caller: &Address) -> Role {
    if is_admin(env, caller) {
        return Role::Admin;
    }
    if is_operator(env, caller) {
        return Role::Operator;
    }
    Role::Member
}