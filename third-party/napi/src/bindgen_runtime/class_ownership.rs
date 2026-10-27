use std::ffi::c_void;
use std::marker::PhantomData;
use std::mem::size_of;
use std::ptr::NonNull;

/// Own the generated class allocation until `napi_wrap` adopts its finalizer.
pub(super) struct PendingClassValue<T> {
    value: NonNull<T>,
    _owned: PhantomData<Box<T>>,
}

impl<T> PendingClassValue<T> {
    /// # Safety
    ///
    /// `value` must be a unique `Box<T>::into_raw` allocation, or the SDK's
    /// one-byte placeholder for an alignment-one zero-sized class. No finalizer
    /// may own it yet. The guard must be transferred immediately after wrapping.
    pub(super) unsafe fn new(value: *mut c_void) -> Self {
        Self {
            value: unsafe { NonNull::new_unchecked(value.cast()) },
            _owned: PhantomData,
        }
    }

    /// The JavaScript object's registered finalizer now owns the allocation.
    pub(super) fn transfer(self) {
        std::mem::forget(self);
    }
}

impl<T> Drop for PendingClassValue<T> {
    fn drop(&mut self) {
        unsafe {
            if size_of::<T>() == 0 && self.value != NonNull::<T>::dangling() {
                // ToNapiValue uses a real byte for ZST identity; into_instance uses
                // Box<T>'s ordinary dangling pointer. Preserve both allocation layouts.
                let placeholder = Box::from_raw(self.value.as_ptr().cast::<u8>());
                self.value.as_ptr().drop_in_place();
                drop(placeholder);
            } else {
                drop(Box::from_raw(self.value.as_ptr()));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PendingClassValue;
    use std::cell::Cell;
    use std::rc::Rc;

    struct OwnedPayload(Rc<Cell<usize>>);
    impl Drop for OwnedPayload {
        fn drop(&mut self) {
            self.0.set(self.0.get() + 1);
        }
    }

    thread_local! {
      static ZERO_SIZED_DROPS: Cell<usize> = const { Cell::new(0) };
    }
    struct ZeroSizedPayload;
    impl Drop for ZeroSizedPayload {
        fn drop(&mut self) {
            ZERO_SIZED_DROPS.with(|count| count.set(count.get() + 1));
        }
    }

    #[test]
    fn pending_value_releases_owned_payload_without_a_javascript_finalizer() {
        let drops = Rc::new(Cell::new(0));
        let pointer = Box::into_raw(Box::new(OwnedPayload(Rc::clone(&drops))));
        drop(unsafe { PendingClassValue::<OwnedPayload>::new(pointer.cast()) });
        assert_eq!(drops.get(), 1);
        assert_eq!(Rc::strong_count(&drops), 1);
    }

    #[test]
    fn transferred_value_is_released_only_by_the_new_owner() {
        let drops = Rc::new(Cell::new(0));
        let pointer = Box::into_raw(Box::new(OwnedPayload(Rc::clone(&drops))));
        unsafe { PendingClassValue::<OwnedPayload>::new(pointer.cast()) }.transfer();
        assert_eq!(drops.get(), 0);
        assert_eq!(Rc::strong_count(&drops), 2);
        drop(unsafe { Box::from_raw(pointer) });
        assert_eq!(drops.get(), 1);
        assert_eq!(Rc::strong_count(&drops), 1);
    }

    #[test]
    fn propagated_error_releases_the_pending_payload() {
        fn fail(drops: Rc<Cell<usize>>) -> Result<(), &'static str> {
            let pointer = Box::into_raw(Box::new(OwnedPayload(drops)));
            let _pending = unsafe { PendingClassValue::<OwnedPayload>::new(pointer.cast()) };
            Err("class creation failed before ownership transfer")?;
            Ok(())
        }
        let drops = Rc::new(Cell::new(0));
        assert!(fail(Rc::clone(&drops)).is_err());
        assert_eq!(drops.get(), 1);
        assert_eq!(Rc::strong_count(&drops), 1);
    }

    #[test]
    fn ordinary_zero_sized_box_runs_its_destructor() {
        ZERO_SIZED_DROPS.with(|count| count.set(0));
        let pointer = Box::into_raw(Box::new(ZeroSizedPayload));
        drop(unsafe { PendingClassValue::<ZeroSizedPayload>::new(pointer.cast()) });
        ZERO_SIZED_DROPS.with(|count| assert_eq!(count.get(), 1));
    }

    #[test]
    fn legacy_zero_sized_placeholder_runs_the_destructor_and_releases_its_byte() {
        ZERO_SIZED_DROPS.with(|count| count.set(0));
        let pointer = Box::into_raw(Box::new(0_u8));
        drop(unsafe { PendingClassValue::<ZeroSizedPayload>::new(pointer.cast()) });
        ZERO_SIZED_DROPS.with(|count| assert_eq!(count.get(), 1));
    }

    #[test]
    fn aligned_zero_sized_box_does_not_deallocate_its_dangling_pointer() {
        #[repr(align(32))]
        struct AlignedPayload;
        let pointer = Box::into_raw(Box::new(AlignedPayload));
        drop(unsafe { PendingClassValue::<AlignedPayload>::new(pointer.cast()) });
    }
}
