//! Resumable DOM traversal. Only numeric handles cross a callback suspension.
use super::{
    error::Result,
    store::{NodeId, TreeStore},
};
use napi_derive::napi;

pub(super) const FILTER_ACCEPT: u16 = 1;
pub(super) const FILTER_REJECT: u16 = 2;
pub(super) const FILTER_SKIP: u16 = 3;

#[napi]
#[derive(Debug, PartialEq, Eq)]
pub enum TraversalMethod {
    IteratorNext,
    IteratorPrevious,
    Parent,
    FirstChild,
    LastChild,
    PreviousSibling,
    NextSibling,
    PreviousNode,
    NextNode,
}

#[derive(Clone, Copy)]
enum Phase {
    Start,
    Iterator,
    Parent,
    Children,
    Sibling,
    SiblingParent,
    PreviousDescendant,
    PreviousParent,
    Next,
    Complete,
}

pub(super) enum Action {
    Filter(NodeId),
    Accept(NodeId),
    Complete,
}

pub(super) struct Cursor {
    pub root: NodeId,
    pub current: NodeId,
    pub before: bool,
    pub active: bool,
    pub mask: u32,
    pub has_filter: bool,
}

impl Cursor {
    pub fn new(root: NodeId, mask: u32, has_filter: bool) -> Self {
        Self {
            root,
            current: root,
            before: true,
            active: false,
            mask,
            has_filter,
        }
    }

    /// Called before unlinking, so sibling/ancestor links still describe the old tree.
    pub fn pre_remove(&mut self, tree: &TreeStore, removed: NodeId) -> Result<()> {
        if removed == self.root || !tree.contains_node(removed as f64, self.current as f64)? {
            return Ok(());
        }
        if self.before {
            let mut candidate = following(tree, removed, 0, true)?;
            while candidate != 0 {
                if tree.contains_node(self.root as f64, candidate as f64)? {
                    self.current = candidate;
                    return Ok(());
                }
                candidate = following(tree, candidate, 0, true)?;
            }
            self.before = false;
        }
        let links = tree.links(removed)?;
        self.current = if links.previous == 0 {
            links.parent
        } else {
            last_descendant(tree, links.previous)?
        };
        Ok(())
    }
}

pub(super) struct Traversal {
    root: NodeId,
    pub node: NodeId,
    pub before: bool,
    method: TraversalMethod,
    phase: Phase,
    result: u16,
}

impl Traversal {
    pub fn new(cursor: &Cursor, method: TraversalMethod) -> Self {
        Self {
            root: cursor.root,
            node: cursor.current,
            before: cursor.before,
            method,
            phase: Phase::Start,
            result: FILTER_ACCEPT,
        }
    }

    pub fn resume(&mut self, result: u16) {
        self.result = result;
    }

    fn filter(&mut self, node: NodeId, phase: Phase) -> Action {
        self.node = node;
        self.phase = phase;
        if node == 0 {
            self.complete()
        } else {
            Action::Filter(node)
        }
    }

    fn complete(&mut self) -> Action {
        self.phase = Phase::Complete;
        Action::Complete
    }
    fn accept(&mut self) -> Action {
        self.phase = Phase::Complete;
        Action::Accept(self.node)
    }
    fn reverse(&self) -> bool {
        matches!(
            self.method,
            TraversalMethod::LastChild | TraversalMethod::PreviousSibling
        )
    }

    fn child(&self, tree: &TreeStore, node: NodeId) -> Result<NodeId> {
        let links = tree.links(node)?;
        Ok(if self.reverse() {
            links.last
        } else {
            links.first
        })
    }

    fn sibling(&self, tree: &TreeStore, node: NodeId) -> Result<NodeId> {
        let links = tree.links(node)?;
        Ok(if self.reverse() {
            links.previous
        } else {
            links.next
        })
    }

    fn iterator_candidate(&mut self, tree: &TreeStore) -> Result<Action> {
        if self.method == TraversalMethod::IteratorNext {
            if !self.before {
                self.node = following(tree, self.node, self.root, false)?;
            }
            self.before = false;
        } else {
            if self.before {
                self.node = preceding(tree, self.node, self.root)?;
            }
            self.before = true;
        }
        Ok(self.filter(self.node, Phase::Iterator))
    }

    fn parent_candidate(&mut self, tree: &TreeStore, phase: Phase) -> Result<Action> {
        if self.node == 0 || self.node == self.root {
            return Ok(self.complete());
        }
        Ok(self.filter(tree.links(self.node)?.parent, phase))
    }

    fn children_sibling(&mut self, tree: &TreeStore, current: NodeId) -> Result<Action> {
        loop {
            let sibling = self.sibling(tree, self.node)?;
            if sibling != 0 {
                return Ok(self.filter(sibling, Phase::Children));
            }
            let parent = tree.links(self.node)?.parent;
            if parent == 0 || parent == self.root || parent == current {
                return Ok(self.complete());
            }
            self.node = parent;
        }
    }

