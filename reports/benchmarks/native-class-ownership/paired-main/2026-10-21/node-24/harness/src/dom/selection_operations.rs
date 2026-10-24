//! Selection control through scoped host values; no JS references survive the native invocation.
use super::{constants::DOCUMENT_TYPE_NODE, napi_error::capture_pending_error, selection};
use napi::{
    Env, Error, JsValue, Result, Status, ValueType,
    bindgen_prelude::{FnArgs, FromNapiValue, Function, JsObjectValue, Unknown},
};
use napi_derive::napi;
use std::sync::atomic::{AtomicU64, Ordering};

static CALLS: AtomicU64 = AtomicU64::new(0);
static ACTIVE: AtomicU64 = AtomicU64::new(0);
struct Guard;
impl Drop for Guard {
    fn drop(&mut self) {
        ACTIVE.fetch_sub(1, Ordering::Relaxed);
    }
}

#[napi]
pub enum SelectionOperation {
    Anchor,
    Focus,
    AnchorNode,
    AnchorOffset,
    FocusNode,
    FocusOffset,
    IsCollapsed,
    RangeCount,
    Type,
    GetRangeAt,
    AddRange,
    RemoveRange,
    RemoveAllRanges,
    Collapse,
    CollapseToStart,
    CollapseToEnd,
    Extend,
    SetBaseAndExtent,
    SelectAllChildren,
    DeleteFromDocument,
    ContainsNode,
    ToString,
    AssociateRange,
}

