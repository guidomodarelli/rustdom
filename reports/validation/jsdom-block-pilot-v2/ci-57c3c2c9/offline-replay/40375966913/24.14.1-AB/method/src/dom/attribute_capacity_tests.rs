//! Capacity regression tests keep the owning collection alive while releasing transient attributes.
use super::*;
use serde_json::{Value, json};

fn name(value: &str) -> Vec<u16> {
    value.encode_utf16().collect()
}

fn capacities(collections: &AttributeCollections, element: NodeId) -> Value {
    let index = &collections.elements[&element];
    json!({
        "ordered": index.ordered.capacity(),
        "names": index.names.capacity(),
        "references": index.references.capacity(),
        "elements": collections.elements.capacity(),
        "owners": collections.owners.capacity(),
        "holders": collections.holders.capacity(),
        "looseOwners": collections.loose_owners.capacity(),
    })
}

fn record(scenario: &str, peak: Value, retained: Value) {
    println!(
        "attribute-capacity {}",
        json!({"scenario": scenario, "peak": peak, "retained": retained})
    );
}

#[test]
fn should_reclaim_capacity_after_unique_attribute_bursts_on_a_live_element() {
    let mut collections = AttributeCollections::default();
    collections.initialize(1);
    for batch in 0..3 {
        for index in 0..4096 {
            collections.append(1, index + 100, name(&format!("data-{index}")));
        }
        let peak = capacities(&collections, 1);
        for index in (8..4096).rev() {
            collections.remove(1, index + 100, &name(&format!("data-{index}")));
        }
        record(
            &format!("unique-sparse-{batch}"),
            peak,
            capacities(&collections, 1),
        );
        assert_eq!(
            collections.elements[&1].ordered,
            (100..108).collect::<Vec<_>>()
        );
        assert_eq!(collections.elements[&1].references.len(), 8);
        for index in 0..8 {
            assert_eq!(
                collections.elements[&1].names[&name(&format!("data-{index}"))],
                vec![index + 100]
            );
            assert_eq!(collections.owners[&(index + 100)], 1);
        }
        for container in ["ordered", "names", "references", "owners", "holders"] {
            assert!(
                capacities(&collections, 1)[container].as_u64().unwrap() < 256,
                "{container} retained high-water capacity"
            );
        }
        for index in (0..8).rev() {
            collections.remove(1, index + 100, &name(&format!("data-{index}")));
        }
        assert!(collections.elements[&1].ordered.is_empty());
        assert!(collections.elements[&1].names.is_empty());
        assert!(collections.elements[&1].references.is_empty());
        record(
            &format!("unique-empty-{batch}"),
            Value::Null,
            capacities(&collections, 1),
        );
    }
}

#[test]
fn should_reclaim_duplicate_name_bucket_capacity_without_changing_order() {
    let mut collections = AttributeCollections::default();
    collections.initialize(1);
    let qualified = name("same");
    for attribute in 100..4196 {
        collections.append(1, attribute, qualified.clone());
    }
    let peak = collections.elements[&1].names[&qualified].capacity();
    for attribute in (108..4196).rev() {
        collections.remove(1, attribute, &qualified);
    }
    let remaining = &collections.elements[&1].names[&qualified];
    record(
        "duplicate-name-bucket",
        json!(peak),
        json!(remaining.capacity()),
    );
    assert_eq!(*remaining, (100..108).collect::<Vec<_>>());
    assert!(remaining.capacity() < 256);
    for attribute in 100..108 {
        assert_eq!(collections.elements[&1].references[&attribute], 2);
    }
}

#[test]
fn should_compact_a_live_index_when_attributes_finalize_before_the_owner() {
    let mut collections = AttributeCollections::default();
    collections.initialize(1);
    let qualified = name("same");
    for attribute in 100..4196 {
        collections.append(1, attribute, qualified.clone());
    }
    let peak = capacities(&collections, 1);
    let mut previous_capacity = collections.elements[&1].ordered.capacity();
    let mut reductions = 0;
    for attribute in (108..4196).rev() {
        assert_eq!(
            collections.release_node(attribute, Some(&qualified)),
            vec![1]
        );
        let capacity = collections.elements[&1].ordered.capacity();
        if capacity < previous_capacity {
            reductions += 1;
            previous_capacity = capacity;
        }
    }
    let index = &collections.elements[&1];
    record(
        "attributes-finalize-before-owner",
        peak,
        capacities(&collections, 1),
    );
    record(
        "ordered-buffer-reductions-across-4088-releases",
        Value::Null,
        json!(reductions),
    );
    assert_eq!(index.ordered, (100..108).collect::<Vec<_>>());
    assert_eq!(index.names[&qualified], index.ordered);
    assert!(index.ordered.capacity() < 256);
    assert!(index.names[&qualified].capacity() < 256);
    assert!(index.references.capacity() < 256);
    assert!(reductions > 0 && reductions <= 8);
    for attribute in 100..108 {
        assert_eq!(collections.owners[&attribute], 1);
        assert_eq!(index.references[&attribute], 2);
    }
}

