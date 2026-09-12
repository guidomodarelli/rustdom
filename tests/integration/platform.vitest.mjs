/** @file Exercises the Web API bridge in actual Vitest test execution. */
import { test, expect } from 'vitest';
import { createServer } from 'node:http';
import { runInThisContext } from 'node:vm';
import { readDomFile } from './read-dom-file.cjs';

test('should submit DOM FormData through a native Request without changing filenames', async () => {
  const form = new FormData();
  form.append('name', 'rustdom');
  form.append('file', new Blob(['content'], { type: 'text/plain' }), 'content.txt');
  const request = new Request('http://localhost/upload', { method: 'POST', body: form });
  const received = await request.formData();
  expect(received).toBeInstanceOf(FormData);
  expect(received.get('file')).toBeInstanceOf(File);
  expect(received.get('name')).toBe('rustdom');
  expect(received.get('file').name).toBe('content.txt');
  expect(await readDomFile(globalThis, received.get('file'))).toEqual([...new TextEncoder().encode('content')]);
});

test('should preserve stream identity and transfer data when using native response bodies', async () => {
  const response = new Response('stream body');
  expect(response.body).toBeInstanceOf(ReadableStream);
  const chunks = [];
  await response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) { controller.enqueue(new TextDecoder().decode(chunk).toUpperCase()); },
  })).pipeTo(new WritableStream({ write(chunk) { chunks.push(chunk); } }));
  expect(chunks.join('')).toBe('STREAM BODY');
  const readable = new ReadableStream({ start(controller) { controller.enqueue('created'); controller.close(); } });
  expect(await readable.getReader().read()).toEqual({ value: 'created', done: false });
});

test('should return DOM FormData and Files when decoding request and response clones', async () => {
  const form = new FormData();
  form.append('tag', 'first');
  form.append('tag', 'second');
  form.append('file', new File([new Uint8Array([0, 128, 255])], 'binary.dat', { type: 'application/octet-stream' }));
  const request = new Request('http://localhost/upload', { method: 'POST', body: form });
  const response = new Response(form);
  for (const owner of [request.clone(), request, response.clone(), response]) {
    const received = await owner.formData();
    expect(received).toBeInstanceOf(FormData);
    expect(received.getAll('tag')).toEqual(['first', 'second']);
    const file = received.get('file');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('binary.dat');
    expect(file.type).toBe('application/octet-stream');
    expect(await readDomFile(globalThis, file)).toEqual([0, 128, 255]);
  }
  for (const owner of [new Request('http://localhost', { method: 'POST', body: new URLSearchParams('tag=first&tag=second') }),
    new Response(new URLSearchParams('tag=first&tag=second'))]) {
    for (const body of [owner.clone(), owner]) {
      const received = await body.formData();
      expect(received).toBeInstanceOf(FormData);
      expect(received.getAll('tag')).toEqual(['first', 'second']);
    }
  }
});

