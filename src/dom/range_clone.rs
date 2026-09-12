//! Iterative cloneContents control. The host executes effects only after native borrows end.
use super::{
    constants::{COMMENT_NODE, PROCESSING_INSTRUCTION_NODE, TEXT_NODE},
    error::{Result, TreeError},
    range_content_queries::ContentSelection,
    range_state::BoundaryPoint,
    store::{NodeId, TreeStore, node_id},
};

#[derive(Debug, PartialEq)]
pub(crate) enum CloneAction {
    CreateFragment(NodeId),
    CloneNode {
        node: NodeId,
        deep: bool,
    },
    SliceData {
        node: NodeId,
        offset: f64,
        count: f64,
    },
    AppendChild {
        parent: NodeId,
        node: NodeId,
    },
    PinNodes(Vec<NodeId>),
    Complete(NodeId),
    InvalidDoctype,
    InconsistentRoots,
}

#[derive(Clone, Copy)]
enum Phase {
    Fragment,
    Check,
    Selection,
    First,
    SingleSlice,
    SingleAppend,
    FirstSlice,
    FirstAppend,
    FirstElementAppend,
    FirstChild,
    AwaitFirstChild,
    Contents,
    ContainedAppend,
    Last,
    LastSlice,
    LastAppend,
    LastElementAppend,
    LastChild,
    AwaitLastChild,
    Complete,
}
struct Frame {
    start: BoundaryPoint,
    end: BoundaryPoint,
    fragment: NodeId,
    cloned: NodeId,
    phase: Phase,
    selection: Option<ContentSelection>,
    contained_index: usize,
}
impl Frame {
    fn new(start: BoundaryPoint, end: BoundaryPoint) -> Self {
        Self {
            start,
            end,
            fragment: 0,
            cloned: 0,
            phase: Phase::Fragment,
            selection: None,
            contained_index: 0,
        }
    }
}
#[derive(Clone, Copy)]
enum CreatedNode {
    Fragment,
    Clone,
}

/// Frames and results contain IDs only. Completion/cancellation immediately releases frame buffers.
pub(crate) struct CloneMachine {
    frames: Vec<Frame>,
    waiting: Option<CreatedNode>,
    completed: Option<NodeId>,
    canceled: bool,
}
impl CloneMachine {
    pub fn new(start: BoundaryPoint, end: BoundaryPoint) -> Self {
        Self {
            frames: vec![Frame::new(start, end)],
            waiting: None,
            completed: None,
            canceled: false,
        }
    }
    pub fn cancel(&mut self) {
        self.frames = Vec::new();
        self.waiting = None;
        self.canceled = true;
    }
    pub fn complete(&self) -> bool {
        self.completed.is_some()
    }

