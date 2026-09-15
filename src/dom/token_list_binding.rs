//! Native token-list state reads canonical attributes and returns writes for the host's existing mutation hooks.
use super::{
    constants::ELEMENT_NODE,
    error::TreeError,
    napi_error::to_napi_error,
    store::{NodeId, TreeStore, node_id},
    token_list::{self, TokenSet, Validation},
};
use napi::{Error, Result, bindgen_prelude::Utf16String};
use napi_derive::napi;
use rustc_hash::FxHashSet;
use std::{
    cell::RefCell,
    rc::Rc,
    sync::{
        Arc, Weak,
        atomic::{AtomicU64, Ordering},
    },
};

static LIVE_LISTS: AtomicU64 = AtomicU64::new(0);
static CREATED_LISTS: AtomicU64 = AtomicU64::new(0);
static RELEASED_LISTS: AtomicU64 = AtomicU64::new(0);

#[napi]
#[derive(PartialEq, Eq)]
pub enum TokenListMethod {
    Add,
    Remove,
    Toggle,
    Replace,
}
#[napi]
pub enum TokenValidation {
    Valid,
    Empty,
    Space,
}
#[napi(object)]
pub struct TokenListMutation {
    pub status: TokenValidation,
    pub result: bool,
    pub value: Option<Utf16String>,
}
#[napi(object)]
pub struct TokenListStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub sets: f64,
    pub token_units: f64,
}
#[napi(object)]
pub struct TokenSetStorage {
    pub length: f64,
    pub item_capacity: f64,
    pub member_capacity: f64,
}

#[napi]
pub struct NativeTokenList {
    owner: NodeId,
    name: Vec<u16>,
    forest: Weak<()>,
    tokens: Rc<RefCell<TokenSet>>,
    dirty: bool,
    supported: Option<FxHashSet<Vec<u16>>>,
}

#[napi]
pub struct NativeTokenSet {
    tokens: Rc<RefCell<TokenSet>>,
}

impl Drop for NativeTokenList {
    fn drop(&mut self) {
        LIVE_LISTS.fetch_sub(1, Ordering::Relaxed);
        RELEASED_LISTS.fetch_add(1, Ordering::Relaxed);
    }
}