test('should resolve relative request and fetch URLs when the document URL changes', async () => {
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/x-www-form-urlencoded');
    response.end(new URLSearchParams({ path: request.url }).toString());
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const previousUrl = window.location.href;
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    jsdom.reconfigure({ url: `${origin}/nested/page` });
    expect(new Request('/api').url).toBe(`${origin}/api`);
    expect(new Request('../api').url).toBe(`${origin}/api`);
    expect(new Request(new URL(`${origin}/absolute`)).url).toBe(`${origin}/absolute`);
    const existing = new Request('/original', { method: 'POST', body: 'request body' });
    expect(await new Request(existing).text()).toBe('request body');
    const response = await fetch('../api?tag=1');
    expect(response.body).toBeInstanceOf(ReadableStream);
    const received = await response.formData();
    expect(received).toBeInstanceOf(FormData);
    expect(received.get('path')).toBe('/api?tag=1');
    history.replaceState(null, '', '/changed/page');
    expect(new Request('next').url).toBe(`${origin}/changed/next`);
    expect((await (await fetch('next')).formData()).get('path')).toBe('/changed/next');
    const base = document.createElement('base');
    base.href = '/assets/';
    document.head.append(base);
    try {
      expect(new Request('next').url).toBe(`${origin}/assets/next`);
      base.href = '/other/';
      expect(new Request('next').url).toBe(`${origin}/other/next`);
    } finally { base.remove(); }
    await expect(fetch()).rejects.toThrow('a URL or Request argument is required');
  } finally {
    jsdom.reconfigure({ url: previousUrl });
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('should remove a DOM listener when a native AbortController aborts', () => {
  const button = document.createElement('button');
  const controller = new AbortController();
  let clicks = 0;
  button.addEventListener('click', () => clicks++, { signal: controller.signal });
  button.click();
  controller.abort();
  button.click();
  expect(clicks).toBe(1);
});

test('should preserve DOM FileReader while accepting Blob responses and clones', async () => {
  const file = new File(['file body'], 'body.txt', { type: 'text/plain' });
  const reader = new FileReader();
  const loaded = new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
  reader.readAsText(file);
  expect(await loaded).toBe('file body');
  const response = new Response(file);
  expect(await response.clone().text()).toBe('file body');
  expect(await response.text()).toBe('file body');
});

test('should retain body consumption and malformed multipart errors', async () => {
  const body = new FormData();
  body.append('field', 'value');
  const request = new Request('http://localhost', { method: 'POST', body });
  expect((await request.clone().formData()).get('field')).toBe('value');
  expect((await request.formData()).get('field')).toBe('value');
  await expect(request.formData()).rejects.toThrow(TypeError);
  const malformed = new Response('invalid', { headers: { 'content-type': 'multipart/form-data; boundary=example' } });
  await expect(malformed.formData()).rejects.toThrow(TypeError);
});

test('should preserve a host stream TypeError when native bodies fail in the current worker realm', async () => {
  const failure = runInThisContext('new TypeError("Body is unusable: Body has already been read")');
  for (const contentType of ['application/x-www-form-urlencoded', 'multipart/form-data; boundary=worker']) {
    for (const Constructor of [Request, Response]) {
      const stream = new ReadableStream({ start(controller) { controller.error(failure); } });
      const headers = { 'content-type': contentType };
      const owner = Constructor === Request
        ? new Constructor('/upload', { method: 'POST', body: stream, duplex: 'half', headers })
        : new Constructor(stream, { headers });
      await expect(owner.formData()).rejects.toBe(failure);
    }
  }
});

test('should use captured form intrinsics when globals disappear during a pending body read', async () => {
  const window = jsdom.window;
  const OriginalFormData = window.FormData;
  const OriginalFile = window.File;
  const descriptors = { FormData: Object.getOwnPropertyDescriptor(window, 'FormData'), File: Object.getOwnPropertyDescriptor(window, 'File') };
  const form = new OriginalFormData();
  form.append('file', new OriginalFile(['content'], 'content.txt', { type: 'text/plain' }));
  const encoded = new Response(form);
  const bytes = new Uint8Array(await encoded.arrayBuffer());
  let controller;
  const stream = new ReadableStream({ start(createdController) { controller = createdController; } });
  const pending = new Response(stream, { headers: encoded.headers }).formData();
  try {
    delete window.FormData;
    delete window.File;
    controller.enqueue(bytes);
    controller.close();
    const received = await pending;
    expect(received.constructor).toBe(OriginalFormData);
    expect(received.get('file').constructor).toBe(OriginalFile);
    expect(await readDomFile(globalThis, received.get('file'))).toEqual([...new TextEncoder().encode('content')]);
  } finally { Object.defineProperties(window, descriptors); }
});

test('should create intrinsic body errors when the current worker TypeError global is changed', async () => {
  const OriginalTypeError = TypeError;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'TypeError');
  for (const mutation of ['replace', 'delete']) {
    const owner = new Response('invalid', { headers: { 'content-type': 'text/plain' } });
    let failure;
    try {
      if (mutation === 'replace') globalThis.TypeError = class ReplacementTypeError extends Error {};
      else delete globalThis.TypeError;
      try { await owner.formData(); } catch (error) { failure = error; }
    } finally { Object.defineProperty(globalThis, 'TypeError', descriptor); }
    expect(failure.constructor).toBe(OriginalTypeError);
  }
});

test('should ignore mutable append and body properties when decoding in the current worker', async () => {
  const originalAppend = FormData.prototype.append;
  const owner = new Response('field=value', { headers: { 'content-type': 'text/plain, application/x-www-form-urlencoded' } });
  Object.defineProperty(owner, 'bodyUsed', { get() { throw new Error('shadow bodyUsed must not run'); } });
  let form;
  try {
    FormData.prototype.append = () => { throw new Error('DOM append override must not run'); };
    form = await owner.formData();
  } finally { FormData.prototype.append = originalAppend; }
  expect(form.get('field')).toBe('value');
});