    fn sibling_candidate(&mut self, tree: &TreeStore, sibling: NodeId) -> Result<Action> {
        if sibling != 0 {
            return Ok(self.filter(sibling, Phase::Sibling));
        }
        let parent = tree.links(self.node)?.parent;
        if parent == 0 || parent == self.root {
            return Ok(self.complete());
        }
        Ok(self.filter(parent, Phase::SiblingParent))
    }

    fn previous_candidate(&mut self, tree: &TreeStore) -> Result<Action> {
        if self.node == self.root {
            return Ok(self.complete());
        }
        let links = tree.links(self.node)?;
        if links.previous != 0 {
            return Ok(self.filter(links.previous, Phase::PreviousDescendant));
        }
        Ok(self.filter(links.parent, Phase::PreviousParent))
    }

    fn next_candidate(&mut self, tree: &TreeStore) -> Result<Action> {
        if self.result != FILTER_REJECT {
            let child = tree.links(self.node)?.first;
            if child != 0 {
                return Ok(self.filter(child, Phase::Next));
            }
        }
        loop {
            if self.node == self.root {
                return Ok(self.complete());
            }
            let links = tree.links(self.node)?;
            if links.next != 0 {
                return Ok(self.filter(links.next, Phase::Next));
            }
            self.node = links.parent;
            if self.node == 0 {
                return Ok(self.complete());
            }
        }
    }

    /// Advance on live links after the previous callback and numeric conversion finish.
    pub fn advance(&mut self, tree: &TreeStore, current: NodeId) -> Result<Action> {
        match self.phase {
            Phase::Complete => Ok(Action::Complete),
            Phase::Start => match self.method {
                TraversalMethod::IteratorNext | TraversalMethod::IteratorPrevious => {
                    self.iterator_candidate(tree)
                }
                TraversalMethod::Parent => self.parent_candidate(tree, Phase::Parent),
                TraversalMethod::FirstChild | TraversalMethod::LastChild => {
                    Ok(self.filter(self.child(tree, self.node)?, Phase::Children))
                }
                TraversalMethod::NextSibling | TraversalMethod::PreviousSibling => {
                    if self.node == self.root {
                        return Ok(self.complete());
                    }
                    self.sibling_candidate(tree, self.sibling(tree, self.node)?)
                }
                TraversalMethod::PreviousNode => self.previous_candidate(tree),
                TraversalMethod::NextNode => self.next_candidate(tree),
            },
            Phase::Iterator => {
                if self.result == FILTER_ACCEPT {
                    Ok(self.accept())
                } else {
                    self.iterator_candidate(tree)
                }
            }
            Phase::Parent => {
                if self.result == FILTER_ACCEPT {
                    Ok(self.accept())
                } else {
                    self.parent_candidate(tree, Phase::Parent)
                }
            }
            Phase::Children => {
                if self.result == FILTER_ACCEPT {
                    return Ok(self.accept());
                }
                if self.result == FILTER_SKIP {
                    let child = self.child(tree, self.node)?;
                    if child != 0 {
                        return Ok(self.filter(child, Phase::Children));
                    }
                }
                self.children_sibling(tree, current)
            }
            Phase::Sibling => {
                if self.result == FILTER_ACCEPT {
                    return Ok(self.accept());
                }
                let child = self.child(tree, self.node)?;
                let sibling = if self.result == FILTER_REJECT || child == 0 {
                    self.sibling(tree, self.node)?
                } else {
                    child
                };
                self.sibling_candidate(tree, sibling)
            }
            Phase::SiblingParent => {
                if self.result == FILTER_ACCEPT {
                    return Ok(self.complete());
                }
                self.sibling_candidate(tree, self.sibling(tree, self.node)?)
            }
            Phase::PreviousDescendant => {
                if self.result != FILTER_REJECT {
                    let child = tree.links(self.node)?.last;
                    if child != 0 {
                        return Ok(self.filter(child, Phase::PreviousDescendant));
                    }
                }
                if self.result == FILTER_ACCEPT {
                    return Ok(self.accept());
                }
                // The reference checks a previous sibling before checking root here.
                let sibling = tree.links(self.node)?.previous;
                if sibling != 0 {
                    return Ok(self.filter(sibling, Phase::PreviousDescendant));
                }
                self.parent_candidate(tree, Phase::PreviousParent)
            }
            Phase::PreviousParent => {
                if self.result == FILTER_ACCEPT {
                    Ok(self.accept())
                } else {
                    self.previous_candidate(tree)
                }
            }
            Phase::Next => {
                if self.result == FILTER_ACCEPT {
                    Ok(self.accept())
                } else {
                    self.next_candidate(tree)
                }
            }
        }
    }
}

fn last_descendant(tree: &TreeStore, mut node: NodeId) -> Result<NodeId> {
    loop {
        let child = tree.links(node)?.last;
        if child == 0 {
            return Ok(node);
        }
        node = child;
    }
}

fn preceding(tree: &TreeStore, node: NodeId, root: NodeId) -> Result<NodeId> {
    if node == root {
        return Ok(0);
    }
    let links = tree.links(node)?;
    if links.previous == 0 {
        Ok(links.parent)
    } else {
        last_descendant(tree, links.previous)
    }
}

