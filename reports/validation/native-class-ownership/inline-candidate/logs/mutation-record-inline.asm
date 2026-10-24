
/home/guido/rustdom-native-class-inline-x2yg1emf/dist/rustdom.node:     file format elf64-x86-64


Disassembly of section .text:

00000000002d47f0 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value>:
  2d47f0:	push   %r15
  2d47f2:	push   %r14
  2d47f4:	push   %r13
  2d47f6:	push   %r12
  2d47f8:	push   %rbx
  2d47f9:	sub    $0x70,%rsp
  2d47fd:	mov    %rdx,%r14
  2d4800:	mov    %rsi,%r15
  2d4803:	mov    %rdi,%rbx
  2d4806:	mov    %rdx,0x8(%rsp)
  2d480b:	lea    -0x277c08(%rip),%rdi        # 5cc0a <std::thread::current::id::ID+0x5ca92>
  2d4812:	mov    $0x15,%esi
  2d4817:	call   *0xcc10b(%rip)        # 3a0928 <_DYNAMIC+0x1a50>
  2d481d:	cmp    $0x1,%rax
  2d4821:	jne    2d48e7 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0xf7>
  2d4827:	mov    %rdx,%r13
  2d482a:	mov    %r14,0x10(%rsp)
  2d482f:	call   *0xca8db(%rip)        # 39f110 <_DYNAMIC+0x238>
  2d4835:	mov    $0x8,%edi
  2d483a:	mov    $0x8,%esi
  2d483f:	call   *0xca8fb(%rip)        # 39f140 <_DYNAMIC+0x268>
  2d4845:	test   %rax,%rax
  2d4848:	je     2d4a1c <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x22c>
  2d484e:	mov    %rax,%r12
  2d4851:	mov    %r14,(%rax)
  2d4854:	movq   $0x3b,(%rsp)
  2d485c:	lea    -0x17e353(%rip),%r8        # 156510 <napi::bindgen_runtime::raw_finalize_unchecked::<rustdom::dom::mutation_record_binding::NativeMutationRecord>>
  2d4863:	lea    -0x272e86(%rip),%r9        # 619e4 <std::thread::current::id::ID+0x6186c>
  2d486a:	lea    0x10(%rsp),%rdi
  2d486f:	mov    %r15,%rsi
  2d4872:	mov    %rax,%rdx
  2d4875:	mov    %r13,%rcx
  2d4878:	call   *0xcaf4a(%rip)        # 39f7c8 <_DYNAMIC+0x8f0>
  2d487e:	mov    0x10(%rsp),%r13
  2d4883:	mov    0x18(%rsp),%r14
  2d4888:	cmp    $0xffffffffffffffff,%r13
  2d488c:	je     2d498d <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x19d>
  2d4892:	movups 0x20(%rsp),%xmm0
  2d4897:	movups 0x30(%rsp),%xmm1
  2d489c:	movaps %xmm1,0x50(%rsp)
  2d48a1:	movaps %xmm0,0x40(%rsp)
  2d48a6:	mov    0xcae1b(%rip),%rax        # 39f6c8 <_DYNAMIC+0x7f0>
  2d48ad:	lock decq (%rax)
  2d48b1:	mov    0xcae18(%rip),%rax        # 39f6d0 <_DYNAMIC+0x7f8>
  2d48b8:	lock incq (%rax)
  2d48bc:	mov    (%r12),%rax
  2d48c0:	lock decq (%rax)
  2d48c4:	jne    2d48cf <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0xdf>
  2d48c6:	mov    %r12,%rdi
  2d48c9:	call   *0xcabe9(%rip)        # 39f4b8 <_DYNAMIC+0x5e0>
  2d48cf:	mov    $0x8,%esi
  2d48d4:	mov    $0x8,%edx
  2d48d9:	mov    %r12,%rdi
  2d48dc:	call   *0xca86e(%rip)        # 39f150 <_DYNAMIC+0x278>
  2d48e2:	jmp    2d49e5 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1f5>
  2d48e7:	mov    0xca822(%rip),%r15        # 39f110 <_DYNAMIC+0x238>
  2d48ee:	call   *%r15
  2d48f1:	call   *%r15
  2d48f4:	mov    $0x4a,%edi
  2d48f9:	mov    $0x1,%esi
  2d48fe:	call   *0xca83c(%rip)        # 39f140 <_DYNAMIC+0x268>
  2d4904:	test   %rax,%rax
  2d4907:	je     2d4a2e <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x23e>
  2d490d:	movups -0x26d6e8(%rip),%xmm0        # 6722c <encoding_rs::data::KSX1001_LOWERCASE+0x4eac>
  2d4914:	movups %xmm0,0x3a(%rax)
  2d4918:	movups -0x26d6fd(%rip),%xmm0        # 67222 <encoding_rs::data::KSX1001_LOWERCASE+0x4ea2>
  2d491f:	movups %xmm0,0x30(%rax)
  2d4923:	movups -0x26d718(%rip),%xmm0        # 67212 <encoding_rs::data::KSX1001_LOWERCASE+0x4e92>
  2d492a:	movups %xmm0,0x20(%rax)
  2d492e:	movups -0x26d733(%rip),%xmm0        # 67202 <encoding_rs::data::KSX1001_LOWERCASE+0x4e82>
  2d4935:	movups %xmm0,0x10(%rax)
  2d4939:	movups -0x26d74e(%rip),%xmm0        # 671f2 <encoding_rs::data::KSX1001_LOWERCASE+0x4e72>
  2d4940:	movups %xmm0,(%rax)
  2d4943:	xorps  %xmm0,%xmm0
  2d4946:	movups %xmm0,0x18(%rbx)
  2d494a:	movq   $0x4a,(%rbx)
  2d4951:	mov    %rax,0x8(%rbx)
  2d4955:	movq   $0x4a,0x10(%rbx)
  2d495d:	movl   $0x1,0x28(%rbx)
  2d4964:	mov    0xcad5d(%rip),%rax        # 39f6c8 <_DYNAMIC+0x7f0>
  2d496b:	lock decq (%rax)
  2d496f:	mov    0xcad5a(%rip),%rax        # 39f6d0 <_DYNAMIC+0x7f8>
  2d4976:	lock incq (%rax)
  2d497a:	lock decq (%r14)
  2d497e:	jne    2d49fe <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x20e>
  2d4980:	lea    0x8(%rsp),%rdi
  2d4985:	call   *0xcab2d(%rip)        # 39f4b8 <_DYNAMIC+0x5e0>
  2d498b:	jmp    2d49fe <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x20e>
  2d498d:	movabs $0xd55f9027949a83ee,%rax
  2d4997:	mov    %rax,0x60(%rsp)
  2d499c:	movabs $0x2ed6607c9c363ba3,%rax
  2d49a6:	mov    %rax,0x68(%rsp)
  2d49ab:	lea    0x10(%rsp),%rdi
  2d49b0:	lea    0x60(%rsp),%rcx
  2d49b5:	mov    %r15,%rsi
  2d49b8:	mov    %r14,%rdx
  2d49bb:	call   *0xca7c7(%rip)        # 39f188 <_DYNAMIC+0x2b0>
  2d49c1:	mov    0x10(%rsp),%r13
  2d49c6:	cmp    $0xffffffffffffffff,%r13
  2d49ca:	je     2d4a0f <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x21f>
  2d49cc:	mov    0x18(%rsp),%r14
  2d49d1:	movups 0x20(%rsp),%xmm0
  2d49d6:	movaps %xmm0,0x40(%rsp)
  2d49db:	movups 0x30(%rsp),%xmm0
  2d49e0:	movaps %xmm0,0x50(%rsp)
  2d49e5:	mov    %r13,(%rbx)
  2d49e8:	mov    %r14,0x8(%rbx)
  2d49ec:	movaps 0x40(%rsp),%xmm0
  2d49f1:	movaps 0x50(%rsp),%xmm1
  2d49f6:	movups %xmm0,0x10(%rbx)
  2d49fa:	movups %xmm1,0x20(%rbx)
  2d49fe:	mov    %rbx,%rax
  2d4a01:	add    $0x70,%rsp
  2d4a05:	pop    %rbx
  2d4a06:	pop    %r12
  2d4a08:	pop    %r13
  2d4a0a:	pop    %r14
  2d4a0c:	pop    %r15
  2d4a0e:	ret    
  2d4a0f:	mov    %r14,0x8(%rbx)
  2d4a13:	movq   $0xffffffffffffffff,(%rbx)
  2d4a1a:	jmp    2d49fe <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x20e>
  2d4a1c:	mov    $0x8,%edi
  2d4a21:	mov    $0x8,%esi
  2d4a26:	call   *0xca6fc(%rip)        # 39f128 <_DYNAMIC+0x250>
  2d4a2c:	jmp    2d4a3e <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x24e>
  2d4a2e:	mov    $0x1,%edi
  2d4a33:	mov    $0x4a,%esi
  2d4a38:	call   *0xca722(%rip)        # 39f160 <_DYNAMIC+0x288>
  2d4a3e:	ud2    
  2d4a40:	mov    %rax,%rbx
  2d4a43:	mov    %r12,%rdi
  2d4a46:	call   15cf50 <core::ptr::drop_glue::<napi::bindgen_runtime::class_ownership::PendingClassValue<rustdom::dom::mutation_record_binding::NativeMutationRecord>>>
  2d4a4b:	mov    %rbx,%rdi
  2d4a4e:	call   357180 <_Unwind_Resume@plt>
  2d4a53:	jmp    2d4a55 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x265>
  2d4a55:	mov    %rax,%rbx
  2d4a58:	mov    0xcac69(%rip),%rax        # 39f6c8 <_DYNAMIC+0x7f0>
  2d4a5f:	lock decq (%rax)
  2d4a63:	mov    0xcac66(%rip),%rax        # 39f6d0 <_DYNAMIC+0x7f8>
  2d4a6a:	lock incq (%rax)
  2d4a6e:	lock decq (%r14)
  2d4a72:	jne    2d4ab1 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x2c1>
  2d4a74:	lea    0x8(%rsp),%rdi
  2d4a79:	call   *0xcaa39(%rip)        # 39f4b8 <_DYNAMIC+0x5e0>
  2d4a7f:	mov    %rbx,%rdi
  2d4a82:	call   357180 <_Unwind_Resume@plt>
  2d4a87:	mov    0xcac3a(%rip),%rcx        # 39f6c8 <_DYNAMIC+0x7f0>
  2d4a8e:	lock decq (%rcx)
  2d4a92:	mov    0xcac37(%rip),%rcx        # 39f6d0 <_DYNAMIC+0x7f8>
  2d4a99:	lock incq (%rcx)
  2d4a9d:	mov    %rax,%rbx
  2d4aa0:	lock decq (%r14)
  2d4aa4:	jne    2d4ab1 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x2c1>
  2d4aa6:	lea    0x10(%rsp),%rdi
  2d4aab:	call   *0xcaa07(%rip)        # 39f4b8 <_DYNAMIC+0x5e0>
  2d4ab1:	mov    %rbx,%rdi
  2d4ab4:	call   357180 <_Unwind_Resume@plt>
