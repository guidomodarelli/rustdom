
/home/guido/rustdom-checkpoint67-reference-0N9EG6/dist/rustdom.node:     file format elf64-x86-64


Disassembly of section .text:

00000000002d2f10 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value>:
  2d2f10:	push   %r15
  2d2f12:	push   %r14
  2d2f14:	push   %r12
  2d2f16:	push   %rbx
  2d2f17:	sub    $0x78,%rsp
  2d2f1b:	mov    %rdx,%r14
  2d2f1e:	mov    %rsi,%r15
  2d2f21:	mov    %rdi,%rbx
  2d2f24:	mov    %rdx,0x8(%rsp)
  2d2f29:	lea    -0x276326(%rip),%rdi        # 5cc0a <std::thread::current::id::ID+0x5ca92>
  2d2f30:	mov    $0x15,%esi
  2d2f35:	call   *0xcc085(%rip)        # 39efc0 <_DYNAMIC+0x1a48>
  2d2f3b:	cmp    $0x1,%rax
  2d2f3f:	jne    2d2fc6 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0xb6>
  2d2f45:	mov    %rdx,%r12
  2d2f48:	mov    %r14,0x10(%rsp)
  2d2f4d:	call   *0xca85d(%rip)        # 39d7b0 <_DYNAMIC+0x238>
  2d2f53:	mov    $0x8,%edi
  2d2f58:	mov    $0x8,%esi
  2d2f5d:	call   *0xca87d(%rip)        # 39d7e0 <_DYNAMIC+0x268>
  2d2f63:	test   %rax,%rax
  2d2f66:	je     2d30f9 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1e9>
  2d2f6c:	mov    %r14,(%rax)
  2d2f6f:	movq   $0x3b,(%rsp)
  2d2f77:	lea    -0x17d16e(%rip),%r8        # 155e10 <napi::bindgen_runtime::raw_finalize_unchecked::<rustdom::dom::mutation_record_binding::NativeMutationRecord>>
  2d2f7e:	lea    -0x2715a1(%rip),%r9        # 619e4 <std::thread::current::id::ID+0x6186c>
  2d2f85:	lea    0x10(%rsp),%rdi
  2d2f8a:	mov    %r15,%rsi
  2d2f8d:	mov    %rax,%rdx
  2d2f90:	mov    %r12,%rcx
  2d2f93:	call   *0xcc02f(%rip)        # 39efc8 <_DYNAMIC+0x1a50>
  2d2f99:	mov    0x10(%rsp),%rax
  2d2f9e:	mov    0x18(%rsp),%r14
  2d2fa3:	cmp    $0xffffffffffffffff,%rax
  2d2fa7:	je     2d306c <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x15c>
  2d2fad:	movups 0x20(%rsp),%xmm0
  2d2fb2:	movups 0x30(%rsp),%xmm1
  2d2fb7:	movaps %xmm1,0x50(%rsp)
  2d2fbc:	movaps %xmm0,0x40(%rsp)
  2d2fc1:	jmp    2d30c4 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1b4>
  2d2fc6:	mov    0xca7e3(%rip),%r15        # 39d7b0 <_DYNAMIC+0x238>
  2d2fcd:	call   *%r15
  2d2fd0:	call   *%r15
  2d2fd3:	mov    $0x4a,%edi
  2d2fd8:	mov    $0x1,%esi
  2d2fdd:	call   *0xca7fd(%rip)        # 39d7e0 <_DYNAMIC+0x268>
  2d2fe3:	test   %rax,%rax
  2d2fe6:	je     2d310b <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1fb>
  2d2fec:	movups -0x26bdc7(%rip),%xmm0        # 6722c <encoding_rs::data::KSX1001_LOWERCASE+0x4eac>
  2d2ff3:	movups %xmm0,0x3a(%rax)
  2d2ff7:	movups -0x26bddc(%rip),%xmm0        # 67222 <encoding_rs::data::KSX1001_LOWERCASE+0x4ea2>
  2d2ffe:	movups %xmm0,0x30(%rax)
  2d3002:	movups -0x26bdf7(%rip),%xmm0        # 67212 <encoding_rs::data::KSX1001_LOWERCASE+0x4e92>
  2d3009:	movups %xmm0,0x20(%rax)
  2d300d:	movups -0x26be12(%rip),%xmm0        # 67202 <encoding_rs::data::KSX1001_LOWERCASE+0x4e82>
  2d3014:	movups %xmm0,0x10(%rax)
  2d3018:	movups -0x26be2d(%rip),%xmm0        # 671f2 <encoding_rs::data::KSX1001_LOWERCASE+0x4e72>
  2d301f:	movups %xmm0,(%rax)
  2d3022:	xorps  %xmm0,%xmm0
  2d3025:	movups %xmm0,0x18(%rbx)
  2d3029:	movq   $0x4a,(%rbx)
  2d3030:	mov    %rax,0x8(%rbx)
  2d3034:	movq   $0x4a,0x10(%rbx)
  2d303c:	movl   $0x1,0x28(%rbx)
  2d3043:	mov    0xcad1e(%rip),%rax        # 39dd68 <_DYNAMIC+0x7f0>
  2d304a:	lock decq (%rax)
  2d304e:	mov    0xcad1b(%rip),%rax        # 39dd70 <_DYNAMIC+0x7f8>
  2d3055:	lock incq (%rax)
  2d3059:	lock decq (%r14)
  2d305d:	jne    2d30dd <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1cd>
  2d305f:	lea    0x8(%rsp),%rdi
  2d3064:	call   *0xcaaee(%rip)        # 39db58 <_DYNAMIC+0x5e0>
  2d306a:	jmp    2d30dd <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1cd>
  2d306c:	movabs $0xd55f9027949a83ee,%rax
  2d3076:	mov    %rax,0x68(%rsp)
  2d307b:	movabs $0x2ed6607c9c363ba3,%rax
  2d3085:	mov    %rax,0x70(%rsp)
  2d308a:	lea    0x10(%rsp),%rdi
  2d308f:	lea    0x68(%rsp),%rcx
  2d3094:	mov    %r15,%rsi
  2d3097:	mov    %r14,%rdx
  2d309a:	call   *0xca778(%rip)        # 39d818 <_DYNAMIC+0x2a0>
  2d30a0:	mov    0x10(%rsp),%rax
  2d30a5:	cmp    $0xffffffffffffffff,%rax
  2d30a9:	je     2d30ec <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1dc>
  2d30ab:	mov    0x18(%rsp),%r14
  2d30b0:	movups 0x20(%rsp),%xmm0
  2d30b5:	movaps %xmm0,0x40(%rsp)
  2d30ba:	movups 0x30(%rsp),%xmm0
  2d30bf:	movaps %xmm0,0x50(%rsp)
  2d30c4:	mov    %rax,(%rbx)
  2d30c7:	mov    %r14,0x8(%rbx)
  2d30cb:	movaps 0x40(%rsp),%xmm0
  2d30d0:	movaps 0x50(%rsp),%xmm1
  2d30d5:	movups %xmm0,0x10(%rbx)
  2d30d9:	movups %xmm1,0x20(%rbx)
  2d30dd:	mov    %rbx,%rax
  2d30e0:	add    $0x78,%rsp
  2d30e4:	pop    %rbx
  2d30e5:	pop    %r12
  2d30e7:	pop    %r14
  2d30e9:	pop    %r15
  2d30eb:	ret    
  2d30ec:	mov    %r14,0x8(%rbx)
  2d30f0:	movq   $0xffffffffffffffff,(%rbx)
  2d30f7:	jmp    2d30dd <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1cd>
  2d30f9:	mov    $0x8,%edi
  2d30fe:	mov    $0x8,%esi
  2d3103:	call   *0xca6bf(%rip)        # 39d7c8 <_DYNAMIC+0x250>
  2d3109:	jmp    2d311b <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x20b>
  2d310b:	mov    $0x1,%edi
  2d3110:	mov    $0x4a,%esi
  2d3115:	call   *0xca6e5(%rip)        # 39d800 <_DYNAMIC+0x288>
  2d311b:	ud2    
  2d311d:	jmp    2d311f <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x20f>
  2d311f:	mov    %rax,%rbx
  2d3122:	mov    0xcac3f(%rip),%rax        # 39dd68 <_DYNAMIC+0x7f0>
  2d3129:	lock decq (%rax)
  2d312d:	mov    0xcac3c(%rip),%rax        # 39dd70 <_DYNAMIC+0x7f8>
  2d3134:	lock incq (%rax)
  2d3138:	lock decq (%r14)
  2d313c:	jne    2d316f <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x25f>
  2d313e:	lea    0x8(%rsp),%rdi
  2d3143:	jmp    2d3169 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x259>
  2d3145:	mov    0xcac1c(%rip),%rcx        # 39dd68 <_DYNAMIC+0x7f0>
  2d314c:	lock decq (%rcx)
  2d3150:	mov    0xcac19(%rip),%rcx        # 39dd70 <_DYNAMIC+0x7f8>
  2d3157:	lock incq (%rcx)
  2d315b:	mov    %rax,%rbx
  2d315e:	lock decq (%r14)
  2d3162:	jne    2d316f <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x25f>
  2d3164:	lea    0x10(%rsp),%rdi
  2d3169:	call   *0xca9e9(%rip)        # 39db58 <_DYNAMIC+0x5e0>
  2d316f:	mov    %rbx,%rdi
  2d3172:	call   355820 <_Unwind_Resume@plt>
