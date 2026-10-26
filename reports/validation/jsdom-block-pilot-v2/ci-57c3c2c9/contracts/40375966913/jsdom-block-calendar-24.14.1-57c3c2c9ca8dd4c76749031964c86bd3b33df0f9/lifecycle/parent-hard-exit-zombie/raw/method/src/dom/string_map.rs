//! Dataset names and lookups over canonical native Attr records, preserving namespace asymmetry.
use super::{
    constants::ELEMENT_NODE,
    error::{Result, TreeError},
    store::{TreeStore, node_id},
};
use rustc_hash::FxHashSet;
use std::sync::atomic::{AtomicU64, Ordering};

pub(super) static READS: AtomicU64 = AtomicU64::new(0);
pub(super) static ENUMERATIONS: AtomicU64 = AtomicU64::new(0);
pub(super) static NAME_PLANS: AtomicU64 = AtomicU64::new(0);
const DATA_PREFIX: &[u16] = &[100, 97, 116, 97, 45];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum NameStatus {
    Valid,
    InvalidProperty,
    InvalidName,
}

pub(super) struct NamePlan {
    pub status: NameStatus,
    pub attribute: Vec<u16>,
}

fn lowercase(unit: u16) -> bool {
    (97..=122).contains(&unit)
}
fn uppercase(unit: u16) -> bool {
    (65..=90).contains(&unit)
}
fn forbidden_property(name: &[u16]) -> bool {
    name.windows(2)
        .any(|pair| pair[0] == 45 && lowercase(pair[1]))
}

pub(super) fn property_name(local_name: &[u16]) -> Option<Vec<u16>> {
    let suffix = local_name.strip_prefix(DATA_PREFIX)?;
    if suffix.iter().copied().any(uppercase) {
        return None;
    }
    let mut output = Vec::with_capacity(suffix.len());
    let mut index = 0;
    while index < suffix.len() {
        if suffix[index] == 45 && suffix.get(index + 1).is_some_and(|unit| lowercase(*unit)) {
            output.push(suffix[index + 1] - 32);
            index += 2;
        } else {
            output.push(suffix[index]);
            index += 1;
        }
    }
    Some(output)
}

pub(super) fn attribute_name(property: &[u16]) -> Vec<u16> {
    let mut output = Vec::with_capacity(DATA_PREFIX.len() + property.len());
    output.extend_from_slice(DATA_PREFIX);
    for unit in property {
        if uppercase(*unit) {
            output.push(45);
            output.push(unit + 32);
        } else {
            output.push(*unit);
        }
    }
    output
}

pub(super) fn name_plan(property: &[u16], validate: bool) -> NamePlan {
    NAME_PLANS.fetch_add(1, Ordering::Relaxed);
    if validate && forbidden_property(property) {
        return NamePlan {
            status: NameStatus::InvalidProperty,
            attribute: Vec::new(),
        };
    }
    let attribute = attribute_name(property);
    let status = if validate && !crate::xml::valid_xml_name(&attribute, false) {
        NameStatus::InvalidName
    } else {
        NameStatus::Valid
    };
    NamePlan { status, attribute }
}

impl TreeStore {
    pub(super) fn dataset_names(&self, owner: f64) -> Result<Vec<Vec<u16>>> {
        let owner = node_id(owner)?;
        if self.links(owner)?.node_kind != Some(ELEMENT_NODE) {
            return Err(TreeError::NotElement(owner));
        }
        ENUMERATIONS.fetch_add(1, Ordering::Relaxed);
        let mut seen = FxHashSet::default();
        let mut output = Vec::new();
        if let Some(attributes) = self.attribute_collections.elements.get(&owner) {
            for id in &attributes.ordered {
                let data = self.attribute(*id)?;
                let name = data
                    .name
                    .as_ref()
                    .expect("canonical Attr name")
                    .units()
                    .collect::<Vec<_>>();
                if let Some(property) = property_name(&name)
                    && seen.insert(property.clone())
                {
                    output.push(property);
                }
            }
        }
        Ok(output)
    }