struct Host<'env> {
    env: &'env Env,
    owner: Unknown<'env>,
    helpers: Unknown<'env>,
}
impl<'env> Host<'env> {
    fn get(&self, receiver: Unknown, name: &str) -> Result<Unknown<'env>> {
        receiver.coerce_to_object()?.get_named_property(name)
    }
    fn set(&self, receiver: Unknown, name: &str, value: Unknown) -> Result<()> {
        receiver.coerce_to_object()?.set_named_property(name, value)
    }
    fn text(&self, value: &str) -> Result<Unknown<'env>> {
        Ok(self.env.create_string(value)?.to_unknown())
    }
    fn number(&self, value: f64) -> Result<Unknown<'env>> {
        Ok(self.env.create_double(value)?.to_unknown())
    }
    fn boolean(&self, value: bool) -> Result<Unknown<'env>> {
        self.env.to_js_value(&value)
    }
    fn null(&self) -> Result<Unknown<'env>> {
        self.env.to_js_value(&())
    }
    fn same(&self, left: Unknown, right: Unknown) -> Result<bool> {
        self.env.strict_equals(left, right)
    }
    fn is_null(&self, value: Unknown) -> Result<bool> {
        Ok(value.get_type()? == ValueType::Null)
    }
    fn call_range_method(&self, range: Unknown, method: &str) -> Result<Unknown<'env>> {
        let function = self.get(range, method)?;
        if function.get_type()? != ValueType::Function {
            return self.call2(
                self.helpers,
                self.get(self.helpers, "throwRangeMethodError")?,
                self.text(method)?,
                function,
            );
        }
        Function::<(), Unknown>::from_unknown(function)?.apply(range, ())
    }
    fn call1(&self, receiver: Unknown, function: Unknown, value: Unknown) -> Result<Unknown<'env>> {
        Function::<Unknown, Unknown>::from_unknown(function)?.apply(receiver, value)
    }
    fn call2(
        &self,
        receiver: Unknown,
        function: Unknown,
        first: Unknown,
        second: Unknown,
    ) -> Result<Unknown<'env>> {
        Function::<FnArgs<(Unknown, Unknown)>, Unknown>::from_unknown(function)?
            .apply(receiver, (first, second).into())
    }
    fn helper1(&self, name: &str, value: Unknown) -> Result<Unknown<'env>> {
        self.call1(self.helpers, self.get(self.helpers, name)?, value)
    }
    fn range(&self) -> Result<Unknown<'env>> {
        self.get(self.owner, "_range")
    }
    fn global(&self) -> Result<Unknown<'env>> {
        self.get(self.owner, "_globalObject")
    }
    fn document(&self) -> Result<Unknown<'env>> {
        self.helper1("implForWrapper", self.get(self.global()?, "_document")?)
    }
    fn root(&self, node: Unknown) -> Result<Unknown<'env>> {
        self.helper1("nodeRoot", node)
    }
    fn length(&self, node: Unknown) -> Result<Unknown<'env>> {
        self.helper1("nodeLength", node)
    }
    fn compare(&self, left: Unknown, right: Unknown) -> Result<f64> {
        self.call2(
            self.helpers,
            self.get(self.helpers, "compare")?,
            left,
            right,
        )?
        .coerce_to_number()?
        .get_double()
    }
    fn point(&self, node: Unknown, offset: Unknown) -> Result<Unknown<'env>> {
        self.call2(self.helpers, self.get(self.helpers, "point")?, node, offset)
    }
    fn error(&self, message: &str, kind: &str) -> Result<()> {
        let error = self.get(self.helpers, "throwDomException")?;
        Function::<FnArgs<(Unknown, Unknown, Unknown)>, Unknown>::from_unknown(error)?.apply(
            self.helpers,
            (self.global()?, self.text(message)?, self.text(kind)?).into(),
        )?;
        Ok(())
    }
    fn create_range(&self, start: Unknown, end: Unknown) -> Result<Unknown<'env>> {
        Function::<FnArgs<(Unknown, Unknown, Unknown)>, Unknown>::from_unknown(
            self.get(self.helpers, "createRange")?,
        )?
        .apply(self.helpers, (self.global()?, start, end).into())
    }
    fn set_boundary(&self, range: Unknown, point: Unknown, start: bool) -> Result<()> {
        let function = self.get(self.helpers, if start { "setStart" } else { "setEnd" })?;
        Function::<FnArgs<(Unknown, Unknown, Unknown)>, Unknown>::from_unknown(function)?.apply(
            self.helpers,
            (range, self.get(point, "node")?, self.get(point, "offset")?).into(),
        )?;
        Ok(())
    }
    fn associate(&self, next: Unknown) -> Result<()> {
        let previous = self.range()?;
        let changed = !self.same(previous, next)?
            && (self.is_null(next)?
                || self.is_null(previous)?
                || self.compare(self.get(next, "_start")?, self.get(previous, "_start")?)? != 0.0
                || self.compare(self.get(next, "_end")?, self.get(previous, "_end")?)? != 0.0);
        self.set(self.owner, "_range", next)?;
        self.set(
            self.owner,
            "_direction",
            self.number(if self.is_null(next)? { 0.0 } else { 1.0 })?,
        )?;
        if changed {
            self.helper1("scheduleChange", self.get(self.global()?, "_document")?)?;
        }
        Ok(())
    }
    fn boundary(&self, anchor: bool) -> Result<Unknown<'env>> {
        let range = self.range()?;
        if !range.coerce_to_bool()? {
            return self.null();
        }
        let forwards = self.same(self.get(self.owner, "_direction")?, self.number(1.0)?)?;
        self.get(range, if anchor == forwards { "_start" } else { "_end" })
    }
    fn root_matches_document(&self, node: Unknown) -> Result<bool> {
        self.same(self.root(node)?, self.document()?)
    }
    fn invalid_doctype(&self, node: Unknown) -> Result<bool> {
        self.same(
            self.get(node, "nodeType")?,
            self.number(DOCUMENT_TYPE_NODE as f64)?,
        )
    }
    fn offset_too_large(&self, node: Unknown, offset: Unknown) -> Result<bool> {
        Ok(offset.coerce_to_number()?.get_double()?
            > self.length(node)?.coerce_to_number()?.get_double()?)
    }

    fn run(&self, operation: SelectionOperation, args: Unknown<'env>) -> Result<Unknown<'env>> {
        let arg = |index| args.coerce_to_object()?.get_element::<Unknown>(index);
        match operation {
            SelectionOperation::Anchor | SelectionOperation::Focus => {
                self.boundary(matches!(operation, SelectionOperation::Anchor))
            }
            SelectionOperation::AnchorNode
            | SelectionOperation::FocusNode
            | SelectionOperation::AnchorOffset
            | SelectionOperation::FocusOffset => {
                let anchor = matches!(
                    operation,
                    SelectionOperation::AnchorNode | SelectionOperation::AnchorOffset
                );
                let offset = matches!(
                    operation,
                    SelectionOperation::AnchorOffset | SelectionOperation::FocusOffset
                );
                let point = self.boundary(anchor)?;
                if point.coerce_to_bool()? {
                    self.get(point, if offset { "offset" } else { "node" })
                } else if offset {
                    self.number(0.0)
                } else {
                    self.null()
                }
            }
            SelectionOperation::IsCollapsed => {
                let range = self.range()?;
                if self.is_null(range)? {
                    self.boolean(true)
                } else {
                    self.get(range, "collapsed")
                }
            }
            SelectionOperation::RangeCount => self.number(if self.is_null(self.range()?)? {
                0.0
            } else {
                1.0
            }),
            SelectionOperation::Type => {
                let range = self.range()?;
                let present = !self.is_null(range)?;
                self.text(selection::selection_type(
                    present,
                    present && self.get(range, "collapsed")?.coerce_to_bool()?,
                ))
            }
            SelectionOperation::GetRangeAt => {
                if !self.same(arg(0)?, self.number(0.0)?)? || self.is_null(self.range()?)? {
                    self.error("Invalid range index.", "IndexSizeError")?;
                }
                self.range()
            }
            SelectionOperation::AddRange => {
                let range = arg(0)?;
                if self.same(self.get(range, "_root")?, self.document()?)?
                    && self.is_null(self.range()?)?
                {
                    self.associate(range)?;
                }
                self.null()
            }
            SelectionOperation::RemoveRange => {
                if !self.same(arg(0)?, self.range()?)? {
                    self.error("Invalid range.", "NotFoundError")?;
                }
                self.associate(self.null()?)?;
                self.null()
            }
            SelectionOperation::RemoveAllRanges => {
                self.associate(self.null()?)?;
                self.null()
            }
            SelectionOperation::Collapse => {
                let node = arg(0)?;
                let offset = arg(1)?;
                if self.is_null(node)? {
                    self.associate(self.null()?)?;
                    return self.null();
                }
                if self.invalid_doctype(node)? {
                    self.error(
                        "DocumentType Node can't be used as boundary point.",
                        "InvalidNodeTypeError",
                    )?;
                }
                if self.offset_too_large(node, offset)? {
                    self.error("Invalid range index.", "IndexSizeError")?;
                }
                if !self.root_matches_document(node)? {
                    return self.null();
                }
                let initial = self.point(node, self.number(0.0)?)?;
                let range = self.create_range(initial, initial)?;
                let point = self.point(node, offset)?;
                self.set_boundary(range, point, true)?;
                self.set_boundary(range, point, false)?;
                self.associate(range)?;
                self.null()
            }
            SelectionOperation::CollapseToStart | SelectionOperation::CollapseToEnd => {
                let range = self.range()?;
                if self.is_null(range)? {
                    self.error("There is no selection to collapse.", "InvalidStateError")?;
                }
                let point = self.get(
                    range,
                    if matches!(operation, SelectionOperation::CollapseToStart) {
                        "_start"
                    } else {
                        "_end"
                    },
                )?;
                // The factory receives independent boundary objects, preserving Range's constructor contract.
                let node = self.get(point, "node")?;
                let offset = self.get(point, "offset")?;
                let start = self.point(node, offset)?;
                let end = self.point(node, offset)?;
                self.associate(self.create_range(start, end)?)?;
                self.null()
            }
            SelectionOperation::Extend => {
                let node = arg(0)?;
                let offset = arg(1)?;
                if !self.root_matches_document(node)? {
                    return self.null();
                }
                if self.is_null(self.range()?)? {
                    self.error("There is no selection to extend.", "InvalidStateError")?;
                }
                let anchor = self.boundary(true)?;
                let focus = self.point(node, offset)?;
                let initial = self.point(node, self.number(0.0)?)?;
                let range = self.create_range(initial, initial)?;
                if !self.same(self.root(node)?, self.get(self.range()?, "_root")?)? {
                    self.set_boundary(range, focus, true)?;
                    self.set_boundary(range, focus, false)?;
                } else if self.compare(anchor, focus)? <= 0.0 {
                    self.set_boundary(range, anchor, true)?;
                    self.set_boundary(range, focus, false)?;
                } else {
                    self.set_boundary(range, focus, true)?;
                    self.set_boundary(range, anchor, false)?;
                }
                self.associate(range)?;
                self.set(
                    self.owner,
                    "_direction",
                    self.number(if self.compare(focus, anchor)? == -1.0 {
                        -1.0
                    } else {
                        1.0
                    })?,
                )?;
                self.null()
            }
            SelectionOperation::SetBaseAndExtent => {
                let anchor_node = arg(0)?;
                let anchor_offset = arg(1)?;
                let focus_node = arg(2)?;
                let focus_offset = arg(3)?;
                if self.offset_too_large(anchor_node, anchor_offset)?
                    || self.offset_too_large(focus_node, focus_offset)?
                {
                    self.error("Invalid anchor or focus offset.", "IndexSizeError")?;
                }
                let document = self.document()?;
                if !self.same(document, self.root(anchor_node)?)?
                    || !self.same(document, self.root(focus_node)?)?
                {
                    return self.null();
                }
                let anchor = self.point(anchor_node, anchor_offset)?;
                let focus = self.point(focus_node, focus_offset)?;
                let range = if self.compare(anchor, focus)? == -1.0 {
                    self.create_range(anchor, focus)?
                } else {
                    self.create_range(focus, anchor)?
                };
                self.associate(range)?;
                self.set(
                    self.owner,
                    "_direction",
                    self.number(if self.compare(focus, anchor)? == -1.0 {
                        -1.0
                    } else {
                        1.0
                    })?,
                )?;
                self.null()
            }
            SelectionOperation::SelectAllChildren => {
                let node = arg(0)?;
                if self.invalid_doctype(node)? {
                    self.error(
                        "DocumentType Node can't be used as boundary point.",
                        "InvalidNodeTypeError",
                    )?;
                }
                let document = self.document()?;
                if !self.same(document, self.root(node)?)? {
                    return self.null();
                }
                let length = self.helper1("childrenCount", node)?;
                let initial = self.point(node, self.number(0.0)?)?;
                let range = self.create_range(initial, initial)?;
                self.set_boundary(range, initial, true)?;
                self.set_boundary(range, self.point(node, length)?, false)?;
                self.associate(range)?;
                self.null()
            }
            SelectionOperation::DeleteFromDocument => {
                let range = self.range()?;
                if !self.is_null(range)? {
                    self.call_range_method(range, "deleteContents")?;
                }
                self.null()
            }
            SelectionOperation::ContainsNode => {
                let node = arg(0)?;
                if self.is_null(self.range()?)? || !self.root_matches_document(node)? {
                    return self.boolean(false);
                }
                let range = self.range()?;
                let start = self.get(range, "_start")?;
                let end = self.get(range, "_end")?;
                let before = self.compare(start, self.point(node, self.number(0.0)?)?)? == -1.0;
                let after = self.compare(end, self.point(node, self.length(node)?)?)? == 1.0;
                self.boolean(selection::contains(
                    before,
                    after,
                    arg(1)?.coerce_to_bool()?,
                ))
            }
            SelectionOperation::ToString => {
                let range = self.range()?;
                if range.coerce_to_bool()? {
                    self.call_range_method(range, "toString")
                } else {
                    self.text("")
                }
            }
            SelectionOperation::AssociateRange => {
                self.associate(arg(0)?)?;
                self.null()
            }
        }
    }
}

