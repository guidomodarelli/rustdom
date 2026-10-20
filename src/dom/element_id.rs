//! Exact first-ID lookup bounded by the canonical physical subtree.
use super::{
    constants::{ELEMENT_NODE, ID_ATTRIBUTE_NAME},
    error::{Result, TreeError},
    store::{TreeStore, node_id},
};

impl TreeStore {
    /// Return the first descendant Element with an exact nonempty ID, or the zero sentinel.
    pub(super) fn query_element_by_id(&self, handle: f64, id: &[u16]) -> Result<f64> {
        let root = node_id(handle)?;
        let mut current = self.links(root)?.first;
        if id.is_empty() {
            return Ok(0.0);
        }
        while current != 0 {
            let data = self
                .data
                .get(&current)
                .ok_or(TreeError::MissingData(current))?;
            if data.kind == ELEMENT_NODE
                && self
                    .attribute_value_for_data(current, data, ID_ATTRIBUTE_NAME)?
                    .is_some_and(|value| value.units().eq(id.iter().copied()))
            {
                return Ok(current as f64);
            }
            current = self.following_within(current, root)?;
        }
        Ok(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn node(store: &mut TreeStore, data: serde_json::Value) -> f64 {
        let handle = store.allocate().unwrap();
        store.set_data(handle, &data.to_string()).unwrap();
        handle
    }

    fn units(value: &str) -> Vec<u16> {
        value.encode_utf16().collect()
    }

    #[test]
    fn should_match_only_exact_null_namespace_ids_in_all_element_namespaces() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":11}));
        for data in [
            json!({"kind":3,"value":"chosen"}),
            json!({"kind":1,"name":"entry","attributes":[{"name":"ID","value":"chosen"}]}),
            json!({"kind":1,"name":"entry","attributes":[{"name":"id","namespace":"urn:attributes","value":"chosen"}]}),
            json!({"kind":1,"name":"entry","attributes":[{"name":"id","value":"Chosen"}]}),
        ] {
            let excluded = node(&mut store, data);
            store.append(root, excluded).unwrap();
        }
        assert_eq!(
            store.query_element_by_id(root, &units("chosen")).unwrap(),
            0.0
        );
        for namespace in [
            Some("http://www.w3.org/1999/xhtml"),
            Some("urn:element"),
            None,
        ] {
            let matched = node(
                &mut store,
                json!({"kind":1,"name":"entry","namespace":namespace,"attributes":[{"name":"id","value":"chosen"}]}),
            );
            store.append(root, matched).unwrap();
            assert_eq!(
                store.query_element_by_id(root, &units("chosen")).unwrap(),
                matched
            );
            store.remove(matched).unwrap();
        }
    }

    #[test]
    fn should_stop_at_first_duplicate_and_follow_live_physical_tree_order() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":11}));
        let first = node(
            &mut store,
            json!({"kind":1,"name":"first","attributes":[{"name":"id","value":"chosen"}]}),
        );
        let nested = node(&mut store, json!({"kind":1,"name":"nested"}));
        let deep = node(
            &mut store,
            json!({"kind":1,"name":"deep","attributes":[{"name":"id","value":"chosen"}]}),
        );
        let second = node(
            &mut store,
            json!({"kind":1,"name":"second","attributes":[{"name":"id","value":"chosen"}]}),
        );
        store.append(root, first).unwrap();
        store.append(root, nested).unwrap();
        store.append(nested, deep).unwrap();
        store.append(root, second).unwrap();
        assert_eq!(
            store.query_element_by_id(root, &units("chosen")).unwrap(),
            first
        );
        store.remove(first).unwrap();
        store.append(nested, first).unwrap();
        assert_eq!(
            store.query_element_by_id(root, &units("chosen")).unwrap(),
            deep
        );
        store.remove(nested).unwrap();
        assert_eq!(
            store.query_element_by_id(root, &units("chosen")).unwrap(),
            second
        );
        // The first match must return without materializing or visiting a later data-less node.
        let uninitialized = store.allocate().unwrap();
        store.append(root, uninitialized).unwrap();
        assert_eq!(
            store.query_element_by_id(root, &units("chosen")).unwrap(),
            second
        );
    }