    pub fn step(&mut self, tree: &mut TreeStore, created: f64) -> Result<CloneAction> {
        if self.canceled {
            return Err(TreeError::RangeCloneProtocol("operation was canceled"));
        }
        if let Some(destination) = self.waiting {
            let id = node_id(created)?;
            tree.links(id)?;
            let frame = self.frames.last_mut().ok_or(TreeError::RangeCloneProtocol(
                "no frame is waiting for a node",
            ))?;
            match destination {
                CreatedNode::Fragment => frame.fragment = id,
                CreatedNode::Clone => frame.cloned = id,
            }
            self.waiting = None;
        } else if created != 0.0 {
            return Err(TreeError::RangeCloneProtocol(
                "step received a node without a pending creation",
            ));
        }
        if let Some(fragment) = self.completed {
            return Ok(CloneAction::Complete(fragment));
        }
        loop {
            let frame = self.frames.last_mut().ok_or(TreeError::RangeCloneProtocol(
                "operation has no active frame",
            ))?;
            match frame.phase {
                Phase::Fragment => {
                    tree.links(frame.start.node)?;
                    tree.links(frame.end.node)?;
                    frame.phase = Phase::Check;
                    self.waiting = Some(CreatedNode::Fragment);
                    return Ok(CloneAction::CreateFragment(frame.start.node));
                }
                Phase::Check => {
                    if frame.start.node == frame.end.node && frame.start.offset == frame.end.offset
                    {
                        frame.phase = Phase::Complete;
                    } else if frame.start.node == frame.end.node
                        && character(tree, frame.start.node)?
                    {
                        frame.phase = Phase::SingleSlice;
                        self.waiting = Some(CreatedNode::Clone);
                        return Ok(CloneAction::CloneNode {
                            node: frame.start.node,
                            deep: false,
                        });
                    } else {
                        frame.phase = Phase::Selection;
                    }
                }
                Phase::SingleSlice => {
                    frame.phase = Phase::SingleAppend;
                    return Ok(CloneAction::SliceData {
                        node: frame.cloned,
                        offset: frame.start.offset,
                        count: frame.end.offset - frame.start.offset,
                    });
                }
                Phase::SingleAppend => {
                    frame.phase = Phase::Complete;
                    return Ok(CloneAction::AppendChild {
                        parent: frame.fragment,
                        node: frame.cloned,
                    });
                }
                Phase::Selection => {
                    let Some(selection) = tree.range_content_selection(frame.start, frame.end)?
                    else {
                        self.cancel();
                        return Ok(CloneAction::InconsistentRoots);
                    };
                    if selection.has_doctype {
                        self.cancel();
                        return Ok(CloneAction::InvalidDoctype);
                    }
                    let mut pins = Vec::with_capacity(selection.contained.len() + 5);
                    pins.extend(
                        [
                            frame.start.node,
                            frame.end.node,
                            selection.common,
                            selection.first_partial,
                            selection.last_partial,
                        ]
                        .into_iter()
                        .filter(|node| *node != 0),
                    );
                    pins.extend(selection.contained.iter().copied());
                    frame.selection = Some(selection);
                    frame.phase = Phase::First;
                    return Ok(CloneAction::PinNodes(pins));
                }
                Phase::First => {
                    let first = frame
                        .selection
                        .as_ref()
                        .expect("selection prepared")
                        .first_partial;
                    if first == 0 {
                        frame.phase = Phase::Contents;
                        continue;
                    }
                    let is_character = character(tree, first)?;
                    frame.phase = if is_character {
                        Phase::FirstSlice
                    } else {
                        Phase::FirstElementAppend
                    };
                    self.waiting = Some(CreatedNode::Clone);
                    return Ok(CloneAction::CloneNode {
                        node: if is_character {
                            frame.start.node
                        } else {
                            first
                        },
                        deep: false,
                    });
                }
                Phase::FirstSlice => {
                    // Read after the clone hook, at the same point as the original driver.
                    let count =
                        tree.range_node_length(frame.start.node)? as f64 - frame.start.offset;
                    frame.phase = Phase::FirstAppend;
                    return Ok(CloneAction::SliceData {
                        node: frame.cloned,
                        offset: frame.start.offset,
                        count,
                    });
                }
                Phase::FirstAppend => {
                    frame.phase = Phase::Contents;
                    return Ok(CloneAction::AppendChild {
                        parent: frame.fragment,
                        node: frame.cloned,
                    });
                }
                Phase::FirstElementAppend => {
                    frame.phase = Phase::FirstChild;
                    return Ok(CloneAction::AppendChild {
                        parent: frame.fragment,
                        node: frame.cloned,
                    });
                }
                Phase::FirstChild => {
                    let first = frame
                        .selection
                        .as_ref()
                        .expect("selection prepared")
                        .first_partial;
                    let child = Frame::new(
                        frame.start,
                        BoundaryPoint {
                            node: first,
                            offset: tree.range_node_length(first)? as f64,
                        },
                    );
                    frame.phase = Phase::AwaitFirstChild;
                    self.frames.push(child);
                }
                Phase::Contents => {
                    let selection = frame.selection.as_ref().expect("selection prepared");
                    if let Some(&node) = selection.contained.get(frame.contained_index) {
                        frame.contained_index += 1;
                        frame.phase = Phase::ContainedAppend;
                        self.waiting = Some(CreatedNode::Clone);
                        return Ok(CloneAction::CloneNode { node, deep: true });
                    }
                    frame.phase = Phase::Last;
                }
                Phase::ContainedAppend => {
                    frame.phase = Phase::Contents;
                    return Ok(CloneAction::AppendChild {
                        parent: frame.fragment,
                        node: frame.cloned,
                    });
                }
                Phase::Last => {
                    let last = frame
                        .selection
                        .as_ref()
                        .expect("selection prepared")
                        .last_partial;
                    if last == 0 {
                        frame.phase = Phase::Complete;
                        continue;
                    }
                    let is_character = character(tree, last)?;
                    frame.phase = if is_character {
                        Phase::LastSlice
                    } else {
                        Phase::LastElementAppend
                    };
                    self.waiting = Some(CreatedNode::Clone);
                    return Ok(CloneAction::CloneNode {
                        node: if is_character { frame.end.node } else { last },
                        deep: false,
                    });
                }
                Phase::LastSlice => {
                    frame.phase = Phase::LastAppend;
                    return Ok(CloneAction::SliceData {
                        node: frame.cloned,
                        offset: 0.0,
                        count: frame.end.offset,
                    });
                }
                Phase::LastAppend => {
                    frame.phase = Phase::Complete;
                    return Ok(CloneAction::AppendChild {
                        parent: frame.fragment,
                        node: frame.cloned,
                    });
                }
                Phase::LastElementAppend => {
                    frame.phase = Phase::LastChild;
                    return Ok(CloneAction::AppendChild {
                        parent: frame.fragment,
                        node: frame.cloned,
                    });
                }
                Phase::LastChild => {
                    let last = frame
                        .selection
                        .as_ref()
                        .expect("selection prepared")
                        .last_partial;
                    let child = Frame::new(
                        BoundaryPoint {
                            node: last,
                            offset: 0.0,
                        },
                        frame.end,
                    );
                    frame.phase = Phase::AwaitLastChild;
                    self.frames.push(child);
                }
                Phase::Complete => {
                    let fragment = frame.fragment;
                    self.frames.pop();
                    if let Some(parent) = self.frames.last_mut() {
                        parent.phase = match parent.phase {
                            Phase::AwaitFirstChild => Phase::Contents,
                            Phase::AwaitLastChild => Phase::Complete,
                            _ => {
                                return Err(TreeError::RangeCloneProtocol(
                                    "child completed outside a pending subclone",
                                ));
                            }
                        };
                        return Ok(CloneAction::AppendChild {
                            parent: parent.cloned,
                            node: fragment,
                        });
                    }
                    self.frames = Vec::new();
                    self.completed = Some(fragment);
                    return Ok(CloneAction::Complete(fragment));
                }
                Phase::AwaitFirstChild | Phase::AwaitLastChild => {
                    return Err(TreeError::RangeCloneProtocol(
                        "pending subclone has no frame",
                    ));
                }
            }
        }
    }
}