/// Execute within the caller's Node-API scope; the returned handle borrows that same environment.
/// Optional legacy delivery stays inside the active-operation guard and preserves callback throws.
fn run_selection_operation<'env>(
    env: &'env Env,
    owner: Unknown<'env>,
    operation: SelectionOperation,
    args: Unknown<'env>,
    helpers: Unknown<'env>,
    receive: Option<Unknown<'env>>,
) -> Result<Unknown<'env>> {
    CALLS.fetch_add(1, Ordering::Relaxed);
    ACTIVE.fetch_add(1, Ordering::Relaxed);
    let _guard = Guard;
    let result = (|| {
        let host = Host {
            env,
            owner,
            helpers,
        };
        let value = host.run(operation, args)?;
        if let Some(receive) = receive {
            host.call1(helpers, receive, value)?;
        }
        Ok(value)
    })();
    match result {
        Ok(value) => Ok(value),
        Err(error) => {
            env.throw(capture_pending_error(env, error))?;
            Err(Error::new(
                Status::PendingException,
                "Selection native operation failed",
            ))
        }
    }
}

/// Preserve the original callback API, including its undefined return value.
#[napi]
pub fn selection_operation(
    env: &Env,
    owner: Unknown,
    operation: SelectionOperation,
    args: Unknown,
    helpers: Unknown,
    receive: Unknown,
) -> Result<()> {
    run_selection_operation(env, owner, operation, args, helpers, Some(receive)).map(|_| ())
}

/// Return the original JavaScript value directly without an extra host callback or persistent root.
#[napi]
pub fn selection_operation_result<'env>(
    env: &'env Env,
    owner: Unknown<'env>,
    operation: SelectionOperation,
    args: Unknown<'env>,
    helpers: Unknown<'env>,
) -> Result<Unknown<'env>> {
    run_selection_operation(env, owner, operation, args, helpers, None)
}

#[napi(object)]
pub struct SelectionOperationStatistics {
    pub calls: f64,
    pub active: f64,
}
#[napi]
pub fn selection_operation_statistics() -> SelectionOperationStatistics {
    SelectionOperationStatistics {
        calls: CALLS.load(Ordering::Relaxed) as f64,
        active: ACTIVE.load(Ordering::Relaxed) as f64,
    }
}