    pub(super) fn dataset_value(&self, owner: f64, property: &[u16]) -> Result<Option<Vec<u16>>> {
        let owner = node_id(owner)?;
        if self.links(owner)?.node_kind != Some(ELEMENT_NODE) {
            return Err(TreeError::NotElement(owner));
        }
        READS.fetch_add(1, Ordering::Relaxed);
        // A camel-cased data-* name can never contain hyphen followed by lowercase ASCII.
        if forbidden_property(property) {
            return Ok(None);
        }
        let wanted = attribute_name(property);
        if let Some(attributes) = self.attribute_collections.elements.get(&owner) {
            for id in &attributes.ordered {
                let data = self.attribute(*id)?;
                if data
                    .name
                    .as_ref()
                    .expect("canonical Attr name")
                    .units()
                    .eq(wanted.iter().copied())
                {
                    return Ok(Some(data.value.units().collect()));
                }
            }
        }
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn text(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }
    #[test]
    fn should_convert_ascii_case_and_preserve_other_utf16_units() {
        for (attribute, property) in [
            ("data-", ""),
            ("data-foo-bar", "fooBar"),
            ("data--foo", "Foo"),
            ("data-foo--bar", "foo-Bar"),
            ("data-é", "é"),
        ] {
            assert_eq!(property_name(&text(attribute)), Some(text(property)));
            assert_eq!(attribute_name(&text(property)), text(attribute));
        }
        assert_eq!(property_name(&text("data-Upper")), None);
        assert_eq!(property_name(&text("other-value")), None);
        let name = [DATA_PREFIX, &[0xd800, 0]].concat();
        assert_eq!(property_name(&name), Some(vec![0xd800, 0]));
    }
    #[test]
    fn should_prioritize_invalid_property_and_skip_validation_for_deletion() {
        assert_eq!(
            name_plan(&text("bad-name"), true).status,
            NameStatus::InvalidProperty
        );
        assert_eq!(
            name_plan(&text("space key"), true).status,
            NameStatus::InvalidName
        );
        assert_eq!(name_plan(&text("x:y"), true).status, NameStatus::Valid);
        assert_eq!(
            name_plan(&text("bad-name"), false).attribute,
            text("data-bad-name")
        );
        assert_eq!(name_plan(&[0xd800], false).status, NameStatus::Valid);
    }
    #[test]
    fn should_read_first_local_name_across_namespaces_and_deduplicate_enumeration() {
        let mut tree = TreeStore::new();
        let owner = tree.allocate().unwrap();
        tree.set_data(owner, r#"{"kind":1,"name":"div"}"#).unwrap();
        tree.initialize_attribute_collection(owner).unwrap();
        let mut attributes = Vec::new();
        for encoded in [
            r#"{"kind":2,"name":"data-name","prefix":"p","namespace":"urn:p","value":"first"}"#,
            r#"{"kind":2,"name":"data-name","value":"second"}"#,
            r#"{"kind":2,"name":"data-UPPER","value":"ignored"}"#,
        ] {
            let attribute = tree.allocate().unwrap();
            tree.initialize_attribute(attribute, encoded).unwrap();
            tree.append_attribute(owner, attribute).unwrap();
            attributes.push(attribute);
        }
        assert_eq!(tree.dataset_names(owner).unwrap(), vec![text("name")]);
        assert_eq!(
            tree.dataset_value(owner, &text("name")).unwrap(),
            Some(text("first"))
        );
        tree.remove_attribute(owner, attributes[0]).unwrap();
        assert_eq!(
            tree.dataset_value(owner, &text("name")).unwrap(),
            Some(text("second"))
        );
        assert_eq!(tree.dataset_value(owner, &text("bad-name")).unwrap(), None);
    }
}
