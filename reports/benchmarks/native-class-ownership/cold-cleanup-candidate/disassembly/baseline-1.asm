
/home/guido/rustdom-validation/ownership-cold-cleanup-prototype/artifacts/baseline.node:     file format elf64-x86-64


Disassembly of section .text:

00000000002fc300 <napi::bindgen_runtime::js_values::class::new_instance_raw>:
  2fc300:	push   %rbp
  2fc301:	push   %r15
  2fc303:	push   %r14
  2fc305:	push   %r13
  2fc307:	push   %r12
  2fc309:	push   %rbx
  2fc30a:	sub    $0x88,%rsp
  2fc311:	mov    %r8,%r12
  2fc314:	mov    %rdx,%r14
  2fc317:	mov    %rsi,%r15
  2fc31a:	mov    %rdi,%rbx
  2fc31d:	mov    0xc0(%rsp),%rax
  2fc325:	mov    %r9,0x30(%rsp)
  2fc32a:	mov    %rax,0x38(%rsp)
  2fc32f:	movq   $0x0,0x20(%rsp)
  2fc338:	lea    0x20(%rsp),%rdx
  2fc33d:	mov    %rsi,%rdi
  2fc340:	mov    %rcx,%rsi
  2fc343:	call   *0xa3fff(%rip)        # 3a0348 <napi_get_reference_value>
  2fc349:	test   %eax,%eax
  2fc34b:	je     2fc3db <napi::bindgen_runtime::js_values::class::new_instance_raw+0xdb>
  2fc351:	cmp    $0x17,%eax
  2fc354:	mov    $0x400,%ebp
  2fc359:	cmovb  %eax,%ebp
  2fc35c:	lea    0x30(%rsp),%rax
  2fc361:	mov    %rax,(%rsp)
  2fc365:	lea    0x15c4(%rip),%rax        # 2fd930 <<&str as core::fmt::Display>::fmt>
  2fc36c:	mov    %rax,0x8(%rsp)
  2fc371:	lea    -0x2a135f(%rip),%rsi        # 5b019 <std::thread::current::id::ID+0x5aea1>
  2fc378:	lea    0x40(%rsp),%rdi
  2fc37d:	mov    %rsp,%rdx
  2fc380:	call   *0xa365a(%rip)        # 39f9e0 <_DYNAMIC+0x260>
  2fc386:	mov    0x48(%rsp),%r14
  2fc38b:	mov    0x50(%rsp),%r15
  2fc390:	test   %r15,%r15
  2fc393:	je     2fc4aa <napi::bindgen_runtime::js_values::class::new_instance_raw+0x1aa>
  2fc399:	call   *0xa3619(%rip)        # 39f9b8 <_DYNAMIC+0x238>
  2fc39f:	mov    $0x1,%esi
  2fc3a4:	mov    %r15,%rdi
  2fc3a7:	call   *0xa363b(%rip)        # 39f9e8 <_DYNAMIC+0x268>
  2fc3ad:	test   %rax,%rax
  2fc3b0:	je     2fc65b <napi::bindgen_runtime::js_values::class::new_instance_raw+0x35b>
  2fc3b6:	mov    %rax,%r12
  2fc3b9:	mov    %rax,%rdi
  2fc3bc:	mov    %r14,%rsi
  2fc3bf:	mov    %r15,%rdx
  2fc3c2:	call   *0xa3628(%rip)        # 39f9f0 <memcpy@GLIBC_2.14>
  2fc3c8:	mov    0x40(%rsp),%rsi
  2fc3cd:	test   %rsi,%rsi
  2fc3d0:	jne    2fc57f <napi::bindgen_runtime::js_values::class::new_instance_raw+0x27f>
  2fc3d6:	jmp    2fc58d <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fc3db:	movq   $0x0,0x18(%rsp)
  2fc3e4:	data16 lea 0xa49c4(%rip),%rdi        # 3a0db0 <_DYNAMIC+0x1630>
  2fc3ec:	data16 data16 rex.W call 357a30 <__tls_get_addr@plt>
  2fc3f4:	mov    %rax,%r13
  2fc3f7:	movzbl (%rax),%ebp
  2fc3fa:	movb   $0x1,(%rax)
  2fc3fd:	mov    0x20(%rsp),%rsi
  2fc402:	lea    0x18(%rsp),%r8
  2fc407:	mov    %r15,%rdi
  2fc40a:	xor    %edx,%edx
  2fc40c:	xor    %ecx,%ecx
  2fc40e:	call   *0xa3f94(%rip)        # 3a03a8 <napi_new_instance>
  2fc414:	mov    %bpl,0x0(%r13)
  2fc418:	test   %eax,%eax
  2fc41a:	je     2fc4c3 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x1c3>
  2fc420:	cmp    $0x17,%eax
  2fc423:	mov    $0x400,%ebp
  2fc428:	cmovb  %eax,%ebp
  2fc42b:	lea    0x30(%rsp),%rax
  2fc430:	mov    %rax,(%rsp)
  2fc434:	lea    0x14f5(%rip),%rax        # 2fd930 <<&str as core::fmt::Display>::fmt>
  2fc43b:	mov    %rax,0x8(%rsp)
  2fc440:	lea    -0x29cb65(%rip),%rsi        # 5f8e2 <std::thread::current::id::ID+0x5f76a>
  2fc447:	lea    0x58(%rsp),%rdi
  2fc44c:	mov    %rsp,%rdx
  2fc44f:	call   *0xa358b(%rip)        # 39f9e0 <_DYNAMIC+0x260>
  2fc455:	mov    0x60(%rsp),%r14
  2fc45a:	mov    0x68(%rsp),%r15
  2fc45f:	test   %r15,%r15
  2fc462:	je     2fc56f <napi::bindgen_runtime::js_values::class::new_instance_raw+0x26f>
  2fc468:	call   *0xa354a(%rip)        # 39f9b8 <_DYNAMIC+0x238>
  2fc46e:	mov    $0x1,%esi
  2fc473:	mov    %r15,%rdi
  2fc476:	call   *0xa356c(%rip)        # 39f9e8 <_DYNAMIC+0x268>
  2fc47c:	test   %rax,%rax
  2fc47f:	je     2fc66b <napi::bindgen_runtime::js_values::class::new_instance_raw+0x36b>
  2fc485:	mov    %rax,%r12
  2fc488:	mov    %rax,%rdi
  2fc48b:	mov    %r14,%rsi
  2fc48e:	mov    %r15,%rdx
  2fc491:	call   *0xa3559(%rip)        # 39f9f0 <memcpy@GLIBC_2.14>
  2fc497:	mov    0x58(%rsp),%rsi
  2fc49c:	test   %rsi,%rsi
  2fc49f:	jne    2fc57f <napi::bindgen_runtime::js_values::class::new_instance_raw+0x27f>
  2fc4a5:	jmp    2fc58d <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fc4aa:	mov    $0x1,%r12d
  2fc4b0:	mov    0x40(%rsp),%rsi
  2fc4b5:	test   %rsi,%rsi
  2fc4b8:	jne    2fc57f <napi::bindgen_runtime::js_values::class::new_instance_raw+0x27f>
  2fc4be:	jmp    2fc58d <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fc4c3:	movq   $0x0,0x28(%rsp)
  2fc4cc:	mov    0x18(%rsp),%rsi
  2fc4d1:	lea    0x28(%rsp),%r9
  2fc4d6:	mov    %r15,%rdi
  2fc4d9:	mov    %r14,%rdx
  2fc4dc:	mov    %r12,%rcx
  2fc4df:	xor    %r8d,%r8d
  2fc4e2:	call   *0xa3528(%rip)        # 39fa10 <napi_wrap>
  2fc4e8:	test   %eax,%eax
  2fc4ea:	je     2fc5b7 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x2b7>
  2fc4f0:	cmp    $0x17,%eax
  2fc4f3:	mov    $0x400,%ebp
  2fc4f8:	cmovb  %eax,%ebp
  2fc4fb:	lea    0x30(%rsp),%rax
  2fc500:	mov    %rax,(%rsp)
  2fc504:	lea    0x1425(%rip),%rax        # 2fd930 <<&str as core::fmt::Display>::fmt>
  2fc50b:	mov    %rax,0x8(%rsp)
  2fc510:	lea    -0x29e4e7(%rip),%rsi        # 5e030 <std::thread::current::id::ID+0x5deb8>
  2fc517:	lea    0x70(%rsp),%rdi
  2fc51c:	mov    %rsp,%rdx
  2fc51f:	call   *0xa34bb(%rip)        # 39f9e0 <_DYNAMIC+0x260>
  2fc525:	mov    0x78(%rsp),%r14
  2fc52a:	mov    0x80(%rsp),%r15
  2fc532:	test   %r15,%r15
  2fc535:	je     2fc632 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x332>
  2fc53b:	call   *0xa3477(%rip)        # 39f9b8 <_DYNAMIC+0x238>
  2fc541:	mov    $0x1,%esi
  2fc546:	mov    %r15,%rdi
  2fc549:	call   *0xa3499(%rip)        # 39f9e8 <_DYNAMIC+0x268>
  2fc54f:	test   %rax,%rax
  2fc552:	je     2fc67b <napi::bindgen_runtime::js_values::class::new_instance_raw+0x37b>
  2fc558:	mov    %rax,%r12
  2fc55b:	mov    %rax,%rdi
  2fc55e:	mov    %r14,%rsi
  2fc561:	mov    %r15,%rdx
  2fc564:	call   *0xa3486(%rip)        # 39f9f0 <memcpy@GLIBC_2.14>
  2fc56a:	jmp    2fc638 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x338>
  2fc56f:	mov    $0x1,%r12d
  2fc575:	mov    0x58(%rsp),%rsi
  2fc57a:	test   %rsi,%rsi
  2fc57d:	je     2fc58d <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fc57f:	mov    $0x1,%edx
  2fc584:	mov    %r14,%rdi
  2fc587:	call   *0xa346b(%rip)        # 39f9f8 <_DYNAMIC+0x278>
  2fc58d:	xorps  %xmm0,%xmm0
  2fc590:	movups %xmm0,0x18(%rbx)
  2fc594:	mov    %r15,(%rbx)
  2fc597:	mov    %r12,0x8(%rbx)
  2fc59b:	mov    %r15,0x10(%rbx)
  2fc59f:	mov    %ebp,0x28(%rbx)
  2fc5a2:	mov    %rbx,%rax
  2fc5a5:	add    $0x88,%rsp
  2fc5ac:	pop    %rbx
  2fc5ad:	pop    %r12
  2fc5af:	pop    %r13
  2fc5b1:	pop    %r14
  2fc5b3:	pop    %r15
  2fc5b5:	pop    %rbp
  2fc5b6:	ret    
  2fc5b7:	call   *0xa33fb(%rip)        # 39f9b8 <_DYNAMIC+0x238>
  2fc5bd:	mov    $0x20,%edi
  2fc5c2:	mov    $0x8,%esi
  2fc5c7:	call   *0xa341b(%rip)        # 39f9e8 <_DYNAMIC+0x268>
  2fc5cd:	test   %rax,%rax
  2fc5d0:	je     2fc64b <napi::bindgen_runtime::js_values::class::new_instance_raw+0x34b>
  2fc5d2:	movq   $0x1,(%rax)
  2fc5d9:	movq   $0x1,0x8(%rax)
  2fc5e1:	mov    %rax,%rcx
  2fc5e4:	add    $0x10,%rcx
  2fc5e8:	movq   $0x1,0x10(%rax)
  2fc5f0:	lea    0x9ecd9(%rip),%rdx        # 39b2d0 <cssparser::serializer::hex_escape::HEX_DIGITS+0x968>
  2fc5f7:	mov    %rdx,0x18(%rax)
  2fc5fb:	mov    0x28(%rsp),%rax
  2fc600:	mov    %r14,(%rsp)
  2fc604:	mov    %rax,0x8(%rsp)
  2fc609:	mov    %rcx,0x10(%rsp)
  2fc60e:	mov    %rsp,%rdx
  2fc611:	mov    %r15,%rdi
  2fc614:	mov    %r14,%rsi
  2fc617:	call   *0xa340b(%rip)        # 39fa28 <_DYNAMIC+0x2a8>
  2fc61d:	mov    0x18(%rsp),%rax
  2fc622:	mov    %rax,0x8(%rbx)
  2fc626:	movq   $0xffffffffffffffff,(%rbx)
  2fc62d:	jmp    2fc5a2 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x2a2>
  2fc632:	mov    $0x1,%r12d
  2fc638:	mov    0x70(%rsp),%rsi
  2fc63d:	test   %rsi,%rsi
  2fc640:	jne    2fc57f <napi::bindgen_runtime::js_values::class::new_instance_raw+0x27f>
  2fc646:	jmp    2fc58d <napi::bindgen_runtime::js_values::class::new_instance_raw+0x28d>
  2fc64b:	mov    $0x8,%edi
  2fc650:	mov    $0x20,%esi
  2fc655:	call   *0xa3375(%rip)        # 39f9d0 <_DYNAMIC+0x250>
  2fc65b:	mov    $0x1,%edi
  2fc660:	mov    %r15,%rsi
  2fc663:	call   *0xa339f(%rip)        # 39fa08 <_DYNAMIC+0x288>
  2fc669:	jmp    2fc689 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x389>
  2fc66b:	mov    $0x1,%edi
  2fc670:	mov    %r15,%rsi
  2fc673:	call   *0xa338f(%rip)        # 39fa08 <_DYNAMIC+0x288>
  2fc679:	jmp    2fc689 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x389>
  2fc67b:	mov    $0x1,%edi
  2fc680:	mov    %r15,%rsi
  2fc683:	call   *0xa337f(%rip)        # 39fa08 <_DYNAMIC+0x288>
  2fc689:	ud2    
  2fc68b:	mov    %rax,%rbx
  2fc68e:	mov    0x70(%rsp),%rsi
  2fc693:	jmp    2fc6a7 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x3a7>
  2fc695:	mov    %rax,%rbx
  2fc698:	mov    0x58(%rsp),%rsi
  2fc69d:	jmp    2fc6a7 <napi::bindgen_runtime::js_values::class::new_instance_raw+0x3a7>
  2fc69f:	mov    %rax,%rbx
  2fc6a2:	mov    0x40(%rsp),%rsi
  2fc6a7:	test   %rsi,%rsi
  2fc6aa:	je     2fc6ba <napi::bindgen_runtime::js_values::class::new_instance_raw+0x3ba>
  2fc6ac:	mov    $0x1,%edx
  2fc6b1:	mov    %r14,%rdi
  2fc6b4:	call   *0xa333e(%rip)        # 39f9f8 <_DYNAMIC+0x278>
  2fc6ba:	mov    %rbx,%rdi
  2fc6bd:	call   357a20 <_Unwind_Resume@plt>
