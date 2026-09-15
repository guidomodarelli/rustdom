//! Event path decisions over opaque indices; JavaScript owns every referenced target.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EventPhase {
    Capturing = 1,
    AtTarget = 2,
    Bubbling = 3,
}

#[derive(Clone, Copy)]
struct PathEntry {
    root_of_closed_tree: bool,
    slot_in_closed_tree: bool,
    target_index: Option<usize>,
}

#[derive(Default)]
enum Cursor {
    #[default]
    Ready,
    Capturing(usize),
    Bubbling(usize),
    Complete,
}

#[derive(Debug, PartialEq, Eq)]
pub struct EventInvocation {
    pub index: usize,
    pub target_index: Option<usize>,
    pub capturing: bool,
    pub invoke: bool,
    pub phase: EventPhase,
}

#[derive(Default)]
pub struct EventPath {
    entries: Vec<PathEntry>,
    cursor: Cursor,
    current_index: Option<usize>,
}

impl EventPath {
    pub fn append(
        &mut self,
        root_closed: bool,
        slot_closed: bool,
        has_target: bool,
    ) -> Option<usize> {
        let target_index = if has_target {
            Some(self.entries.len())
        } else {
            self.entries.last().and_then(|entry| entry.target_index)
        };
        self.entries.push(PathEntry {
            root_of_closed_tree: root_closed,
            slot_in_closed_tree: slot_closed,
            target_index,
        });
        target_index
    }

    pub fn reset_iteration(&mut self) {
        self.cursor = Cursor::Ready;
    }

    pub fn next(&mut self, bubbles: bool, stopped: bool) -> Option<EventInvocation> {
        loop {
            let (index, capturing) = match self.cursor {
                Cursor::Ready => {
                    self.cursor = Cursor::Capturing(self.entries.len());
                    continue;
                }
                Cursor::Capturing(0) => {
                    self.cursor = Cursor::Bubbling(0);
                    continue;
                }
                Cursor::Capturing(remaining) => {
                    self.cursor = Cursor::Capturing(remaining - 1);
                    (remaining - 1, true)
                }
                Cursor::Bubbling(index) if index < self.entries.len() => {
                    self.cursor = Cursor::Bubbling(index + 1);
                    (index, false)
                }
                Cursor::Bubbling(_) | Cursor::Complete => {
                    self.cursor = Cursor::Complete;
                    return None;
                }
            };
            let entry = self.entries[index];
            let at_target = entry.target_index == Some(index);
            if !capturing && !at_target && !bubbles {
                continue;
            }
            if !stopped {
                self.current_index = Some(index);
            }
            return Some(EventInvocation {
                index,
                target_index: entry.target_index,
                capturing,
                invoke: !stopped,
                phase: if at_target {
                    EventPhase::AtTarget
                } else if capturing {
                    EventPhase::Capturing
                } else {
                    EventPhase::Bubbling
                },
            });
        }
    }

    /// None in the returned sequence represents the host's currentTarget value.
    pub fn visible_indices(&self) -> Vec<Option<usize>> {
        if self.entries.is_empty() {
            return Vec::new();
        }
        let current_index = self.current_index.unwrap_or(0);
        let mut current_target_level = 0isize;
        for (index, entry) in self.entries.iter().enumerate().rev() {
            if entry.root_of_closed_tree {
                current_target_level += 1;
            }
            if self.current_index == Some(index) {
                break;
            }
            if entry.slot_in_closed_tree {
                current_target_level -= 1;
            }
        }
        let mut visible = Vec::with_capacity(self.entries.len());
        let mut level = current_target_level;
        let mut maximum = current_target_level;
        for index in (0..current_index).rev() {
            let entry = self.entries[index];
            if entry.root_of_closed_tree {
                level += 1;
            }
            if level <= maximum {
                visible.push(Some(index));
            }
            if entry.slot_in_closed_tree {
                level -= 1;
                maximum = maximum.min(level);
            }
        }
        visible.reverse();
        visible.push(None);
        level = current_target_level;
        maximum = current_target_level;
        for index in current_index + 1..self.entries.len() {
            let entry = self.entries[index];
            if entry.slot_in_closed_tree {
                level += 1;
            }
            if level <= maximum {
                visible.push(Some(index));
            }
            if entry.root_of_closed_tree {
                level -= 1;
                maximum = maximum.min(level);
            }
        }
        visible
    }