fn character(tree: &TreeStore, node: NodeId) -> Result<bool> {
    let kind = tree
        .data
        .get(&node)
        .ok_or(TreeError::MissingData(node))?
        .kind;
    Ok(matches!(
        kind,
        TEXT_NODE | PROCESSING_INSTRUCTION_NODE | COMMENT_NODE
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn node(tree: &mut TreeStore, data: &str) -> NodeId {
        let id = tree.allocate().unwrap();
        tree.set_data(id, data).unwrap();
        id as NodeId
    }
    fn point(node: NodeId, offset: f64) -> BoundaryPoint {
        BoundaryPoint { node, offset }
    }

    #[test]
    fn should_deliver_character_clone_effects_in_order_without_changing_the_source() {
        let mut tree = TreeStore::new();
        let source = node(&mut tree, r#"{"kind":3,"value":"abcd"}"#);
        let mut operation = CloneMachine::new(point(source, 1.0), point(source, 3.0));
        assert_eq!(
            operation.step(&mut tree, 0.0).unwrap(),
            CloneAction::CreateFragment(source)
        );
        let fragment = node(&mut tree, r#"{"kind":11}"#);
        assert_eq!(
            operation.step(&mut tree, fragment as f64).unwrap(),
            CloneAction::CloneNode {
                node: source,
                deep: false
            }
        );
        let cloned = node(&mut tree, r#"{"kind":3,"value":"abcd"}"#);
        let instruction = operation.step(&mut tree, cloned as f64).unwrap();
        assert_eq!(
            instruction,
            CloneAction::SliceData {
                node: cloned,
                offset: 1.0,
                count: 2.0
            }
        );
        let data = tree.substring_data(cloned as f64, 1, 2).unwrap();
        tree.set_character_data(cloned as f64, TEXT_NODE, data)
            .unwrap();
        assert_eq!(
            operation.step(&mut tree, 0.0).unwrap(),
            CloneAction::AppendChild {
                parent: fragment,
                node: cloned
            }
        );
        tree.append(fragment as f64, cloned as f64).unwrap();
        assert_eq!(
            operation.step(&mut tree, 0.0).unwrap(),
            CloneAction::Complete(fragment)
        );
        assert_eq!(
            tree.character_data(source as f64).unwrap(),
            &"abcd".encode_utf16().collect::<Vec<_>>()
        );
        assert_eq!(
            tree.character_data(cloned as f64).unwrap(),
            &"bc".encode_utf16().collect::<Vec<_>>()
        );
        assert_eq!(tree.links(fragment).unwrap().first, cloned);
        assert!(operation.complete());
        assert_eq!(
            operation.frames.capacity(),
            0,
            "Completed controller must release its frame allocation"
        );
        for id in [cloned, fragment, source] {
            tree.release(id as f64).unwrap();
        }
        assert_eq!(
            operation.step(&mut tree, 0.0).unwrap(),
            CloneAction::Complete(fragment)
        );
    }

    #[test]
    fn should_read_subrange_length_after_the_host_clone_and_append_effects() {
        let mut tree = TreeStore::new();
        let root = node(&mut tree, r#"{"kind":1,"name":"main"}"#);
        let first = node(&mut tree, r#"{"kind":1,"name":"b"}"#);
        let start = node(&mut tree, r#"{"kind":3,"value":"left"}"#);
        let end = node(&mut tree, r#"{"kind":3,"value":"right"}"#);
        tree.append(root as f64, first as f64).unwrap();
        tree.append(first as f64, start as f64).unwrap();
        tree.append(root as f64, end as f64).unwrap();
        let mut operation = CloneMachine::new(point(start, 1.0), point(end, 2.0));
        assert_eq!(
            operation.step(&mut tree, 0.0).unwrap(),
            CloneAction::CreateFragment(start)
        );
        let fragment = node(&mut tree, r#"{"kind":11}"#);
        assert!(matches!(
            operation.step(&mut tree, fragment as f64).unwrap(),
            CloneAction::PinNodes(_)
        ));
        assert_eq!(
            operation.step(&mut tree, 0.0).unwrap(),
            CloneAction::CloneNode {
                node: first,
                deep: false
            }
        );
        let copied_first = node(&mut tree, r#"{"kind":1,"name":"b"}"#);
        assert_eq!(
            operation.step(&mut tree, copied_first as f64).unwrap(),
            CloneAction::AppendChild {
                parent: fragment,
                node: copied_first
            }
        );
        tree.append(fragment as f64, copied_first as f64).unwrap();
        let added = node(&mut tree, r#"{"kind":3,"value":" added"}"#);
        tree.append(first as f64, added as f64).unwrap();
        assert_eq!(
            operation.step(&mut tree, 0.0).unwrap(),
            CloneAction::CreateFragment(start)
        );
        let child_fragment = node(&mut tree, r#"{"kind":11}"#);
        let CloneAction::PinNodes(pins) = operation.step(&mut tree, child_fragment as f64).unwrap()
        else {
            panic!("Subclone must pin its current selection");
        };
        assert!(
            pins.contains(&added),
            "Late-added child must belong to the subclone selection"
        );
        operation.cancel();
        assert_eq!(operation.frames.capacity(), 0);
    }

    #[test]
    fn should_preserve_doctype_and_root_errors_after_creating_the_result_fragment() {
        let mut tree = TreeStore::new();
        let document = node(&mut tree, r#"{"kind":9}"#);
        let doctype = node(&mut tree, r#"{"kind":10,"name":"html"}"#);
        let root = node(&mut tree, r#"{"kind":1,"name":"html"}"#);
        tree.append(document as f64, doctype as f64).unwrap();
        tree.append(document as f64, root as f64).unwrap();
        let mut operation = CloneMachine::new(point(document, 0.0), point(document, 2.0));
        assert_eq!(
            operation.step(&mut tree, 0.0).unwrap(),
            CloneAction::CreateFragment(document)
        );
        let fragment = node(&mut tree, r#"{"kind":11}"#);
        assert_eq!(
            operation.step(&mut tree, fragment as f64).unwrap(),
            CloneAction::InvalidDoctype
        );
        assert!(operation.step(&mut tree, 0.0).is_err());
        assert_eq!(tree.child_count(document).unwrap(), 2);
        let detached = node(&mut tree, r#"{"kind":3,"value":"detached"}"#);
        let mut disconnected = CloneMachine::new(point(root, 0.0), point(detached, 1.0));
        assert_eq!(
            disconnected.step(&mut tree, 0.0).unwrap(),
            CloneAction::CreateFragment(root)
        );
        assert_eq!(
            disconnected.step(&mut tree, fragment as f64).unwrap(),
            CloneAction::InconsistentRoots
        );
    }

    #[test]
    fn should_reject_invalid_results_and_endpoints_without_consuming_reserved_handles() {
        let mut tree = TreeStore::new();
        let source = tree.allocate().unwrap() as NodeId;
        let reserved = tree.reserve_handles().unwrap() as NodeId;
        let before = tree.statistics();
        let mut invalid = CloneMachine::new(point(source, 0.0), point(reserved, 0.0));
        assert!(invalid.step(&mut tree, 0.0).is_err());
        let mut operation = CloneMachine::new(point(source, 0.0), point(source, 0.0));
        assert!(operation.step(&mut tree, source as f64).is_err());
        assert_eq!(
            operation.step(&mut tree, 0.0).unwrap(),
            CloneAction::CreateFragment(source)
        );
        assert!(operation.step(&mut tree, 0.0).is_err());
        assert!(operation.step(&mut tree, reserved as f64).is_err());
        assert_eq!(tree.statistics().allocations, before.allocations);
        assert_eq!(tree.statistics().reserved_handles, before.reserved_handles);
        let fragment = node(&mut tree, r#"{"kind":11}"#);
        assert_eq!(
            operation.step(&mut tree, fragment as f64).unwrap(),
            CloneAction::Complete(fragment)
        );
        operation.cancel();
        operation.cancel();
        assert!(operation.step(&mut tree, 0.0).is_err());
    }
}
