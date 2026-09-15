//! Regression coverage for every entry into canonical attribute ownership.
use super::*;

fn metadata() -> NodeData {
    NodeData {
        kind: ELEMENT_NODE,
        name: Some(DomString::Text("div".into())),
        namespace: Some(DomString::Text(HTML_NAMESPACE.into())),
        ..NodeData::default()
    }
}

fn fixture(from_attributes: bool, populated: bool) -> (TreeStore, f64, f64, f64) {
    let mut tree = TreeStore::new();
    let element = tree.allocate().unwrap();
    let source = tree.allocate().unwrap();
    let incoming = tree.allocate().unwrap();
    tree.initialize_attribute(source, r#"{"kind":2,"name":"id","value":"preserved"}"#)
        .unwrap();
    tree.initialize_attribute(
        incoming,
        r#"{"kind":2,"name":"data-new","value":"incoming"}"#,
    )
    .unwrap();
    if from_attributes {
        let attributes = if populated { vec![source] } else { Vec::new() };
        tree.set_element_from_attributes(element, metadata(), &attributes)
            .unwrap();
    } else {
        tree.set_data(element, if populated {
            r#"{"kind":1,"name":"div","namespace":"http://www.w3.org/1999/xhtml","attributes":[{"name":"id","value":"preserved"}]}"#
        } else {
            r#"{"kind":1,"name":"div","namespace":"http://www.w3.org/1999/xhtml"}"#
        }).unwrap();
    }
    (tree, element, source, incoming)
}

fn state(tree: &TreeStore) -> [f64; 11] {
    let statistics = tree.statistics();
    [
        statistics.attribute_collections,
        statistics.attribute_owners,
        statistics.attribute_holders,
        statistics.live_nodes,
        statistics.capacity,
        statistics.allocations,
        statistics.releases,
        statistics.reserved_handles,
        statistics.data_nodes,
        statistics.data_updates,
        statistics.mutations,
    ]
}

fn markup(tree: &mut TreeStore, element: f64) -> String {
    String::from_utf16(&tree.serialize_html(element, true, false).unwrap()).unwrap()
}

#[test]
fn should_reject_all_implicit_attribute_mutations_without_modifying_snapshots() {
    type Mutation = fn(&mut TreeStore, f64, f64, f64) -> Result<AttributeDelta>;
    let mutations: [Mutation; 4] = [
        |tree, element, _old, new| tree.append_attribute(element, new),
        |tree, element, _old, new| tree.set_attribute(element, new),
        |tree, element, old, _new| tree.remove_attribute(element, old),
        |tree, element, old, new| tree.replace_attribute(element, old, new),
    ];
    for from_attributes in [false, true] {
        for mutation in mutations {
            let (mut tree, element, source, incoming) = fixture(from_attributes, true);
            let before = state(&tree);
            for _ in 0..8 {
                assert!(matches!(
                    mutation(&mut tree, element, source, incoming),
                    Err(TreeError::NonEmptyAttributeSnapshot(_))
                ));
            }
            assert_eq!(state(&tree), before);
            assert_eq!(tree.attribute_owner(incoming).unwrap(), 0.0);
            assert_eq!(markup(&mut tree, element), "<div id=\"preserved\"></div>");
        }
    }
}

#[test]
fn should_seal_constructor_ownership_and_preserve_value_and_release_contracts() {
    let (mut tree, element, source, incoming) = fixture(true, true);
    let before = state(&tree);
    assert!(matches!(
        tree.initialize_attribute_owner(incoming, Some(element)),
        Err(TreeError::NonEmptyAttributeSnapshot(_))
    ));
    assert_eq!(state(&tree), before);
    tree.set_attribute_value(incoming, &[65]).unwrap();
    assert_eq!(markup(&mut tree, element), "<div id=\"preserved\"></div>");
    tree.release(incoming).unwrap();
    assert_eq!(markup(&mut tree, element), "<div id=\"preserved\"></div>");
    tree.release(element).unwrap();
    tree.release(source).unwrap();

    let (mut tree, element, source, incoming) = fixture(false, false);
    tree.initialize_attribute_owner(incoming, Some(element))
        .unwrap();
    assert_eq!(tree.statistics().attribute_collections, 1.0);
    let before = state(&tree);
    assert!(matches!(
        tree.set_element_from_attributes(element, metadata(), &[source]),
        Err(TreeError::AttributeCollectionInitialized(_))
    ));
    assert_eq!(state(&tree), before);
    tree.set_attribute_value(incoming, &[65]).unwrap();
    assert_eq!(markup(&mut tree, element), "<div></div>");
    tree.append_attribute(element, incoming).unwrap();
    assert_eq!(markup(&mut tree, element), "<div data-new=\"A\"></div>");
    tree.release(incoming).unwrap();
    assert_eq!(markup(&mut tree, element), "<div></div>");
    assert_eq!(tree.statistics().attribute_owners, 0.0);
}

#[test]
fn should_validate_owner_inputs_before_creating_any_collection() {
    let (mut tree, element, _source, incoming) = fixture(false, false);
    let reserved = tree.reserve_handles().unwrap();
    let before = state(&tree);
    assert!(
        tree.initialize_attribute_owner(reserved, Some(element))
            .is_err()
    );
    assert_eq!(state(&tree), before);
    assert!(
        tree.initialize_attribute_owner(incoming, Some(reserved))
            .is_err()
    );
    assert_eq!(state(&tree), before);
    tree.initialize_attribute_owner(incoming, None).unwrap();
    assert_eq!(state(&tree), before);
}

#[test]
fn should_protect_metadata_updates_without_restricting_initialization_or_retyping() {
    let (mut tree, element, _source, _incoming) = fixture(false, true);
    let before = state(&tree);
    assert!(matches!(
        tree.set_element_metadata(element, metadata()),
        Err(TreeError::NonEmptyAttributeSnapshot(_))
    ));
    assert_eq!(state(&tree), before);
    assert_eq!(markup(&mut tree, element), "<div id=\"preserved\"></div>");
    tree.set_data(element, r#"{"kind":3,"value":"retyped"}"#)
        .unwrap();
    tree.set_element_metadata(element, metadata()).unwrap();
    assert_eq!(markup(&mut tree, element), "<div></div>");
}

#[test]
fn should_borrow_snapshots_and_reject_invalid_canonical_data_at_the_reader() {
    let (mut tree, element, _source, _incoming) = fixture(false, true);
    let before = state(&tree);
    assert_eq!(tree.attribute_views(element as NodeId).unwrap().count(), 1);
    assert_eq!(state(&tree), before);
    assert_eq!(markup(&mut tree, element), "<div id=\"preserved\"></div>");
    assert!(matches!(
        tree.attribute_views(1000),
        Err(TreeError::MissingData(_))
    ));
    // The storage primitive has no metadata. An invalid canonical handle must still surface
    // through the borrowed view instead of being replaced by an obsolete snapshot.
    tree.attribute_collections.initialize(element as NodeId);
    tree.attribute_collections
        .append(element as NodeId, 1000, vec![65]);
    assert!(matches!(
        tree.attribute_views(element as NodeId).unwrap().next(),
        Some(Err(TreeError::NotAttribute(_)))
    ));
    assert!(matches!(
        tree.serialize_html(element, true, false),
        Err(TreeError::NotAttribute(_))
    ));
}
