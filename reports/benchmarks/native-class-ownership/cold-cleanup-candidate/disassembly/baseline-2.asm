
/home/guido/rustdom-validation/ownership-cold-cleanup-prototype/artifacts/baseline.node:     file format elf64-x86-64


Disassembly of section .text:

00000000002d5080 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value>:
  2d5080:	push   %r15
  2d5082:	push   %r14
  2d5084:	push   %r13
  2d5086:	push   %r12
  2d5088:	push   %rbx
  2d5089:	sub    $0x70,%rsp
  2d508d:	mov    %rdx,%r14
  2d5090:	mov    %rsi,%r15
  2d5093:	mov    %rdi,%rbx
  2d5096:	mov    %rdx,0x8(%rsp)
  2d509b:	lea    -0x278418(%rip),%rdi        # 5cc8a <std::thread::current::id::ID+0x5cb12>
  2d50a2:	mov    $0x15,%esi
  2d50a7:	call   *0xcc12b(%rip)        # 3a11d8 <_DYNAMIC+0x1a58>
  2d50ad:	cmp    $0x1,%rax
  2d50b1:	jne    2d5177 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0xf7>
  2d50b7:	mov    %rdx,%r13
  2d50ba:	mov    %r14,0x10(%rsp)
  2d50bf:	call   *0xca8f3(%rip)        # 39f9b8 <_DYNAMIC+0x238>
  2d50c5:	mov    $0x8,%edi
  2d50ca:	mov    $0x8,%esi
  2d50cf:	call   *0xca913(%rip)        # 39f9e8 <_DYNAMIC+0x268>
  2d50d5:	test   %rax,%rax
  2d50d8:	je     2d52ac <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x22c>
  2d50de:	mov    %rax,%r12
  2d50e1:	mov    %r14,(%rax)
  2d50e4:	movq   $0x3b,(%rsp)
  2d50ec:	lea    -0x17e973(%rip),%r8        # 156780 <napi::bindgen_runtime::raw_finalize_unchecked::<rustdom::dom::mutation_record_binding::NativeMutationRecord>>
  2d50f3:	lea    -0x273696(%rip),%r9        # 61a64 <std::thread::current::id::ID+0x618ec>
  2d50fa:	lea    0x10(%rsp),%rdi
  2d50ff:	mov    %r15,%rsi
  2d5102:	mov    %rax,%rdx
  2d5105:	mov    %r13,%rcx
  2d5108:	call   *0xcaf62(%rip)        # 3a0070 <_DYNAMIC+0x8f0>
  2d510e:	mov    0x10(%rsp),%r13
  2d5113:	mov    0x18(%rsp),%r14
  2d5118:	cmp    $0xffffffffffffffff,%r13
  2d511c:	je     2d521d <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x19d>
  2d5122:	movups 0x20(%rsp),%xmm0
  2d5127:	movups 0x30(%rsp),%xmm1
  2d512c:	movaps %xmm1,0x50(%rsp)
  2d5131:	movaps %xmm0,0x40(%rsp)
  2d5136:	mov    0xcae33(%rip),%rax        # 39ff70 <_DYNAMIC+0x7f0>
  2d513d:	lock decq (%rax)
  2d5141:	mov    0xcae30(%rip),%rax        # 39ff78 <_DYNAMIC+0x7f8>
  2d5148:	lock incq (%rax)
  2d514c:	mov    (%r12),%rax
  2d5150:	lock decq (%rax)
  2d5154:	jne    2d515f <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0xdf>
  2d5156:	mov    %r12,%rdi
  2d5159:	call   *0xcac01(%rip)        # 39fd60 <_DYNAMIC+0x5e0>
  2d515f:	mov    $0x8,%esi
  2d5164:	mov    $0x8,%edx
  2d5169:	mov    %r12,%rdi
  2d516c:	call   *0xca886(%rip)        # 39f9f8 <_DYNAMIC+0x278>
  2d5172:	jmp    2d5275 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x1f5>
  2d5177:	mov    0xca83a(%rip),%r15        # 39f9b8 <_DYNAMIC+0x238>
  2d517e:	call   *%r15
  2d5181:	call   *%r15
  2d5184:	mov    $0x4a,%edi
  2d5189:	mov    $0x1,%esi
  2d518e:	call   *0xca854(%rip)        # 39f9e8 <_DYNAMIC+0x268>
  2d5194:	test   %rax,%rax
  2d5197:	je     2d52be <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x23e>
  2d519d:	movups -0x26deb2(%rip),%xmm0        # 672f2 <encoding_rs::data::KSX1001_LOWERCASE+0x4ef2>
  2d51a4:	movups %xmm0,0x3a(%rax)
  2d51a8:	movups -0x26dec7(%rip),%xmm0        # 672e8 <encoding_rs::data::KSX1001_LOWERCASE+0x4ee8>
  2d51af:	movups %xmm0,0x30(%rax)
  2d51b3:	movups -0x26dee2(%rip),%xmm0        # 672d8 <encoding_rs::data::KSX1001_LOWERCASE+0x4ed8>
  2d51ba:	movups %xmm0,0x20(%rax)
  2d51be:	movups -0x26defd(%rip),%xmm0        # 672c8 <encoding_rs::data::KSX1001_LOWERCASE+0x4ec8>
  2d51c5:	movups %xmm0,0x10(%rax)
  2d51c9:	movups -0x26df18(%rip),%xmm0        # 672b8 <encoding_rs::data::KSX1001_LOWERCASE+0x4eb8>
  2d51d0:	movups %xmm0,(%rax)
  2d51d3:	xorps  %xmm0,%xmm0
  2d51d6:	movups %xmm0,0x18(%rbx)
  2d51da:	movq   $0x4a,(%rbx)
  2d51e1:	mov    %rax,0x8(%rbx)
  2d51e5:	movq   $0x4a,0x10(%rbx)
  2d51ed:	movl   $0x1,0x28(%rbx)
  2d51f4:	mov    0xcad75(%rip),%rax        # 39ff70 <_DYNAMIC+0x7f0>
  2d51fb:	lock decq (%rax)
  2d51ff:	mov    0xcad72(%rip),%rax        # 39ff78 <_DYNAMIC+0x7f8>
  2d5206:	lock incq (%rax)
  2d520a:	lock decq (%r14)
  2d520e:	jne    2d528e <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x20e>
  2d5210:	lea    0x8(%rsp),%rdi
  2d5215:	call   *0xcab45(%rip)        # 39fd60 <_DYNAMIC+0x5e0>
  2d521b:	jmp    2d528e <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x20e>
  2d521d:	movabs $0xd55f9027949a83ee,%rax
  2d5227:	mov    %rax,0x60(%rsp)
  2d522c:	movabs $0x2ed6607c9c363ba3,%rax
  2d5236:	mov    %rax,0x68(%rsp)
  2d523b:	lea    0x10(%rsp),%rdi
  2d5240:	lea    0x60(%rsp),%rcx
  2d5245:	mov    %r15,%rsi
  2d5248:	mov    %r14,%rdx
  2d524b:	call   *0xca7df(%rip)        # 39fa30 <_DYNAMIC+0x2b0>
  2d5251:	mov    0x10(%rsp),%r13
  2d5256:	cmp    $0xffffffffffffffff,%r13
  2d525a:	je     2d529f <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x21f>
  2d525c:	mov    0x18(%rsp),%r14
  2d5261:	movups 0x20(%rsp),%xmm0
  2d5266:	movaps %xmm0,0x40(%rsp)
  2d526b:	movups 0x30(%rsp),%xmm0
  2d5270:	movaps %xmm0,0x50(%rsp)
  2d5275:	mov    %r13,(%rbx)
  2d5278:	mov    %r14,0x8(%rbx)
  2d527c:	movaps 0x40(%rsp),%xmm0
  2d5281:	movaps 0x50(%rsp),%xmm1
  2d5286:	movups %xmm0,0x10(%rbx)
  2d528a:	movups %xmm1,0x20(%rbx)
  2d528e:	mov    %rbx,%rax
  2d5291:	add    $0x70,%rsp
  2d5295:	pop    %rbx
  2d5296:	pop    %r12
  2d5298:	pop    %r13
  2d529a:	pop    %r14
  2d529c:	pop    %r15
  2d529e:	ret    
  2d529f:	mov    %r14,0x8(%rbx)
  2d52a3:	movq   $0xffffffffffffffff,(%rbx)
  2d52aa:	jmp    2d528e <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x20e>
  2d52ac:	mov    $0x8,%edi
  2d52b1:	mov    $0x8,%esi
  2d52b6:	call   *0xca714(%rip)        # 39f9d0 <_DYNAMIC+0x250>
  2d52bc:	jmp    2d52ce <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x24e>
  2d52be:	mov    $0x1,%edi
  2d52c3:	mov    $0x4a,%esi
  2d52c8:	call   *0xca73a(%rip)        # 39fa08 <_DYNAMIC+0x288>
  2d52ce:	ud2    
  2d52d0:	mov    %rax,%rbx
  2d52d3:	mov    %r12,%rdi
  2d52d6:	call   15d1c0 <core::ptr::drop_glue::<napi::bindgen_runtime::class_ownership::PendingClassValue<rustdom::dom::mutation_record_binding::NativeMutationRecord>>>
  2d52db:	mov    %rbx,%rdi
  2d52de:	call   357a20 <_Unwind_Resume@plt>
  2d52e3:	jmp    2d52e5 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x265>
  2d52e5:	mov    %rax,%rbx
  2d52e8:	mov    0xcac81(%rip),%rax        # 39ff70 <_DYNAMIC+0x7f0>
  2d52ef:	lock decq (%rax)
  2d52f3:	mov    0xcac7e(%rip),%rax        # 39ff78 <_DYNAMIC+0x7f8>
  2d52fa:	lock incq (%rax)
  2d52fe:	lock decq (%r14)
  2d5302:	jne    2d5341 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x2c1>
  2d5304:	lea    0x8(%rsp),%rdi
  2d5309:	call   *0xcaa51(%rip)        # 39fd60 <_DYNAMIC+0x5e0>
  2d530f:	mov    %rbx,%rdi
  2d5312:	call   357a20 <_Unwind_Resume@plt>
  2d5317:	mov    0xcac52(%rip),%rcx        # 39ff70 <_DYNAMIC+0x7f0>
  2d531e:	lock decq (%rcx)
  2d5322:	mov    0xcac4f(%rip),%rcx        # 39ff78 <_DYNAMIC+0x7f8>
  2d5329:	lock incq (%rcx)
  2d532d:	mov    %rax,%rbx
  2d5330:	lock decq (%r14)
  2d5334:	jne    2d5341 <<rustdom::dom::mutation_record_binding::NativeMutationRecord as napi::bindgen_runtime::js_values::ToNapiValue>::to_napi_value+0x2c1>
  2d5336:	lea    0x10(%rsp),%rdi
  2d533b:	call   *0xcaa1f(%rip)        # 39fd60 <_DYNAMIC+0x5e0>
  2d5341:	mov    %rbx,%rdi
  2d5344:	call   357a20 <_Unwind_Resume@plt>
