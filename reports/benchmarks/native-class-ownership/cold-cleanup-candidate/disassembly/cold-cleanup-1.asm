
/home/guido/rustdom-validation/ownership-cold-cleanup-prototype/artifacts/cold-cleanup.node:     file format elf64-x86-64


Disassembly of section .text:

00000000002d1b20 <<napi::bindgen_runtime::class_ownership::PendingClassValue<rustdom::dom::mutation_record_binding::NativeMutationRecord> as core::ops::drop::Drop>::drop>:
  2d1b20:	push   %rbx
  2d1b21:	mov    (%rdi),%rbx
  2d1b24:	mov    0xcdfc5(%rip),%rax        # 39faf0 <_DYNAMIC+0x800>
  2d1b2b:	lock decq (%rax)
  2d1b2f:	mov    0xcdfc2(%rip),%rax        # 39faf8 <_DYNAMIC+0x808>
  2d1b36:	lock incq (%rax)
  2d1b3a:	mov    (%rbx),%rax
  2d1b3d:	lock decq (%rax)
  2d1b41:	jne    2d1b4c <<napi::bindgen_runtime::class_ownership::PendingClassValue<rustdom::dom::mutation_record_binding::NativeMutationRecord> as core::ops::drop::Drop>::drop+0x2c>
  2d1b43:	mov    %rbx,%rdi
  2d1b46:	call   *0xcdd94(%rip)        # 39f8e0 <_DYNAMIC+0x5f0>
  2d1b4c:	mov    $0x8,%esi
  2d1b51:	mov    $0x8,%edx
  2d1b56:	mov    %rbx,%rdi
  2d1b59:	pop    %rbx
  2d1b5a:	jmp    *0xcda08(%rip)        # 39f568 <_DYNAMIC+0x278>
