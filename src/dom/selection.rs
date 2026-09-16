//! Selection direction and association decisions, independent of JS owner references.
#[derive(Default)]
pub(super) struct SelectionState {
    pub direction: f64,
}
impl SelectionState {
    pub fn anchor_is_start(&self) -> bool {
        self.direction == 1.0
    }
    pub fn associate(
        &mut self,
        has_old: bool,
        has_new: bool,
        same: bool,
        start_equal: bool,
        end_equal: bool,
    ) -> bool {
        let changed = !same && (!has_old || !has_new || !start_equal || !end_equal);
        self.direction = if has_new { 1.0 } else { 0.0 };
        changed
    }
    pub fn orient(&mut self, focus_before_anchor: bool) {
        self.direction = if focus_before_anchor { -1.0 } else { 1.0 };
    }
}

pub(super) fn selection_type(has_range: bool, collapsed: bool) -> &'static str {
    if !has_range {
        "None"
    } else if collapsed {
        "Caret"
    } else {
        "Range"
    }
}
pub(super) fn contains(start_before: bool, end_after: bool, partial: bool) -> bool {
    if partial {
        start_before || end_after
    } else {
        start_before && end_after
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn should_reset_direction_and_notify_only_reference_association_changes() {
        let mut state = SelectionState::default();
        assert!(!state.associate(false, false, true, false, false));
        assert_eq!(state.direction, 0.0);
        assert!(state.associate(false, true, false, true, true));
        assert!(state.anchor_is_start());
        state.orient(true);
        assert!(!state.anchor_is_start());
        assert!(!state.associate(true, true, false, true, true));
        assert_eq!(state.direction, 1.0);
        assert!(state.associate(true, true, false, true, false));
        assert!(state.associate(true, false, false, false, false));
        assert_eq!(state.direction, 0.0);
    }
    #[test]
    fn should_preserve_type_and_strict_containment_rules() {
        assert_eq!(selection_type(false, true), "None");
        assert_eq!(selection_type(true, true), "Caret");
        assert_eq!(selection_type(true, false), "Range");
        assert!(!contains(false, false, true));
        assert!(contains(true, false, true));
        assert!(!contains(true, false, false));
        assert!(contains(true, true, false));
    }
}
