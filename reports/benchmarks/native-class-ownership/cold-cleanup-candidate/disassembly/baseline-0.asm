
/home/guido/rustdom-validation/ownership-cold-cleanup-prototype/artifacts/baseline.node:     file format elf64-x86-64


Disassembly of section .text:

000000000015d1c0 <core::ptr::drop_glue::<napi::bindgen_runtime::class_ownership::PendingClassValue<rustdom::dom::mutation_record_binding::NativeMutationRecord>>>:
  15d1c0:	push   %rbx
  15d1c1:	mov    0x242da8(%rip),%rax        # 39ff70 <_DYNAMIC+0x7f0>
  15d1c8:	lock decq (%rax)
  15d1cc:	mov    0x242da5(%rip),%rax        # 39ff78 <_DYNAMIC+0x7f8>
  15d1d3:	lock incq (%rax)
  15d1d7:	mov    (%rdi),%rax
  15d1da:	lock decq (%rax)
  15d1de:	jne    15d1ec <core::ptr::drop_glue::<napi::bindgen_runtime::class_ownership::PendingClassValue<rustdom::dom::mutation_record_binding::NativeMutationRecord>>+0x2c>
  15d1e0:	mov    %rdi,%rbx
  15d1e3:	call   *0x242b77(%rip)        # 39fd60 <_DYNAMIC+0x5e0>
  15d1e9:	mov    %rbx,%rdi
  15d1ec:	mov    $0x8,%esi
  15d1f1:	mov    $0x8,%edx
  15d1f6:	pop    %rbx
  15d1f7:	jmp    *0x2427fb(%rip)        # 39f9f8 <_DYNAMIC+0x278>
