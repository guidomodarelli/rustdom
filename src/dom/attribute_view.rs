//! Borrow current attribute metadata without cloning payloads or crossing Node-API.
use super::{
    constants::ELEMENT_NODE,
    data::{AttributeData, DomString},
    error::{Result, TreeError},
    store::{NodeId, TreeStore},
};

pub(crate) struct AttributeView<'a> {
    pub name: &'a DomString,
    pub namespace: Option<&'a DomString>,
    pub prefix: Option<&'a DomString>,
    pub value: &'a DomString,
}

pub(crate) enum AttributeViews<'a> {
    Canonical {
        store: &'a TreeStore,
        ids: std::slice::Iter<'a, NodeId>,
    },
    Snapshot(std::slice::Iter<'a, AttributeData>),
}

impl<'a> Iterator for AttributeViews<'a> {
    type Item = Result<AttributeView<'a>>;
    fn next(&mut self) -> Option<Self::Item> {
        match self {
            Self::Canonical { store, ids } => ids.next().map(|id| {
                let data = store.data.get(id).ok_or(TreeError::MissingData(*id))?;
                Ok(AttributeView {
                    name: data.name.as_ref().ok_or(TreeError::MissingData(*id))?,
                    namespace: data.namespace.as_ref(),
                    prefix: data.prefix.as_ref(),
                    value: &data.value,
                })
            }),
            Self::Snapshot(attributes) => attributes.next().map(|attribute| {
                Ok(AttributeView {
                    name: &attribute.name,
                    namespace: attribute.namespace.as_ref(),
                    prefix: attribute.prefix.as_ref(),
                    value: &attribute.value,
                })
            }),
        }
    }
}

impl TreeStore {
    pub(crate) fn attribute_views(&self, element: NodeId) -> Result<AttributeViews<'_>> {
        let data = self
            .data
            .get(&element)
            .ok_or(TreeError::MissingData(element))?;
        if data.kind != ELEMENT_NODE {
            return Err(TreeError::NotElement(element));
        }
        Ok(match self.attribute_collections.elements.get(&element) {
            Some(collection) => AttributeViews::Canonical {
                store: self,
                ids: collection.ordered.iter(),
            },
            None => AttributeViews::Snapshot(data.attributes.iter()),
        })
    }
}