#[test]
fn should_preserve_live_aliases_when_the_ordered_collection_becomes_empty() {
    let mut collections = AttributeCollections::default();
    collections.initialize(1);
    collections.initialize(4);
    collections.append(1, 2, name("p:key"));
    collections.replace(1, 2, 3, name("q:key"));
    collections.remove(1, 3, &name("q:key"));
    collections.append(4, 2, name("p:key"));
    for attribute in 100..4196 {
        collections.append(1, attribute, name(&format!("data-{attribute}")));
    }
    let peak = capacities(&collections, 1);
    for attribute in (100..4196).rev() {
        collections.remove(1, attribute, &name(&format!("data-{attribute}")));
    }
    let index = &collections.elements[&1];
    record(
        "live-alias-with-empty-order",
        peak,
        capacities(&collections, 1),
    );
    assert!(index.ordered.is_empty());
    assert_eq!(index.names[&name("p:key")], vec![2]);
    assert_eq!(index.references[&2], 1);
    assert_eq!(collections.owners[&2], 4);
    assert_eq!(collections.holders[&2].len(), 2);
    assert!(index.ordered.capacity() < 256);
    assert!(index.names.capacity() < 256);
    assert!(index.references.capacity() < 256);
}

#[test]
fn should_reclaim_global_tables_while_an_element_and_attribute_remain_alive() {
    let mut collections = AttributeCollections::default();
    for index in 0..4096 {
        let element = index * 2 + 100;
        collections.initialize(element);
        collections.append(element, element + 1, name("data-key"));
    }
    let peak = capacities(&collections, 100);
    for index in (1..4096).rev() {
        collections.release_node(index * 2 + 100, None);
    }
    record(
        "global-tables-with-live-pair",
        peak,
        capacities(&collections, 100),
    );
    assert_eq!(collections.elements.len(), 1);
    assert_eq!(collections.owners[&101], 100);
    assert_eq!(
        collections.holders[&101]
            .iter()
            .copied()
            .collect::<Vec<_>>(),
        vec![100]
    );
    assert!(collections.elements.capacity() < 256);
    assert!(collections.owners.capacity() < 256);
    assert!(collections.holders.capacity() < 256);
    collections.release_node(100, None);
    assert_eq!(collections.elements.capacity(), 0);
    assert_eq!(collections.owners.capacity(), 0);
    assert_eq!(collections.holders.capacity(), 0);
}

#[test]
fn should_reclaim_shared_holder_capacity_without_losing_the_remaining_alias() {
    let mut collections = AttributeCollections::default();
    for index in 0..2048 {
        let element = index + 100;
        collections.initialize(element);
        collections.append(element, 2, name("p:key"));
        collections.replace(element, 2, index + 10_000, name("q:key"));
    }
    let peak = collections.holders[&2].capacity();
    for element in (101..2148).rev() {
        collections.release_node(element, None);
    }
    record(
        "shared-holder-set",
        json!(peak),
        json!(collections.holders[&2].capacity()),
    );
    assert_eq!(
        collections.holders[&2].iter().copied().collect::<Vec<_>>(),
        vec![100]
    );
    assert_eq!(collections.elements[&100].names[&name("p:key")], vec![2]);
    assert!(collections.holders[&2].capacity() < 256);
    assert_eq!(collections.release_node(2, Some(&name("p:key"))), vec![100]);
    assert_eq!(collections.elements[&100].ordered, vec![10_000]);
    assert_eq!(
        collections.elements[&100].names[&name("q:key")],
        vec![10_000]
    );
}

#[test]
fn should_reclaim_constructor_owner_sets_and_tables_as_attributes_finalize() {
    let mut collections = AttributeCollections::default();
    collections.initialize(1);
    for attribute in 100..4196 {
        collections.set_initial_owner(attribute, 1);
    }
    let peak = collections.loose_owners[&1].capacity();
    for attribute in (108..4196).rev() {
        collections.release_node(attribute, None);
    }
    record(
        "constructor-owner-set",
        json!(peak),
        json!(collections.loose_owners[&1].capacity()),
    );
    assert_eq!(collections.loose_owners[&1].len(), 8);
    assert!(collections.loose_owners[&1].capacity() < 256);
    for attribute in 100..108 {
        assert_eq!(collections.owners[&attribute], 1);
        collections.release_node(attribute, None);
    }
    for element in 100..4196 {
        collections.set_initial_owner(element + 10_000, element);
    }
    let peak = collections.loose_owners.capacity();
    for element in (101..4196).rev() {
        collections.release_node(element, None);
    }
    record(
        "constructor-owner-table",
        json!(peak),
        json!(collections.loose_owners.capacity()),
    );
    assert_eq!(
        collections.loose_owners[&100]
            .iter()
            .copied()
            .collect::<Vec<_>>(),
        vec![10_100]
    );
    assert!(collections.loose_owners.capacity() < 256);
    assert!(collections.owners.capacity() < 256);
}
