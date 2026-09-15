//! Abort state, ordered dependency links and algorithm membership without JavaScript references.
use super::{compact_storage::CompactMap, constants::JS_MAX_SAFE_INTEGER};
use rustc_hash::{FxBuildHasher, FxHashSet};
use std::collections::{BTreeMap, BTreeSet};
use std::ops::Bound::{Excluded, Unbounded};

#[derive(Debug, PartialEq, Eq)]
pub enum AbortStateError {
    UnknownSignal(u64),
    StateNotFresh,
    SourceNotAborted,
    UnknownAlgorithm(u64),
    IdentifiersExhausted,
}

#[derive(Default)]
struct AbortState {
    aborted: bool,
    dependent: bool,
    sources: BTreeMap<u64, u64>,
    dependents: BTreeMap<u64, u64>,
    algorithms: BTreeSet<u64>,
    next_algorithm: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub struct AbortAnyPlan {
    pub reason_source: Option<u64>,
    pub sources: Vec<u64>,
    pub source_inputs: Vec<usize>,
}

#[derive(Default)]
pub struct AbortGraph {
    states: CompactMap<u64, AbortState, FxBuildHasher>,
    next_link: u64,
    links: usize,
    algorithms: usize,
}

impl AbortGraph {
    pub fn allocate(&mut self, id: u64) {
        assert!(!self.states.contains_key(&id));
        self.states.insert(id, AbortState::default());
    }
    fn state(&self, id: u64) -> Result<&AbortState, AbortStateError> {
        self.states
            .get(&id)
            .ok_or(AbortStateError::UnknownSignal(id))
    }
    fn state_mut(&mut self, id: u64) -> Result<&mut AbortState, AbortStateError> {
        self.states
            .get_mut(&id)
            .ok_or(AbortStateError::UnknownSignal(id))
    }
    pub fn aborted(&self, id: u64) -> Result<bool, AbortStateError> {
        Ok(self.state(id)?.aborted)
    }
    pub fn dependent(&self, id: u64) -> Result<bool, AbortStateError> {
        Ok(self.state(id)?.dependent)
    }
    pub fn set_aborted(&mut self, id: u64, value: bool) -> Result<(), AbortStateError> {
        self.state_mut(id)?.aborted = value;
        Ok(())
    }
    pub fn set_dependent(&mut self, id: u64, value: bool) -> Result<(), AbortStateError> {
        self.state_mut(id)?.dependent = value;
        Ok(())
    }

    pub fn initialize_any(
        &mut self,
        result: u64,
        inputs: &[u64],
    ) -> Result<AbortAnyPlan, AbortStateError> {
        let target = self.state(result)?;
        if target.aborted
            || target.dependent
            || !target.sources.is_empty()
            || !target.dependents.is_empty()
            || !target.algorithms.is_empty()
        {
            return Err(AbortStateError::StateNotFresh);
        }
        for id in inputs {
            self.state(*id)?;
            if *id == result {
                return Err(AbortStateError::StateNotFresh);
            }
        }
        if let Some(source) = inputs.iter().copied().find(|id| self.states[id].aborted) {
            self.state_mut(result)?.aborted = true;
            return Ok(AbortAnyPlan {
                reason_source: Some(source),
                sources: Vec::new(),
                source_inputs: Vec::new(),
            });
        }
        let mut sources = Vec::new();
        let mut source_inputs = Vec::new();
        let mut seen = FxHashSet::default();
        for (input_index, id) in inputs.iter().enumerate() {
            let signal = self.state(*id)?;
            if !signal.dependent {
                if seen.insert(*id) {
                    sources.push(*id);
                    source_inputs.push(input_index);
                }
            } else {
                for source in signal.sources.values() {
                    let root = self.state(*source)?;
                    if !root.aborted && !root.dependent && seen.insert(*source) {
                        sources.push(*source);
                        source_inputs.push(input_index);
                    }
                }
            }
        }
        if self.next_link > JS_MAX_SAFE_INTEGER - sources.len() as u64 {
            return Err(AbortStateError::IdentifiersExhausted);
        }
        self.state_mut(result)?.dependent = true;
        for source in &sources {
            self.next_link += 1;
            let link = self.next_link;
            self.state_mut(result)?.sources.insert(link, *source);
            self.state_mut(*source)?.dependents.insert(link, result);
            self.links += 1;
        }
        Ok(AbortAnyPlan {
            reason_source: None,
            sources,
            source_inputs,
        })
    }

