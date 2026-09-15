//! Rectangle state and IEEE-754 edges; no DOM owners, callbacks or shared allocations.
#[derive(Clone, Copy)]
pub(super) struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Match ECMAScript Math.min/Math.max, including NaN propagation and signed zero.
fn edge(start: f64, size: f64, maximum: bool) -> f64 {
    let end = start + size;
    if start.is_nan() || end.is_nan() {
        return f64::NAN;
    }
    if start == 0.0 && end == 0.0 {
        let negative = if maximum {
            start.is_sign_negative() && end.is_sign_negative()
        } else {
            start.is_sign_negative() || end.is_sign_negative()
        };
        return if negative { -0.0 } else { 0.0 };
    }
    if (maximum && start > end) || (!maximum && start < end) {
        start
    } else {
        end
    }
}

impl Rect {
    pub fn top(&self) -> f64 {
        edge(self.y, self.height, false)
    }
    pub fn right(&self) -> f64 {
        edge(self.x, self.width, true)
    }
    pub fn bottom(&self) -> f64 {
        edge(self.y, self.height, true)
    }
    pub fn left(&self) -> f64 {
        edge(self.x, self.width, false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_order_negative_dimensions_without_changing_the_origin() {
        let rect = Rect {
            x: 2.0,
            y: 3.0,
            width: -5.0,
            height: -7.0,
        };
        assert_eq!(
            (rect.left(), rect.top(), rect.right(), rect.bottom()),
            (-3.0, -4.0, 2.0, 3.0)
        );
        assert_eq!((rect.x, rect.y), (2.0, 3.0));
    }

    #[test]
    fn should_propagate_nan_and_preserve_overflow_and_infinities() {
        for (start, size) in [
            (f64::NAN, 0.0),
            (0.0, f64::NAN),
            (f64::INFINITY, f64::NEG_INFINITY),
            (f64::NEG_INFINITY, f64::INFINITY),
        ] {
            assert!(edge(start, size, true).is_nan());
            assert!(edge(start, size, false).is_nan());
        }
        assert_eq!(edge(f64::MAX, f64::MAX, true), f64::INFINITY);
        assert_eq!(edge(f64::MAX, f64::MAX, false), f64::MAX);
        assert_eq!(edge(f64::NEG_INFINITY, -1.0, true), f64::NEG_INFINITY);
    }

    #[test]
    fn should_resolve_equal_zero_edges_by_ecmascript_sign_rules() {
        for start in [0.0_f64, -0.0_f64] {
            for size in [0.0_f64, -0.0_f64] {
                assert_eq!(
                    edge(start, size, false).is_sign_negative(),
                    start.is_sign_negative()
                );
                assert_eq!(
                    edge(start, size, true).is_sign_negative(),
                    start.is_sign_negative() && size.is_sign_negative()
                );
            }
        }
        assert_eq!(edge(-1.0, 1.0, true).to_bits(), 0.0_f64.to_bits());
        assert_eq!(edge(1.0, -1.0, false).to_bits(), 0.0_f64.to_bits());
    }

    #[test]
    fn should_keep_subnormal_dimensions_and_independent_copies() {
        let rect = Rect {
            x: 0.0,
            y: 0.0,
            width: f64::from_bits(1),
            height: -f64::from_bits(1),
        };
        let mut copy = rect;
        copy.width = 2.0;
        assert_eq!(rect.right().to_bits(), 1);
        assert_eq!(rect.top(), -f64::from_bits(1));
        assert_eq!(copy.right(), 2.0);
    }
}