    pub fn clear(&mut self) {
        *self = Self::default();
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn capacity(&self) -> usize {
        self.entries.capacity()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_capture_then_bubble_with_target_overrides_and_current_bubbles_value() {
        let mut path = EventPath::default();
        for has_target in [true, false, true, false] {
            path.append(false, false, has_target);
        }
        let captures: Vec<_> = (0..4).map(|_| path.next(false, false).unwrap()).collect();
        assert_eq!(
            captures.iter().map(|step| step.index).collect::<Vec<_>>(),
            [3, 2, 1, 0]
        );
        assert_eq!(
            captures
                .iter()
                .map(|step| step.target_index)
                .collect::<Vec<_>>(),
            [Some(2), Some(2), Some(0), Some(0)]
        );
        assert_eq!(
            captures.iter().map(|step| step.phase).collect::<Vec<_>>(),
            [
                EventPhase::Capturing,
                EventPhase::AtTarget,
                EventPhase::Capturing,
                EventPhase::AtTarget
            ]
        );
        assert_eq!(path.next(false, false).unwrap().index, 0);
        assert_eq!(path.next(false, false).unwrap().index, 2);
        let final_step = path.next(true, false).unwrap();
        assert_eq!(final_step.index, 3);
        assert_eq!(final_step.phase, EventPhase::Bubbling);
        assert!(!final_step.capturing);
        assert_eq!(path.next(true, false), None);
        assert_eq!(path.next(true, false), None);
    }

    #[test]
    fn should_hide_closed_roots_without_hiding_slotted_light_targets() {
        let mut path = EventPath::default();
        path.append(false, false, true); // light target
        path.append(false, true, false); // slot in closed root
        path.append(true, false, false); // closed root
        path.append(false, false, false); // host
        path.append(false, false, false); // document
        assert_eq!(path.next(true, false).unwrap().index, 4);
        assert_eq!(path.visible_indices(), [Some(0), Some(3), None]);
        path.next(true, false);
        assert_eq!(path.visible_indices(), [Some(0), None, Some(4)]);
        path.next(true, false);
        assert_eq!(
            path.visible_indices(),
            [Some(0), Some(1), None, Some(3), Some(4)]
        );
        path.next(true, false);
        assert_eq!(
            path.visible_indices(),
            [Some(0), None, Some(2), Some(3), Some(4)]
        );
        path.next(true, false);
        assert_eq!(path.visible_indices(), [None, Some(3), Some(4)]);
    }

    #[test]
    fn should_preserve_current_target_when_stopped_and_release_large_path_buffers() {
        let mut path = EventPath::default();
        assert!(path.visible_indices().is_empty());
        for index in 0..10_000 {
            path.append(false, false, index == 0);
        }
        // Before invoking any listener, the sentinel retains the host's null currentTarget.
        let before = path.visible_indices();
        assert_eq!(before.len(), 10_000);
        assert_eq!(before[0], None);
        path.next(true, false);
        let visible = path.visible_indices();
        let stopped = path.next(true, true).unwrap();
        assert_eq!(stopped.index, 9_998);
        assert_eq!(stopped.target_index, Some(0));
        assert!(!stopped.invoke);
        assert_eq!(path.visible_indices(), visible);
        assert!(path.capacity() >= 10_000);
        path.clear();
        assert_eq!(path.len(), 0);
        assert_eq!(path.capacity(), 0);
        assert!(path.visible_indices().is_empty());
        assert_eq!(visible.len(), 10_000);
    }
}