impl NativeTokenList {
    pub(super) fn create(
        tree: &TreeStore,
        owner: f64,
        name: Utf16String,
        supported: Option<Vec<Utf16String>>,
    ) -> Result<Self> {
        let owner = node_id(owner).map_err(to_napi_error)?;
        tree.attribute_by_namespace(owner as f64, None, &name)
            .map_err(to_napi_error)?;
        LIVE_LISTS.fetch_add(1, Ordering::Relaxed);
        CREATED_LISTS.fetch_add(1, Ordering::Relaxed);
        Ok(Self {
            owner,
            name: name.to_vec(),
            forest: Arc::downgrade(&tree.delivery_identity),
            tokens: Rc::new(RefCell::new(TokenSet::default())),
            dirty: true,
            supported: supported
                .map(|tokens| tokens.into_iter().map(|token| token.to_vec()).collect()),
        })
    }
    fn check(&self, tree: &TreeStore) -> Result<()> {
        if self.forest.as_ptr() != Arc::as_ptr(&tree.delivery_identity) {
            return Err(Error::from_reason(
                "NativeTokenList: operation belongs to a different forest",
            ));
        }
        if tree.links(self.owner).map_err(to_napi_error)?.node_kind != Some(ELEMENT_NODE) {
            return Err(to_napi_error(TreeError::NotElement(self.owner)));
        }
        Ok(())
    }
    pub(super) fn value(&self, tree: &TreeStore) -> Result<Vec<u16>> {
        self.check(tree)?;
        let attribute = tree
            .attribute_by_namespace(self.owner as f64, None, &self.name)
            .map_err(to_napi_error)?;
        if attribute == 0.0 {
            Ok(Vec::new())
        } else {
            Ok(tree
                .attribute(attribute as NodeId)
                .map_err(to_napi_error)?
                .value
                .units()
                .collect())
        }
    }
    pub(super) fn sync(&mut self, tree: &TreeStore) -> Result<()> {
        self.check(tree)?;
        if self.dirty {
            self.tokens = Rc::new(RefCell::new(TokenSet::parse(&self.value(tree)?)));
            self.dirty = false;
        }
        Ok(())
    }
    pub(super) fn length(&mut self, tree: &TreeStore) -> Result<u32> {
        self.sync(tree)?;
        Ok(self.tokens.borrow().len() as u32)
    }
    pub(super) fn item(&mut self, tree: &TreeStore, index: u32) -> Result<Option<Utf16String>> {
        self.sync(tree)?;
        Ok(self.tokens.borrow().get(index as usize).map(Into::into))
    }
    pub(super) fn contains(&mut self, tree: &TreeStore, token: &[u16]) -> Result<bool> {
        self.sync(tree)?;
        Ok(self.tokens.borrow().contains(token))
    }
    pub(super) fn set(&mut self, tree: &TreeStore) -> Result<NativeTokenSet> {
        self.sync(tree)?;
        Ok(NativeTokenSet {
            tokens: self.tokens.clone(),
        })
    }
    pub(super) fn mutate(
        &mut self,
        tree: &TreeStore,
        method: TokenListMethod,
        inputs: Vec<Utf16String>,
        force: Option<bool>,
    ) -> Result<TokenListMutation> {
        self.check(tree)?;
        if method == TokenListMethod::Toggle && inputs.len() != 1 {
            return Err(Error::from_reason(
                "NativeTokenList: toggle requires one token",
            ));
        }
        if method == TokenListMethod::Replace && inputs.len() != 2 {
            return Err(Error::from_reason(
                "NativeTokenList: replace requires two tokens",
            ));
        }
        let inputs = inputs
            .into_iter()
            .map(|token| token.to_vec())
            .collect::<Vec<_>>();
        let validation = token_list::validate(&inputs, method == TokenListMethod::Replace);
        if validation != Validation::Valid {
            return Ok(TokenListMutation {
                status: match validation {
                    Validation::Empty => TokenValidation::Empty,
                    _ => TokenValidation::Space,
                },
                result: false,
                value: None,
            });
        }
        self.sync(tree)?;
        let mut tokens = self.tokens.borrow_mut();
        let result = match method {
            TokenListMethod::Add => {
                for token in &inputs {
                    tokens.append(token);
                }
                false
            }
            TokenListMethod::Remove => {
                tokens.remove(&inputs);
                false
            }
            TokenListMethod::Replace => {
                if !tokens.replace(&inputs[0], &inputs[1]) {
                    return Ok(TokenListMutation {
                        status: TokenValidation::Valid,
                        result: false,
                        value: None,
                    });
                }
                true
            }
            TokenListMethod::Toggle => {
                let present = tokens.contains(&inputs[0]);
                if present && force == Some(true) || !present && force == Some(false) {
                    return Ok(TokenListMutation {
                        status: TokenValidation::Valid,
                        result: present,
                        value: None,
                    });
                }
                if present {
                    tokens.remove(&inputs);
                } else {
                    tokens.append(&inputs[0]);
                }
                !present
            }
        };
        let present = tree
            .attribute_by_name(self.owner as f64, &self.name, false)
            .map_err(to_napi_error)?
            != 0.0;
        let value = if !present && tokens.len() == 0 {
            None
        } else {
            Some(tokens.serialize().into())
        };
        Ok(TokenListMutation {
            status: TokenValidation::Valid,
            result,
            value,
        })
    }
}

#[napi]
impl NativeTokenList {
    #[napi]
    pub fn invalidate(&mut self) {
        self.dirty = true;
    }
    #[napi]
    pub fn supports(&self, token: Utf16String) -> Option<bool> {
        let supported = self.supported.as_ref()?;
        let lower = token
            .iter()
            .map(|unit| {
                if (65..=90).contains(unit) {
                    unit + 32
                } else {
                    *unit
                }
            })
            .collect::<Vec<_>>();
        Some(supported.contains(&lower))
    }
    #[napi]
    pub fn statistics() -> TokenListStatistics {
        TokenListStatistics {
            live: LIVE_LISTS.load(Ordering::Relaxed) as f64,
            created: CREATED_LISTS.load(Ordering::Relaxed) as f64,
            released: RELEASED_LISTS.load(Ordering::Relaxed) as f64,
            sets: token_list::LIVE_SETS.load(Ordering::Relaxed) as f64,
            token_units: token_list::TOKEN_UNITS.load(Ordering::Relaxed) as f64,
        }
    }
}

#[napi]
impl NativeTokenSet {
    #[napi(getter)]
    pub fn size(&self) -> u32 {
        self.tokens.borrow().len() as u32
    }
    #[napi]
    pub fn contains(&self, token: Utf16String) -> bool {
        self.tokens.borrow().contains(&token)
    }
    #[napi]
    pub fn get(&self, index: u32) -> Option<Utf16String> {
        self.tokens.borrow().get(index as usize).map(Into::into)
    }
    #[napi]
    pub fn storage(&self) -> TokenSetStorage {
        let tokens = self.tokens.borrow();
        let (items, members) = tokens.capacity();
        TokenSetStorage {
            length: tokens.len() as f64,
            item_capacity: items as f64,
            member_capacity: members as f64,
        }
    }
}
