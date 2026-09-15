//! Native abort handles share a thread-local graph; all graph locks end before returning to JavaScript.
use super::{
    abort_state::{AbortGraph, AbortStateError},
    constants::JS_MAX_SAFE_INTEGER,
};
use napi::{Error, Result, Status};
use napi_derive::napi;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicU64, Ordering},
};

thread_local! { static GRAPH: Arc<Mutex<AbortGraph>> = Arc::new(Mutex::new(AbortGraph::default())); }
static LAST_ID: AtomicU64 = AtomicU64::new(0);
static LIVE: AtomicU64 = AtomicU64::new(0);
static CREATED: AtomicU64 = AtomicU64::new(0);
static RELEASED: AtomicU64 = AtomicU64::new(0);
static LINKS: AtomicU64 = AtomicU64::new(0);
static ALGORITHMS: AtomicU64 = AtomicU64::new(0);

#[napi(object)]
pub struct NativeAbortStatistics {
    pub live: f64,
    pub created: f64,
    pub released: f64,
    pub links: f64,
    pub algorithms: f64,
}
#[napi(object)]
pub struct NativeAbortGraphStatistics {
    pub signals: f64,
    pub links: f64,
    pub algorithms: f64,
    pub capacity: f64,
}
#[napi(object)]
pub struct NativeAbortAnyPlan {
    pub reason_source: f64,
    pub sources: Vec<f64>,
    pub source_inputs: Vec<f64>,
}

#[napi]
pub struct NativeAbortState {
    id: u64,
    graph: Arc<Mutex<AbortGraph>>,
}

