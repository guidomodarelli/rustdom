//! Immutable DocumentType and ProcessingInstruction metadata held only by the native node record.
use super::{
    constants::{DOCUMENT_TYPE_NODE, PROCESSING_INSTRUCTION_NODE},
    data::{DocumentTypeData, DomString, NodeData},
    error::{Result, TreeError},
    store::{TreeStore, node_id},
};

pub enum DocumentTypeField {
    Name,
    PublicId,
    SystemId,
}

impl TreeStore {
    pub fn initialize_document_type(
        &mut self,
        handle: f64,
        name: &[u16],
        public_id: &[u16],
        system_id: &[u16],
    ) -> Result<()> {
        self.replace_data(
            handle,
            NodeData {
                kind: DOCUMENT_TYPE_NODE,
                name: Some(DomString::from_units(name)),
                doctype: Some(Box::new(DocumentTypeData {
                    public_id: DomString::from_units(public_id),
                    system_id: DomString::from_units(system_id),
                })),
                ..NodeData::default()
            },
        )
    }

    pub fn document_type_field(&self, handle: f64, field: DocumentTypeField) -> Result<Vec<u16>> {
        let id = node_id(handle)?;
        let data = self.data.get(&id).ok_or(TreeError::MissingData(id))?;
        if data.kind != DOCUMENT_TYPE_NODE {
            return Err(TreeError::NotDocumentType(id));
        }
        let value = match field {
            DocumentTypeField::Name => data.name.as_ref().ok_or(TreeError::MissingData(id))?,
            DocumentTypeField::PublicId => {
                let Some(doctype) = &data.doctype else {
                    return Ok(Vec::new());
                };
                &doctype.public_id
            }
            DocumentTypeField::SystemId => {
                let Some(doctype) = &data.doctype else {
                    return Ok(Vec::new());
                };
                &doctype.system_id
            }
        };
        Ok(value.units().collect())
    }

    pub fn initialize_processing_instruction_target(
        &mut self,
        handle: f64,
        target: &[u16],
    ) -> Result<()> {
        let id = node_id(handle)?;
        let data = self.data.get(&id).ok_or(TreeError::MissingData(id))?;
        if data.kind != PROCESSING_INSTRUCTION_NODE {
            return Err(TreeError::NotProcessingInstruction(id));
        }
        let mut data = data.clone();
        data.name = Some(DomString::from_units(target));
        self.replace_data(handle, data)
    }

    pub fn processing_instruction_target(&self, handle: f64) -> Result<Vec<u16>> {
        let id = node_id(handle)?;
        let data = self.data.get(&id).ok_or(TreeError::MissingData(id))?;
        if data.kind != PROCESSING_INSTRUCTION_NODE {
            return Err(TreeError::NotProcessingInstruction(id));
        }
        Ok(data
            .name
            .as_ref()
            .ok_or(TreeError::MissingData(id))?
            .units()
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_keep_processing_instruction_target_through_character_data_updates() {
        let mut tree = TreeStore::new();
        let handle = tree.allocate().unwrap();
        tree.set_character_data(handle, PROCESSING_INSTRUCTION_NODE, vec![65])
            .unwrap();
        tree.initialize_processing_instruction_target(handle, &[116, 97, 114, 103, 101, 116])
            .unwrap();
        tree.set_character_data(handle, PROCESSING_INSTRUCTION_NODE, vec![66])
            .unwrap();
        assert_eq!(
            tree.processing_instruction_target(handle).unwrap(),
            vec![116, 97, 114, 103, 101, 116]
        );
        tree.replace_character_data(handle, 0, 1, &[55296]).unwrap();
        assert_eq!(
            tree.processing_instruction_target(handle).unwrap(),
            vec![116, 97, 114, 103, 101, 116]
        );
        assert_eq!(tree.character_data(handle).unwrap(), &[55296]);
        assert!(
            tree.document_type_field(handle, DocumentTypeField::Name)
                .is_err()
        );
    }

    #[test]
    fn should_preserve_doctype_identifiers_and_release_their_native_storage() {
        let mut tree = TreeStore::new();
        let handle = tree.allocate().unwrap();
        tree.initialize_document_type(handle, &[114], &[55296, 0], &[56320])
            .unwrap();
        assert_eq!(
            tree.document_type_field(handle, DocumentTypeField::Name)
                .unwrap(),
            vec![114]
        );
        assert_eq!(
            tree.document_type_field(handle, DocumentTypeField::PublicId)
                .unwrap(),
            vec![55296, 0]
        );
        assert_eq!(
            tree.document_type_field(handle, DocumentTypeField::SystemId)
                .unwrap(),
            vec![56320]
        );
        assert!(
            tree.initialize_processing_instruction_target(handle, &[116])
                .is_err()
        );
        assert_eq!(
            tree.document_type_field(handle, DocumentTypeField::SystemId)
                .unwrap(),
            vec![56320]
        );
        tree.release(handle).unwrap();
        assert!(
            tree.document_type_field(handle, DocumentTypeField::Name)
                .is_err()
        );
        assert_eq!(tree.statistics().data_nodes, 0.0);
    }
}
