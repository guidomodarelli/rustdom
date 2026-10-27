
/home/guido/rustdom-native-class-NMmiki/dist/rustdom.node:     file format elf64-x86-64


Disassembly of section .text:

0000000000165880 <napi::bindgen_runtime::js_values::class::new_instance::<rustdom::dom::mutation_record_binding::NativeMutationRecord>>:
  165880:	push   %r15
  165882:	push   %r14
  165884:	push   %r12
  165886:	push   %rbx
  165887:	sub    $0x48,%rsp
  16588b:	mov    %rdx,%r14
  16588e:	mov    %rsi,%r15
  165891:	mov    %rdi,%rbx
  165894:	movq   $0x3b,(%rsp)
  16589c:	lea    -0xf253(%rip),%r8        # 156650 <napi::bindgen_runtime::raw_finalize_unchecked::<rustdom::dom::mutation_record_binding::NativeMutationRecord>>
  1658a3:	lea    -0x103ec6(%rip),%r9        # 619e4 <std::thread::current::id::ID+0x6186c>
  1658aa:	lea    0x8(%rsp),%rdi
  1658af:	call   *0x23a193(%rip)        # 39fa48 <_DYNAMIC+0x8f0>
  1658b5:	mov    0x8(%rsp),%rax
  1658ba:	mov    0x10(%rsp),%r12
  1658bf:	cmp    $0xffffffffffffffff,%rax
  1658c3:	je     165924 <napi::bindgen_runtime::js_values::class::new_instance::<rustdom::dom::mutation_record_binding::NativeMutationRecord>+0xa4>
  1658c5:	movups 0x18(%rsp),%xmm0
  1658ca:	movups 0x28(%rsp),%xmm1
  1658cf:	movups %xmm1,0x20(%rbx)
  1658d3:	movups %xmm0,0x10(%rbx)
  1658d7:	mov    %rax,(%rbx)
  1658da:	mov    %r12,0x8(%rbx)
  1658de:	mov    0x23a063(%rip),%rax        # 39f948 <_DYNAMIC+0x7f0>
  1658e5:	lock decq (%rax)
  1658e9:	mov    0x23a060(%rip),%rax        # 39f950 <_DYNAMIC+0x7f8>
  1658f0:	lock incq (%rax)
  1658f4:	mov    (%r14),%rax
  1658f7:	lock decq (%rax)
  1658fb:	jne    165906 <napi::bindgen_runtime::js_values::class::new_instance::<rustdom::dom::mutation_record_binding::NativeMutationRecord>+0x86>
  1658fd:	mov    %r14,%rdi
  165900:	call   *0x239e32(%rip)        # 39f738 <_DYNAMIC+0x5e0>
  165906:	mov    $0x8,%esi
  16590b:	mov    $0x8,%edx
  165910:	mov    %r14,%rdi
  165913:	add    $0x48,%rsp
  165917:	pop    %rbx
  165918:	pop    %r12
  16591a:	pop    %r14
  16591c:	pop    %r15
  16591e:	jmp    *0x239aac(%rip)        # 39f3d0 <_DYNAMIC+0x278>
  165924:	movabs $0xd55f9027949a83ee,%rax
  16592e:	mov    %rax,0x38(%rsp)
  165933:	movabs $0x2ed6607c9c363ba3,%rax
  16593d:	mov    %rax,0x40(%rsp)
  165942:	lea    0x8(%rsp),%rdi
  165947:	lea    0x38(%rsp),%rcx
  16594c:	mov    %r15,%rsi
  16594f:	mov    %r12,%rdx
  165952:	call   *0x239ab0(%rip)        # 39f408 <_DYNAMIC+0x2b0>
  165958:	cmpq   $0xffffffffffffffff,0x8(%rsp)
  16595e:	je     16597c <napi::bindgen_runtime::js_values::class::new_instance::<rustdom::dom::mutation_record_binding::NativeMutationRecord>+0xfc>
  165960:	movups 0x8(%rsp),%xmm0
  165965:	movups 0x18(%rsp),%xmm1
  16596a:	movups 0x28(%rsp),%xmm2
  16596f:	movups %xmm2,0x20(%rbx)
  165973:	movups %xmm1,0x10(%rbx)
  165977:	movups %xmm0,(%rbx)
  16597a:	jmp    165987 <napi::bindgen_runtime::js_values::class::new_instance::<rustdom::dom::mutation_record_binding::NativeMutationRecord>+0x107>
  16597c:	mov    %r12,0x8(%rbx)
  165980:	movq   $0xffffffffffffffff,(%rbx)
  165987:	add    $0x48,%rsp
  16598b:	pop    %rbx
  16598c:	pop    %r12
  16598e:	pop    %r14
  165990:	pop    %r15
  165992:	ret    
  165993:	mov    %rax,%rbx
  165996:	mov    %r14,%rdi
  165999:	call   15d090 <core::ptr::drop_glue::<napi::bindgen_runtime::class_ownership::PendingClassValue<rustdom::dom::mutation_record_binding::NativeMutationRecord>>>
  16599e:	mov    %rbx,%rdi
  1659a1:	call   357400 <_Unwind_Resume@plt>