fn following(
    tree: &TreeStore,
    mut node: NodeId,
    root: NodeId,
    skip_children: bool,
) -> Result<NodeId> {
    if !skip_children {
        let child = tree.links(node)?.first;
        if child != 0 {
            return Ok(child);
        }
    }
    while node != 0 && node != root {
        let links = tree.links(node)?;
        if links.next != 0 {
            return Ok(links.next);
        }
        node = links.parent;
    }
    Ok(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> (TreeStore, Cursor) {
        let mut tree = TreeStore::new();
        for _ in 0..6 {
            let id = tree.allocate().unwrap();
            tree.set_data(id, r#"{"kind":1,"name":"node"}"#).unwrap();
        }
        for (parent, child) in [(1., 2.), (2., 3.), (2., 4.), (1., 5.), (5., 6.)] {
            tree.append(parent, child).unwrap();
        }
        (tree, Cursor::new(1, u32::MAX, true))
    }

    fn move_cursor(
        tree: &TreeStore,
        cursor: &mut Cursor,
        method: TraversalMethod,
        decisions: &[(NodeId, u16)],
    ) -> (NodeId, Vec<NodeId>) {
        let mut traversal = Traversal::new(cursor, method);
        let mut filtered = Vec::new();
        loop {
            match traversal.advance(tree, cursor.current).unwrap() {
                Action::Complete => return (0, filtered),
                Action::Accept(node) => {
                    cursor.current = node;
                    cursor.before = traversal.before;
                    return (node, filtered);
                }
                Action::Filter(node) => {
                    filtered.push(node);
                    traversal.resume(
                        decisions
                            .iter()
                            .find(|(id, _)| *id == node)
                            .map_or(FILTER_ACCEPT, |(_, result)| *result),
                    );
                }
            }
        }
    }

    #[test]
    fn should_distinguish_iterator_rejection_from_walker_pruning() {
        let (tree, mut cursor) = fixture();
        let rejected = [(2, FILTER_REJECT)];
        assert_eq!(
            move_cursor(&tree, &mut cursor, TraversalMethod::IteratorNext, &rejected).0,
            1
        );
        assert_eq!(
            move_cursor(&tree, &mut cursor, TraversalMethod::IteratorNext, &rejected),
            (3, vec![2, 3])
        );
        cursor.current = 1;
        assert_eq!(
            move_cursor(&tree, &mut cursor, TraversalMethod::NextNode, &rejected),
            (5, vec![2, 5])
        );
        cursor.current = 1;
        assert_eq!(
            move_cursor(
                &tree,
                &mut cursor,
                TraversalMethod::FirstChild,
                &[(2, FILTER_SKIP)]
            ),
            (3, vec![2, 3])
        );
    }

    #[test]
    fn should_walk_reverse_siblings_children_and_parents() {
        let (tree, mut cursor) = fixture();
        assert_eq!(
            move_cursor(
                &tree,
                &mut cursor,
                TraversalMethod::LastChild,
                &[(5, FILTER_SKIP)]
            )
            .0,
            6
        );
        assert_eq!(
            move_cursor(
                &tree,
                &mut cursor,
                TraversalMethod::PreviousSibling,
                &[(5, FILTER_SKIP)]
            )
            .0,
            2
        );
        assert_eq!(
            move_cursor(&tree, &mut cursor, TraversalMethod::NextSibling, &[]).0,
            5
        );
        assert_eq!(
            move_cursor(&tree, &mut cursor, TraversalMethod::PreviousNode, &[]),
            (4, vec![2, 4])
        );
        assert_eq!(
            move_cursor(
                &tree,
                &mut cursor,
                TraversalMethod::Parent,
                &[(2, FILTER_SKIP)]
            )
            .0,
            1
        );
    }

    #[test]
    fn should_resume_against_live_links_and_preserve_failed_position() {
        let (mut tree, mut cursor) = fixture();
        let mut traversal = Traversal::new(&cursor, TraversalMethod::NextNode);
        assert!(matches!(
            traversal.advance(&tree, cursor.current).unwrap(),
            Action::Filter(2)
        ));
        tree.remove(2.).unwrap();
        traversal.resume(FILTER_REJECT);
        assert!(matches!(
            traversal.advance(&tree, cursor.current).unwrap(),
            Action::Complete
        ));
        assert_eq!(cursor.current, 1);
        cursor.before = true;
        assert_eq!(
            move_cursor(&tree, &mut cursor, TraversalMethod::IteratorPrevious, &[]).0,
            0
        );
        assert!(cursor.before);
    }

    #[test]
    fn should_repair_positions_before_removing_subtrees() {
        let (tree, mut cursor) = fixture();
        cursor.current = 3;
        cursor.pre_remove(&tree, 2).unwrap();
        assert_eq!(cursor.current, 5);
        assert!(cursor.before);
        cursor.current = 6;
        cursor.pre_remove(&tree, 5).unwrap();
        assert_eq!(cursor.current, 4);
        assert!(!cursor.before);
        cursor.pre_remove(&tree, 1).unwrap();
        assert_eq!(cursor.current, 4);
    }
}