    pub fn mark_dependents(&mut self, source: u64) -> Result<Vec<u64>, AbortStateError> {
        let state = self.state(source)?;
        if !state.aborted {
            return Err(AbortStateError::SourceNotAborted);
        }
        let dependents: Vec<_> = state.dependents.values().copied().collect();
        let mut selected = Vec::with_capacity(dependents.len());
        for dependent in dependents {
            let state = self.state_mut(dependent)?;
            if !state.aborted {
                state.aborted = true;
                selected.push(dependent);
            }
        }
        Ok(selected)
    }

    /// Returns roots in composition order for host lifetime bookkeeping only.
    pub fn source_ids(&self, signal: u64) -> Result<Vec<u64>, AbortStateError> {
        Ok(self.state(signal)?.sources.values().copied().collect())
    }

    /// Removes terminal dependency edges from every source without changing reason or algorithms.
    pub fn detach_sources(&mut self, signal: u64) -> Result<(), AbortStateError> {
        let sources = std::mem::take(&mut self.state_mut(signal)?.sources);
        for (link, source) in sources {
            if let Some(parent) = self.states.get_mut(&source) {
                parent.dependents.remove(&link);
            }
            self.links -= 1;
        }
        Ok(())
    }

    pub fn add_algorithm(
        &mut self,
        signal: u64,
        existing: Option<u64>,
    ) -> Result<u64, AbortStateError> {
        let state = self.state_mut(signal)?;
        if state.aborted {
            return Ok(0);
        }
        if let Some(id) = existing {
            return if state.algorithms.contains(&id) {
                Ok(id)
            } else {
                Err(AbortStateError::UnknownAlgorithm(id))
            };
        }
        if state.next_algorithm == JS_MAX_SAFE_INTEGER {
            return Err(AbortStateError::IdentifiersExhausted);
        }
        state.next_algorithm += 1;
        let id = state.next_algorithm;
        state.algorithms.insert(id);
        self.algorithms += 1;
        Ok(id)
    }
    pub fn remove_algorithm(&mut self, signal: u64, id: u64) -> Result<bool, AbortStateError> {
        let removed = self.state_mut(signal)?.algorithms.remove(&id);
        if removed {
            self.algorithms -= 1;
        }
        Ok(removed)
    }
    pub fn next_algorithm(&self, signal: u64, after: u64) -> Result<Option<u64>, AbortStateError> {
        Ok(self
            .state(signal)?
            .algorithms
            .range((Excluded(after), Unbounded))
            .next()
            .copied())
    }
    pub fn clear_algorithms(&mut self, signal: u64) -> Result<(), AbortStateError> {
        let state = self.state_mut(signal)?;
        let removed = state.algorithms.len();
        state.algorithms.clear();
        self.algorithms -= removed;
        Ok(())
    }
    pub fn release(&mut self, id: u64) {
        let Some(state) = self.states.remove(&id) else {
            return;
        };
        for (link, source) in state.sources {
            if let Some(parent) = self.states.get_mut(&source) {
                parent.dependents.remove(&link);
            }
            self.links -= 1;
        }
        for (link, dependent) in state.dependents {
            if let Some(child) = self.states.get_mut(&dependent) {
                child.sources.remove(&link);
            }
            self.links -= 1;
        }
        self.algorithms -= state.algorithms.len();
        self.states.compact();
    }
    pub fn counts(&self) -> (usize, usize, usize, usize) {
        (
            self.states.len(),
            self.links,
            self.algorithms,
            self.states.capacity(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn graph() -> AbortGraph {
        let mut graph = AbortGraph::default();
        for id in 1..=8 {
            graph.allocate(id);
        }
        graph
    }
    #[test]
    fn should_select_first_aborted_input_and_validate_before_mutation() {
        let mut graph = graph();
        graph.set_aborted(2, true).unwrap();
        graph.set_aborted(1, true).unwrap();
        assert_eq!(
            graph.initialize_any(3, &[2, 1]).unwrap(),
            AbortAnyPlan {
                reason_source: Some(2),
                sources: vec![],
                source_inputs: vec![]
            }
        );
        assert!(graph.aborted(3).unwrap());
        assert!(!graph.dependent(3).unwrap());
        let before = graph.counts();
        assert_eq!(
            graph.initialize_any(4, &[1, 999]),
            Err(AbortStateError::UnknownSignal(999))
        );
        assert_eq!(graph.counts(), before);
        assert!(!graph.aborted(4).unwrap());
        assert_eq!(
            graph.initialize_any(4, &[4]),
            Err(AbortStateError::StateNotFresh)
        );
    }
    #[test]
    fn should_flatten_deduplicate_and_mark_every_dependent_before_delivery() {
        let mut graph = graph();
        assert_eq!(graph.initialize_any(3, &[1, 2, 1]).unwrap().sources, [1, 2]);
        assert_eq!(graph.initialize_any(4, &[3, 2]).unwrap().sources, [1, 2]);
        assert_eq!(
            graph.mark_dependents(1),
            Err(AbortStateError::SourceNotAborted)
        );
        graph.set_aborted(1, true).unwrap();
        assert_eq!(graph.mark_dependents(1).unwrap(), [3, 4]);
        assert!(graph.aborted(3).unwrap() && graph.aborted(4).unwrap());
        graph.set_aborted(2, true).unwrap();
        assert!(graph.mark_dependents(2).unwrap().is_empty());
        assert!(graph.initialize_any(5, &[]).unwrap().sources.is_empty());
        assert!(graph.dependent(5).unwrap());
    }
    #[test]
    fn should_detach_terminal_roots_without_losing_algorithm_state_or_double_releasing_links() {
        let mut graph = graph();
        graph.initialize_any(3, &[2, 1]).unwrap();
        graph.initialize_any(4, &[3]).unwrap();
        assert_eq!(graph.source_ids(3).unwrap(), [2, 1]);
        let algorithm = graph.add_algorithm(3, None).unwrap();
        graph.set_aborted(1, true).unwrap();
        assert_eq!(graph.mark_dependents(1).unwrap(), [3, 4]);
        graph.detach_sources(3).unwrap();
        graph.detach_sources(3).unwrap();
        assert!(graph.source_ids(3).unwrap().is_empty());
        assert_eq!(graph.source_ids(4).unwrap(), [2, 1]);
        assert_eq!(graph.next_algorithm(3, 0).unwrap(), Some(algorithm));
        assert_eq!(graph.counts().1, 2);
        graph.release(3);
        graph.release(4);
        assert_eq!(graph.counts().1, 0);
    }
    #[test]
    fn should_keep_algorithm_iteration_live_and_never_reuse_removed_ids() {
        let mut graph = graph();
        let first = graph.add_algorithm(1, None).unwrap();
        let second = graph.add_algorithm(1, None).unwrap();
        assert_eq!(graph.add_algorithm(1, Some(first)).unwrap(), first);
        assert_eq!(graph.next_algorithm(1, 0).unwrap(), Some(first));
        graph.remove_algorithm(1, second).unwrap();
        let third = graph.add_algorithm(1, None).unwrap();
        assert!(third > second);
        assert_eq!(graph.next_algorithm(1, first).unwrap(), Some(third));
        graph.set_aborted(1, true).unwrap();
        assert_eq!(graph.add_algorithm(1, None).unwrap(), 0);
        graph.clear_algorithms(1).unwrap();
        assert_eq!(graph.next_algorithm(1, 0).unwrap(), None);
    }
    #[test]
    fn should_reclaim_bidirectional_links_and_capacity_with_a_live_signal() {
        let mut graph = AbortGraph::default();
        graph.allocate(1);
        for id in 2..10_002 {
            graph.allocate(id);
            graph.initialize_any(id, &[1]).unwrap();
        }
        assert_eq!(graph.counts().1, 10_000);
        for id in 2..10_002 {
            graph.release(id);
        }
        let (signals, links, algorithms, capacity) = graph.counts();
        assert_eq!((signals, links, algorithms), (1, 0, 0));
        assert!(capacity <= 64);
        graph.release(1);
        assert_eq!(graph.counts().0, 0);
    }
}