fn native_error(error: AbortStateError) -> Error {
    let message = match error {
        AbortStateError::UnknownSignal(id) => format!("unknown signal {id}"),
        AbortStateError::StateNotFresh => {
            "initializeAny requires a fresh state and cannot include itself".into()
        }
        AbortStateError::SourceNotAborted => "markDependents requires an aborted source".into(),
        AbortStateError::UnknownAlgorithm(id) => format!("unknown algorithm {id}"),
        AbortStateError::IdentifiersExhausted => "identifiers exhausted".into(),
    };
    Error::new(Status::InvalidArg, format!("NativeAbortState: {message}"))
}
fn identity(value: f64, allow_zero: bool) -> Result<u64> {
    if !value.is_finite()
        || value.fract() != 0.0
        || value < if allow_zero { 0.0 } else { 1.0 }
        || value > JS_MAX_SAFE_INTEGER as f64
    {
        return Err(Error::new(
            Status::InvalidArg,
            "NativeAbortState: identity must be a safe integer in the accepted range",
        ));
    }
    Ok(value as u64)
}
fn update_counter(counter: &AtomicU64, before: usize, after: usize) {
    if after > before {
        counter.fetch_add((after - before) as u64, Ordering::Relaxed);
    } else if before > after {
        counter.fetch_sub((before - after) as u64, Ordering::Relaxed);
    }
}
impl NativeAbortState {
    fn read<Value>(
        &self,
        action: impl FnOnce(&AbortGraph) -> std::result::Result<Value, AbortStateError>,
    ) -> Result<Value> {
        let graph = self.graph.lock().map_err(|_| {
            Error::new(
                Status::GenericFailure,
                "NativeAbortState: graph lock poisoned",
            )
        })?;
        action(&graph).map_err(native_error)
    }
    fn mutate<Value>(
        &self,
        action: impl FnOnce(&mut AbortGraph) -> std::result::Result<Value, AbortStateError>,
    ) -> Result<Value> {
        let mut graph = self.graph.lock().map_err(|_| {
            Error::new(
                Status::GenericFailure,
                "NativeAbortState: graph lock poisoned",
            )
        })?;
        let before = graph.counts();
        let result = action(&mut graph);
        let after = graph.counts();
        update_counter(&LINKS, before.1, after.1);
        update_counter(&ALGORITHMS, before.2, after.2);
        result.map_err(native_error)
    }
}
impl Drop for NativeAbortState {
    fn drop(&mut self) {
        let mut graph = self.graph.lock().unwrap_or_else(|error| error.into_inner());
        let before = graph.counts();
        graph.release(self.id);
        let after = graph.counts();
        update_counter(&LINKS, before.1, after.1);
        update_counter(&ALGORITHMS, before.2, after.2);
        LIVE.fetch_sub(1, Ordering::Relaxed);
        RELEASED.fetch_add(1, Ordering::Relaxed);
    }
}
#[napi]
impl NativeAbortState {
    #[napi(constructor)]
    pub fn new() -> Result<Self> {
        let previous = LAST_ID
            .fetch_update(Ordering::Relaxed, Ordering::Relaxed, |id| {
                if id < JS_MAX_SAFE_INTEGER {
                    Some(id + 1)
                } else {
                    None
                }
            })
            .map_err(|_| native_error(AbortStateError::IdentifiersExhausted))?;
        let id = previous + 1;
        let graph = GRAPH.with(Arc::clone);
        graph
            .lock()
            .map_err(|_| {
                Error::new(
                    Status::GenericFailure,
                    "NativeAbortState: graph lock poisoned",
                )
            })?
            .allocate(id);
        LIVE.fetch_add(1, Ordering::Relaxed);
        CREATED.fetch_add(1, Ordering::Relaxed);
        Ok(Self { id, graph })
    }
    #[napi(getter)]
    pub fn id(&self) -> f64 {
        self.id as f64
    }
    #[napi(getter)]
    pub fn aborted(&self) -> Result<bool> {
        self.read(|graph| graph.aborted(self.id))
    }
    #[napi(setter)]
    pub fn set_aborted(&self, value: bool) -> Result<()> {
        self.mutate(|graph| graph.set_aborted(self.id, value))
    }
    #[napi(getter)]
    pub fn dependent(&self) -> Result<bool> {
        self.read(|graph| graph.dependent(self.id))
    }
    #[napi(setter)]
    pub fn set_dependent(&self, value: bool) -> Result<()> {
        self.mutate(|graph| graph.set_dependent(self.id, value))
    }
    #[napi]
    pub fn initialize_any(&self, inputs: Vec<f64>) -> Result<NativeAbortAnyPlan> {
        let inputs = inputs
            .into_iter()
            .map(|id| identity(id, false))
            .collect::<Result<Vec<_>>>()?;
        let plan = self.mutate(|graph| graph.initialize_any(self.id, &inputs))?;
        Ok(NativeAbortAnyPlan {
            reason_source: plan.reason_source.map_or(0.0, |id| id as f64),
            sources: plan.sources.into_iter().map(|id| id as f64).collect(),
            source_inputs: plan
                .source_inputs
                .into_iter()
                .map(|index| index as f64)
                .collect(),
        })
    }
    #[napi]
    pub fn mark_dependents(&self) -> Result<Vec<f64>> {
        Ok(self
            .mutate(|graph| graph.mark_dependents(self.id))?
            .into_iter()
            .map(|id| id as f64)
            .collect())
    }
    #[napi]
    pub fn add_algorithm(&self, existing: f64) -> Result<f64> {
        let existing = identity(existing, true)?;
        Ok(self.mutate(|graph| {
            graph.add_algorithm(self.id, if existing == 0 { None } else { Some(existing) })
        })? as f64)
    }
    #[napi]
    pub fn remove_algorithm(&self, id: f64) -> Result<bool> {
        let id = identity(id, false)?;
        self.mutate(|graph| graph.remove_algorithm(self.id, id))
    }
    #[napi]
    pub fn next_algorithm(&self, after: f64) -> Result<f64> {
        let after = identity(after, true)?;
        Ok(self
            .read(|graph| graph.next_algorithm(self.id, after))?
            .map_or(0.0, |id| id as f64))
    }
    #[napi]
    pub fn clear_algorithms(&self) -> Result<()> {
        self.mutate(|graph| graph.clear_algorithms(self.id))
    }
    #[napi]
    pub fn graph_statistics(&self) -> Result<NativeAbortGraphStatistics> {
        self.read(|graph| {
            let (signals, links, algorithms, capacity) = graph.counts();
            Ok(NativeAbortGraphStatistics {
                signals: signals as f64,
                links: links as f64,
                algorithms: algorithms as f64,
                capacity: capacity as f64,
            })
        })
    }
    #[napi]
    pub fn statistics() -> NativeAbortStatistics {
        NativeAbortStatistics {
            live: LIVE.load(Ordering::Relaxed) as f64,
            created: CREATED.load(Ordering::Relaxed) as f64,
            released: RELEASED.load(Ordering::Relaxed) as f64,
            links: LINKS.load(Ordering::Relaxed) as f64,
            algorithms: ALGORITHMS.load(Ordering::Relaxed) as f64,
        }
    }
}