    #[test]
    fn should_preserve_literal_utf16_values_and_never_match_an_empty_id() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":11}));
        let empty = node(
            &mut store,
            json!({"kind":1,"name":"empty","attributes":[{"name":"id","value":""}]}),
        );
        store.append(root, empty).unwrap();
        assert_eq!(store.query_element_by_id(root, &[]).unwrap(), 0.0);
        for value in [units("*"), units(" chosen "), vec![0xd800, 0, 0xdc00]] {
            let matched = node(
                &mut store,
                json!({"kind":1,"name":"entry","attributes":[{"name":"id","value":value}]}),
            );
            store.append(root, matched).unwrap();
            assert_eq!(store.query_element_by_id(root, &value).unwrap(), matched);
        }
        assert_eq!(
            store
                .query_element_by_id(root, &[0xfffd, 0, 0xfffd])
                .unwrap(),
            0.0
        );
    }

    #[test]
    fn should_observe_current_canonical_attr_values_and_removal_without_an_index() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":11}));
        let matched = node(&mut store, json!({"kind":1,"name":"entry"}));
        store.append(root, matched).unwrap();
        store.initialize_attribute_collection(matched).unwrap();
        let attribute = store.allocate().unwrap();
        store
            .initialize_attribute(attribute, r#"{"kind":2,"name":"id","value":"before"}"#)
            .unwrap();
        store.append_attribute(matched, attribute).unwrap();
        assert_eq!(
            store.query_element_by_id(root, &units("before")).unwrap(),
            matched
        );
        store
            .set_attribute_value(attribute, &units("after"))
            .unwrap();
        assert_eq!(
            store.query_element_by_id(root, &units("before")).unwrap(),
            0.0
        );
        assert_eq!(
            store.query_element_by_id(root, &units("after")).unwrap(),
            matched
        );
        store.remove_attribute(matched, attribute).unwrap();
        assert_eq!(
            store.query_element_by_id(root, &units("after")).unwrap(),
            0.0
        );
    }

    #[test]
    fn should_exclude_the_root_and_external_subtrees_without_retaining_owners() {
        let mut store = TreeStore::new();
        let outer = node(&mut store, json!({"kind":11}));
        let root = node(
            &mut store,
            json!({"kind":1,"name":"root","attributes":[{"name":"id","value":"chosen"}]}),
        );
        let external = node(
            &mut store,
            json!({"kind":1,"name":"external","attributes":[{"name":"id","value":"chosen"}]}),
        );
        let matched = node(
            &mut store,
            json!({"kind":1,"name":"entry","attributes":[{"name":"id","value":"inside"}]}),
        );
        store.append(outer, root).unwrap();
        store.append(outer, external).unwrap();
        store.append(root, matched).unwrap();
        assert_eq!(
            store.query_element_by_id(root, &units("chosen")).unwrap(),
            0.0
        );
        let result = store.query_element_by_id(root, &units("inside")).unwrap();
        assert_eq!(result, matched);
        for handle in [matched, root, external, outer] {
            store.release(handle).unwrap();
        }
        assert_eq!(store.statistics().live_nodes, 0.0);
        assert_eq!(store.statistics().data_nodes, 0.0);
        assert_eq!(result, matched);
    }

    #[test]
    fn should_reject_invalid_roots_and_missing_descendant_metadata_without_activation() {
        let mut store = TreeStore::new();
        let root = node(&mut store, json!({"kind":11}));
        let reserved = store.reserve_handles().unwrap();
        let before = store.statistics();
        for invalid in [0.0, -1.0, 0.5, f64::NAN, reserved] {
            assert!(
                store
                    .query_element_by_id(invalid, &units("chosen"))
                    .is_err()
            );
            assert!(store.query_element_by_id(invalid, &[]).is_err());
        }
        assert_eq!(store.statistics().allocations, before.allocations);
        assert_eq!(store.statistics().reserved_handles, before.reserved_handles);
        let missing = store.allocate().unwrap();
        store.append(root, missing).unwrap();
        assert!(store.query_element_by_id(root, &units("chosen")).is_err());
    }
}
