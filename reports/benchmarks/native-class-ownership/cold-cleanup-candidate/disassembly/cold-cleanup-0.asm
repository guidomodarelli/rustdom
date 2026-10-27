
/home/guido/rustdom-validation/ownership-cold-cleanup-prototype/artifacts/cold-cleanup.node:     file format elf64-x86-64


Disassembly of section .text:

00000000002fbe70 <napi::bindgen_runtime::js_values::class::new_instance_raw>:
  2fbe70:	push   %rbp
  2fbe71:	push   %r15
  2fbe73:	push   %r14
  2fbe75:	push   %r13
  2fbe77:	push   %r12
  2fbe79:	push   %rbx
  2fbe7a:	sub    $0x88,%rsp
  2fbe81:	mov    %r8,%r12
  2fbe84:	mov    %rdx,%r14
  2fbe87:	mov    %rsi,%r15
  2fbe8a:	mov    %rdi,%rbx
  2fbe8d:	mov    0xc0(%rsp),%rax
  2fbe95:	mov    %r9,0x30(%rsp)
  2fbe9a:	mov    %rax,0x38(%rsp)
  2fbe9f:	movq   $0x0,0x20(%rsp)
  2fbea8:	lea    0x20(%rsp),%rdx
  2fbead:	mov    %rsi,%rdi
  2fbeb0:	mov    %rcx,%rsi
  2fbeb3:	call   *0xa4007(%rip)        # 39fec0 <napi_get_reference_value>
  2fbeb9:	test   %eax,%eax
  2fbebb:	je     2fbf4b <napi::bindgen_runtime::js_values::class::new_instance_raw+0xdb>
  2fbec1:	cmp    $0x17,%eax
  2fbec4:	mov    $0x400,%ebp
  2fbec9:	cmovb  %eax,%ebp
  2fbecc:	lea    0x30(%rsp),%rax
  2fbed1:	mov    %rax,(%rsp)
  2fbed5:	lea    0x15c4(%rip),%rax        # 2fd4a0 <<&str as core::fmt::Display>::fmt>
  2fbedc:	mov    %rax,0x8(%rsp)
  2fbee1:	lea    -0x2a0ccf(%rip),%rsi        # 5b219 <std::thread::current::id::ID+0x5b0a1>
  2fbee8:	lea    0x40(%rsp),%rdi
  2fbeed:	mov    %rsp,%rdx
  2fbef0:	call   *0xa365a(%rip)        # 39f550 <_DYNAMIC+0x260>
  2fbef6:	mov    0x48(%rsp),%r14
  2fbefb:	mov    0x50(%rsp),%r15
  2fbf00:	test   %r15,%r15
  2fbf03:	je     2fc01a <napi::bindgen_runtime::js_values::class::new_instance_raw+0x1aa>
  2fbf09:	call   *0xa3619(%rip)        # 39f528 <_DYNAMIC+0x238>
  2fbf0f:	mov    $0x1,%esi
  2fbf14:	mov    %r15,%rdi
  2fbf17:	call   *0xa363b(%rip)        # 39f558 <_DYNAMIC+0x268>
  2fbf1d:	test   %rax,%rax
  2fbf20:	je     2fc1cb <napi::bindgen_runtime::js_values::class::new_instance_raw+0x35b>
  2fbf26:	mov    %rax,%r12
  2fbf29:	mov    %rax,%rdi
  2fbf2c:	mov    %r14,%rsi
  2fbf2f:	mov    %r15,%rdx
  2fbf32:	call   *0xa3628(%rip)        # 39f560 <memcpy@GLIBC_2.14>
  2fbf38:	mov    0x40(%rsp),%rsi
  2fbf3d:	test   %rsi,%rsi
  2fbf40:	jne    2fc0ef <napi::bindgen_runtime::js_values::class::new_instance_raw+0x27f>
  2fbf46:	jmp    2fc0fd <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fbf4b:	movq   $0x0,0x18(%rsp)
  2fbf54:	data16 lea 0xa49cc(%rip),%rdi        # 3a0928 <_DYNAMIC+0x1638>
  2fbf5c:	data16 data16 rex.W call 3575a0 <__tls_get_addr@plt>
  2fbf64:	mov    %rax,%r13
  2fbf67:	movzbl (%rax),%ebp
  2fbf6a:	movb   $0x1,(%rax)
  2fbf6d:	mov    0x20(%rsp),%rsi
  2fbf72:	lea    0x18(%rsp),%r8
  2fbf77:	mov    %r15,%rdi
  2fbf7a:	xor    %edx,%edx
  2fbf7c:	xor    %ecx,%ecx
  2fbf7e:	call   *0xa3f9c(%rip)        # 39ff20 <napi_new_instance>
  2fbf84:	mov    %bpl,0x0(%r13)
  2fbf88:	test   %eax,%eax
  2fbf8a:	je     2fc033 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x1c3>
  2fbf90:	cmp    $0x17,%eax
  2fbf93:	mov    $0x400,%ebp
  2fbf98:	cmovb  %eax,%ebp
  2fbf9b:	lea    0x30(%rsp),%rax
  2fbfa0:	mov    %rax,(%rsp)
  2fbfa4:	lea    0x14f5(%rip),%rax        # 2fd4a0 <<&str as core::fmt::Display>::fmt>
  2fbfab:	mov    %rax,0x8(%rsp)
  2fbfb0:	lea    -0x29c4d5(%rip),%rsi        # 5fae2 <std::thread::current::id::ID+0x5f96a>
  2fbfb7:	lea    0x58(%rsp),%rdi
  2fbfbc:	mov    %rsp,%rdx
  2fbfbf:	call   *0xa358b(%rip)        # 39f550 <_DYNAMIC+0x260>
  2fbfc5:	mov    0x60(%rsp),%r14
  2fbfca:	mov    0x68(%rsp),%r15
  2fbfcf:	test   %r15,%r15
  2fbfd2:	je     2fc0df <napi::bindgen_runtime::js_values::class::new_instance_raw+0x26f>
  2fbfd8:	call   *0xa354a(%rip)        # 39f528 <_DYNAMIC+0x238>
  2fbfde:	mov    $0x1,%esi
  2fbfe3:	mov    %r15,%rdi
  2fbfe6:	call   *0xa356c(%rip)        # 39f558 <_DYNAMIC+0x268>
  2fbfec:	test   %rax,%rax
  2fbfef:	je     2fc1db <napi::bindgen_runtime::js_values::class::new_instance_raw+0x36b>
  2fbff5:	mov    %rax,%r12
  2fbff8:	mov    %rax,%rdi
  2fbffb:	mov    %r14,%rsi
  2fbffe:	mov    %r15,%rdx
  2fc001:	call   *0xa3559(%rip)        # 39f560 <memcpy@GLIBC_2.14>
  2fc007:	mov    0x58(%rsp),%rsi
  2fc00c:	test   %rsi,%rsi
  2fc00f:	jne    2fc0ef <napi::bindgen_runtime::js_values::class::new_instance_raw+0x27f>
  2fc015:	jmp    2fc0fd <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fc01a:	mov    $0x1,%r12d
  2fc020:	mov    0x40(%rsp),%rsi
  2fc025:	test   %rsi,%rsi
  2fc028:	jne    2fc0ef <napi::bindgen_runtime::js_values::class::new_instance_raw+0x27f>
  2fc02e:	jmp    2fc0fd <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fc033:	movq   $0x0,0x28(%rsp)
  2fc03c:	mov    0x18(%rsp),%rsi
  2fc041:	lea    0x28(%rsp),%r9
  2fc046:	mov    %r15,%rdi
  2fc049:	mov    %r14,%rdx
  2fc04c:	mov    %r12,%rcx
  2fc04f:	xor    %r8d,%r8d
  2fc052:	call   *0xa3528(%rip)        # 39f580 <napi_wrap>
  2fc058:	test   %eax,%eax
  2fc05a:	je     2fc127 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x2b7>
  2fc060:	cmp    $0x17,%eax
  2fc063:	mov    $0x400,%ebp
  2fc068:	cmovb  %eax,%ebp
  2fc06b:	lea    0x30(%rsp),%rax
  2fc070:	mov    %rax,(%rsp)
  2fc074:	lea    0x1425(%rip),%rax        # 2fd4a0 <<&str as core::fmt::Display>::fmt>
  2fc07b:	mov    %rax,0x8(%rsp)
  2fc080:	lea    -0x29de57(%rip),%rsi        # 5e230 <std::thread::current::id::ID+0x5e0b8>
  2fc087:	lea    0x70(%rsp),%rdi
  2fc08c:	mov    %rsp,%rdx
  2fc08f:	call   *0xa34bb(%rip)        # 39f550 <_DYNAMIC+0x260>
  2fc095:	mov    0x78(%rsp),%r14
  2fc09a:	mov    0x80(%rsp),%r15
  2fc0a2:	test   %r15,%r15
  2fc0a5:	je     2fc1a2 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x332>
  2fc0ab:	call   *0xa3477(%rip)        # 39f528 <_DYNAMIC+0x238>
  2fc0b1:	mov    $0x1,%esi
  2fc0b6:	mov    %r15,%rdi
  2fc0b9:	call   *0xa3499(%rip)        # 39f558 <_DYNAMIC+0x268>
  2fc0bf:	test   %rax,%rax
  2fc0c2:	je     2fc1eb <napi::bindgen_runtime::js_values::class::new_instance_raw+0x37b>
  2fc0c8:	mov    %rax,%r12
  2fc0cb:	mov    %rax,%rdi
  2fc0ce:	mov    %r14,%rsi
  2fc0d1:	mov    %r15,%rdx
  2fc0d4:	call   *0xa3486(%rip)        # 39f560 <memcpy@GLIBC_2.14>
  2fc0da:	jmp    2fc1a8 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x338>
  2fc0df:	mov    $0x1,%r12d
  2fc0e5:	mov    0x58(%rsp),%rsi
  2fc0ea:	test   %rsi,%rsi
  2fc0ed:	je     2fc0fd <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fc0ef:	mov    $0x1,%edx
  2fc0f4:	mov    %r14,%rdi
  2fc0f7:	call   *0xa346b(%rip)        # 39f568 <_DYNAMIC+0x278>
  2fc0fd:	xorps  %xmm0,%xmm0
  2fc100:	movups %xmm0,0x18(%rbx)
  2fc104:	mov    %r15,(%rbx)
  2fc107:	mov    %r12,0x8(%rbx)
  2fc10b:	mov    %r15,0x10(%rbx)
  2fc10f:	mov    %ebp,0x28(%rbx)
  2fc112:	mov    %rbx,%rax
  2fc115:	add    $0x88,%rsp
  2fc11c:	pop    %rbx
  2fc11d:	pop    %r12
  2fc11f:	pop    %r13
  2fc121:	pop    %r14
  2fc123:	pop    %r15
  2fc125:	pop    %rbp
  2fc126:	ret    
  2fc127:	call   *0xa33fb(%rip)        # 39f528 <_DYNAMIC+0x238>
  2fc12d:	mov    $0x20,%edi
  2fc132:	mov    $0x8,%esi
  2fc137:	call   *0xa341b(%rip)        # 39f558 <_DYNAMIC+0x268>
  2fc13d:	test   %rax,%rax
  2fc140:	je     2fc1bb <napi::bindgen_runtime::js_values::class::new_instance_raw+0x34b>
  2fc142:	movq   $0x1,(%rax)
  2fc149:	movq   $0x1,0x8(%rax)
  2fc151:	mov    %rax,%rcx
  2fc154:	add    $0x10,%rcx
  2fc158:	movq   $0x1,0x10(%rax)
  2fc160:	lea    0x9ecd9(%rip),%rdx        # 39ae40 <cssparser::serializer::hex_escape::HEX_DIGITS+0x968>
  2fc167:	mov    %rdx,0x18(%rax)
  2fc16b:	mov    0x28(%rsp),%rax
  2fc170:	mov    %r14,(%rsp)
  2fc174:	mov    %rax,0x8(%rsp)
  2fc179:	mov    %rcx,0x10(%rsp)
  2fc17e:	mov    %rsp,%rdx
  2fc181:	mov    %r15,%rdi
  2fc184:	mov    %r14,%rsi
  2fc187:	call   *0xa33fb(%rip)        # 39f588 <_DYNAMIC+0x298>
  2fc18d:	mov    0x18(%rsp),%rax
  2fc192:	mov    %rax,0x8(%rbx)
  2fc196:	movq   $0xffffffffffffffff,(%rbx)
  2fc19d:	jmp    2fc112 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x2a2>
  2fc1a2:	mov    $0x1,%r12d
  2fc1a8:	mov    0x70(%rsp),%rsi
  2fc1ad:	test   %rsi,%rsi
  2fc1b0:	jne    2fc0ef <napi::bindgen_runtime::js_values::class::new_instance_raw+0x27f>
  2fc1b6:	jmp    2fc0fd <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fc1bb:	mov    $0x8,%edi
  2fc1c0:	mov    $0x20,%esi
  2fc1c5:	call   *0xa3375(%rip)        # 39f540 <_DYNAMIC+0x250>
  2fc1cb:	mov    $0x1,%edi
  2fc1d0:	mov    %r15,%rsi
  2fc1d3:	call   *0xa339f(%rip)        # 39f578 <_DYNAMIC+0x288>
  2fc1d9:	jmp    2fc1f9 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x389>
  2fc1db:	mov    $0x1,%edi
  2fc1e0:	mov    %r15,%rsi
  2fc1e3:	call   *0xa338f(%rip)        # 39f578 <_DYNAMIC+0x288>
  2fc1e9:	jmp    2fc1f9 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x389>
  2fc1eb:	mov    $0x1,%edi
  2fc1f0:	mov    %r15,%rsi
  2fc1f3:	call   *0xa337f(%rip)        # 39f578 <_DYNAMIC+0x288>
  2fc1f9:	ud2    
  2fc1fb:	mov    %rax,%rbx
  2fc1fe:	mov    0x70(%rsp),%rsi
  2fc203:	jmp    2fc217 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x3a7>
  2fc205:	mov    %rax,%rbx
  2fc208:	mov    0x58(%rsp),%rsi
  2fc20d:	jmp    2fc217 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x3a7>
  2fc20f:	mov    %rax,%rbx
  2fc212:	mov    0x40(%rsp),%rsi
  2fc217:	test   %rsi,%rsi
  2fc21a:	je     2fc22a <napi::bindgen_runtime::js_values::class::new_instance_raw+0x3ba>
  2fc21c:	mov    $0x1,%edx
  2fc221:	mov    %r14,%rdi
  2fc224:	call   *0xa333e(%rip)        # 39f568 <_DYNAMIC+0x278>
  2fc22a:	mov    %rbx,%rdi
  2fc22d:	call   357590 <_Unwind_Resume@plt>
