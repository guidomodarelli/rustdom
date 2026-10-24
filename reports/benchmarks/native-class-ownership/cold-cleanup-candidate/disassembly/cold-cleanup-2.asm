
/home/guido/rustdom-validation/ownership-cold-cleanup-prototype/artifacts/cold-cleanup.node:     file format elf64-x86-64


Disassembly of section .text:

00000000002d4b10 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value>:
  2d4b10:	push   %r15
  2d4b12:	push   %r14
  2d4b14:	push   %r12
  2d4b16:	push   %rbx
  2d4b17:	sub    $0x88,%rsp
  2d4b1e:	mov    %rdx,%r14
  2d4b21:	mov    %rsi,%r15
  2d4b24:	mov    %rdi,%rbx
  2d4b27:	mov    %rdx,0x10(%rsp)
  2d4b2c:	lea    -0x277ca9(%rip),%rdi        # 5ce8a <std::thread::current::id::ID+0x5cd12>
  2d4b33:	mov    $0x15,%esi
  2d4b38:	call   *0xcc28a(%rip)        # 3a0dc8 <_DYNAMIC+0x1ad8>
  2d4b3e:	cmp    $0x1,%rax
  2d4b42:	jne    2d4c32 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x122>
  2d4b48:	mov    %rdx,%r12
  2d4b4b:	mov    %r14,0x20(%rsp)
  2d4b50:	call   *0xca9d2(%rip)        # 39f528 <_DYNAMIC+0x238>
  2d4b56:	mov    $0x8,%edi
  2d4b5b:	mov    $0x8,%esi
  2d4b60:	call   *0xca9f2(%rip)        # 39f558 <_DYNAMIC+0x268>
  2d4b66:	test   %rax,%rax
  2d4b69:	je     2d4d19 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x209>
  2d4b6f:	mov    %r14,(%rax)
  2d4b72:	mov    %rax,0x18(%rsp)
  2d4b77:	movq   $0x3b,(%rsp)
  2d4b7f:	lea    -0x17e2b6(%rip),%r8        # 1568d0 <napi::bindgen_runtime::raw_finalize_unchecked::<rustdom::dom::mutation_record_binding::NativeMutationRecord>>
  2d4b86:	lea    -0x272f29(%rip),%r9        # 61c64 <std::thread::current::id::ID+0x61aec>
  2d4b8d:	lea    0x20(%rsp),%rdi
  2d4b92:	mov    %r15,%rsi
  2d4b95:	mov    %rax,%rdx
  2d4b98:	mov    %r12,%rcx
  2d4b9b:	call   *0xcc22f(%rip)        # 3a0dd0 <_DYNAMIC+0x1ae0>
  2d4ba1:	mov    0x20(%rsp),%r12
  2d4ba6:	mov    0x28(%rsp),%r14
  2d4bab:	cmp    $0xffffffffffffffff,%r12
  2d4baf:	jne    2d4cf5 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1e5>
  2d4bb5:	movabs $0xd55f9027949a83ee,%rax
  2d4bbf:	mov    %rax,0x78(%rsp)
  2d4bc4:	movabs $0x2ed6607c9c363ba3,%rax
  2d4bce:	mov    %rax,0x80(%rsp)
  2d4bd6:	lea    0x20(%rsp),%rdi
  2d4bdb:	lea    0x78(%rsp),%rcx
  2d4be0:	mov    %r15,%rsi
  2d4be3:	mov    %r14,%rdx
  2d4be6:	call   *0xca9a4(%rip)        # 39f590 <_DYNAMIC+0x2a0>
  2d4bec:	mov    0x20(%rsp),%r12
  2d4bf1:	cmp    $0xffffffffffffffff,%r12
  2d4bf5:	je     2d4cd8 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1c8>
  2d4bfb:	mov    0x28(%rsp),%r14
  2d4c00:	movups 0x30(%rsp),%xmm0
  2d4c05:	movaps %xmm0,0x50(%rsp)
  2d4c0a:	movups 0x40(%rsp),%xmm0
  2d4c0f:	movaps %xmm0,0x60(%rsp)
  2d4c14:	mov    %r12,(%rbx)
  2d4c17:	mov    %r14,0x8(%rbx)
  2d4c1b:	movaps 0x50(%rsp),%xmm0
  2d4c20:	movaps 0x60(%rsp),%xmm1
  2d4c25:	movups %xmm0,0x10(%rbx)
  2d4c29:	movups %xmm1,0x20(%rbx)
  2d4c2d:	jmp    2d4ce3 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1d3>
  2d4c32:	mov    0xca8ef(%rip),%r15        # 39f528 <_DYNAMIC+0x238>
  2d4c39:	call   *%r15
  2d4c3c:	call   *%r15
  2d4c3f:	mov    $0x4a,%edi
  2d4c44:	mov    $0x1,%esi
  2d4c49:	call   *0xca909(%rip)        # 39f558 <_DYNAMIC+0x268>
  2d4c4f:	test   %rax,%rax
  2d4c52:	je     2d4d2b <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x21b>
  2d4c58:	movups -0x26d76d(%rip),%xmm0        # 674f2 <encoding_rs::data::KSX1001_LOWERCASE+0x4ef2>
  2d4c5f:	movups %xmm0,0x3a(%rax)
  2d4c63:	movups -0x26d782(%rip),%xmm0        # 674e8 <encoding_rs::data::KSX1001_LOWERCASE+0x4ee8>
  2d4c6a:	movups %xmm0,0x30(%rax)
  2d4c6e:	movups -0x26d79d(%rip),%xmm0        # 674d8 <encoding_rs::data::KSX1001_LOWERCASE+0x4ed8>
  2d4c75:	movups %xmm0,0x20(%rax)
  2d4c79:	movups -0x26d7b8(%rip),%xmm0        # 674c8 <encoding_rs::data::KSX1001_LOWERCASE+0x4ec8>
  2d4c80:	movups %xmm0,0x10(%rax)
  2d4c84:	movups -0x26d7d3(%rip),%xmm0        # 674b8 <encoding_rs::data::KSX1001_LOWERCASE+0x4eb8>
  2d4c8b:	movups %xmm0,(%rax)
  2d4c8e:	xorps  %xmm0,%xmm0
  2d4c91:	movups %xmm0,0x18(%rbx)
  2d4c95:	movq   $0x4a,(%rbx)
  2d4c9c:	mov    %rax,0x8(%rbx)
  2d4ca0:	movq   $0x4a,0x10(%rbx)
  2d4ca8:	movl   $0x1,0x28(%rbx)
  2d4caf:	mov    0xcae3a(%rip),%rax        # 39faf0 <_DYNAMIC+0x800>
  2d4cb6:	lock decq (%rax)
  2d4cba:	mov    0xcae37(%rip),%rax        # 39faf8 <_DYNAMIC+0x808>
  2d4cc1:	lock incq (%rax)
  2d4cc5:	lock decq (%r14)
  2d4cc9:	jne    2d4ce3 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1d3>
  2d4ccb:	lea    0x10(%rsp),%rdi
  2d4cd0:	call   *0xcac0a(%rip)        # 39f8e0 <_DYNAMIC+0x5f0>
  2d4cd6:	jmp    2d4ce3 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1d3>
  2d4cd8:	mov    %r14,0x8(%rbx)
  2d4cdc:	movq   $0xffffffffffffffff,(%rbx)
  2d4ce3:	mov    %rbx,%rax
  2d4ce6:	add    $0x88,%rsp
  2d4ced:	pop    %rbx
  2d4cee:	pop    %r12
  2d4cf0:	pop    %r14
  2d4cf2:	pop    %r15
  2d4cf4:	ret    
  2d4cf5:	movups 0x30(%rsp),%xmm0
  2d4cfa:	movups 0x40(%rsp),%xmm1
  2d4cff:	movaps %xmm1,0x60(%rsp)
  2d4d04:	movaps %xmm0,0x50(%rsp)
  2d4d09:	lea    0x18(%rsp),%rdi
  2d4d0e:	call   *0xcbd94(%rip)        # 3a0aa8 <_DYNAMIC+0x17b8>
  2d4d14:	jmp    2d4c14 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x104>
  2d4d19:	mov    $0x8,%edi
  2d4d1e:	mov    $0x8,%esi
  2d4d23:	call   *0xca817(%rip)        # 39f540 <_DYNAMIC+0x250>
  2d4d29:	jmp    2d4d3b <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x22b>
  2d4d2b:	mov    $0x1,%edi
  2d4d30:	mov    $0x4a,%esi
  2d4d35:	call   *0xca83d(%rip)        # 39f578 <_DYNAMIC+0x288>
  2d4d3b:	ud2    
  2d4d3d:	mov    %rax,%rbx
  2d4d40:	lea    0x18(%rsp),%rdi
  2d4d45:	call   *0xcbd5d(%rip)        # 3a0aa8 <_DYNAMIC+0x17b8>
  2d4d4b:	mov    %rbx,%rdi
  2d4d4e:	call   357590 <_Unwind_Resume@plt>
  2d4d53:	jmp    2d4d55 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x245>
  2d4d55:	mov    %rax,%rbx
  2d4d58:	mov    0xcad91(%rip),%rax        # 39faf0 <_DYNAMIC+0x800>
  2d4d5f:	lock decq (%rax)
  2d4d63:	mov    0xcad8e(%rip),%rax        # 39faf8 <_DYNAMIC+0x808>
  2d4d6a:	lock incq (%rax)
  2d4d6e:	lock decq (%r14)
  2d4d72:	jne    2d4db1 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x2a1>
  2d4d74:	lea    0x10(%rsp),%rdi
  2d4d79:	call   *0xcab61(%rip)        # 39f8e0 <_DYNAMIC+0x5f0>
  2d4d7f:	mov    %rbx,%rdi
  2d4d82:	call   357590 <_Unwind_Resume@plt>
  2d4d87:	mov    0xcad62(%rip),%rcx        # 39faf0 <_DYNAMIC+0x800>
  2d4d8e:	lock decq (%rcx)
  2d4d92:	mov    0xcad5f(%rip),%rcx        # 39faf8 <_DYNAMIC+0x808>
  2d4d99:	lock incq (%rcx)
  2d4d9d:	mov    %rax,%rbx
  2d4da0:	lock decq (%r14)
  2d4da4:	jne    2d4db1 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x2a1>
  2d4da6:	lea    0x20(%rsp),%rdi
  2d4dab:	call   *0xcab2f(%rip)        # 39f8e0 <_DYNAMIC+0x5f0>
  2d4db1:	mov    %rbx,%rdi
  2d4db4:	call   357590 <_Unwind_Resume@plt>
