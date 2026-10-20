//! HTMLCollection named lookup and supported-name ordering over borrowed canonical attributes.
use super::{
    constants::{ELEMENT_NODE, HTML_NAMESPACE, ID_ATTRIBUTE_NAME, NAME_ATTRIBUTE_NAME},
    data::{DomString, NodeData},
    error::{Result, TreeError},
    store::{NodeId, TreeStore, node_id},
};
use rustc_hash::FxHashSet;

impl TreeStore {
    fn collection_element(&self, handle: f64) -> Result<(NodeId, &NodeData)> {
        let id = node_id(handle)?;
        let data = self
            .data
            .get(&id)
            .filter(|data| data.kind == ELEMENT_NODE)
            .ok_or(TreeError::NotElement(id))?;
        Ok((id, data))
    }

    fn collection_attribute_value<'a>(
        &'a self,
        id: NodeId,
        data: &'a NodeData,
        name: &str,
    ) -> Result<Option<&'a DomString>> {
        for attribute in self.attribute_views_for_data(id, data) {
            let attribute = attribute?;
            if attribute.namespace.is_none() && attribute.name.code_units_equal_str(name) {
                return Ok(Some(attribute.value));
            }
        }
        Ok(None)
    }

    /// The first member matching id or its eligible HTML name wins; no global id priority.
    pub(super) fn collection_named_item(&self, handles: &[f64], key: &[u16]) -> Result<f64> {
        if key.is_empty() {
            return Ok(0.0);
        }
        let expected = DomString::from_units(key);
        for &handle in handles {
            let (id, data) = self.collection_element(handle)?;
            if self
                .collection_attribute_value(id, data, ID_ATTRIBUTE_NAME)?
                .is_some_and(|value| value.code_units_equal(&expected))
            {
                return Ok(handle);
            }
            if data
                .namespace
                .as_ref()
                .is_some_and(|namespace| namespace.code_units_equal_str(HTML_NAMESPACE))
                && self
                    .collection_attribute_value(id, data, NAME_ATTRIBUTE_NAME)?
                    .is_some_and(|value| value.code_units_equal(&expected))
            {
                return Ok(handle);
            }
        }
        Ok(0.0)
    }

    /// Return nonempty id/name values in member order, preserving the first occurrence of each name.
    pub(super) fn collection_property_names(&self, handles: &[f64]) -> Result<Vec<Vec<u16>>> {
        let mut seen = FxHashSet::default();
        let mut result = Vec::new();
        for &handle in handles {
            let (id, data) = self.collection_element(handle)?;
            let id_value = self.collection_attribute_value(id, data, ID_ATTRIBUTE_NAME)?;
            let name_value = if data
                .namespace
                .as_ref()
                .is_some_and(|namespace| namespace.code_units_equal_str(HTML_NAMESPACE))
            {
                self.collection_attribute_value(id, data, NAME_ATTRIBUTE_NAME)?
            } else {
                None
            };
            for value in [id_value, name_value].into_iter().flatten() {
                if value.is_empty() {
                    continue;
                }
                let units = value.units().collect::<Vec<_>>();
                if seen.insert(units.clone()) {
                    result.push(units);
                }
            }
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn element(
        store: &mut TreeStore,
        namespace: Option<&str>,
        attributes: serde_json::Value,
    ) -> f64 {
        let handle = store.allocate().unwrap();
        store
            .set_data(
                handle,
                &json!({"kind":1,"name":"i","namespace":namespace,"attributes":attributes})
                    .to_string(),
            )
            .unwrap();
        handle
    }
    fn units(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }

    #[test]
    fn should_preserve_member_order_and_html_name_eligibility() {
        let mut store = TreeStore::new();
        let named = element(
            &mut store,
            Some(HTML_NAMESPACE),
            json!([{"name":"id","value":"first"},{"name":"name","value":"shared"}]),
        );
        let id = element(
            &mut store,
            None,
            json!([{"name":"id","value":"shared"},{"name":"name","value":"foreign"}]),
        );
        assert_eq!(
            store
                .collection_named_item(&[named, id], &units("shared"))
                .unwrap(),
            named
        );
        assert_eq!(
            store
                .collection_named_item(&[id, named], &units("shared"))
                .unwrap(),
            id
        );
        assert_eq!(
            store
                .collection_named_item(&[id, named], &units("foreign"))
                .unwrap(),
            0.0
        );
        assert_eq!(store.collection_named_item(&[named, id], &[]).unwrap(), 0.0);
        assert_eq!(
            store.collection_property_names(&[named, id]).unwrap(),
            ["first", "shared"].map(units)
        );
    }

    #[test]
    fn should_ignore_namespaced_and_uppercase_attributes_and_keep_first_alias_values() {
        let mut store = TreeStore::new();
        let handle = element(
            &mut store,
            Some(HTML_NAMESPACE),
            json!([
            {"name":"id","namespace":"urn:attributes","value":"ignored"},
            {"name":"ID","value":"uppercase"},{"name":"name","value":"first"},{"name":"name","value":"second"},
            {"name":"id","value":"actual"}]),
        );
        assert_eq!(
            store.collection_property_names(&[handle]).unwrap(),
            ["actual", "first"].map(units)
        );
        for absent in ["ignored", "uppercase", "second"] {
            assert_eq!(
                store
                    .collection_named_item(&[handle], &units(absent))
                    .unwrap(),
                0.0
            );
        }
        assert_eq!(
            store
                .collection_named_item(&[handle], &units("first"))
                .unwrap(),
            handle
        );
    }

    #[test]
    fn should_keep_surrogates_nul_and_supported_name_order_without_string_replacement() {
        let mut store = TreeStore::new();
        let first = element(
            &mut store,
            Some(HTML_NAMESPACE),
            json!([{"name":"id","value":[0xd800]},{"name":"name","value":[0xdc00]}]),
        );
        let second = element(
            &mut store,
            Some(HTML_NAMESPACE),
            json!([{"name":"id","value":[0xdc00]},{"name":"name","value":[0]}]),
        );
        assert_eq!(
            store
                .collection_named_item(&[first, second], &[0xd800])
                .unwrap(),
            first
        );
        assert_eq!(
            store
                .collection_named_item(&[first, second], &[0xdc00])
                .unwrap(),
            first
        );
        assert_eq!(
            store
                .collection_named_item(&[first, second], &[0xfffd])
                .unwrap(),
            0.0
        );
        assert_eq!(
            store.collection_property_names(&[first, second]).unwrap(),
            vec![vec![0xd800], vec![0xdc00], vec![0]]
        );
    }

    #[test]
    fn should_read_canonical_attribute_changes_without_retaining_a_name_index() {
        let mut store = TreeStore::new();
        let handle = element(&mut store, Some(HTML_NAMESPACE), json!([]));
        store.initialize_attribute_collection(handle).unwrap();
        let attribute = store.allocate().unwrap();
        store
            .initialize_attribute(attribute, r#"{"kind":2,"name":"id","value":"before"}"#)
            .unwrap();
        store.append_attribute(handle, attribute).unwrap();
        assert_eq!(
            store
                .collection_named_item(&[handle], &units("before"))
                .unwrap(),
            handle
        );
        store
            .set_attribute_value(attribute, &units("after"))
            .unwrap();
        assert_eq!(
            store
                .collection_named_item(&[handle], &units("before"))
                .unwrap(),
            0.0
        );
        assert_eq!(
            store.collection_property_names(&[handle]).unwrap(),
            vec![units("after")]
        );
        store.remove_attribute(handle, attribute).unwrap();
        assert!(
            store
                .collection_property_names(&[handle])
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn should_reject_invalid_released_and_non_element_members_without_activation() {
        let mut store = TreeStore::new();
        let reserved = store.reserve_handles().unwrap();
        let text = store.allocate().unwrap();
        store
            .set_data(text, r#"{"kind":3,"value":"text"}"#)
            .unwrap();
        let released = element(&mut store, None, json!([]));
        store.release(released).unwrap();
        let before = store.statistics();
        for invalid in [0.0, -1.0, 0.5, f64::NAN, reserved, text, released] {
            assert!(
                store
                    .collection_named_item(&[invalid], &units("key"))
                    .is_err()
            );
            assert!(store.collection_property_names(&[invalid]).is_err());
        }
        assert_eq!(store.statistics().allocations, before.allocations);
        assert_eq!(store.statistics().reserved_handles, before.reserved_handles);
    }
}
