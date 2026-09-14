//! Lossless binding values for stateless native dataset operations.
use super::string_map;
use napi::bindgen_prelude::Utf16String;
use napi_derive::napi;
use std::sync::atomic::Ordering;

#[napi]
pub enum DatasetNameStatus {
    Valid,
    InvalidProperty,
    InvalidName,
}
#[napi(object)]
pub struct DatasetNamePlan {
    pub status: DatasetNameStatus,
    pub attribute: Utf16String,
}
#[napi(object)]
pub struct DatasetStatistics {
    pub reads: f64,
    pub enumerations: f64,
    pub name_plans: f64,
}

pub(super) fn plan(name: &[u16], validate: bool) -> DatasetNamePlan {
    let plan = string_map::name_plan(name, validate);
    DatasetNamePlan {
        status: match plan.status {
            string_map::NameStatus::Valid => DatasetNameStatus::Valid,
            string_map::NameStatus::InvalidProperty => DatasetNameStatus::InvalidProperty,
            string_map::NameStatus::InvalidName => DatasetNameStatus::InvalidName,
        },
        attribute: plan.attribute.into(),
    }
}

pub(super) fn statistics() -> DatasetStatistics {
    DatasetStatistics {
        reads: string_map::READS.load(Ordering::Relaxed) as f64,
        enumerations: string_map::ENUMERATIONS.load(Ordering::Relaxed) as f64,
        name_plans: string_map::NAME_PLANS.load(Ordering::Relaxed) as f64,
    }
}
