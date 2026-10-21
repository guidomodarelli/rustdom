
/home/guido/rustdom-native-class-NMmiki/dist/rustdom.node:     file format elf64-x86-64


Disassembly of section .text:

00000000002d4e40 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value>:
  2d4e40:	push   %r15
  2d4e42:	push   %r14
  2d4e44:	push   %r12
  2d4e46:	push   %rbx
  2d4e47:	sub    $0x38,%rsp
  2d4e4b:	mov    %rdx,%rbx
  2d4e4e:	mov    %rsi,%r15
  2d4e51:	mov    %rdi,%r14
  2d4e54:	mov    %rdx,(%rsp)
  2d4e58:	lea    -0x278255(%rip),%rdi        # 5cc0a <std::thread::current::id::ID+0x5ca92>
  2d4e5f:	mov    $0x15,%esi
  2d4e64:	call   *0xcbd3e(%rip)        # 3a0ba8 <_DYNAMIC+0x1a50>
  2d4e6a:	cmp    $0x1,%rax
  2d4e6e:	jne    2d4ee1 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0xa1>
  2d4e70:	mov    %rdx,%r12
  2d4e73:	mov    %rbx,0x8(%rsp)
  2d4e78:	call   *0xca512(%rip)        # 39f390 <_DYNAMIC+0x238>
  2d4e7e:	mov    $0x8,%edi
  2d4e83:	mov    $0x8,%esi
  2d4e88:	call   *0xca532(%rip)        # 39f3c0 <_DYNAMIC+0x268>
  2d4e8e:	test   %rax,%rax
  2d4e91:	je     2d4fa1 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x161>
  2d4e97:	mov    %rbx,(%rax)
  2d4e9a:	lea    0x8(%rsp),%rdi
  2d4e9f:	mov    %r15,%rsi
  2d4ea2:	mov    %rax,%rdx
  2d4ea5:	mov    %r12,%rcx
  2d4ea8:	call   165880 <napi::bindgen_runtime::js_values::class::new_instance::<rustdom::dom::mutation_record_binding::NativeMutationRecord>>
  2d4ead:	mov    0x8(%rsp),%rcx
  2d4eb2:	mov    0x10(%rsp),%rax
  2d4eb7:	cmp    $0xffffffffffffffff,%rcx
  2d4ebb:	je     2d4f87 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x147>
  2d4ec1:	movups 0x18(%rsp),%xmm0
  2d4ec6:	movups 0x28(%rsp),%xmm1
  2d4ecb:	movups %xmm1,0x20(%r14)
  2d4ed0:	movups %xmm0,0x10(%r14)
  2d4ed5:	mov    %rcx,(%r14)
  2d4ed8:	mov    %rax,0x8(%r14)
  2d4edc:	jmp    2d4f92 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x152>
  2d4ee1:	mov    0xca4a8(%rip),%r15        # 39f390 <_DYNAMIC+0x238>
  2d4ee8:	call   *%r15
  2d4eeb:	call   *%r15
  2d4eee:	mov    $0x4a,%edi
  2d4ef3:	mov    $0x1,%esi
  2d4ef8:	call   *0xca4c2(%rip)        # 39f3c0 <_DYNAMIC+0x268>
  2d4efe:	test   %rax,%rax
  2d4f01:	je     2d4fb3 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x173>
  2d4f07:	movups -0x26dce2(%rip),%xmm0        # 6722c <encoding_rs::data::KSX1001_LOWERCASE+0x4eac>
  2d4f0e:	movups %xmm0,0x3a(%rax)
  2d4f12:	movups -0x26dcf7(%rip),%xmm0        # 67222 <encoding_rs::data::KSX1001_LOWERCASE+0x4ea2>
  2d4f19:	movups %xmm0,0x30(%rax)
  2d4f1d:	movups -0x26dd12(%rip),%xmm0        # 67212 <encoding_rs::data::KSX1001_LOWERCASE+0x4e92>
  2d4f24:	movups %xmm0,0x20(%rax)
  2d4f28:	movups -0x26dd2d(%rip),%xmm0        # 67202 <encoding_rs::data::KSX1001_LOWERCASE+0x4e82>
  2d4f2f:	movups %xmm0,0x10(%rax)
  2d4f33:	movups -0x26dd48(%rip),%xmm0        # 671f2 <encoding_rs::data::KSX1001_LOWERCASE+0x4e72>
  2d4f3a:	movups %xmm0,(%rax)
  2d4f3d:	xorps  %xmm0,%xmm0
  2d4f40:	movups %xmm0,0x18(%r14)
  2d4f45:	movq   $0x4a,(%r14)
  2d4f4c:	mov    %rax,0x8(%r14)
  2d4f50:	movq   $0x4a,0x10(%r14)
  2d4f58:	movl   $0x1,0x28(%r14)
  2d4f60:	mov    0xca9e1(%rip),%rax        # 39f948 <_DYNAMIC+0x7f0>
  2d4f67:	lock decq (%rax)
  2d4f6b:	mov    0xca9de(%rip),%rax        # 39f950 <_DYNAMIC+0x7f8>
  2d4f72:	lock incq (%rax)
  2d4f76:	lock decq (%rbx)
  2d4f7a:	jne    2d4f92 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x152>
  2d4f7c:	mov    %rsp,%rdi
  2d4f7f:	call   *0xca7b3(%rip)        # 39f738 <_DYNAMIC+0x5e0>
  2d4f85:	jmp    2d4f92 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x152>
  2d4f87:	mov    %rax,0x8(%r14)
  2d4f8b:	movq   $0xffffffffffffffff,(%r14)
  2d4f92:	mov    %r14,%rax
  2d4f95:	add    $0x38,%rsp
  2d4f99:	pop    %rbx
  2d4f9a:	pop    %r12
  2d4f9c:	pop    %r14
  2d4f9e:	pop    %r15
  2d4fa0:	ret    
  2d4fa1:	mov    $0x8,%edi
  2d4fa6:	mov    $0x8,%esi
  2d4fab:	call   *0xca3f7(%rip)        # 39f3a8 <_DYNAMIC+0x250>
  2d4fb1:	jmp    2d4fc3 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x183>
  2d4fb3:	mov    $0x1,%edi
  2d4fb8:	mov    $0x4a,%esi
  2d4fbd:	call   *0xca41d(%rip)        # 39f3e0 <_DYNAMIC+0x288>
  2d4fc3:	ud2    
  2d4fc5:	jmp    2d4fc7 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x187>
  2d4fc7:	mov    %rax,%r14
  2d4fca:	mov    0xca977(%rip),%rax        # 39f948 <_DYNAMIC+0x7f0>
  2d4fd1:	lock decq (%rax)
  2d4fd5:	mov    0xca974(%rip),%rax        # 39f950 <_DYNAMIC+0x7f8>
  2d4fdc:	lock incq (%rax)
  2d4fe0:	lock decq (%rbx)
  2d4fe4:	jne    2d5015 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1d5>
  2d4fe6:	mov    %rsp,%rdi
  2d4fe9:	jmp    2d500f <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1cf>
  2d4feb:	mov    0xca956(%rip),%rcx        # 39f948 <_DYNAMIC+0x7f0>
  2d4ff2:	lock decq (%rcx)
  2d4ff6:	mov    0xca953(%rip),%rcx        # 39f950 <_DYNAMIC+0x7f8>
  2d4ffd:	lock incq (%rcx)
  2d5001:	mov    %rax,%r14
  2d5004:	lock decq (%rbx)
  2d5008:	jne    2d5015 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1d5>
  2d500a:	lea    0x8(%rsp),%rdi
  2d500f:	call   *0xca723(%rip)        # 39f738 <_DYNAMIC+0x5e0>
  2d5015:	mov    %r14,%rdi
  2d5018:	call   357400 <_Unwind_Resume@plt>
